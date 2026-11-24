"""Move eligible HELOAN loans to Assigned to UW and record the outcome.

Each milestone is attempted once per invocation and verified by the move tool
before proceeding. Input is a completed
loan-classification EventBridge event. Audit lookup uses the first match within
the last 24 hours; DynamoDB scan order does not imply the latest review.
If the matching review already records a completed move, skip loan processing.
"""

import asyncio
import base64
import html
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3
import requests
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from src.tools.base import BaseTool
from src.tools.email_tools import SendEmailTool
from src.tools.oneloan_tools import AssignOneLoanRoleTool, GetLoanTool, MoveOneLoanMilestoneTool


logger = logging.getLogger()
logger.setLevel(logging.INFO)
TRIGGER_MILESTONES = ("Sent to processing", "Processing")
COORDINATOR_FIELD = "LoanTeamMember.UserId.Underwriting_Coord"
AUDIT_TABLE_NAME_ENV = "FIRST_REVIEW_AUDIT_TABLE_NAME"
PDF_BUCKET_NAME_ENV = "FIRST_REVIEW_PDF_BUCKET_NAME"
NOTIFICATION_RECIPIENTS = ("Boyang.Zhao@rate.com", "Teresa.Melzer@rate.com")


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))


def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)


def _write_milestone_audit_log(
    table_name: str,
    review_id: int | Decimal,
    audit_lines: list[str],
    milestone_moved: bool = False,
) -> None:
    table = boto3.resource("dynamodb").Table(table_name)
    values = {":audit_log": "\n".join(audit_lines)}
    expression = "SET milestone_move_audit_log = :audit_log"
    if milestone_moved:
        expression += ", milestone_moved = :moved"
        values[":moved"] = True
    table.update_item(
        Key={"id": review_id},
        UpdateExpression=expression,
        ConditionExpression="attribute_exists(id)",
        ExpressionAttributeValues=values,
    )


async def _call_tool(tool: BaseTool, arguments: dict, audit_lines: list[str]) -> dict:
    try:
        response = json.loads(await tool.execute(arguments))
    except (ValueError, TypeError, RuntimeError, requests.RequestException):
        logger.exception("Tool %s failed", tool.name)
        _log(audit_lines, logging.ERROR, "%s failed; its outcome could not be confirmed", tool.name)
        return {"success": False}
    if not isinstance(response, dict):
        _log(audit_lines, logging.ERROR, "%s returned an invalid response", tool.name)
        return {"success": False}
    if response.get("success") is not True:
        _log(
            audit_lines, logging.ERROR, "%s failed: %s", tool.name,
            response.get("failure_reason") or response.get("error") or "Invalid tool result",
        )
    return response


async def _notify_milestone_outcome(
    loan_number: str, review: dict, moved: bool, failure_reason: str,
) -> None:
    if moved:
        subject = f"HELOAN Milestone Moved | Loan {loan_number}"
        message = f"Loan {loan_number}'s milestone was moved successfully to Assigned to UW."
    else:
        subject = f"HELOAN Milestone Move Not Confirmed | Loan {loan_number}"
        message = (
            f"Loan {loan_number} was eligible to move to Assigned to UW, but the move was not confirmed. "
            f"{failure_reason} Check the current milestone in OneLoan before retrying."
        )

    attachments = []
    bucket = os.getenv(PDF_BUCKET_NAME_ENV)
    key = review.get("pdf_s3_key")
    if bucket and isinstance(key, str) and key:
        try:
            s3 = boto3.client("s3", config=Config(connect_timeout=3, read_timeout=5, retries={"total_max_attempts": 1}))
            stream = s3.get_object(Bucket=bucket, Key=key)["Body"]
            try:
                pdf_bytes = stream.read()
            finally:
                stream.close()
            attachments.append({
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "encoding": "base64",
                "contentType": "application/pdf",
                "filename": f"{loan_number} HELOAN First Review.pdf",
            })
        except (BotoCoreError, ClientError, OSError):
            logger.exception("Could not retrieve first-review PDF for loan %s", loan_number)
    else:
        logger.warning("Missing first-review PDF key or bucket for loan %s", loan_number)
    if not attachments:
        message += " The first-review PDF was unavailable."

    result = await _call_tool(SendEmailTool(timeout=10), {
        # SendEmailTool unescapes the body once before sending to Mercury.
        "body": html.escape(f"<p>{html.escape(message)}</p>"),
        "to": [{"address": address} for address in NOTIFICATION_RECIPIENTS],
        "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
        "subject": subject,
        "attachments": attachments,
    }, [])
    if result.get("success") is True:
        logger.info("Sent milestone-move outcome email for loan %s", loan_number)
    else:
        logger.error("Milestone-move outcome email failed for loan %s", loan_number)


def _find_recent_first_review(table_name: str, loan_number: str) -> dict | None:
    table = boto3.resource("dynamodb").Table(table_name)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    scan_kwargs = {
        "FilterExpression": (
            Attr("loan_number").eq(loan_number)
            & Attr("created_at").between(cutoff.isoformat(), now.isoformat())
        ),
        "ConsistentRead": True,
    }
    while True:
        response = table.scan(**scan_kwargs)
        reviews = response.get("Items", [])
        if reviews:
            return reviews[0]
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return None
        scan_kwargs["ExclusiveStartKey"] = last_key


async def _handler(event: dict, context) -> dict:
    if not isinstance(event, dict):
        logger.error("Invalid milestone-movement event: expected an object")
        raise ValueError("Event must be an object")
    if event.get("source") != "nfs-ai.flowstate" or event.get("detail-type") != "Loan Classification":
        logger.error("Invalid milestone-movement event source or detail type")
        raise ValueError("Expected a Flowstate loan classification event")
    detail = event.get("detail")
    if not isinstance(detail, dict):
        logger.error("Invalid milestone-movement event detail")
        raise ValueError("Event detail must be an object")
    event_data = detail.get("eventData")
    if (
        detail.get("eventName") != "loan-classification-finished"
        or not isinstance(event_data, dict)
        or event_data.get("completed") is not True
    ):
        logger.error("Invalid or incomplete loan classification event")
        raise ValueError("Expected a completed loan classification event")

    identity = detail.get("identity")
    company = detail.get("company")
    if not isinstance(identity, dict) or not isinstance(company, dict):
        logger.error("Invalid identity or company in milestone-movement event")
        raise ValueError("Event identity and company must be objects")
    for container, field in (
        (identity, "loanNumber"),
        (identity, "encompassGUID"),
        (company, "code"),
    ):
        if not isinstance(container.get(field), str) or not container[field].strip():
            logger.error("Missing or invalid %s in milestone-movement event", field)
            raise ValueError(f"{field} is required as a nonempty string")
    loan_number = identity["loanNumber"].strip()
    encompass_guid = identity["encompassGUID"].strip()
    company_code = company["code"].strip()

    audit_lines: list[str] = []
    _log(audit_lines, logging.INFO, "Received milestone-movement event for loan %s with company %s", loan_number, company_code)
    table_name = os.environ.get(AUDIT_TABLE_NAME_ENV)
    if not table_name:
        _log(audit_lines, logging.ERROR, "%s environment variable is not set", AUDIT_TABLE_NAME_ENV)
        raise RuntimeError(f"{AUDIT_TABLE_NAME_ENV} environment variable is not set")

    review = _find_recent_first_review(table_name, loan_number)
    if review is None:
        _log(audit_lines, logging.INFO, "No first-review audit record found in the last 24 hours for loan %s; the milestone audit log cannot be saved", loan_number)
    else:
        _log(audit_lines, logging.INFO, "Found first-review audit %s for loan %s", review["id"], loan_number)

    notify = (
        review is not None
        and review.get("milestone_moved") is not True
        and review.get("milestone_move_eligible") is True
    )
    milestone_moved = False
    failure_reason = "An unexpected error occurred during milestone processing."
    try:
        result = await _process_loan(encompass_guid, loan_number, company_code, review, audit_lines)
        body = json.loads(result["body"])
        milestone_moved = body.get("milestone_moved") is True
        failure_reason = body.get("message") or failure_reason
        return result
    except Exception as exc:
        _log(audit_lines, logging.ERROR, "Milestone-movement processing failed: %s", type(exc).__name__)
        logger.exception("Milestone-movement processing failed for loan %s", loan_number)
        raise
    finally:
        if review is not None:
            try:
                _write_milestone_audit_log(table_name, review["id"], audit_lines, milestone_moved)
            except Exception:
                logger.exception("Failed to save milestone-movement audit log for loan %s", loan_number)
                raise
            finally:
                if notify:
                    await _notify_milestone_outcome(loan_number, review, milestone_moved, failure_reason)


async def _process_loan(
    encompass_guid: str,
    loan_number: str,
    company_code: str,
    review: dict | None,
    audit_lines: list[str],
) -> dict:
    if review is not None and review.get("milestone_moved") is True:
        _log(
            audit_lines,
            logging.INFO,
            "Skipping milestone movement for loan %s: first-review audit %s already has milestone_moved=True",
            loan_number,
            review["id"],
        )
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Milestone already moved; event ignored",
                "loan_number": loan_number,
                "first_review_audit_id": int(review["id"]),
                "milestone_move_eligible": review.get("milestone_move_eligible") is True,
                "milestone_moved": False,
            }),
        }

    secret_name = os.environ.get("AWS_SECRET_NAME")
    if not secret_name:
        _log(audit_lines, logging.ERROR, "AWS_SECRET_NAME environment variable is not set")
        raise RuntimeError("AWS_SECRET_NAME environment variable is not set")

    _log(audit_lines, logging.INFO, "Loading service credentials for loan %s", loan_number)
    secrets = get_secret(secret_name)
    for key, value in secrets.items():
        os.environ[key] = value

    _log(audit_lines, logging.INFO, "Fetching loan program and milestone for loan %s", loan_number)
    loan_response = await _call_tool(GetLoanTool(), {
        "loan_identifier": encompass_guid,
        "company": company_code,
        "requestedProperties": ["1401", "MS.STATUS", COORDINATOR_FIELD],
    }, audit_lines)
    if loan_response.get("success") is not True or not isinstance(loan_response.get("data"), dict):
        _log(audit_lines, logging.ERROR, "GetLoanTool failed for loan %s", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "Failed to fetch loan properties", "milestone_moved": False})}
    fields = loan_response["data"]
    loan_program = fields.get("1401")
    milestone = fields.get("MS.STATUS")
    if not isinstance(loan_program, str) or not loan_program.strip() or not isinstance(milestone, str) or not milestone.strip():
        _log(audit_lines, logging.ERROR, "Loan %s has missing or invalid loan program or milestone", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "Loan program or milestone is missing or invalid", "milestone_moved": False})}

    _log(audit_lines, logging.INFO, "Loan %s has loan program %s and milestone %s", loan_number, loan_program, milestone)
    is_supported_program = (
        re.search(r"\b(?:CES|HELOAN)\b", loan_program, re.IGNORECASE)
        and "brokered" not in loan_program.casefold()
    )
    if os.getenv("ENVIRONMENT") == "prod" and not is_supported_program:
        _log(audit_lines, logging.INFO, "Skipping loan %s with unsupported program: %s", loan_number, loan_program)
        return {"statusCode": 200, "body": json.dumps({"message": "Unsupported product; event ignored", "milestone_moved": False})}
    if milestone not in TRIGGER_MILESTONES:
        _log(audit_lines, logging.INFO, "Skipping loan %s at milestone: %s", loan_number, milestone)
        return {"statusCode": 200, "body": json.dumps({"message": "Loan is not at Sent to processing or Processing; event ignored", "milestone_moved": False})}

    if review is None:
        _log(audit_lines, logging.INFO, "No first-review audit record found in the last 24 hours for loan %s; no milestone movement", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No first-review audit record found in the last 24 hours", "milestone_moved": False})}

    eligible = review.get("milestone_move_eligible") is True
    moved = False
    failure_reason = None
    if not eligible:
        _log(audit_lines, logging.INFO, "Loan %s is not eligible based on first matching recent first-review audit %s; no milestone movement", loan_number, review["id"])
    else:
        moved, failure_reason = await _advance_milestones(encompass_guid, company_code, fields, audit_lines)
    return {
        "statusCode": 200,
        "body": json.dumps({
            "loan_number": loan_number,
            "first_review_audit_id": int(review["id"]),
            "milestone_move_eligible": eligible,
            "milestone_moved": moved,
            **({"message": failure_reason} if failure_reason else {}),
        }),
    }


async def _advance_milestones(
    loan_guid: str, company: str, fields: dict, audit_lines: list[str],
) -> tuple[bool, str | None]:
    coordinator = fields.get(COORDINATOR_FIELD)
    if (
        COORDINATOR_FIELD not in fields
        or COORDINATOR_FIELD in (fields.get("unresolved_field_ids") or [])
        or (coordinator is not None and not isinstance(coordinator, str))
    ):
        _log(audit_lines, logging.ERROR, "UW coordinator field could not be resolved; no assignment or milestone movement attempted")
        return False, "The underwriting coordinator field could not be verified."

    if not coordinator or not coordinator.strip():
        _log(audit_lines, logging.INFO, "UW coordinator is unassigned; assigning placeholder uwcoord")
        assignment = await _call_tool(AssignOneLoanRoleTool(), {
            "loan_guid": loan_guid,
            "company": company,
            "assignments": [{"role": "underwriting-coord", "user_id": "uwcoord"}],
        }, audit_lines)
        if assignment.get("success") is not True:
            _log(audit_lines, logging.ERROR, "Unable to assign UW coordinator; assignment outcome is unconfirmed; no milestone movement attempted")
            return False, "Assignment of the underwriting coordinator was not confirmed."

        await asyncio.sleep(10)
        verification = await _call_tool(GetLoanTool(), {
            "loan_identifier": loan_guid,
            "company": company,
            "requestedProperties": [COORDINATOR_FIELD],
        }, audit_lines)
        verified_fields = verification.get("data")
        if verification.get("success") is not True or not isinstance(verified_fields, dict):
            _log(audit_lines, logging.ERROR, "Unable to verify UW coordinator assignment; no milestone movement attempted")
            return False, "The underwriting coordinator assignment could not be verified."
        coordinator = verified_fields.get(COORDINATOR_FIELD)
        if (
            COORDINATOR_FIELD in (verified_fields.get("unresolved_field_ids") or [])
            or not isinstance(coordinator, str)
            or not coordinator.strip()
        ):
            _log(audit_lines, logging.ERROR, "Unable to assign UW coordinator: no assigned coordinator could be confirmed after 10 seconds")
            return False, "No assigned underwriting coordinator could be confirmed."

    _log(audit_lines, logging.INFO, "UW coordinator assigned: %s; prerequisites for both milestone moves are satisfied", coordinator)
    for target in ("App Fee Collected", "Assigned to UW"):
        _log(audit_lines, logging.INFO, "Attempting milestone movement to %s", target)
        movement = await _call_tool(MoveOneLoanMilestoneTool(), {
            "loan_guid": loan_guid,
            "company": company,
            "target_milestone": target,
        }, audit_lines)
        if movement.get("success") is not True:
            progress = (
                "App Fee Collected was verified before this attempt. "
                if target == "Assigned to UW" else ""
            )
            _log(
                audit_lines, logging.ERROR,
                "%sMovement to %s was not confirmed; the write may or may not have applied. "
                "Stopping without retry; manual investigation may be required.",
                progress, target,
            )
            return False, f"{progress}Movement to {target} was not confirmed; the write may still have applied."
        _log(audit_lines, logging.INFO, "Milestone movement to %s verified by the move tool", target)
    return True, None
