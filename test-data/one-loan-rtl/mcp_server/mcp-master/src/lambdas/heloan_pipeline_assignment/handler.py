import base64
import html
import asyncio
import json
import logging
import os
import boto3
import time
import re
from botocore.exceptions import BotoCoreError, ClientError

from .loan_attributes import get_loan_attributes
from src.tools.oneloan_tools import (
    GetLoanTool,
    GetBorrowerPriorLoanTeamTool,
    GetTeamMemberPipelineCountTool,
    AssignOneLoanRoleTool,
)
from src.tools.email_tools import SendEmailTool
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from .pdf_generator import generate_assignment_pdf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

ATTRIBUTE_TO_ROSTER_COLUMN = {
    "language_preference_flag": "Language Preference",
    "chairmans_club_flag": "Chairmans Club",
    "presidents_club_flag": "Presidents Club",
    "loan_amount_over_400k_flag": "Loan Amount Over 400k",
    "self_employed_flag": "Self Employed",
    "multiple_employers_flag": "Multiple Employers",
    "multiple_properties_flag": "Multiple Properties",
    "investment_second_home_flag": "Investment Second Home",
    "multi_family_flag": "Multi Family",
    "condo_flag": "Condo",
    "retail_flag": "Retail",
    "employee_loan_access_flag": "Employee Loan Access",
}



DAILY_COUNT_COLUMN = "Assigned Today Count"
LAST_ASSIGNED_COLUMN = "Last Assigned At"
CURRENT_PIPELINE_COLUMN = "Current Pipeline Count"
ACTIVE_PIPELINE_COLUMN = "Active Pipeline Count"
PIPELINE_UPDATED_COLUMN = "Pipeline Count Last Updated"
ENCOMPASS_USER_ID_COLUMN = "Encompass User ID"
EMPLOYEE_ID_COLUMN = "Employee ID"  
EMAIL_COLUMN = "Email"
ASSIGN_ROLES_ENV = "ASSIGN_ROLES_IN_ONELOAN"
LOCK_TABLE_NAME_ENV = "ASSIGNMENT_LOCK_TABLE_NAME"
FAILURE_ALERT_RECIPIENTS_ENV = "PIPELINE_ASSIGNMENT_ALERT_RECIPIENTS"
FIRST_REVIEW_LAMBDA_NAME_ENV = "FIRST_REVIEW_LAMBDA_NAME"
DUPLICATE_LOCK_WINDOW = timedelta(hours=2)
CHICAGO = ZoneInfo("America/Chicago")

REASON_CODES: dict[str, str | None] = {
    # Successful outcomes
    "NORMAL": None,
    "ASSIGNED_FROM_RESUBMISSION_POOL": "ASSIGNED_FROM_RESUBMISSION_POOL",
    "DAILY_CAP_EXCEEDED_FALLBACK": "DAILY_CAP_EXCEEDED_FALLBACK",
    "ALREADY_ASSIGNED": "ALREADY_ASSIGNED",
    # Eligibility failures
    "NO_ELIGIBLE_UW": "NO_ELIGIBLE_UW",
    "NO_ELIGIBLE_PROCESSOR": "NO_ELIGIBLE_PROCESSOR",
    "NO_ELIGIBLE_CC": "NO_ELIGIBLE_CC",
    # Capacity failures
    "PIPELINE_EXHAUSTED": "PIPELINE_EXHAUSTED",
    "PIPELINE_EXHAUSTED_PROCESSOR": "PIPELINE_EXHAUSTED_PROCESSOR",
    "PIPELINE_EXHAUSTED_CC": "PIPELINE_EXHAUSTED_CC",
    # Assignment failures
    "ONELOAN_ROLE_ASSIGNMENT_FAILED": "ONELOAN_ROLE_ASSIGNMENT_FAILED",
    "INVALID_EMPLOYEE_ID": "INVALID_EMPLOYEE_ID",
    # Intentional skips
    "AUTO_DECLINED_NO_ASSIGNMENT": "AUTO_DECLINED_NO_ASSIGNMENT",
    "SKIPPED_BY_REQUEST": "SKIPPED_BY_REQUEST",
}

ROLE_CONFIGS = (
    {
        "key": "uw",
        "role_label": "UW",
        "name_column_key": "Underwriter Name",
        "roster_table_env_var": "UW_ROSTER_TABLE_NAME",
        "milestones": [
            "Processing", "App Fee Collected", "Assigned to UW",
            "Submittal", "UW Decision Expected", "Conditions Submitted to UW",
        ],
        "active_milestones": [
            "Assigned to UW", "Submittal", "UW Decision Expected", "Conditions Submitted to UW",
        ],
        "already_assigned_selector": None,
        "already_assigned_name_selector": None,
        "already_assigned_email_selector": None,
        "no_eligible_reason_code": REASON_CODES["NO_ELIGIBLE_UW"],
        "pipeline_exhausted_reason_code": REASON_CODES["PIPELINE_EXHAUSTED"],
        "oneloan_role_slugs": ("underwriter",),
        "ignore_if_same_as_selector": None,
        "ignore_values": (),
    },
    {
        "key": "processor",
        "role_label": "Processor",
        "name_column_key": "Processor Name",
        "roster_table_env_var": "PROCESSOR_ROSTER_TABLE_NAME",
        "milestones": [
            "Processing", "App Fee Collected", "Assigned to UW",
            "Submittal", "UW Decision Expected", "Conditions Submitted to UW",
            "Approval", "Assign to Close",
        ],
        "active_milestones": [
            "Processing", "App Fee Collected", "Submittal", "UW Decision Expected",
            "Approval", "Assign to Close",
        ],
        "already_assigned_selector": "LoanTeamMember.UserId.Mortgage_Consultant",
        "already_assigned_name_selector": "LoanTeamMember.Name.Mortgage_Consultant",
        "already_assigned_email_selector": "LoanTeamMember.Email.Mortgage_Consultant",
        "no_eligible_reason_code": REASON_CODES["NO_ELIGIBLE_PROCESSOR"],
        "pipeline_exhausted_reason_code": REASON_CODES["PIPELINE_EXHAUSTED_PROCESSOR"],
        "oneloan_role_slugs": ("mortgage-consultant", "loan-coordinator"),
        "ignore_if_same_as_selector": "LoanTeamMember.UserId.Loan_Officer",
        "ignore_values": ("testmc", "testmc1", "testmc2", "cdprocess"),
    },
    {
        "key": "cc",
        "role_label": "CC",
        "name_column_key": "Closing Coordinator Name",
        "roster_table_env_var": "CC_ROSTER_TABLE_NAME",
        "milestones": [
            "Processing", "App Fee Collected", "Assigned to UW",
            "Submittal", "UW Decision Expected", "Conditions Submitted to UW",
            "Approval", "Assign to Close", "Doc Signed",
        ],
        "active_milestones": ["Approval", "Assign to Close", "Doc Signed"],
        "already_assigned_selector": "LoanTeamMember.UserId.Ops_Assist_-_CC",
        "already_assigned_name_selector": "LoanTeamMember.Name.Ops_Assist_-_CC",
        "already_assigned_email_selector": "LoanTeamMember.Email.Ops_Assist_-_CC",
        "no_eligible_reason_code": REASON_CODES["NO_ELIGIBLE_CC"],
        "pipeline_exhausted_reason_code": REASON_CODES["PIPELINE_EXHAUSTED_CC"],
        "oneloan_role_slugs": ("ops-assist-cc",),
        "ignore_if_same_as_selector": None,
        "ignore_values": (),
    },
)

ALERT_ROLE_NAMES = {
    "uw": "Underwriter",
    "processor": "Processor/Loan Coordinator",
    "cc": "Closing Coordinator",
}

def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

async def _invoke_flowstate_lambda(payload: dict) -> None:
    function_name = os.getenv("FLOWSTATE_LAMBDA_NAME")
    if not function_name:
        raise RuntimeError("FLOWSTATE_LAMBDA_NAME environment variable is not set")

    response = await asyncio.to_thread(
        boto3.client("lambda").invoke,
        FunctionName=function_name,
        InvocationType="Event",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    if response.get("StatusCode") != 202:
        raise RuntimeError(f"Flowstate Lambda invocation was not accepted: {response.get('StatusCode')}")

    logger.info("Flowstate milestone Lambda accepted loan %s", payload.get("encompassGUID"))

    loan_number = str(payload["loanNumber"])
    table_name = os.environ["FLOWSTATE_WHITELIST_TABLE_NAME"]
    table = boto3.resource("dynamodb").Table(table_name)
    await asyncio.to_thread(table.put_item, Item={"loan_number": loan_number})


async def _invoke_first_review_lambda(payload: dict) -> None:
    function_name = os.getenv(FIRST_REVIEW_LAMBDA_NAME_ENV)
    if not function_name:
        raise RuntimeError(f"{FIRST_REVIEW_LAMBDA_NAME_ENV} environment variable is not set")

    response = await asyncio.to_thread(
        boto3.client("lambda").invoke,
        FunctionName=function_name,
        InvocationType="Event",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    if response.get("StatusCode") != 202:
        raise RuntimeError(f"First-review Lambda invocation was not accepted: {response.get('StatusCode')}")

    logger.info(
        "First-review Lambda accepted loan %s for assignment audit %s",
        payload.get("detail", {}).get("identity", {}).get("loanNumber"),
        payload.get("pipeline_assignment", {}).get("audit_id"),
    )

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
            ConditionExpression="attribute_not_exists(loan_number)",
        )
        return True
    except lock_table.meta.client.exceptions.ConditionalCheckFailedException:
        return False

def _failure_reason_text(role_config: dict, reason_code: str | None) -> str | None:
    """Translates reason codes to plain english"""
    if reason_code == role_config["no_eligible_reason_code"]:
        return "no eligible team member on the roster matches this loan's attributes"
    if reason_code == role_config["pipeline_exhausted_reason_code"]:
        return "every eligible team member is at their maximum pipeline size"
    if reason_code == REASON_CODES["ONELOAN_ROLE_ASSIGNMENT_FAILED"]:
        return "a team member was selected but the assignment could not be written to OneLoan"
    if reason_code == REASON_CODES["INVALID_EMPLOYEE_ID"]:
        return "a team member was selected but has no valid employee ID for OneLoan assignment"
    return None

def _collect_assignment_failures(results: dict) -> list[dict]:
    failures = []
    for role_config in ROLE_CONFIGS:
        key = role_config["key"]
        reason_code = results[key]["reason_code"]
        reason_text = _failure_reason_text(role_config, reason_code)
        if reason_text:
            failures.append({
                "role": ALERT_ROLE_NAMES[key],
                "reason_code": reason_code,
                "reason": reason_text,
            })
    return failures

def _assignment_date_bucket(now: datetime) -> str:
    return (now + timedelta(minutes=30)).astimezone(CHICAGO).strftime("%Y-%m-%d")


def _assignment_pdf_key(assignment_id: int, created_at: datetime) -> str:
    local_date = created_at.astimezone(CHICAGO).strftime("%Y-%m-%d")
    return f"{local_date}/{assignment_id}.pdf"

def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)

def _write_audit_record(
    table_name: str,
    id_: int,
    now: datetime,
    loan_number: str, loan_guid: str, loan_company: str,
    assigned_uw_id: str | None, assigned_uw_name: str | None, assigned_uw_email: str | None,
    assigned_processor_id: str | None, assigned_processor_name: str | None, assigned_processor_email: str | None,
    assigned_cc_id: str | None, assigned_cc_name: str | None, assigned_cc_email: str | None,
    reason_code_uw: str | None,
    reason_code_processor: str | None,
    reason_code_cc: str | None,
    attributes: dict,
    audit_log: str,
    pdf_s3_key: str | None,
    assignment_date: str,
) -> None:
    table = boto3.resource("dynamodb").Table(table_name)
    item = {
        "id": id_,
        "loan_number": loan_number,
        "created_at": now.isoformat(),
        "assignment_date": assignment_date,
        "loan_guid": loan_guid,
        "loan_company": loan_company,
        "assigned_uw_id": assigned_uw_id,
        "assigned_uw_name": assigned_uw_name,
        "assigned_uw_email": assigned_uw_email,
        "assigned_processor_id": assigned_processor_id,
        "assigned_processor_name": assigned_processor_name,
        "assigned_processor_email": assigned_processor_email,
        "assigned_cc_id": assigned_cc_id,
        "assigned_cc_name": assigned_cc_name,
        "assigned_cc_email": assigned_cc_email,
        "reason_code_uw": reason_code_uw,
        "reason_code_processor": reason_code_processor,
        "reason_code_cc": reason_code_cc,
        "attributes": attributes,
        "audit_log": audit_log,
    }
    if pdf_s3_key:
        item["pdf_s3_key"] = pdf_s3_key
    table.put_item(Item=item)


def _record_auto_decline(
    audit_table_name: str,
    loan_number: str,
    loan_guid: str,
    loan_company: str,
) -> int:
    now = datetime.now(timezone.utc)
    audit_id = time.time_ns()
    audit_lines = [
        f"Loan {loan_number} was auto-declined by Prajna.",
        "No pipeline assignments were made; no further action was taken.",
    ]
    logger.info("Auto-decline audit for loan %s:\n%s", loan_number, "\n".join(audit_lines))

    _write_audit_record(
        audit_table_name,
        audit_id,
        now,
        loan_number,
        loan_guid,
        loan_company,
        None, None, None,
        None, None, None,
        None, None, None,
        REASON_CODES["AUTO_DECLINED_NO_ASSIGNMENT"],
        REASON_CODES["AUTO_DECLINED_NO_ASSIGNMENT"],
        REASON_CODES["AUTO_DECLINED_NO_ASSIGNMENT"],
        {},
        "\n".join(audit_lines),
        None,
        _assignment_date_bucket(now),
    )
    return audit_id


def _finalize_audit(
    audit_table_name: str,
    pdf_bucket_name: str,
    audit_lines: list[str],
    loan_number: str,
    loan_guid: str,
    loan_company: str,
    loan_type: str | None,
    attributes: dict,
    results: dict,
) -> tuple[dict, bytes | None]:
    audit_log = "\n".join(audit_lines)
    logger.info("Full assignment audit trail for loan %s:\n%s", loan_number, audit_log)
    id_ = time.time_ns()
    now = datetime.now(timezone.utc)
    assignment_context = {
        "audit_id": id_,
        "created_at": now.isoformat(),
        "assignment_date": _assignment_date_bucket(now),
    }

    uw = results["uw"]
    processor = results["processor"]
    cc = results["cc"]

    pdf_s3_key = None
    pdf_bytes = None
    try:
        pdf_bytes = generate_assignment_pdf({
            "loan_number": loan_number,
            "loan_company": loan_company,
            "loan_type": loan_type,
            "created_at": now.isoformat(),
            "attributes": attributes,
            "audit_log": audit_log,
            "results": results,
        })
        pdf_s3_key = _assignment_pdf_key(id_, now)
        boto3.client("s3").put_object(
            Bucket=pdf_bucket_name,
            Key=pdf_s3_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
    except Exception:
        logger.exception(
            "Failed to generate/upload assignment PDF for loan %s; audit record will be written without one.",
            loan_number,
        )
        pdf_s3_key = None

    _write_audit_record(
        audit_table_name, id_, now, loan_number, loan_guid, loan_company,
        uw["id"] or "", uw["name"] or "", uw.get("email") or "",
        processor["id"] or "", processor["name"] or "", processor.get("email") or "",
        cc["id"] or "", cc["name"] or "", cc.get("email") or "",
        uw["reason_code"], processor["reason_code"], cc["reason_code"],
        attributes, audit_log, pdf_s3_key, assignment_context["assignment_date"],
    )
    return assignment_context, pdf_bytes


def _matches_attributes(member: dict, loan_attributes: dict) -> bool:
    return all(
        member.get(ATTRIBUTE_TO_ROSTER_COLUMN[flag_key], False)
        for flag_key, flagged in loan_attributes.items()
        if flagged
    )


def _get_eligible_people(
    table_name: str, loan_attributes: dict, prior_team_ids: set[str],
) -> list[dict]:
    table = boto3.resource("dynamodb").Table(table_name)

    people = []
    scan_kwargs = {}
    while True:
        response = table.scan(**scan_kwargs)
        people.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    eligible = []
    for member in people:
        if not member.get("New Assignments"):
            continue
        if (
            _matches_attributes(member, loan_attributes)
            or (
                member.get(ENCOMPASS_USER_ID_COLUMN) in prior_team_ids
                and member.get("Re-Submission", False)
            )
        ):
            eligible.append(member)

    return eligible

def _utilization(member: dict) -> float:
    """current_assigned / Max Pipeline Size, per P0-6. A member with Max Pipeline
    Size of 0 is treated as fully utilized (sorts last) rather than dividing
    by zero"""
    max_pipeline = member.get("Max Pipeline Size") or 0
    if max_pipeline <= 0:
        return float("inf")
    return member["current_pipeline_count"] / max_pipeline

async def _rank_eligible_people(
    eligible_people: list[dict], audit_lines: list[str], milestones: list[str],
    name_column_key: str, normal_ids: set[str], prior_ids: set[str],
    active_milestones: list[str] | None = None,
    roster_table_name: str | None = None,
) -> dict:
    enriched = []
    seen: set[str] = set()
    for member in eligible_people:
        encompass_id = member.get(ENCOMPASS_USER_ID_COLUMN)
        if not encompass_id:
            _log(audit_lines, logging.ERROR, "%s has no Encompass User ID in the roster; skipping from ranking.", member[name_column_key])
            continue
        if encompass_id in seen:
            continue
        seen.add(encompass_id)
 
        counts_raw = await GetTeamMemberPipelineCountTool().execute({
            "encompass_id": encompass_id,
            "milestones": milestones,
        })
        counts = json.loads(counts_raw)

        if not counts.get("success"):
            _log(audit_lines, logging.ERROR, "GetTeamMemberPipelineCountTool failed for %s: %s", member[name_column_key], counts)
            continue
        data = counts["data"]
        current_pipeline_count = data["current_pipeline_count"]
        _log(
            audit_lines, logging.INFO,
            "%s current pipeline count = %d",
            member[name_column_key], current_pipeline_count,
        )
        active_count = None
        if active_milestones:
            try:
                active_raw = await GetTeamMemberPipelineCountTool().execute({
                    "encompass_id": encompass_id,
                    "milestones": active_milestones,
                })
                active = json.loads(active_raw)
                active_data = active.get("data") if isinstance(active, dict) else None
                value = active_data.get("current_pipeline_count") if isinstance(active_data, dict) else None
                if (
                    not isinstance(active, dict) or not active.get("success")
                    or not isinstance(value, int) or isinstance(value, bool) or value < 0
                ):
                    raise ValueError("Active pipeline response did not contain a valid count")
                active_count = value
                _log(audit_lines, logging.INFO, "%s active pipeline count = %d",
                     member[name_column_key], active_count)
            except Exception as exc:
                _log(audit_lines, logging.WARNING,
                     "Active pipeline count failed for %s (%s); continuing with total-based ranking.",
                     member[name_column_key], type(exc).__name__)
        if roster_table_name:
            _store_pipeline_counts(
                roster_table_name, encompass_id, current_pipeline_count, active_count, audit_lines,
            )
        enriched.append({
            **member,
            "current_pipeline_count": current_pipeline_count,
        })

    def _sort_key(member: dict) -> tuple:
        return (_utilization(member), member.get(DAILY_COUNT_COLUMN, 0), member.get(LAST_ASSIGNED_COLUMN, "")
    )
 
    pipeline_available = []
    for member in enriched:
        max_pipeline = member.get("Max Pipeline Size") or 0
        current_pipeline = member["current_pipeline_count"]
        if current_pipeline < max_pipeline:
            pipeline_available.append(member)
        else:
            _log(
                audit_lines, logging.INFO,
                "%s dropped from pool due to reaching their total assignment cap limit of %d (Loans assigned total: %d)",
                member[name_column_key], max_pipeline, current_pipeline
            )

    prior_pool = [
        member for member in pipeline_available
        if member[ENCOMPASS_USER_ID_COLUMN] in prior_ids
    ]
    if prior_pool:
        prior_pool.sort(key=_sort_key)
        _log(
            audit_lines, logging.INFO,
            "Resubmission: %d prior %s candidate(s) below total pipeline capacity; "
            "bypassing attribute requirements and daily caps.",
            len(prior_pool), name_column_key.split(" ")[0],
        )
        return {"pool": prior_pool, "reason_code": REASON_CODES["ASSIGNED_FROM_RESUBMISSION_POOL"]}

    _log(audit_lines, logging.INFO, "No available prior-team match; applying normal assignment rules.")
    pipeline_available = [
        member for member in pipeline_available
        if member[ENCOMPASS_USER_ID_COLUMN] in normal_ids
    ]
    daily_capped_pool = []
    for member in pipeline_available:
        max_daily = member.get("Max Daily Assignments") or 0
        assigned_today = member.get(DAILY_COUNT_COLUMN, 0)
        if assigned_today < max_daily:
            daily_capped_pool.append(member)
        else:
            _log(
                audit_lines, logging.INFO,
                "%s dropped from pool due to reaching their daily assignment cap limit of %d (Loans assigned today: %d)",
                member[name_column_key], max_daily, assigned_today
            )

    if daily_capped_pool:
        daily_capped_pool.sort(key=_sort_key)
        return {"pool": daily_capped_pool, "reason_code": REASON_CODES["NORMAL"]}

    if not pipeline_available:
        return {"pool": [], "reason_code": REASON_CODES["NORMAL"]}

    _log(
        audit_lines, logging.INFO,
        "All %d skill-eligible %s(s) at their daily cap — applying %s",
        len(pipeline_available), name_column_key.split(" ")[0],
        REASON_CODES["DAILY_CAP_EXCEEDED_FALLBACK"],
    )

    fallback_pool = pipeline_available
    fallback_pool.sort(key=_sort_key)
    return {"pool": fallback_pool, "reason_code": REASON_CODES["DAILY_CAP_EXCEEDED_FALLBACK"]}

async def _assign_role_in_oneloan(role_config: dict, employee_id: int, loan_guid: str, company_code: str, audit_lines: list[str]) -> bool:
    role_label = role_config["role_label"]
    slugs = role_config["oneloan_role_slugs"]
    try:
        raw = await AssignOneLoanRoleTool().execute({
            "loan_guid": loan_guid,
            "company": company_code,
            "assignments": [{"role": slug, "user_id": employee_id} for slug in slugs],
        })
        result = json.loads(raw)
    except Exception:
        logger.exception("Unexpected error calling AssignOneLoanRoleTool for %s", role_label)
        _log(audit_lines, logging.ERROR, "OneLoan role assignment failed for %s (employee ID %s): unexpected error calling OneLoan.", role_label, employee_id)
        return False

    if result.get("success"):
        _log(audit_lines, logging.INFO, "Assigned %s in OneLoan as %s (employee ID %s).", role_label, ", ".join(slugs), employee_id)
        return True

    status = result.get("status")
    stage = result.get("stage")
    if status and stage:
        where = f" (HTTP {status} at {stage} step)"
    elif stage:
        where = f" (failed at {stage} step)"
    else:
        where = ""
    _log(audit_lines, logging.ERROR, "OneLoan role assignment failed for %s (employee ID %s): %s%s",
         role_label, employee_id, result.get("error", "unknown error"), where)
    return False

async def _assign_role(
    role_config: dict, fields: dict, attributes: dict, audit_lines: list[str],
    loan_guid: str, company_code: str, prior_team_ids: set[str],
) -> dict:
    """Run the eligibility/ranking/assignment flow for one role (UW,
    Processor, or CC), independently of the other two roles"""
    role_label = role_config["role_label"]
    name_column_key = role_config["name_column_key"]

    already_assigned_selector = role_config["already_assigned_selector"]
    if already_assigned_selector:
        existing_id = fields.get(already_assigned_selector)
        ignore_selector = role_config["ignore_if_same_as_selector"]
        if existing_id and (
            (ignore_selector and str(existing_id) == str(fields.get(ignore_selector)))
            or str(existing_id).strip().lower() in role_config["ignore_values"]
        ):
            _log(
                audit_lines, logging.INFO,
                "%s value (%s) is a placeholder or matches the Loan Officer; treating %s as unassigned.",
                role_label, existing_id, role_label,
            )
            existing_id = None
        if existing_id:
            existing_name = fields.get(role_config["already_assigned_name_selector"])
            _log(
                audit_lines, logging.INFO,
                "Loan already has a %s assigned (%s / %s); skipping %s assignment.",
                role_label, existing_name, existing_id, role_label,
            )
            existing_email = fields.get(role_config["already_assigned_email_selector"])
            return {"id": existing_id, "name": existing_name, "email": existing_email, "reason_code": REASON_CODES["ALREADY_ASSIGNED"]}

    roster_table_name = os.getenv(role_config["roster_table_env_var"])
    eligible = _get_eligible_people(roster_table_name, attributes, prior_team_ids)
    normal_ids = {
        member[ENCOMPASS_USER_ID_COLUMN] for member in eligible
        if member.get(ENCOMPASS_USER_ID_COLUMN) and _matches_attributes(member, attributes)
    }
    prior_ids = {
        member[ENCOMPASS_USER_ID_COLUMN] for member in eligible
        if member.get(ENCOMPASS_USER_ID_COLUMN) in prior_team_ids
        and member.get("Re-Submission", False)
    }
    _log(audit_lines, logging.INFO, "Found %d combined %s candidate(s): %s",
        len(eligible), role_label, [member[name_column_key] for member in eligible])
    _log(audit_lines, logging.INFO, "%s candidate membership: %d normal, %d prior-team with Re-Submission enabled.",
         role_label, len(normal_ids), len(prior_ids))
    audit_lines.append("")

    if not eligible:
        _log(audit_lines, logging.ERROR,
            "No eligible %s found; holding for manual review.",
            role_label)
        return {"id": None, "name": None, "email": None, "reason_code": role_config["no_eligible_reason_code"]}

    ranking = await _rank_eligible_people(
        eligible, audit_lines, role_config["milestones"], name_column_key, normal_ids, prior_ids,
        role_config.get("active_milestones"), roster_table_name,
    )
    ranked_pool = ranking["pool"]

    if not ranked_pool:
        _log(audit_lines, logging.ERROR, "Pipeline-exhausted for %s; holding for overflow queue.", role_label)
        return {"id": None, "name": None, "email": None, "reason_code": role_config["pipeline_exhausted_reason_code"]}

    audit_lines.append("")
    selected = ranked_pool[0]
    _log(audit_lines, logging.INFO, "Selected %s %s (reason: %s)",
         role_label, selected[name_column_key], ranking["reason_code"] or "normal assignment")
    audit_lines.append("")

    for member in ranked_pool:
        _log(audit_lines, logging.INFO,
            "%s %s: percent capacity of loan pipeline used=%.3f, loans assigned so far today=%d, last assigned loan=%s",
            role_label, member[name_column_key], _utilization(member), member.get(DAILY_COUNT_COLUMN, 0),
            member.get(LAST_ASSIGNED_COLUMN) or "Never")

    if os.getenv(ASSIGN_ROLES_ENV, "").lower() == "true":
        raw_employee_id = selected.get(EMPLOYEE_ID_COLUMN)
        try:
            employee_id = int(raw_employee_id) if raw_employee_id not in (None, "") else None
        except (TypeError, ValueError):
            employee_id = None

        if employee_id is None:
            _log(audit_lines, logging.ERROR, "No usable employee ID in the roster for %s %s; cannot assign in OneLoan.", role_label, selected[name_column_key])
            return {"id": None, "name": None, "email": None, "reason_code": REASON_CODES["INVALID_EMPLOYEE_ID"]}
        elif not await _assign_role_in_oneloan(role_config, employee_id, loan_guid, company_code, audit_lines):
            return {"id": None, "name": None, "email": None, "reason_code": REASON_CODES["ONELOAN_ROLE_ASSIGNMENT_FAILED"]}
        _increment_pipeline_counts(
            roster_table_name, selected, name_column_key, role_config["key"] == "processor", audit_lines,
        )

    _record_assignment(roster_table_name, selected[ENCOMPASS_USER_ID_COLUMN], role_label, audit_lines)

    return {
        "id": selected[ENCOMPASS_USER_ID_COLUMN],
        "name": selected[name_column_key],
        "email": selected.get(EMAIL_COLUMN),
        "reason_code": ranking["reason_code"],
    }

async def _get_prior_team_ids(fields: dict, audit_lines: list[str]) -> set[str]:
    ssn = fields.pop("65", None)
    if not isinstance(ssn, str) or not ssn.strip():
        _log(audit_lines, logging.WARNING,
             "Borrower SSN missing/invalid; borrower history unavailable. Continuing normal assignment.")
        return set()
    try:
        raw = await GetBorrowerPriorLoanTeamTool().execute({"ssns": [ssn]})
        response = json.loads(raw)
        data = response.get("data") if isinstance(response, dict) else None
        ids = data.get("prior_team_member_ids") if isinstance(data, dict) else None
        if (
            not isinstance(response, dict) or not response.get("success")
            or not isinstance(ids, list)
            or any(not isinstance(member, str) or not member.strip() for member in ids)
        ):
            _log(audit_lines, logging.WARNING,
                 "Borrower history lookup failed or returned invalid data; continuing normal assignment.")
            return set()
    except (ValueError, TypeError, RuntimeError):
        # Do not log exceptions or responses that could contain the borrower SSN.
        _log(audit_lines, logging.WARNING,
             "Borrower history lookup raised an error; continuing normal assignment.")
        return set()
    prior_ids = set(ids)
    _log(audit_lines, logging.INFO, "Borrower history: %d unique prior team member(s) found.", len(prior_ids))
    _log(audit_lines, logging.INFO, "Borrower history prior user IDs: %s", json.dumps(ids))
    return prior_ids


def _store_pipeline_counts(
    table_name: str, encompass_id: str, current_count: int, active_count: int | None,
    audit_lines: list[str],
) -> None:
    names = {
        "#pk": ENCOMPASS_USER_ID_COLUMN,
        "#current": CURRENT_PIPELINE_COLUMN,
        "#updated": PIPELINE_UPDATED_COLUMN,
    }
    values = {":current": current_count, ":now": datetime.now(timezone.utc).isoformat()}
    expression = "SET #current = :current, #updated = :now"
    if active_count is not None:
        names["#active"] = ACTIVE_PIPELINE_COLUMN
        values[":active"] = active_count
        expression += ", #active = :active"
    try:
        boto3.resource("dynamodb").Table(table_name).update_item(
            Key={ENCOMPASS_USER_ID_COLUMN: encompass_id},
            UpdateExpression=expression,
            ConditionExpression="attribute_exists(#pk)",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
    except (BotoCoreError, ClientError) as exc:
        _log(audit_lines, logging.WARNING,
             "Could not store pipeline counts for %s in %s (%s); continuing with total-based ranking.",
             encompass_id, table_name, str(exc))


def _increment_pipeline_counts(
    table_name: str, member: dict, name_column_key: str, increment_active: bool,
    audit_lines: list[str],
) -> None:
    names = {
        "#pk": ENCOMPASS_USER_ID_COLUMN,
        "#current": CURRENT_PIPELINE_COLUMN,
        "#updated": PIPELINE_UPDATED_COLUMN,
    }
    values = {
        ":baseline": member["current_pipeline_count"],
        ":one": 1,
        ":now": datetime.now(timezone.utc).isoformat(),
    }
    expression = "SET #current = if_not_exists(#current, :baseline) + :one, #updated = :now"
    condition = "attribute_exists(#pk)"
    if increment_active:
        names["#active"] = ACTIVE_PIPELINE_COLUMN
        expression += ", #active = #active + :one"
        condition += " AND attribute_exists(#active)"
    try:
        table = boto3.resource("dynamodb").Table(table_name)
        try:
            response = table.update_item(
                Key={ENCOMPASS_USER_ID_COLUMN: member[ENCOMPASS_USER_ID_COLUMN]},
                UpdateExpression=expression,
                ConditionExpression=condition,
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            if not increment_active:
                raise
            # No known active baseline: increment only the total, without inventing one.
            del names["#active"]
            response = table.update_item(
                Key={ENCOMPASS_USER_ID_COLUMN: member[ENCOMPASS_USER_ID_COLUMN]},
                UpdateExpression=expression.split(", #active")[0],
                ConditionExpression="attribute_exists(#pk)",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
        attributes = response["Attributes"]
        active = attributes.get(ACTIVE_PIPELINE_COLUMN)
        _log(audit_lines, logging.INFO,
             "%s roster pipeline counts after assignment: current = %s, active = %s",
             member[name_column_key], attributes[CURRENT_PIPELINE_COLUMN],
             active if active is not None else "unavailable")
    except (BotoCoreError, ClientError) as exc:
        _log(audit_lines, logging.WARNING,
             "Could not increment roster pipeline counts after assignment for %s (%s).",
             member[name_column_key], str(exc))


def _record_assignment(table_name: str, encompass_id: str, role_label: str, audit_lines: list[str]) -> None:
    table = boto3.resource("dynamodb").Table(table_name)
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        table.update_item(
            Key={ENCOMPASS_USER_ID_COLUMN: encompass_id},
            UpdateExpression="SET #count = if_not_exists(#count, :zero) + :incr, #last_assigned = :now",
            ConditionExpression="attribute_exists(#pk)",
            ExpressionAttributeNames={
                "#pk": ENCOMPASS_USER_ID_COLUMN,
                "#count": DAILY_COUNT_COLUMN,
                "#last_assigned": LAST_ASSIGNED_COLUMN,
            },
            ExpressionAttributeValues={":zero": 0, ":incr": 1, ":now": now_iso},
        )
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        _log(
            audit_lines, logging.WARNING,
            "Could not record assignment (%s / %s) for %s %s — roster row no longer exists.",
            DAILY_COUNT_COLUMN, LAST_ASSIGNED_COLUMN, role_label, encompass_id,
        )

async def _send_assignment_failure_alert(
    loan_number: str, company_code: str, failures: list[dict], pdf_bytes: bytes | None,
) -> None:
    recipients = [addr.strip() for addr in os.getenv(FAILURE_ALERT_RECIPIENTS_ENV, "").split(",") if addr.strip()]
    if not recipients:
        logger.error("%s environment variable is not set; skipping failure alert email for loan %s", FAILURE_ALERT_RECIPIENTS_ENV, loan_number)
        return

    lines = "".join(
        f"<li>Loan {html.escape(str(loan_number))} failed to be assigned to "
        f"{html.escape(f['role'])} because {html.escape(f['reason'])}.</li>"
        for f in failures
    )
    body = (
        f"<p>Loan {html.escape(str(loan_number))} ({html.escape(str(company_code))}) "
        f"was not fully assigned:</p><ul>{lines}</ul>"
        "<p>The assignment report for this loan is attached.</p>"
    )

    attachments = []
    if pdf_bytes:
        attachments.append({
            "content": base64.b64encode(pdf_bytes).decode("ascii"),
            "encoding": "base64",
            "contentType": "application/pdf",
            "filename": f"{loan_number} HELOAN Pipeline Assignment Report.pdf",
        })
    else:
        logger.warning("No PDF available for loan %s; sending failure alert without an attachment", loan_number)

    try:
        send_result_raw = await SendEmailTool().execute({
            "body": body,
            "to": [{"address": address} for address in recipients],
            "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
            "subject": f"HELOAN Loan {loan_number} Not Fully Assigned",
            "attachments": attachments,
        })
        send_result = json.loads(send_result_raw)
        if not send_result.get("success"):
            logger.error("Failed to send assignment failure alert for loan %s: %s", loan_number, send_result)
            return
    except Exception:
        logger.exception("Unexpected error sending assignment failure alert for loan %s", loan_number)
        return

    logger.info("Sent assignment failure alert for loan %s (%d failed role(s))", loan_number, len(failures))


def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))

async def _handler(event: dict, context) -> dict:
    audit_lines: list[str] = []
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    # Load secrets into environment variables
    for key, value in secrets.items():
        os.environ[key] = value

    audit_table_name = os.getenv("ASSIGNMENT_AUDIT_TABLE_NAME")
    pdf_bucket_name = os.getenv("ASSIGNMENT_PDF_BUCKET_NAME")

    # Extract loan number, encompass GUID, and company code from the event payload
    loan_number = event.get("detail", {}).get("identity", {}).get("loanNumber")
    encompass_guid = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    for flag in ("skip_underwriting_assignment", "manual", "skip_flowstate", "skip_first_review"):
        if flag in event and not isinstance(event[flag], bool):
            logger.error("%s must be a boolean.", flag)
            return {"statusCode": 400, "body": json.dumps({
                "error": f"{flag} must be a boolean."
            })}
    skip_underwriting_assignment = event.get("skip_underwriting_assignment", False)
    manual = event.get("manual", False)
    skip_flowstate = event.get("skip_flowstate", False)
    skip_first_review = event.get("skip_first_review", False)
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}
    if not encompass_guid:
        logger.error("Encompass GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass GUID is required in the event payload."})}
    _log(audit_lines, logging.INFO, "Received HELOAN pipeline-assignment event for loan number: %s w/ company code: %s", loan_number, company_code)

    if event.get("decision") == "DECLINE":
        if not audit_table_name:
            logger.error("ASSIGNMENT_AUDIT_TABLE_NAME environment variable is not set")
            return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
        audit_id = _record_auto_decline(audit_table_name, loan_number, encompass_guid, company_code)
        return {"statusCode": 200, "body": json.dumps({
            "loan_number": loan_number,
            "decision": "DECLINE",
            "reason_code": REASON_CODES["AUTO_DECLINED_NO_ASSIGNMENT"],
            "audit_id": audit_id,
        })}

    requested_fields = [
        "65",                   # Borrower SSN; never log this value
        "URLA.X21",              # Borrower language preference
        "URLA.X22",              # Co-borrower language preference
        "CX.VP.MEMBERSHIP",      # Chairman's Club / President's Club (same field, both attributes)
        "2",                     # Base Loan Amount
        "CX.ANY.BORR.SELF.EMPLOYED",  # Self-employed indicator
        "BE0109",                # Borrower — CurrentEmploymentIndicator 
        "CE0109",                # Co-borrower — CurrentEmploymentIndicator 
        "FM0146",                # REO Owner values across all reoProperties
        "1811",                  # Property Will Be (Investor / SecondHome / PrimaryResidence)
        "1041",                  # Subject Property Type
        "16",                    # Subject Property # Units — Multi-Family attribute (units > 1)
        "CX.PLOCSTCNTR",           # Cost Center — Retail attribute
        "MS.STATUS",             # Loan.MilestoneCurrentName 
        "MS.STATUSDATE",         # Loan.MilestoneCurrentDateUtc 
        "1401",
        "11",
        "LoanTeamMember.UserId.Mortgage_Consultant",
        "LoanTeamMember.Name.Mortgage_Consultant",
        "LoanTeamMember.Email.Mortgage_Consultant",
        "LoanTeamMember.UserId.Ops_Assist_-_CC",
        "LoanTeamMember.Name.Ops_Assist_-_CC",
        "LoanTeamMember.Email.Ops_Assist_-_CC",
        "LoanTeamMember.UserId.Loan_Officer",
    ]

    try:
        loan_response_raw = await GetLoanTool().execute({
            "loan_identifier": encompass_guid,
            "company": company_code,
            "requestedProperties": requested_fields
        })
        loan_response = json.loads(loan_response_raw)
        if not loan_response.get("success"):
            logger.error("GetLoanTool call failed for loan %s", loan_number)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan fields"})}

    except Exception:
        logger.exception("Failed to fetch loan fields via GetLoanTool for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan fields"})}

    fields = loan_response.get("data", {})

    _log(audit_lines, logging.INFO, "HELOAN auto-assignment fields for loan %s: %s",
                loan_number, json.dumps({key: value for key, value in fields.items() if key != "65"}))

    # Verify milestone directly off the loan (MS.STATUS)
    milestone = fields.get("MS.STATUS")
    loan_program = fields.get("1401")
    is_supported_program = (
        re.search(r"\b(?:CES|HELOAN)\b", loan_program or "", re.IGNORECASE)
        and "brokered" not in (loan_program or "").casefold()
    )
    if manual:
        _log(audit_lines, logging.INFO, "Milestone and loan-program checks bypassed by manual request.")
    if not manual and os.getenv("ENVIRONMENT") == "prod" and milestone != "Sent to processing":
        _log(audit_lines, logging.INFO, "Skipping event for loan %s with milestone: %s", loan_number, milestone)
        return {"statusCode": 200, "body": json.dumps({"message": "Milestone not yet reached; event ignored"})}

    if not manual and os.getenv("ENVIRONMENT") == "prod" and not is_supported_program:
        _log(audit_lines, logging.INFO, "Skipping event for loan %s with unsupported loan program: %s", loan_number, loan_program)
        return {"statusCode": 200, "body": json.dumps({"message": "Unsupported product; event ignored"})}

    if os.getenv("ENVIRONMENT") == "prod":
        lock_table_name = os.getenv(LOCK_TABLE_NAME_ENV)
        if not lock_table_name:
            logger.error("%s environment variable is not set; refusing to process without duplicate-event protection.", LOCK_TABLE_NAME_ENV)
            return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

        if not _claim_loan_lock(lock_table_name, loan_number):
            _log(audit_lines, logging.INFO, "Loan %s already claimed by another invocation within the last %s; skipping as a likely duplicate event.", loan_number, DUPLICATE_LOCK_WINDOW)
            return {"statusCode": 200, "body": json.dumps({"message": "Duplicate event; loan already claimed for processing"})}
    
    # Compute the 12 segmentation attributes from the fields already fetched above
    prior_team_ids = await _get_prior_team_ids(fields, audit_lines)
    attributes = get_loan_attributes(fields, audit_lines)
    _log(audit_lines, logging.INFO, "HELOAN segmentation attributes for loan %s: %s", loan_number, json.dumps(attributes))
    audit_lines.append("")

    results: dict[str, dict] = {}
    for role_config in ROLE_CONFIGS:
        if role_config["key"] == "uw" and skip_underwriting_assignment:
            _log(audit_lines, logging.INFO, "Underwriter assignment skipped by request.")
            results["uw"] = {
                "id": None,
                "name": None,
                "email": None,
                "reason_code": REASON_CODES["SKIPPED_BY_REQUEST"],
            }
        else:
            results[role_config["key"]] = await _assign_role(
                role_config, fields, attributes, audit_lines, encompass_guid, company_code, prior_team_ids,
            )
        audit_lines.append("")

    if skip_flowstate:
        _log(audit_lines, logging.INFO, "Flowstate Lambda invocation skipped by request.")
    elif results["processor"]["reason_code"] in (
        REASON_CODES["NORMAL"],
        REASON_CODES["DAILY_CAP_EXCEEDED_FALLBACK"],
        REASON_CODES["ASSIGNED_FROM_RESUBMISSION_POOL"],
    ):
        try:
            flowstate_payload = {
                "loanType": "HELOAN",
                "loanNumber": loan_number,
                "encompassGUID": encompass_guid,
                "company": company_code,
                "propertyAddress": fields.get("11"),
            }
            _log(audit_lines, logging.INFO, "Invoking Flowstate milestone Lambda with payload: %s", json.dumps(flowstate_payload))
            await _invoke_flowstate_lambda(flowstate_payload)
        except Exception:
            logger.exception("Failed to dispatch or whitelist Flowstate loan %s", loan_number)

    if skip_first_review:
        _log(audit_lines, logging.INFO, "First-review Lambda invocation skipped by request.")

    assignment_context, pdf_bytes = _finalize_audit(
        audit_table_name, pdf_bucket_name, audit_lines, loan_number, encompass_guid,
        company_code, fields.get("1401"), attributes, results,
    )

    first_review_invoked = False
    if not skip_first_review:
        try:
            await _invoke_first_review_lambda({
                "detail": event.get("detail", {}),
                "pipeline_assignment": {
                    **assignment_context,
                    "results": results,
                },
            })
            first_review_invoked = True
        except Exception:
            logger.exception(
                "Failed to invoke first-review Lambda for loan %s after assignment audit %s",
                loan_number,
                assignment_context["audit_id"],
            )
    
    failures = _collect_assignment_failures(results)
    if failures:
        await _send_assignment_failure_alert(loan_number, company_code, failures, pdf_bytes)

    uw_result = results["uw"]

    return {"statusCode": 200, "body": json.dumps({
        "loan_number": loan_number,
        "attributes": attributes,
        "assigned_uw": uw_result["name"],
        "reason_code_uw": uw_result["reason_code"],
        "assigned_processor": results["processor"]["name"],
        "reason_code_processor": results["processor"]["reason_code"],
        "assigned_cc": results["cc"]["name"],
        "reason_code_cc": results["cc"]["reason_code"],
        "first_review_invoked": first_review_invoked,
    })}