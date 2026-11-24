import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone

import boto3

from src.tools.oneloan_tools import GetLoanTool, PatchOneLoanTool


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
AUDIT_TABLE_NAME_ENV = "TITLE_COMPANY_UPDATE_AUDIT_TABLE_NAME"


def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)


def _write_audit_record(
    table_name: str,
    *,
    loan_number: str,
    loan_guid: str,
    loan_company: str,
    loan_type: str | None,
    patch_succeeded: bool,
    audit_log: str,
) -> int:
    audit_id = time.time_ns()
    audit_seconds, audit_nanoseconds = divmod(audit_id, 1_000_000_000)
    date_updated = datetime.fromtimestamp(audit_seconds, timezone.utc).replace(
        microsecond=audit_nanoseconds // 1_000,
    ).isoformat()
    table = boto3.resource("dynamodb").Table(table_name)
    table.put_item(Item={
        "id": audit_id,
        "date_updated": date_updated,
        "loan_number": loan_number,
        "loan_guid": loan_guid,
        "loan_company": loan_company,
        "loan_type": loan_type,
        "patch_succeeded": patch_succeeded,
        "audit_log": audit_log,
    })
    return audit_id


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))


async def _handler(event: dict, context) -> dict:
    logger.info("Raw event: %s", json.dumps(event))
    audit_lines: list[str] = []

    try:
        secret_name = os.getenv(
            "AWS_SECRET_NAME",
            "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev",
        )
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    for key, value in secrets.items():
        os.environ[key] = value

    loan_number = event.get("detail", {}).get("identity", {}).get("loanNumber")
    encompass_guid = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}
    if not encompass_guid:
        logger.error("Encompass GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass GUID is required in the event payload."})}

    _log(
        audit_lines,
        logging.INFO,
        "Received milestone-changed event for loan number %s with company code %s",
        loan_number,
        company_code,
    )

    try:
        loan_response_raw = await GetLoanTool().execute({
            "loan_identifier": encompass_guid,
            "company": company_code,
            "requestedProperties": ["MS.STATUS", "1401"],
        })
        loan_response = json.loads(loan_response_raw)
        if not loan_response.get("success"):
            raise RuntimeError(f"GetLoanTool call failed: {loan_response}")

        loan_type = loan_response.get("data", {}).get("1401")
        milestone = loan_response.get("data", {}).get("MS.STATUS")
        _log(audit_lines, logging.INFO, "Loan type (field 1401) for loan %s: %s", loan_number, loan_type)
        _log(audit_lines, logging.INFO, "Current milestone (field MS.STATUS) for loan %s: %s", loan_number, milestone)
    except Exception:
        logger.exception("Failed to fetch loan properties for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan properties"})}

    if os.getenv("ENVIRONMENT") == "prod":
        loan_type_text = str(loan_type or "")
        is_supported_program = (
            re.search(r"\b(?:CES|HELOAN)\b", loan_type_text, re.IGNORECASE)
            and "brokered" not in loan_type_text.casefold()
        )
        if not is_supported_program:
            _log(audit_lines, logging.INFO, "Skipping event for loan %s with unsupported loan type: %s", loan_number, loan_type)
            return {"statusCode": 200, "body": json.dumps({"message": "Unsupported product; event ignored"})}

        if milestone != "Assigned to UW":
            _log(audit_lines, logging.INFO, "Skipping event for loan %s with milestone: %s", loan_number, milestone)
            return {"statusCode": 200, "body": json.dumps({"message": "Milestone not yet reached; event ignored"})}

        _log(audit_lines, logging.INFO, "Loan passed preliminary eligibility checks")
    else:
        _log(audit_lines, logging.INFO, "Preliminary eligibility checks bypassed outside prod")

    _log(audit_lines, logging.INFO, "Patching title company fields for loan %s", loan_number)
    patch_succeeded = False
    try:
        patch_response_raw = await PatchOneLoanTool().execute({
            "loan_guid": encompass_guid,
            "company": company_code,
            "fields": [
                {"fieldId": "411", "value": ""},
                {"fieldId": "CX.APPROVEDTITLECOMPANY", "value": "OTHER"},
            ],
        })
        patch_response = json.loads(patch_response_raw)
        if not patch_response.get("success"):
            raise RuntimeError(f"PatchOneLoanTool call failed: {patch_response}")
        patch_succeeded = True
    except Exception:
        logger.exception("Failed to patch title company fields for loan %s", loan_number)
        _log(audit_lines, logging.ERROR, "Failed to patch title company fields for loan %s", loan_number)
    else:
        _log(audit_lines, logging.INFO, "Patched title company fields for loan %s", loan_number)

    audit_table_name = os.getenv(AUDIT_TABLE_NAME_ENV)
    if not audit_table_name:
        logger.error("%s environment variable is not set; refusing to process without an audit trail.", AUDIT_TABLE_NAME_ENV)
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    try:
        audit_id = _write_audit_record(
            audit_table_name,
            loan_number=loan_number,
            loan_guid=encompass_guid,
            loan_company=company_code,
            loan_type=loan_type,
            patch_succeeded=patch_succeeded,
            audit_log="\n".join(audit_lines),
        )
    except Exception:
        logger.exception("Failed to write title-company update audit record for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to write audit record"})}

    if not patch_succeeded:
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to patch title company fields", "audit_id": audit_id})}

    return {"statusCode": 200, "body": json.dumps({"message": "Title company fields patched", "audit_id": audit_id})}