import asyncio
import uuid
import time
import boto3
import requests
import os
import logging
import json
from datetime import datetime, timezone, timedelta
from src.tools.ecs_tools import GetECSCreditTool
from src.tools.oneloan_tools import PatchOneLoanTool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

COMPANY_EID_TO_ALIAS = {
    1: "gri",
    2: "gra",
    3: "prate",
    4: "strn",
    5: "owning",
    6: "gatelessinc",
    7: "sofi",
    8: "op",
    9: "grins",
    10: "grrav",
    11: "tdl",
    12: "bkco",
    13: "cer",
    14: "citywide",
    15: "chl",
    16: "gib",
    17: "hma",
    18: "kbhs",
    19: "premia",
    20: "resu",
    21: "shold",
    22: "fpf",
    23: "sventu",
    24: "gp",
    25: "pma",
    26: "wl",
    27: "atg",
    28: "certainty",
    30: "cwhm",
    31: "qhl",
}
COMPANY_ALIAS_TO_EID = {v: k for k, v in COMPANY_EID_TO_ALIAS.items()}


def _append_resolved_fields(loan_number: str, resolved: list):
    """Append newly resolved fields to the loan's cumulative resolved list."""
    if not resolved:
        return
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(
        os.getenv("RESOLVED_FIELDS_TABLE_NAME", "mcp-1003-resolved-fields-dev")
    )
    table.update_item(
        Key={"loan_number": loan_number},
        UpdateExpression="SET resolved_fields = list_append(if_not_exists(resolved_fields, :empty), :new_fields), last_updated = :ts",
        ExpressionAttributeValues={
            ":new_fields": resolved,
            ":empty": [],
            ":ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    logger.info("Appended %d resolved field(s) for loan %s", len(resolved), loan_number)


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def _write_loan_scheduling_record(loan_number: str, loan_guid: str, company_code: str):
    """Write initial record on first run; no-op if loan already exists."""
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(
        os.getenv("SCHEDULING_TABLE_NAME", "mcp-1003-scheduling-dev")
    )
    try:
        table.put_item(
            Item={
                "loan_number": loan_number,
                "loan_guid": loan_guid,
                "company_code": company_code,
                "first_run_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "run_count": 1,
                "last_status": "in_progress",
            },
            ConditionExpression="attribute_not_exists(loan_number)"
        )
    except boto3.resource("dynamodb", region_name="us-east-1").meta.client.exceptions.ConditionalCheckFailedException:
        pass


def _get_loan_scheduling_record(loan_number: str) -> dict:
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(
        os.getenv("SCHEDULING_TABLE_NAME", "mcp-1003-scheduling-dev")
    )
    return table.get_item(Key={"loan_number": loan_number}).get("Item", {})


def _update_loan_scheduling_record(loan_number: str, run_count: int, last_status: str, next_run_at: str = None):
    table = boto3.resource("dynamodb", region_name="us-east-1").Table(
        os.getenv("SCHEDULING_TABLE_NAME", "mcp-1003-scheduling-dev")
    )
    update_expr = "SET run_count = :rc, last_status = :ls"
    attr_values = {":rc": run_count, ":ls": last_status}
    if next_run_at is not None:
        update_expr += ", next_run_at = :nra"
        attr_values[":nra"] = next_run_at
    table.update_item(
        Key={"loan_number": loan_number},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=attr_values
    )


def lambda_handler(event, context):
    return asyncio.run(_handler(event, context))


async def _handler(event, context):
    logger.info("Received event: %s", json.dumps(event))
    # Cron events from EventBridge Rules have a "source" of "aws.events" and no loan detail
    if event.get("source") == "aws.events" and not event.get("detail", {}).get("loanNumber"):
        return await _handle_cron(event, context)
    detail = event.get("detail", {})
    if detail.get("eventName") == "ExtractionCompleted":
        return await _handle_extraction_completed(event, context)
    return await _handle_loan_event(event, context)


async def _handle_loan_event(event, context):
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    # Load secrets into environment variables
    for key, value in secrets.items():
        os.environ[key] = value

    # Extract loan number and company code from the event payload
    loan_number = event.get("detail", {}).get("identity", {}).get("loanNumber")
    loan_guid = event.get("detail", {}).get("identity", {}).get("grLoanGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not loan_guid:
        logger.error("Loan GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan GUID is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}

    _write_loan_scheduling_record(loan_number, loan_guid, company_code)
    logger.info("Received ___ event for loan number: %s w/ company code: %s", loan_number, company_code)

    # Send to the Prajna 1003 agent API
    logger.info("Sending info to Prajna 1003 agent API for loan %s", loan_number)
    prajna_domain = os.getenv("PRAJNA_1003_DOMAIN")
    if not prajna_domain:
        logger.error("Prajna 1003 agent domain not configured. Please set the PRAJNA_1003_DOMAIN environment variable.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
    url = f"{prajna_domain}"
    headers = {
        "x-api-key": os.getenv("PRAJNA_ACCESS_TOKEN")
    }
    body = {
        "loan_number": loan_number,
        "company": company_code
    }

    try:
        prajna_response = requests.post(url, headers=headers, json=body)
        prajna_response.raise_for_status()

    except requests.RequestException as e:
        logger.error("Failed to send info to Prajna 1003 agent API: %s", e)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to communicate with Prajna 1003 agent API"})}

    response_data = prajna_response.json()
    logger.info("Prajna 1003 agent response for loan %s: %s", loan_number, json.dumps(response_data))
    credit_report_fields = []
    actionable_fields = []
    for f in response_data.get("missing_required_fields", []):
        doc_type = f.get("extraction_doc_type")
        if doc_type == "Credit Report":
            credit_report_fields.append(f)
        elif doc_type is not None:
            actionable_fields.append(f)
    logger.info("Actionable missing fields for loan %s: %s", loan_number, json.dumps(actionable_fields))

    # If there are credit report missing fields, invoke the ECS credit tool
    logger.info("Credit report missing fields for loan %s: %s", loan_number, json.dumps(credit_report_fields))
    if credit_report_fields:
        try:
            raw = await GetECSCreditTool().execute({"loan_number": loan_number})
            ecs_response = json.loads(raw)

        except Exception as e:
            logger.error("Failed to invoke ECS credit tool for loan %s: %s", loan_number, e)

        logger.info("ECS credit tool response for loan %s: %s", loan_number, json.dumps(ecs_response))
        # Process response - TODO


    # Send actionable missing fields to document extraction API
    if actionable_fields:
        doc_extraction_domain = os.getenv("DOC_EXTRACTION_1003_DOMAIN")
        if not doc_extraction_domain:
            logger.error("Document extraction API domain not configured. Please set the DOC_EXTRACTION_1003_DOMAIN environment variable.")
            return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
        url = f"{doc_extraction_domain}"
        headers = {
            "x-api-key": os.getenv("DOC_EXTRACTION_1003_ACCESS_TOKEN")
        }
        requestId = str(uuid.uuid4())
        body = {
            "companyId": company_code,
            "entityId": COMPANY_ALIAS_TO_EID.get(company_code.lower()),
            "loanGuid": loan_guid,
            "loanNumber": loan_number,
            "requestId": requestId,
            "required_field_check": {
                "missing": actionable_fields
            }
        }

        try:
            doc_extraction_response = requests.post(url, headers=headers, json=body)
            doc_extraction_response.raise_for_status()

        except requests.RequestException as e:
            logger.error("Failed to send actionable missing fields to document extraction API for loan %s: %s", loan_number, e)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to communicate with document extraction API"})}

        doc_extraction_response = doc_extraction_response.json()
        if doc_extraction_response.get("status") == "accepted":
            logger.info("Document extraction API accepted the request for loan %s", loan_number)

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Successfully sent info to Prajna 1003 agent API"})
    }


async def _handle_extraction_completed(event, context):
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    for key, value in secrets.items():
        os.environ[key] = value

    detail = event.get("detail", {})
    event_data = detail.get("eventData", {})
    loan_number = detail.get("identity", {}).get("loanNumber")
    loan_guid = detail.get("identity", {}).get("grLoanGUID")
    company = detail.get("company", {}).get("code")
    request_id = event_data.get("requestId")
    status = event_data.get("status")

    logger.info("ExtractionCompleted for loan %s requestId %s status %s", loan_number, request_id, status)

    resolved = event_data.get("resolved", [])
    unresolved = event_data.get("unresolved", [])

    logger.info("Resolved fields for loan %s: %s", loan_number, json.dumps(resolved))
    logger.info("Unresolved fields for loan %s: %s", loan_number, json.dumps(unresolved))

    if resolved:
        _append_resolved_fields(loan_number, resolved)

    # Route on status and schedule retries if partial
    record = _get_loan_scheduling_record(loan_number)
    run_count = int(record.get("run_count", 1))
    first_run_str = record.get("first_run_at", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    first_run_dt = datetime.strptime(first_run_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)

    if status == "complete":
        logger.info("Extraction complete for loan %s — all fields resolved", loan_number)
        _update_loan_scheduling_record(loan_number, run_count, "complete")
    elif status == "partial":
        if run_count == 1:
            next_run_at = (first_run_dt + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
            _update_loan_scheduling_record(loan_number, run_count, "partial", next_run_at)
            logger.info("Loan %s partial — run 2 scheduled at %s", loan_number, next_run_at)
        elif run_count == 2:
            next_run_at = (first_run_dt + timedelta(weeks=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            _update_loan_scheduling_record(loan_number, run_count, "partial", next_run_at)
            logger.info("Loan %s partial — run 3 scheduled at %s", loan_number, next_run_at)
        elif run_count >= 3:
            logger.info("Final run for loan %s still partial — no further runs scheduled", loan_number)
            _update_loan_scheduling_record(loan_number, run_count, "final_partial")

    # Write missing field value(s) to OneLoan
    patch_fields = [
        {
            "fieldId": field.get("field"),
            "value": field.get("value"),
        }
        for field in resolved
    ]

    if patch_fields:
        try:
            patch_response = await PatchOneLoanTool().execute({
                "loan_guid": loan_guid,
                "company": company,
                "fields": patch_fields,
            })
            patch_result = json.loads(patch_response)

            if not patch_result.get("success"):
                logger.error("OneLoan patch failed for loan %s: %s", loan_number, patch_result.get("error"))
                return {
                    "statusCode": 500,
                    "body": json.dumps({"error": "Failed to patch OneLoan"}),
                }

        except Exception as error:
            logger.error("Failed to patch OneLoan for loan %s: %s", loan_number, error)
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Failed to patch OneLoan"}),
            }

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "ExtractionCompleted processed",
            "requestId": request_id,
        }),
    }


async def _handle_cron(event, context):
    """Runs every hour; finds loans due for a retry and re-runs them."""
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    for key, value in secrets.items():
        os.environ[key] = value

    table = boto3.resource("dynamodb", region_name="us-east-1").Table(
        os.getenv("SCHEDULING_TABLE_NAME", "mcp-1003-scheduling-dev")
    )
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    # Scan for partial loans whose next_run_at has passed
    result = table.scan(
        FilterExpression="last_status = :s AND next_run_at <= :now",
        ExpressionAttributeValues={":s": "partial", ":now": now_str}
    )
    due_loans = result.get("Items", [])
    logger.info("Cron: %d loan(s) due for retry", len(due_loans))

    for record in due_loans:
        loan_number = record["loan_number"]
        new_run_count = int(record.get("run_count", 1)) + 1
        logger.info("Cron: starting run %d for loan %s", new_run_count, loan_number)
        _update_loan_scheduling_record(loan_number, new_run_count, "in_progress")
        synthetic_event = {
            "detail": {
                "identity": {
                    "loanNumber": loan_number,
                    "grLoanGUID": record.get("loan_guid")
                },
                "company": {"code": record.get("company_code")}
            }
        }
        await _handle_loan_event(synthetic_event, context)

    return {"statusCode": 200, "body": json.dumps({"message": f"Processed {len(due_loans)} loan(s)"})}