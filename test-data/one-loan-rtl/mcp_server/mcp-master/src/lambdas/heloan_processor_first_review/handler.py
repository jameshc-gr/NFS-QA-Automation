import asyncio
import base64
import html
import json
import logging
import os
import re
import time
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

import boto3

from src.tools.email_tools import SendEmailTool
from src.tools.oneloan_tools import GetLoanTool
from .pdf_generator import generate_first_review_pdf
from .verification_checks import get_auto_advance_decision, get_verification_results, FAIL


logger = logging.getLogger()
logger.setLevel(logging.INFO)

TRIGGER_MILESTONE = "Sent to processing"

LOCK_TABLE_NAME_ENV = "FIRST_REVIEW_LOCK_TABLE_NAME"
DUPLICATE_LOCK_WINDOW = timedelta(minutes=15)
AUDIT_TABLE_NAME_ENV = "FIRST_REVIEW_AUDIT_TABLE_NAME"
PDF_BUCKET_NAME_ENV = "FIRST_REVIEW_PDF_BUCKET_NAME"
CHICAGO = ZoneInfo("America/Chicago")
NEWLY_ASSIGNED_REASON_CODES = (None, "DAILY_CAP_EXCEEDED_FALLBACK", "ASSIGNED_FROM_RESUBMISSION_POOL")
EMAIL_FROM_NAME = "Digital Mortgage Systems MCP"
EMAIL_FROM_ADDRESS = "no-reply@rate.com"
FIRST_REVIEW_EMAIL_RECIPIENT = {"name": "Boyang Zhao", "address": "Boyang.Zhao@rate.com"}
BORROWER_FIRST_NAME_FIELD = "4000"
BORROWER_LAST_NAME_FIELD = "4002"
COBORROWER_FIRST_NAME_FIELD = "4004"
COBORROWER_LAST_NAME_FIELD = "4006"

_ASSIGNMENT_ROLE_LABELS = {
    "uw": "Underwriter",
    "processor": "Processor/Mortgage Consultant",
    "cc": "Closing Coordinator",
}

_ASSIGNMENT_TEAM_ROLES = {
    "uw": ("underwriter",),
    "processor": ("processor_mortgage_consultant", "loan_coordinator"),
    "cc": ("closing_coordinator",),
}

_TEAM_EMAIL_FIELDS = {
    "loan_officer": (
        "LoanTeamMember.Name.Loan_Officer",
        "LoanTeamMember.UserId.Loan_Officer",
        "LoanTeamMember.Email.Loan_Officer",
    ),
    "underwriter": (
        "LoanTeamMember.Name.Underwriter",
        "LoanTeamMember.UserId.Underwriter",
        "LoanTeamMember.Email.Underwriter",
    ),
    "processor_mortgage_consultant": (
        "LoanTeamMember.Name.Mortgage_Consultant",
        "LoanTeamMember.UserId.Mortgage_Consultant",
        "LoanTeamMember.Email.Mortgage_Consultant",
    ),
    "loan_coordinator": (
        "LoanTeamMember.Name.Loan_Coordinator",
        "LoanTeamMember.UserId.Loan_Coordinator",
        "LoanTeamMember.Email.Loan_Coordinator",
    ),
    "closing_coordinator": (
        "LoanTeamMember.Name.Ops_Assist_-_CC",
        "LoanTeamMember.UserId.Ops_Assist_-_CC",
        "LoanTeamMember.Email.Ops_Assist_-_CC",
    ),
}


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

def _claim_loan_lock(lock_table_name: str, loan_number: str) -> bool:
    lock_table = boto3.resource("dynamodb").Table(lock_table_name)
    now = datetime.now(timezone.utc)
    try:
        lock_table.put_item(
            Item={
                "loan_number": loan_number,
                "claimed_at": now.isoformat(),
                "expires_at": int((now + DUPLICATE_LOCK_WINDOW).timestamp()),
            },
            ConditionExpression="attribute_not_exists(loan_number) OR expires_at < :now",
            ExpressionAttributeValues={":now": int(now.timestamp())},
        )
        return True
    except lock_table.meta.client.exceptions.ConditionalCheckFailedException:
        return False

def _write_audit_record(
    table_name: str,
    *,
    review_id: int,
    created_at: datetime,
    assignment_audit_id: int | None,
    loan_number: str,
    loan_guid: str,
    loan_company: str,
    lo_user_id: str | None,
    lo_name: str | None,
    results: dict,
    check_followup_needed: bool,
    audit_log: str,
    pdf_status: str,
    pdf_s3_key: str | None,
    auto_advance_decision: dict,
    assignment_created_at: datetime | None = None,
    assignment_date: str | None = None,
) -> None:
    table = boto3.resource("dynamodb").Table(table_name)
    item = {
        "id": review_id,
        "loan_number": loan_number,
        "created_at": created_at.isoformat(),
        "audit_date": assignment_date if assignment_date is not None else created_at.astimezone(CHICAGO).strftime("%Y-%m-%d"),
        "loan_guid": loan_guid,
        "loan_company": loan_company,
        "lo_user_id": lo_user_id,
        "lo_name": lo_name,
        "disclosures_status": results["disclosure"]["status"],
        "disclosures_reason": results["disclosure"]["reason"],
        "hard_credit_status": results["hard_credit"]["status"],
        "hard_credit_reason": results["hard_credit"]["reason"],
        "dti_status": results["dti"]["status"],
        "dti_reason": results["dti"]["reason"],
        "milestone_move_eligible": auto_advance_decision["eligible"],
        "milestone_moved": False,
        "auto_advance_reasons": auto_advance_decision["reasons"],
        "check_followup_needed": check_followup_needed,
        "audit_log": audit_log,
        "pdf_status": pdf_status,
    }
    if assignment_audit_id is not None:
        item["assignment_audit_id"] = assignment_audit_id
    if assignment_created_at is not None:
        item["assignment_created_at"] = assignment_created_at.isoformat()
    if pdf_s3_key:
        item["pdf_s3_key"] = pdf_s3_key
    table.put_item(Item=item)


def _record_identity(
    reviewed_at: datetime,
    assignment_audit_id: int | None,
    assignment_created_at: datetime | None,
) -> tuple[int, datetime]:
    """ID and timestamp shared by the audit record and PDF key. They mirror the
    pipeline-assignment record when available; otherwise the review's own values are used."""
    if assignment_audit_id is None:
        return time.time_ns(), reviewed_at
    return assignment_audit_id, assignment_created_at or reviewed_at


def _first_review_pdf_key(record_id: int, record_created_at: datetime) -> str:
    local_date = record_created_at.astimezone(CHICAGO).strftime("%Y-%m-%d")
    return f"{local_date}/{record_id}.pdf"

def _parse_assignment_dates(pipeline_assignment: dict) -> tuple[datetime | None, str | None]:
    timestamp = pipeline_assignment.get("created_at")
    reporting_date = pipeline_assignment.get("assignment_date")
    if timestamp is None and reporting_date is None:
        if pipeline_assignment.get("audit_id") is not None:
            logger.warning("Assignment %s has no reporting-date metadata; using the review's Chicago date", pipeline_assignment["audit_id"])
        return None, None
    if not isinstance(timestamp, str) or not isinstance(reporting_date, str):
        raise ValueError("Assignment created_at and assignment_date must both be provided as strings")
    created_at = datetime.fromisoformat(timestamp)
    if created_at.tzinfo is None:
        raise ValueError("Assignment created_at must include a UTC offset")
    parsed_date = datetime.strptime(reporting_date, "%Y-%m-%d")
    if parsed_date.strftime("%Y-%m-%d") != reporting_date:
        raise ValueError("Assignment assignment_date must use YYYY-MM-DD")
    return created_at, reporting_date


def _upload_first_review_pdf(bucket_name: str, object_key: str, pdf_bytes: bytes) -> None:
    boto3.client("s3").put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )


def _assigned_team_from_pipeline_results(results: dict) -> dict:
    assigned_team = {}
    for result_key, role_keys in _ASSIGNMENT_TEAM_ROLES.items():
        result = results.get(result_key)
        if not isinstance(result, dict):
            continue
        member = {
            "name": result.get("name"),
            "user_id": result.get("id"),
            "reason_code": result.get("reason_code"),
        }
        for role_key in role_keys:
            assigned_team[role_key] = member
    return assigned_team


def _apply_payload_assignments(fields: dict, assignment_results: dict, audit_lines: list[str]) -> None:
    """Overwrite team fields for roles pipeline assignment just filled, since
    OneLoan may not reflect those assignments yet. Already-assigned roles keep
    OneLoan's values because the Mortgage Consultant and Loan Coordinator can differ."""
    for result_key, role_keys in _ASSIGNMENT_TEAM_ROLES.items():
        result = assignment_results.get(result_key)
        if not isinstance(result, dict) or result.get("reason_code") not in NEWLY_ASSIGNED_REASON_CODES:
            continue
        expected_id = str(result.get("id") or "").strip()
        if not expected_id:
            _log(audit_lines, logging.WARNING,
                 "%s assignment has no payload user ID; using OneLoan team fields.", _ASSIGNMENT_ROLE_LABELS[result_key])
            continue
        payload_email = str(result.get("email") or "").strip() or None
        for role_key in role_keys:
            name_field, id_field, email_field = _TEAM_EMAIL_FIELDS[role_key]
            oneloan_id = str(fields.get(id_field) or "").strip()
            oneloan_matches = oneloan_id.casefold() == expected_id.casefold()
            if not oneloan_matches:
                _log(audit_lines, logging.INFO,
                     "%s: OneLoan shows user ID %s; using pipeline assignment %s (%s).",
                     role_key, oneloan_id or "not available", result.get("name") or "name not available", expected_id)
            email = payload_email or (fields.get(email_field) if oneloan_matches else None)
            if not email:
                _log(audit_lines, logging.WARNING, "%s: no email available for %s.", role_key, expected_id)
            fields[name_field] = result.get("name") or (fields.get(name_field) if oneloan_matches else None)
            fields[id_field] = result["id"]
            fields[email_field] = email


def _assignment_failure_message(reason_code: str | None) -> str | None:
    if reason_code in (*NEWLY_ASSIGNED_REASON_CODES, "ALREADY_ASSIGNED", "SKIPPED_BY_REQUEST"):
        return None
    if reason_code.startswith("NO_ELIGIBLE_"):
        return "no eligible team member matched the loan"
    if reason_code.startswith("PIPELINE_EXHAUSTED"):
        return "eligible team members are at pipeline capacity"
    if reason_code == "ONELOAN_ROLE_ASSIGNMENT_FAILED":
        return "the OneLoan assignment could not be completed"
    if reason_code == "INVALID_EMPLOYEE_ID":
        return "the selected team member has no valid employee ID for OneLoan"
    return reason_code.replace("_", " ").lower()


def _borrower_name(fields: dict, first_field: str, last_field: str) -> str:
    parts = [
        fields[field_id].strip()
        for field_id in (first_field, last_field)
        if isinstance(fields.get(field_id), str) and fields[field_id].strip()
    ]
    return " ".join(parts) if parts else "not on file"


def _check_followups(results: dict, fields: dict) -> list[tuple[str, list[str]]]:
    followups = []
    disclosure = results.get("disclosure") or {}
    disclosure_status = str(disclosure.get("status", "UNKNOWN")).upper()
    disclosure_date = fields.get("CX.APPRCVD.1")
    if disclosure_status == "FAIL":
        followups.append((
            "Signed Initial Disclosures",
            ["Initial disclosures need to be signed by all borrowers on the loan application and the VP."],
        ))
    elif disclosure_status == "UNKNOWN" or not disclosure_date:
        followups.append((
            "Signed Initial Disclosures",
            ["Unable to verify because required fields are missing."],
        ))

    hard_credit = results.get("hard_credit") or {}
    hard_credit_status = str(hard_credit.get("status", "UNKNOWN")).upper()
    if hard_credit_status == "PASS":
        return followups
    credit_description = (
        hard_credit.get("reason")
        or "Unable to verify whether hard credit is on file. Please review the loan’s credit report."
    )
    details = [credit_description]
    if hard_credit_status == "FAIL":
        consent_fields_present = all(field_id in fields for field_id in ("4073", "4004", "4006"))
        has_coborrower = bool(fields.get(COBORROWER_FIRST_NAME_FIELD) or fields.get(COBORROWER_LAST_NAME_FIELD))
        all_required_consent_given = (
            consent_fields_present
            and fields.get("4073") is True
            and (not has_coborrower or fields.get("4076") is True)
        )
        report_instruction = (
            "A hard credit pull must be completed with the report in file, unless a still-valid credit report from a prior file is being used. "
            "If so, confirm that the report is available in the current file."
        )
        if all_required_consent_given:
            consenting_names = [_borrower_name(fields, BORROWER_FIRST_NAME_FIELD, BORROWER_LAST_NAME_FIELD)]
            if has_coborrower:
                consenting_names.append(_borrower_name(fields, COBORROWER_FIRST_NAME_FIELD, COBORROWER_LAST_NAME_FIELD))
            consent_names = " and ".join(consenting_names)
            details.append(f"Consent to pull hard credit is on file for {consent_names}. {report_instruction}")
        elif consent_fields_present and (not has_coborrower or "4076" in fields):
            missing_consent = []
            missing_names = []
            if fields.get("4073") is not True:
                missing_consent.append("borrower")
                missing_names.append(_borrower_name(fields, BORROWER_FIRST_NAME_FIELD, BORROWER_LAST_NAME_FIELD))
            if has_coborrower and fields.get("4076") is not True:
                missing_consent.append("co-borrower")
                missing_names.append(_borrower_name(fields, COBORROWER_FIRST_NAME_FIELD, COBORROWER_LAST_NAME_FIELD))
            authorization_subject = " and ".join(f"the {party}" for party in missing_consent)
            authorization_instruction = (
                "Borrower authorization to pull hard credit must be selected on the Borrower Summary Origination screen "
                "with the corresponding date of authorization."
                if missing_consent == ["borrower"]
                else f"Authorization for {authorization_subject} to pull hard credit must be selected on the Borrower Summary Origination screen with the corresponding date of authorization."
            )
            details.extend([
                report_instruction,
                f"Credit consent is missing for {' and '.join(missing_names)} ({' and '.join(missing_consent)}). {authorization_instruction}",
            ])
        else:
            details.append(
                hard_credit.get("followup")
                or "Required credit authorization is missing. Verify consent and obtain any required consent before completing a hard-credit pull."
            )
    followups.append(("Credit Report/Credit Authorization", details))
    
    dti = results.get("dti") or {}
    dti_status = str(dti.get("status", "UNKNOWN")).upper()
    if dti_status == "FAIL":
        followups.append((
            "Debt-to-Income Ratio",
            ["This loan's DTI is 50% or higher and may not qualify as structured. Please review and adjust the income or liabilities before moving forward."],
        ))
    elif dti_status == "UNKNOWN":
        followups.append((
            "Debt-to-Income Ratio",
            ["Unable to determine DTI. Please verify that the back-end DTI field is populated on the loan."],
        ))
    
    return followups


def _email_recipients(fields: dict) -> list[dict]:
    recipients = [dict(FIRST_REVIEW_EMAIL_RECIPIENT)]
    seen_addresses = {FIRST_REVIEW_EMAIL_RECIPIENT["address"].casefold()}
    team_roles = (
        ("loan_officer", "Loan Officer"),
        ("processor_mortgage_consultant", "Processor"),
        ("loan_coordinator", "Loan Coordinator"),
    )
    for role_key, role_label in team_roles:
        name_field, _, email_field = _TEAM_EMAIL_FIELDS[role_key]
        name = fields.get(name_field)
        email = fields.get(email_field)
        if not isinstance(email, str) or not email.strip():
            logger.warning("No %s email available for first-review notification", role_label)
            continue

        address = email.strip()
        if address.casefold() in seen_addresses:
            continue
        recipients.append({
            "name": name.strip() if isinstance(name, str) and name.strip() else role_label,
            "address": address,
        })
        seen_addresses.add(address.casefold())
    return recipients


def _email_greeting_names(fields: dict) -> list[str]:
    names = []
    seen_identities = set()
    for role_key in ("loan_officer", "processor_mortgage_consultant", "loan_coordinator"):
        name_field, id_field, email_field = _TEAM_EMAIL_FIELDS[role_key]
        name = fields.get(name_field)
        if not isinstance(name, str) or not name.strip():
            continue
        identities = {
            (kind, value.strip().casefold())
            for kind, value in (
                ("name", name),
                ("id", fields.get(id_field)),
                ("email", fields.get(email_field)),
            )
            if isinstance(value, str) and value.strip()
        }
        if not seen_identities.intersection(identities):
            names.append(name.strip())
        seen_identities.update(identities)
    return names


def _assigned_team_email_lines(fields: dict, assignment_results: dict) -> list[str]:
    role_rows = (
        ("loan_officer", "Loan Officer", None),
        ("underwriter", "Underwriter", "uw"),
        ("processor_mortgage_consultant", "Processor/Mortgage Consultant", "processor"),
        ("loan_coordinator", "Loan Coordinator", "processor"),
        ("closing_coordinator", "Closing Coordinator", "cc"),
    )
    lines = []
    for team_key, label, result_key in role_rows:
        name_field, user_id_field, email_field = _TEAM_EMAIL_FIELDS[team_key]
        assignment = assignment_results.get(result_key, {}) if result_key else {}
        failure = _assignment_failure_message(assignment.get("reason_code")) if result_key else None
        if failure:
            lines.append(f"{label}: Not assigned ({failure})")
            continue
        name = fields.get(name_field) or assignment.get("name")
        user_id = fields.get(user_id_field) or assignment.get("id")
        email = fields.get(email_field)
        if not name and not user_id and not email:
            lines.append(f"{label}: Not assigned")
            continue
        lines.append(
            f"{label}: {name or 'Name unavailable'}, {email or 'Email unavailable'}"
        )
    return lines


def _build_first_review_email(
    loan_number: str,
    borrower_name: str,
    fields: dict,
    results: dict,
    assignment_results: dict,
    pdf_bytes: bytes | None,
) -> tuple[str, str, list[dict], list[str]]:
    check_followups = _check_followups(results, fields)
    assignment_followups = []
    for result_key, role_label in _ASSIGNMENT_ROLE_LABELS.items():
        result = assignment_results.get(result_key) or {}
        failure = _assignment_failure_message(result.get("reason_code"))
        if failure:
            assignment_followups.append(f"{role_label}: {failure}.")

    recipients = _email_recipients(fields)
    has_followups = bool(check_followups or assignment_followups)
    subject_status = "Action Needed" if has_followups else "Complete"
    subject = f"HELOAN First Review {subject_status} | Loan {loan_number}"
    greeting_names = [html.escape(name) for name in _email_greeting_names(fields)]
    if greeting_names:
        joined_names = ", ".join(greeting_names[:-1]) + " and " + greeting_names[-1] if len(greeting_names) > 1 else greeting_names[0]
        greeting = f"Hello {joined_names},"
    else:
        greeting = "Hello, looks like the assigned roles failed somehow."

    body_parts = [f"<p style=\"color:#000000\">{greeting}</p><br/>"]
    loan_context = f"loan {html.escape(str(loan_number))}"
    if borrower_name:
        loan_context += f" ({html.escape(borrower_name)})"
    if check_followups:
        body_parts.append(f"<p style=\"color:#000000\">The initial first-review checks for {loan_context} are complete. One or more checks need attention before it can be sent to underwriting for further review.</p>")
        body_parts.append("<p style=\"color:#000000\">Please review the following:</p>")
        check_items = "".join(
            f"<li>{html.escape(check_title)}<ul>"
            + "".join(f"<li>{html.escape(detail)}</li>" for detail in details)
            + "</ul></li>"
            for check_title, details in check_followups
        )
        body_parts.append(f"<ul style=\"color:#000000\">{check_items}</ul>")
        has_unknown_check = any(
            str((results.get(check_name) or {}).get("status", "UNKNOWN")).upper() == "UNKNOWN"
            for check_name in ("disclosure", "hard_credit")
        )
        if has_unknown_check and pdf_bytes:
            body_parts.append("<p style=\"color:#000000\">Please review the audit log in the attached PDF and the loan fields.</p>")
        elif has_unknown_check:
            body_parts.append("<p style=\"color:#000000\">Please review the loan fields. The PDF could not be generated, so the full audit log is available in the first-review audit record.</p>")
    else:
        body_parts.append(f"<p style=\"color:#000000\">The initial first-review checks for {loan_context} are complete. All first-review checks look good, and no further action is needed for these checks.</p>")

    body_parts.append("<p style=\"color:#FF0000\"><b>Please Note:</b> Title is now ordered automatically through ServiceLink. Please don't submit a separate title order, since this may create a duplicate.</p>")

    if assignment_followups:
        body_parts.append("<p style=\"color:#000000\">Pipeline assignment did not complete for the following role(s):</p>")
        body_parts.append("<ul style=\"color:#000000\">" + "".join(f"<li>{html.escape(item)}</li>" for item in assignment_followups) + "</ul>")
        body_parts.append("<p style=\"color:#000000\">Please follow up with Brian Neff (Brian.Neff@rate.com) about the missing assigned roles.</p>")

    if pdf_bytes:
        body_parts.append("<p style=\"color:#000000\">The first-review PDF is attached with detailed findings, the assigned-team snapshot, and the audit trail. It also includes a Loan Information section summarizing loan and qualification details, subject property information, and the borrower profile.</p>")
    else:
        body_parts.append("<p style=\"color:#000000\">The first-review PDF could not be generated, contact Boyang.Zhao@rate.com for more information on the findings.</p>")

    team_lines = _assigned_team_email_lines(fields, assignment_results)
    body_parts.append("<p style=\"color:#000000\">Assigned team:</p>")
    body_parts.append("<ul style=\"color:#000000\">" + "".join(f"<li>{html.escape(line)}</li>" for line in team_lines) + "</ul>")
    body_parts.append("<p style=\"color:#000000\">These checks are not a loan approval or a guarantee of underwriting clearance.</p>")
    body_parts.append("<p style=\"color:#000000\">Thank you,<br/>HELOAN First Review</p>")
    body = "".join(body_parts)
    return subject, body, recipients, team_lines


async def _send_first_review_email(
    loan_number: str,
    borrower_name: str,
    fields: dict,
    results: dict,
    assignment_results: dict,
    pdf_bytes: bytes | None,
) -> tuple[str, list[str]]:
    subject, body, recipients, _ = _build_first_review_email(
        loan_number, borrower_name, fields, results, assignment_results, pdf_bytes,
    )
    if not recipients:
        logger.error("No valid email recipients for loan %s; skipping first-review email", loan_number)
        return "skipped_no_recipients", []

    attachments = []
    if pdf_bytes:
        attachments.append({
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "encoding": "base64",
            "contentType": "application/pdf",
            "filename": f"{loan_number} HELOAN First Review.pdf",
        })

    try:
        response_raw = await SendEmailTool().execute({
            "body": body,
            "to": recipients,
            "from": {"name": EMAIL_FROM_NAME, "address": EMAIL_FROM_ADDRESS},
            "subject": subject,
            "attachments": attachments,
        })
        response = json.loads(response_raw)
        if not response.get("success"):
            logger.error("Failed to send first-review email for loan %s: %s", loan_number, response)
            return "failed", [recipient["address"] for recipient in recipients]
    except Exception:
        logger.exception("Unexpected error sending first-review email for loan %s", loan_number)
        return "failed", [recipient["address"] for recipient in recipients]

    logger.info("Sent first-review email for loan %s to %s", loan_number, [r["address"] for r in recipients])
    return "sent", [recipient["address"] for recipient in recipients]

def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)


def _log_loan_information(fields: dict, audit_lines: list[str]) -> None:
    descriptions = {
        "1109": "Base loan amount",
        "2": "Total loan amount, including financed MI/fees",
        "1811": "Subject property occupancy",
        "742": "Back-end DTI",
        "740": "Front-end DTI",
        "2853": "Credit score for decision making",
        "353": "LTV",
        "976": "CLTV",
        "1540": "HCLTV",
        "11": "Property street address",
        "12": "Property city",
        "13": "Property county",
        "14": "Property state",
        "15": "Property ZIP code",
        "16": "Number of units",
        "1041": "Fannie Mae property type",
        "CX.MRTG.COUNT": "Total properties owned",
        "CX.SELFEMPLOYED": "Self-employment indicator",
        "921": "Total gross rental income",
        "1005": "Subject property gross rental income",
        "FL0118": "List of each liability's payoff flag",
        "FL0102": "List of each liability's creditor name",
        "FL0108": "List of each liability's type",
        "FL0110": "List of each liability's account last four",
    }
    audit_lines.append("")
    _log(audit_lines, logging.INFO, "Loan Information")
    for field_id, description in descriptions.items():
        value = json.dumps(fields[field_id]) if field_id in fields else "Not returned"
        audit_field = "FLNN" + field_id[4:] if field_id.startswith("FL01") else field_id
        _log(audit_lines, logging.INFO, "Field %s (%s): %s", audit_field, description, value)


def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))


async def _handler(event: dict, context) -> dict:
    audit_lines: list[str] = []
    secret_name = os.environ.get("AWS_SECRET_NAME")
    if not secret_name:
        raise RuntimeError("AWS_SECRET_NAME environment variable is not set")

    secrets = get_secret(secret_name)
    for key, value in secrets.items():
        os.environ[key] = value

    # Extract loan number, encompass GUID, and company code from the event payload
    loan_number = event.get("detail", {}).get("identity", {}).get("loanNumber")
    encompass_guid = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    pipeline_assignment = event.get("pipeline_assignment") or {}
    assignment_audit_id = pipeline_assignment.get("audit_id")
    assignment_results = pipeline_assignment.get("results") or {}
    try:
        assignment_created_at, assignment_date = _parse_assignment_dates(pipeline_assignment)
    except ValueError:
        logger.exception("Invalid assignment reporting-date metadata for loan %s", loan_number)
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid assignment reporting-date metadata"})}
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}
    if not encompass_guid:
        logger.error("Encompass GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass GUID is required in the event payload."})}
    _log(audit_lines, logging.INFO, "HELOAN processor first review received milestone-changed(heloan) event for loan number: %s w/ company code: %s", loan_number, company_code)

    requested_fields = [
        "CX.APPRCVD.1",          # Disclosures signed date
        "4073",                  # Hard credit consent, borrower
        "4076",                  # Hard credit consent, co-borrower; only checked when a co-borrower exists
        "4000",                  # Borrower first name
        "4002",                  # Borrower last name
        "4004",                  # Co-borrower first name; used to detect whether a co-borrower exists
        "4006",                  # Co-borrower last name; used to detect whether a co-borrower exists
        "4750",                  # Prequal credit report indicator
        "MS.STATUS",             # Loan.MilestoneCurrentName
        "1401",
        "1109",                  # Base loan amount
        "2",                     # Total loan amount, including financed MI/fees
        "1811",                  # Subject property occupancy
        "742",                   # Back-end DTI
        "740",                   # Front-end DTI
        "2853",                  # Credit score for decision making
        "353",                   # LTV
        "976",                   # CLTV
        "1540",                  # HCLTV
        "11",                    # Property street address
        "12",                    # Property city
        "13",                    # Property county
        "14",                    # Property state
        "15",                    # Property ZIP code
        "16",                    # Number of units
        "1041",                  # Fannie Mae property type
        "CX.MRTG.COUNT",          # Total properties owned
        "CX.SELFEMPLOYED",        # Self-employment indicator
        "901",                   # Combined base income
        "902",                   # Combined overtime
        "903",                   # Combined bonuses
        "904",                   # Combined commissions
        "905",                   # Combined dividends/interest
        "906",                   # Combined net rental income
        "907",                   # Combined other income 1
        "908",                   # Combined other income 2
        "921",                   # Total gross rental income
        "1005",                  # Subject property gross rental income
        "FE0153",                # Borrower military entitlement, first current job
        "FE0353",                # Borrower military entitlement, second current job
        "FE0253",                # Co-borrower military entitlement, first current job
        "FE0453",                # Co-borrower military entitlement, second current job
        "FL0118",                # Liability payoff flags across records
        "FL0102",                # Liability creditor names
        "FL0108",                # Liability types
        "FL0110",                # Liability account last four
        "LoanTeamMember.UserId.Loan_Officer",
        "LoanTeamMember.Name.Loan_Officer",
        "LoanTeamMember.Email.Loan_Officer",
        "LoanTeamMember.UserId.Underwriter",
        "LoanTeamMember.Name.Underwriter",
        "LoanTeamMember.Email.Underwriter",
        "LoanTeamMember.UserId.Mortgage_Consultant",
        "LoanTeamMember.Name.Mortgage_Consultant",
        "LoanTeamMember.Email.Mortgage_Consultant",
        "LoanTeamMember.UserId.Loan_Coordinator",
        "LoanTeamMember.Name.Loan_Coordinator",
        "LoanTeamMember.Email.Loan_Coordinator",
        "LoanTeamMember.UserId.Ops_Assist_-_CC",
        "LoanTeamMember.Name.Ops_Assist_-_CC",
        "LoanTeamMember.Email.Ops_Assist_-_CC",
    ]

    try:
        loan_response_raw = await GetLoanTool().execute({
            "loan_identifier": encompass_guid,
            "company": company_code,
            "requestedProperties": requested_fields
        })
        loan_response = json.loads(loan_response_raw)
        if not loan_response.get("success"):
            logger.error("GetLoanTool call failed for loan %s: %s", loan_number, loan_response)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan fields"})}

    except Exception:
        logger.exception("Failed to fetch loan fields via GetLoanTool for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan fields"})}

    fields = loan_response.get("data", {})

    # Log to see all extracted fields
    _log(audit_lines, logging.INFO, "HELOAN processor first review fields for loan %s: %s", loan_number, json.dumps(fields))

    # Fields we asked for that did not come back at all (as opposed to coming back null/empty)
    missing_fields = [f for f in requested_fields if f not in fields]
    if missing_fields:
        _log(audit_lines, logging.WARNING, "Fields not returned for loan %s: %s", loan_number, missing_fields)

    # Verify milestone directly off the loan (MS.STATUS)
    milestone = fields.get("MS.STATUS")
    loan_program = fields.get("1401")
    is_supported_program = (
        re.search(r"\b(?:CES|HELOAN)\b", loan_program or "", re.IGNORECASE)
        and "brokered" not in (loan_program or "").casefold()
    )
    if os.getenv("ENVIRONMENT") == "prod" and milestone != TRIGGER_MILESTONE:
        _log(audit_lines, logging.INFO, "Skipping event for loan %s with milestone: %s", loan_number, milestone)
        return {"statusCode": 200, "body": json.dumps({"message": "Milestone not yet reached; event ignored"})}

    if os.getenv("ENVIRONMENT") == "prod" and not is_supported_program:
        _log(audit_lines, logging.INFO, "Skipping event for loan %s with unsupported loan program: %s", loan_number, loan_program)
        return {"statusCode": 200, "body": json.dumps({"message": "Unsupported product; event ignored"})}

    lock_table_name = os.getenv(LOCK_TABLE_NAME_ENV)
    if not lock_table_name:
        logger.error("%s environment variable is not set; refusing to process without duplicate-event protection.", LOCK_TABLE_NAME_ENV)
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    audit_table_name = os.getenv(AUDIT_TABLE_NAME_ENV)
    if not audit_table_name:
        logger.error("%s environment variable is not set; refusing to process without an audit trail.", AUDIT_TABLE_NAME_ENV)
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    pdf_bucket_name = os.getenv(PDF_BUCKET_NAME_ENV)
    if not pdf_bucket_name:
        logger.error("%s environment variable is not set; refusing to process without PDF storage.", PDF_BUCKET_NAME_ENV)
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
    
    if not _claim_loan_lock(lock_table_name, loan_number):
        _log(audit_lines, logging.INFO, "Loan %s already claimed by another invocation within the last %s; skipping as a likely duplicate event.", loan_number, DUPLICATE_LOCK_WINDOW)
        return {"statusCode": 200, "body": json.dumps({"message": "Duplicate event; loan already claimed for processing"})}

    _apply_payload_assignments(fields, assignment_results, audit_lines)
    _log(audit_lines, logging.INFO, "Loan %s (company %s) is at milestone %r; loan program is %r",
         loan_number, company_code, milestone, loan_program)
    _log(audit_lines, logging.INFO, "Loan Officer: %s (%s), email %s",
         fields.get("LoanTeamMember.Name.Loan_Officer"),
         fields.get("LoanTeamMember.UserId.Loan_Officer"),
         fields.get("LoanTeamMember.Email.Loan_Officer") or "not on file")
    if assignment_audit_id is not None:
        _log(audit_lines, logging.INFO, "Pipeline assignment audit ID: %s", assignment_audit_id)
        for role_key, result in assignment_results.items():
            if isinstance(result, dict) and result.get("reason_code"):
                _log(
                    audit_lines,
                    logging.INFO,
                    "Pipeline assignment %s outcome: %s",
                    role_key,
                    result["reason_code"],
                )
    audit_lines.append("")

    results = get_verification_results(fields, audit_lines)
    auto_advance_decision = get_auto_advance_decision(
        fields, results, assignment_results, audit_lines,
    )
    _log_loan_information(fields, audit_lines)
    failed_checks = [name for name, result in results.items() if result["status"] == FAIL]
    check_followup_needed = any(result["status"] != "PASS" for result in results.values())
    _log(audit_lines, logging.INFO, "HELOAN processor first review results for loan %s: check_followup_needed=%s, failed_checks=%s",
                loan_number, check_followup_needed, failed_checks)

    reviewed_at = datetime.now(timezone.utc)
    record_id, record_created_at = _record_identity(reviewed_at, assignment_audit_id, assignment_created_at)
    pdf_object_key = _first_review_pdf_key(record_id, record_created_at)
    pdf_item = {
        "loan_number": loan_number,
        "loan_company": company_code,
        "loan_type": loan_program,
        "created_at": reviewed_at,
        "fields": fields,
        "results": results,
        "milestone_move_eligible": auto_advance_decision["eligible"],
        "assigned_team": _assigned_team_from_pipeline_results(assignment_results),
        "audit_log": "\n".join(audit_lines),
    }
    pdf_s3_key = None
    pdf_status = "failed"
    pdf_bytes = None
    try:
        pdf_bytes = generate_first_review_pdf(pdf_item)
        _upload_first_review_pdf(pdf_bucket_name, pdf_object_key, pdf_bytes)
        pdf_s3_key = pdf_object_key
        pdf_status = "stored"
        _log(audit_lines, logging.INFO, "First-review PDF stored at s3://%s/%s", pdf_bucket_name, pdf_s3_key)
    except Exception:
        logger.exception("Failed to generate or store first-review PDF for loan %s", loan_number)
        _log(audit_lines, logging.ERROR, "Failed to generate or store first-review PDF")

    audit_written = True
    try:
        _write_audit_record(
            audit_table_name,
            review_id=record_id,
            created_at=record_created_at,
            assignment_audit_id=assignment_audit_id,
            loan_number=loan_number,
            loan_guid=encompass_guid,
            loan_company=company_code,
            lo_user_id=fields.get("LoanTeamMember.UserId.Loan_Officer"),
            lo_name=fields.get("LoanTeamMember.Name.Loan_Officer"),
            results=results,
            check_followup_needed=check_followup_needed,
            audit_log="\n".join(audit_lines),
            pdf_status=pdf_status,
            pdf_s3_key=pdf_s3_key,
            auto_advance_decision=auto_advance_decision,
            assignment_created_at=assignment_created_at,
            assignment_date=assignment_date,
        )
    except Exception:
        logger.exception("Failed to write first review audit record for loan %s", loan_number)
        audit_written = False

    email_status = "skipped_audit_write_failed"
    email_recipients = []
    if audit_written:
        email_status, email_recipients = await _send_first_review_email(
            loan_number,
            _borrower_name(fields, BORROWER_FIRST_NAME_FIELD, BORROWER_LAST_NAME_FIELD),
            fields,
            results,
            assignment_results,
            pdf_bytes,
        )

    response_status = 200 if audit_written and pdf_status == "stored" else 500
    return {"statusCode": response_status, "body": json.dumps({
        "loan_number": loan_number,
        "milestone": milestone,
        "check_followup_needed": check_followup_needed,
        "failed_checks": failed_checks,
        "results": results,
        "auto_advance_decision": auto_advance_decision,
        "fields": fields,
        "missing_fields": missing_fields,
        "audit_log": audit_lines,
        "pdf_status": pdf_status,
        "pdf_s3_key": pdf_s3_key,
        "audit_written": audit_written,
        "assignment_audit_id": assignment_audit_id,
        "email_status": email_status,
        "email_recipients": email_recipients,
    })}
