import logging
import os
import asyncio
import html
import json
import boto3
import base64

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from boto3.dynamodb.conditions import Key
from src.tools.email_tools import SendEmailTool

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


PARTITION_KEY = "Encompass User ID"
COUNT_ATTR = "Assigned Today Count"
AUDIT_TABLE_NAME_ENV = "ASSIGNMENT_AUDIT_TABLE_NAME"
AUDIT_DATE_INDEX_NAME = "assignment_date-created_at-index"
DIGEST_RECIPIENTS_ENV = "PIPELINE_ASSIGNMENT_DIGEST_RECIPIENTS"
PDF_BUCKET_NAME_ENV = "ASSIGNMENT_PDF_BUCKET_NAME"
FIRST_REVIEW_AUDIT_TABLE_NAME_ENV = "FIRST_REVIEW_AUDIT_TABLE_NAME"
FIRST_REVIEW_PDF_BUCKET_NAME_ENV = "FIRST_REVIEW_PDF_BUCKET_NAME"
AUTO_DECLINED_NO_ASSIGNMENT_REASON_CODE = "AUTO_DECLINED_NO_ASSIGNMENT"
CHICAGO = ZoneInfo("America/Chicago")

ROSTER_TABLE_ENV_VARS = (
    ("UW", "HELOAN_UW_ROSTER_TABLE_NAME", "heloan_uw_roster"),
    ("Processor", "HELOAN_PROCESSOR_ROSTER_TABLE_NAME", "heloan_processor_roster"),
    ("CC", "HELOAN_CC_ROSTER_TABLE_NAME", "heloan_cc_roster"),
)


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

def _reset_roster_table(table) -> tuple[int, int]:
    reset_count = 0
    skipped_count = 0
    scan_kwargs = {
        "ProjectionExpression": "#pk, #count",
        "ExpressionAttributeNames": {
            "#pk": PARTITION_KEY,
            "#count": COUNT_ATTR,
        },
    }

    while True:
        response = table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            key_value = item.get(PARTITION_KEY)
            if not key_value:
                skipped_count += 1
                logger.warning("Skipping row with no %s: %r", PARTITION_KEY, item)
                continue

            if item.get(COUNT_ATTR) == 0:
                continue

            try:
                table.update_item(
                    Key={PARTITION_KEY: key_value},
                    UpdateExpression="SET #count = :zero",
                    ConditionExpression="attribute_exists(#pk)",
                    ExpressionAttributeNames={"#pk": PARTITION_KEY, "#count": COUNT_ATTR},
                    ExpressionAttributeValues={":zero": 0},
                )
                reset_count += 1
            except table.meta.client.exceptions.ConditionalCheckFailedException:
                logger.info("Row %r no longer exists; not recreating it", key_value)

        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return reset_count, skipped_count



def _closing_bucket_date() -> str:
    return (datetime.now(CHICAGO).date() - timedelta(days=1)).isoformat()

def _query_todays_audit_rows(audit_table, bucket_date: str) -> list:
    items = []
    query_kwargs = {
        "IndexName": AUDIT_DATE_INDEX_NAME,
        "KeyConditionExpression": Key("assignment_date").eq(bucket_date),
    }
    while True:
        response = audit_table.query(**query_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return items

def _query_first_reviews(review_table, bucket_date: str, assignment_ids: set) -> dict:
    reviews = {}
    # Include legacy reviews written using their execution date rather than the inherited reporting date.
    date = datetime.strptime(bucket_date, "%Y-%m-%d").date() - timedelta(days=1)
    end_date = datetime.now(CHICAGO).date()
    while date <= end_date:
        query_kwargs = {
            "IndexName": "audit_date-created_at-index",
            "KeyConditionExpression": Key("audit_date").eq(date.isoformat()),
        }
        while True:
            response = review_table.query(**query_kwargs)
            for review in response.get("Items", []):
                assignment_id = review.get("assignment_audit_id")
                if assignment_id not in assignment_ids:
                    continue
                previous = reviews.get(assignment_id)
                if previous is None or (review["created_at"], review["id"]) > (previous["created_at"], previous["id"]):
                    reviews[assignment_id] = review
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            query_kwargs["ExclusiveStartKey"] = last_key
        date += timedelta(days=1)
    return reviews

def _render_role_cell(name: str | None, uw_id, reason_code: str | None) -> str:
    """Build an assigned-role cell for the daily digest."""
    if reason_code == AUTO_DECLINED_NO_ASSIGNMENT_REASON_CODE:
        return "Auto declined, skipped assignment"
    if reason_code == "SKIPPED_BY_REQUEST":
        return "Skipped by request"
    if reason_code == "ALREADY_ASSIGNED":
        return "Already Assigned"
    if reason_code and reason_code not in ("DAILY_CAP_EXCEEDED_FALLBACK", "ASSIGNED_FROM_RESUBMISSION_POOL"):
        return f"Failed due to {html.escape(reason_code)}"

    cell = f"{html.escape(name or '')} ({html.escape(str(uw_id or ''))})"
    if reason_code == "DAILY_CAP_EXCEEDED_FALLBACK":
        cell += ", using fallback pool"
    elif reason_code == "ASSIGNED_FROM_RESUBMISSION_POOL":
        cell += ", using resubmission pool"
    return cell


def _render_table_row(item: dict, review: dict | None = None) -> str:
    loan_number = html.escape(str(item.get("loan_number", "")))
    company = html.escape(str(item.get("loan_company", "")))

    uw_column = _render_role_cell(
        item.get("assigned_uw_name"), item.get("assigned_uw_id"), item.get("reason_code_uw"),
    )

    processor_column = _render_role_cell(
        item.get("assigned_processor_name"), item.get("assigned_processor_id"), item.get("reason_code_processor"),
    )
    cc_column = _render_role_cell(
        item.get("assigned_cc_name"), item.get("assigned_cc_id"), item.get("reason_code_cc"),
    )

    cells = [loan_number, company, uw_column, processor_column, cc_column]
    for field in ("disclosures_status", "hard_credit_status", "dti_status"):
        cells.append(html.escape(str(review.get(field) or "UNKNOWN")) if review is not None else "No review recorded")
    cells.append("Yes" if review is not None and review.get("milestone_move_eligible") is True else "No")
    tds = "".join(f"<td style=\"padding:8px;border:1px solid #dddddd;white-space:nowrap;\">{c}</td>" for c in cells)
    return f"<tr>{tds}</tr>"

def _render_email_body(items: list, bucket_date: str, reviews: dict) -> str:
    template_path = os.path.join(os.path.dirname(__file__), "email_template.html")
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    rows = "\n".join(_render_table_row(item, reviews.get(item["id"])) for item in items)
    report_date = datetime.strptime(bucket_date, "%Y-%m-%d").strftime("%B %d, %Y")

    return (
        template
        .replace("{{REPORT_DATE}}", report_date)
        .replace("{{LOAN_COUNT}}", str(len(items)))
        .replace("{{LOAN_ROWS}}", rows)
    )

async def _send_daily_digest(dynamodb) -> dict:
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager; skipping digest email")
        return {"digestEmailSent": False}

    for key, value in secrets.items():
        os.environ[key] = value

    audit_table_name = os.getenv(AUDIT_TABLE_NAME_ENV)
    pdf_bucket_name = os.getenv(PDF_BUCKET_NAME_ENV)
    review_table_name = os.getenv(FIRST_REVIEW_AUDIT_TABLE_NAME_ENV)
    review_pdf_bucket_name = os.getenv(FIRST_REVIEW_PDF_BUCKET_NAME_ENV)
    recipients = [addr.strip() for addr in os.getenv(DIGEST_RECIPIENTS_ENV, "").split(",") if addr.strip()]
    if not audit_table_name:
        logger.error("%s environment variable is not set; skipping digest email", AUDIT_TABLE_NAME_ENV)
        return {"digestEmailSent": False}
    if not pdf_bucket_name:
        logger.error("%s environment variable is not set; skipping digest email", PDF_BUCKET_NAME_ENV)
        return {"digestEmailSent": False}
    if not recipients:
        logger.error("%s environment variable is not set; skipping digest email", DIGEST_RECIPIENTS_ENV)
        return {"digestEmailSent": False}
    for env_var, value in (
        (FIRST_REVIEW_AUDIT_TABLE_NAME_ENV, review_table_name),
        (FIRST_REVIEW_PDF_BUCKET_NAME_ENV, review_pdf_bucket_name),
    ):
        if not value:
            logger.error("%s environment variable is not set; skipping digest email", env_var)
            return {"digestEmailSent": False}

    audit_table = dynamodb.Table(audit_table_name)
    bucket_date = _closing_bucket_date()

    try:
        items = _query_todays_audit_rows(audit_table, bucket_date)
    except Exception:
        logger.exception("Failed to query %s for bucket %s", audit_table_name, bucket_date)
        return {"digestEmailSent": False}

    if not items:
        logger.info("No pipeline-assignment activity for %s; skipping digest email", bucket_date)
        return {"digestEmailSent": False}

    try:
        reviews = _query_first_reviews(
            dynamodb.Table(review_table_name), bucket_date, {item["id"] for item in items},
        )
    except Exception:
        logger.exception("Failed to query first reviews from %s; skipping combined digest", review_table_name)
        return {"digestEmailSent": False}

    s3 = boto3.client("s3")
    attachments = []
    for item in items:
        review = reviews.get(item["id"])
        reports = [(item, pdf_bucket_name, "HELOAN Pipeline Assignment Report")]
        if review is None:
            logger.warning("No first review recorded for assignment %s, loan %s", item["id"], item.get("loan_number"))
        else:
            reports.append((review, review_pdf_bucket_name, "HELOAN First Review"))
        for report, bucket_name, topic in reports:
            pdf_s3_key = report.get("pdf_s3_key")
            if not pdf_s3_key:
                logger.warning("No pdf_s3_key for %s, loan %s; sending digest without this PDF", topic, item.get("loan_number"))
                continue
            try:
                obj = s3.get_object(Bucket=bucket_name, Key=pdf_s3_key)
                pdf_bytes = obj["Body"].read()
            except Exception:
                logger.exception("Failed to fetch %s PDF for loan %s", topic, item.get("loan_number"))
                continue
            attachments.append({
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "encoding": "base64",
                "contentType": "application/pdf",
                "filename": f"{item.get('loan_number', 'unknown')} {topic}.pdf",
            })

    body = _render_email_body(items, bucket_date, reviews)
    send_result_raw = await SendEmailTool().execute({
        "body": body,
        "to": [{"address": address} for address in recipients],
        "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
        "subject": f"HELOAN Daily Pipeline Assignment & First Review Digest — {len(items)} loan(s)",
        "attachments": attachments,
    })
    send_result = json.loads(send_result_raw)
    if not send_result.get("success"):
        logger.error("Failed to send HELOAN pipeline assignment and first-review digest email: %s", send_result)
        return {"digestEmailSent": False}

    logger.info("Sent HELOAN pipeline assignment and first-review digest email for %d loan(s)", len(items))
    return {"digestEmailSent": True, "digestLoanCount": len(items)}


def lambda_handler(event, context):
    return asyncio.run(_handler(event, context))


async def _handler(event, context) -> dict:
    dynamodb = boto3.resource("dynamodb")

    reset_count = 0
    skipped_count = 0
    for label, env_var, default_name in ROSTER_TABLE_ENV_VARS:
        table_name = os.getenv(env_var, default_name)
        table = dynamodb.Table(table_name)
        table_reset_count, table_skipped_count = _reset_roster_table(table)
        reset_count += table_reset_count
        skipped_count += table_skipped_count
        logger.info(
            "heloan_uw_roster_reset_daily: %s roster %r -- reset %d row(s), skipped %d row(s) with no %s",
            label, table_name, table_reset_count, table_skipped_count, PARTITION_KEY,
        )

    digest_result = await _send_daily_digest(dynamodb)

    return {
        "statusCode": 200,
        "resetCount": reset_count,
        "skippedCount": skipped_count,
        **digest_result,
    }