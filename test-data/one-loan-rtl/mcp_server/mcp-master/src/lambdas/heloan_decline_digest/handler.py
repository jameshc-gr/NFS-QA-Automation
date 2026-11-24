import asyncio
import base64
import html
import json
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import boto3

from src.tools.email_tools import SendEmailTool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_REGION = "us-east-1"


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def _scan_all_items(table) -> list:
    items = []
    kwargs = {}
    while True:
        response = table.scan(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return items


def _render_email_body(items: list, template_name: str, include_decline_reason: bool) -> str:
    template_path = os.path.join(os.path.dirname(__file__), template_name)
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    rows = "\n".join(
        "<tr>"
        f"<td style=\"padding:8px;border:1px solid #dddddd;\">{html.escape(str(item.get('loan_number', '')))}</td>"
        f"<td style=\"padding:8px;border:1px solid #dddddd;\">{html.escape(str(item.get('company', '')))}</td>"
        + (
            f"<td style=\"padding:8px;border:1px solid #dddddd;\">{html.escape(str(item.get('decline_reason', '') or 'N/A'))}</td>"
            if include_decline_reason else ""
        )
        + "</tr>"
        for item in items
    )

    return (
        template
        .replace("{{REPORT_DATE}}", datetime.now(timezone.utc).strftime("%B %d, %Y"))
        .replace("{{LOAN_COUNT}}", str(len(items)))
        .replace("{{LOAN_ROWS}}", rows)
    )


def lambda_handler(event: dict, context) -> dict:
    result = asyncio.run(_handler(event, context))
    if result.get("statusCode", 200) >= 400:
        logger.error("HELOAN_DECLINE_DIGEST_PROCESSING_FAILED status_code=%s", result["statusCode"])
    return result


def _is_digest_send_time(event: dict) -> bool:
    if event.get("force") is True:
        return True
    return datetime.now(ZoneInfo("America/New_York")).hour == 9


async def _handler(event: dict, context) -> dict:
    if not _is_digest_send_time(event):
        logger.info("Skipping HELOAN decline digest because it is not 9 AM ET")
        return {"statusCode": 200, "body": json.dumps({"message": "Not scheduled send time"})}

    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    for key, value in secrets.items():
        os.environ[key] = value

    table_name = os.getenv("DECLINE_QUEUE_TABLE_NAME")
    bucket_name = os.getenv("DECLINE_PDF_BUCKET_NAME")
    decline_recipients = [addr.strip() for addr in os.getenv("DECLINE_DIGEST_RECIPIENTS", "").split(",") if addr.strip()]
    pass_recipients = [addr.strip() for addr in os.getenv("PASS_DIGEST_RECIPIENTS", "").split(",") if addr.strip()]
    if not table_name or not bucket_name:
        logger.error("DECLINE_QUEUE_TABLE_NAME/DECLINE_PDF_BUCKET_NAME environment variables are not set.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
    if not decline_recipients or not pass_recipients:
        logger.error("DECLINE_DIGEST_RECIPIENTS/PASS_DIGEST_RECIPIENTS environment variables are not set.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    session = boto3.Session(region_name=TABLE_REGION)
    table = session.resource("dynamodb").Table(table_name)

    try:
        items = _scan_all_items(table)
    except Exception:
        logger.exception("Failed to scan HELOAN digest queue table")
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to read digest queue"})}

    if not items:
        logger.info("No HELOAN decisions queued; skipping digest emails")
        return {"statusCode": 200, "body": json.dumps({"message": "No decisions to report"})}

    s3 = session.client("s3")
    # Entries written before the pass digest existed carry no decision attribute.
    # NEEDS REVIEW loans ride along with PASS in the same digest/recipients.
    decline_items = [item for item in items if str(item.get("decision", "DECLINE")).upper() == "DECLINE"]
    pass_items = [item for item in items if str(item.get("decision", "DECLINE")).upper() != "DECLINE"]

    results = {}
    failures = []
    for decision, decision_items, recipients, template, include_reason in (
        ("DECLINE", decline_items, decline_recipients, "email_template.html", True),
        ("PASS", pass_items, pass_recipients, "pass_email_template.html", False),
    ):
        if not decision_items:
            continue
        sent = await _send_digest(
            s3, table, bucket_name, decision, decision_items, recipients, template, include_reason
        )
        if sent:
            results[decision.lower() + "_loan_count"] = len(decision_items)
        else:
            failures.append(decision)

    if failures:
        return {"statusCode": 500, "body": json.dumps({"error": f"Failed to send digest email(s): {', '.join(failures)}"})}

    return {"statusCode": 200, "body": json.dumps(results)}


async def _send_digest(s3, table, bucket_name: str, decision: str, items: list, recipients: list,
                       template_name: str, include_decline_reason: bool) -> bool:
    attachments = []
    for item in items:
        try:
            obj = s3.get_object(Bucket=bucket_name, Key=item["s3_key"])
            pdf_bytes = obj["Body"].read()
        except Exception:
            logger.exception("Failed to fetch decision PDF for loan %s", item.get("loan_number"))
            continue
        attachments.append({
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "encoding": "base64",
            "contentType": "application/pdf",
            "filename": f"{item.get('loan_number', 'unknown')} HELOAN Credit Decision Report.pdf",
        })

    body = _render_email_body(items, template_name, include_decline_reason)
    loan_numbers = ", ".join(str(item.get("loan_number", "")) for item in items)
    subject_label = "Decline" if decision == "DECLINE" else "Pass"

    send_result_raw = await SendEmailTool().execute({
        "body": body,
        "to": [{"address": address} for address in recipients],
        "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
        "subject": f"HELOAN Daily {subject_label} Digest — {len(items)} loan(s): {loan_numbers}",
        "attachments": attachments,
    })
    send_result = json.loads(send_result_raw)
    if not send_result.get("success"):
        logger.error("Failed to send HELOAN %s digest email: %s", decision, send_result)
        return False

    # Clear the queue now that the digest has been sent successfully.
    for item in items:
        try:
            s3.delete_object(Bucket=bucket_name, Key=item["s3_key"])
        except Exception:
            logger.exception("Failed to delete decision PDF for loan %s", item.get("loan_number"))
        try:
            table.delete_item(Key={"loan_number": item["loan_number"]})
        except Exception:
            logger.exception("Failed to delete digest queue entry for loan %s", item.get("loan_number"))

    logger.info("Sent HELOAN %s digest email for %d loan(s)", decision, len(items))
    return True
