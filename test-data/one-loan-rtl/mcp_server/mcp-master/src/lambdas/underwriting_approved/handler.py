import json
import logging
import os
import asyncio
import re
import time
from datetime import date, datetime, timezone
from typing import Dict, Optional
import boto3
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from src.tools.oneloan_tools import GetLoanTool
from src.tools.taskmaster_tools import (
    CreateTasksTool,
    GetConditionTaskTemplatesTool,
    GetTaskTemplatesTool,
    GetTasksTool,
    RemoveTaskTool,
)
from src.tools.borrower_entity_tools import SearchBorrowerEntityTool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

#PILOT_LO_IDS = {2800,16198,11421,8312,8843,2135,29778,7347,34253,35035,4723}
PILOT_LC_IDS = {"jcorcoran", "vbastianelli", "jrutzen", "wbarker", "clagonzalez", "mkoehler", "lmonge", "dougn"}

def _flatten_tasks(results: list) -> list:
    """Expand task objects that embed additional tasks as task2_xxx, task3_xxx, etc.
    into separate flat task objects all using the task_xxx key format."""
    flat = []
    for item in results:
        prefixes = sorted(
            {m.group(1) for k in item for m in [re.match(r'^(task\d*)_', k)] if m},
            key=lambda p: int(p[4:]) if p[4:].isdigit() else 0,
        )
        # Fields that don't belong to any task prefix (e.g. uw_condition_guid)
        shared_fields = {k: v for k, v in item.items() if not any(k.startswith(p + "_") for p in prefixes)}
        for prefix in prefixes:
            task = {
                "task_" + k[len(prefix) + 1:]: v
                for k, v in item.items()
                if k.startswith(prefix + "_")
            }
            if task:
                flat.append({**shared_fields, **task})
    return flat


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def _acquire_idempotency_lock(loan_number: str, ttl_seconds: int = 30) -> bool:
    """Attempt to claim an idempotency lock for the given loan number in DynamoDB.

    Uses a conditional write so only the first concurrent invocation succeeds.
    Returns True if the lock was acquired (safe to proceed), False if a duplicate
    invocation already claimed it within the TTL window.

    The DynamoDB table name is read from the IDEMPOTENCY_TABLE_NAME env var and
    defaults to 'mcp-underwriting-approved-idempotency-dev'. The table must have
    'loan_number' (String) as its partition key and a TTL attribute named 'expires_at'.
    """
    table_name = os.getenv("IDEMPOTENCY_TABLE_NAME", "mcp-underwriting-approved-idempotency-dev")
    expires_at = int(time.time()) + ttl_seconds
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table = dynamodb.Table(table_name)
    try:
        table.put_item(
            Item={
                "loan_number": loan_number,
                "expires_at": expires_at,
            },
            # Allow overwrite if item doesn't exist OR if the existing lock has expired,
            # since DynamoDB TTL deletion is eventually consistent and may lag.
            ConditionExpression="attribute_not_exists(loan_number) OR expires_at < :now",
            ExpressionAttributeValues={":now": int(time.time())},
        )
        return True
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return False
    except Exception:
        # If DynamoDB is unavailable, log the error but allow processing to continue
        # rather than blocking all events.
        logger.exception(
            "Idempotency lock check failed for loan %s; proceeding without deduplication",
            loan_number,
        )
        return True


def _write_conditions_to_tasks_rows(
    loan_number: str,
    company_code: str,
    gr_loan_id: str,
    loan_id: str,
    rows: list,
) -> None:
    """Persist one row per underwriting condition (including filtered-out conditions)
    to the full audit table, joined with any generated task data.

    The table name is read from the UW_CONDITIONS_TO_TASKS_TABLE_NAME env var and defaults
    to 'mcp-underwriting-conditions-to-tasks-dev'. The table must have 'loan_number' (String)
    as its partition key and 'row_id' (String) as its sort key.
    """
    table_name = os.getenv("UW_CONDITIONS_TO_TASKS_TABLE_NAME", "mcp-underwriting-conditions-to-tasks-dev")
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table = dynamodb.Table(table_name)
    now = datetime.now(timezone.utc).isoformat()
    # Counts rows per condition guid so multiple tasks from the same condition (task2_/task3_
    # flattening) never collide, even if they resolve to the same task-template-id.
    guid_seen_count: Dict[str, int] = {}
    with table.batch_writer() as batch:
        for row in rows:
            guid = row.get("uw_condition_guid") or "no-guid"
            task_template_id = row.get("task_template_id") or "no-task"
            n = guid_seen_count.get(guid, 0)
            guid_seen_count[guid] = n + 1
            item = {
                "loan_number": loan_number,
                "row_id": f"{guid}:{task_template_id}:{n}",
                "company": company_code,
                "gr_loan_guid": gr_loan_id or "",
                "encompass_guid": loan_id or "",
                "datetime_stamp": now,
                "uw_condition_guid": row.get("uw_condition_guid", ""),
                "condition_title": row.get("condition_title", ""),
                "condition_description": row.get("condition_description", ""),
                "condition_filtered_out": row.get("condition_filtered_out", False),
                "task_template_id": row.get("task_template_id") or "",
                "task_key": row.get("task_key") or "",
                "task_title": row.get("task_title") or "",
                "task_description": row.get("task_description") or "",
                "task_type": row.get("task_type") or "",
                "task_action_type": row.get("task_action_type") or "",
                "task_category": row.get("task_category") or "",
                "task_display_type": row.get("task_display_type") or "",
                "task_meta": json.dumps(row.get("task_meta")) if row.get("task_meta") else "",
                "task_assigned_to": row.get("task_assigned_to") or "",
                "existing_task_removed": row.get("existing_task_removed", False),
            }
            batch.put_item(Item=item)
    logger.info(
        "Wrote conditions-to-tasks rows to DynamoDB for loan %s: table=%s row_count=%d",
        loan_number,
        table_name,
        len(rows),
    )


def _write_loan_data_to_dynamodb(loan_number: str, conditions_list: list, new_tasks_list: list) -> None:
    """Persist loan conditions and successfully created tasks to DynamoDB for review.

    The table name is read from the UW_TASKS_TABLE_NAME env var and defaults to
    'mcp-underwriting-tasks-dev'. The table must have 'loan_number' (String) as
    its partition key and 'created_at' (String, ISO 8601) as its sort key.
    """
    table_name = os.getenv("UW_TASKS_TABLE_NAME", "mcp-underwriting-tasks-dev")
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table = dynamodb.Table(table_name)
    table.put_item(
        Item={
            "loan_number": loan_number,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "conditions_count": len(conditions_list),
            "new_tasks_count": len(new_tasks_list),
            "conditions_list": json.dumps(conditions_list),
            "new_tasks_list": json.dumps(new_tasks_list),
        }
    )
    logger.info(
        "Wrote loan data to DynamoDB for loan %s: table=%s conditions=%d tasks=%d",
        loan_number,
        table_name,
        len(conditions_list),
        len(new_tasks_list),
    )


def lambda_handler(event, context):
    result = asyncio.run(_handler(event, context))
    if result.get("statusCode", 200) >= 400:
        logger.error("UNDERWRITING_APPROVED_PROCESSING_FAILED status_code=%s", result["statusCode"])
    return result


_TEMPLATE_CACHE: Dict[str, Optional[float | str | Dict]] = {
    "task_templates": None,
    "expires_at": None,
}


async def _get_task_templates():
    task_templates = _TEMPLATE_CACHE.get("task_templates")
    expires_at = _TEMPLATE_CACHE.get("expires_at")
    current_time = time.time()

    if task_templates and isinstance(expires_at, float) and current_time < expires_at:
        return task_templates
    try:
        raw = await GetTaskTemplatesTool().execute({})
        result = json.loads(raw)
        _TEMPLATE_CACHE["task_templates"] = result
        _TEMPLATE_CACHE["expires_at"] = current_time + 3600  # Cache for 1hr
        return result
    except Exception as e:
        logger.exception("Failed to fetch task templates")
        return {"success": False, "error": "Failed to fetch task templates"}



def _resolve_task_template_ids(new_tasks: list, task_templates: list) -> list:
    """Replace the task_template_id value in each flattened Prajna task (which
    holds the template key string, e.g. 'standard_lox') with the correct
    Taskmaster UUID by matching on taskTemplateKey."""
    key_to_template: Dict[str, Dict] = {
        t["taskTemplateKey"]: t
        for t in task_templates
        if "taskTemplateKey" in t and "taskTemplateId" in t
    }

    resolved = []
    for task in new_tasks:
        task_template_key = task.get("task_template_id")  # Prajna's key used to resolve the Taskmaster template.
        template = key_to_template.get(task_template_key) if task_template_key else None
        if template:
            correct_id = template.get("taskTemplateId")
            task = {
                **task,
                # Preserve Prajna's distinct key; fall back to its lookup key when absent.
                "template_key": task.get("template_key") or task_template_key,
                "task_template_id": correct_id,
                "task_key": template.get("taskTemplateKey"),
                "task_action_type": template.get("taskActionType"),
                "task_category": template.get("taskCategory"),
                "task_display_type": template.get("taskDisplayType")
            }
            logger.info("Resolved task template data for key '%s' -> '%s'", task_template_key, correct_id)
        else:
            logger.warning(
                "Could not resolve task template ID for key '%s'; task will be skipped",
                task_template_key,
            )
            continue
        resolved.append(task)

    return resolved


def _condition_template_text(task_template: dict, field: str) -> str:
    value = task_template.get(field) or {}
    if not isinstance(value, dict):
        return ""
    return str(value.get("en") or "")


def _condition_templates_by_title(template_results: list) -> Dict[str, list[dict]]:
    templates_by_condition = {}
    for result in template_results:
        if not isinstance(result, dict):
            continue
        condition_key = " ".join(str(result.get("conditionKey") or "").casefold().split())
        templates = result.get("taskTemplates") or []
        if condition_key and isinstance(templates, list):
            templates_by_condition[condition_key] = [
                template for template in templates if isinstance(template, dict)
            ]
    return templates_by_condition


def _condition_task_template_fields(template_results: list) -> Dict[str, Dict[str, str]]:
    """Map condition titles to English Prajna template hints for up to two tasks."""
    fields_by_condition = {}
    for condition_key, templates in _condition_templates_by_title(template_results).items():
        fields = {}
        for index, template in enumerate(templates[:2]):
            if not isinstance(template, dict):
                continue
            prefix = "task" if index == 0 else "task2"
            fields[f"{prefix}_title_template"] = _condition_template_text(template, "taskTitleTemplates")
            fields[f"{prefix}_description_template"] = _condition_template_text(template, "taskDescriptionTemplates")
        fields_by_condition[condition_key] = fields
    return fields_by_condition


async def _get_condition_task_templates(condition_titles: list[str]) -> Dict[str, list[dict]]:
    unique_titles = list(dict.fromkeys(
        title.strip() for title in condition_titles if isinstance(title, str) and title.strip()
    ))
    if not unique_titles:
        return {}
    try:
        raw = await GetConditionTaskTemplatesTool().execute({"conditionKeys": unique_titles})
        result = json.loads(raw)
    except Exception:
        logger.exception("Failed to fetch condition task templates")
        raise RuntimeError("Failed to fetch condition task templates") from None
    if not isinstance(result, dict) or not result.get("success") or not isinstance(result.get("data"), list):
        logger.error("Taskmaster returned an unsuccessful condition template lookup")
        raise RuntimeError("Failed to fetch condition task templates")
    return _condition_templates_by_title(result["data"])


def _build_prajna_conditions(condition_logs: list, templates_by_title: Dict[str, Dict[str, str]]) -> list:
    prajna_conditions = []
    for condition in condition_logs:
        title = condition.get("title", "")
        normalized_title = " ".join(str(title).casefold().split())
        template_fields = templates_by_title.get(normalized_title, {})
        if not template_fields:
            logger.info(
                "Skipping condition without Taskmaster task templates: condition_title=%s guid=%s",
                title,
                condition.get("guid", ""),
            )
            continue
        prajna_condition = {
            "condition_title": title,
            "condition_description": condition.get("description", ""),
            "uw_condition_guid": condition.get("guid", ""),
            "task_title_template": template_fields.get("task_title_template", ""),
            "task_description_template": template_fields.get("task_description_template", ""),
        }
        if "task2_title_template" in template_fields:
            prajna_condition["task2_title_template"] = template_fields["task2_title_template"]
            prajna_condition["task2_description_template"] = template_fields.get("task2_description_template", "")
        prajna_conditions.append(prajna_condition)
    return prajna_conditions


def _condition_templates_by_guid(
    condition_logs: list,
    templates_by_title: Dict[str, list[dict]],
) -> Dict[str, list[dict]]:
    templates_by_guid = {}
    for condition in condition_logs:
        title_key = " ".join(str(condition.get("title") or "").casefold().split())
        condition_guid = str(condition.get("guid") or "")
        if condition_guid and title_key in templates_by_title:
            templates_by_guid[condition_guid] = templates_by_title[title_key]
    return templates_by_guid


def _resolve_condition_task_templates(
    tasks: list,
    templates_by_guid: Dict[str, list[dict]],
) -> list:
    """Enrich AI-generated task text with metadata from its condition template."""
    template_indexes = {}
    resolved = []
    for task in tasks:
        condition_guid = str(task.get("uw_condition_guid") or "")
        templates = templates_by_guid.get(condition_guid, [])
        template_index = template_indexes.get(condition_guid, 0)
        template_indexes[condition_guid] = template_index + 1
        if template_index >= len(templates):
            logger.warning(
                "No Taskmaster condition template found for generated task: condition_guid=%s task_index=%d",
                condition_guid,
                template_index,
            )
            continue

        template = templates[template_index]
        task = {
            **task,
            "task_template_id": template.get("taskTemplateId"),
            "template_key": template.get("taskTemplateKey"),
            "task_key": template.get("taskTemplateKey"),
            "task_action_type": template.get("taskActionType"),
            "task_category": template.get("taskCategory"),
            "task_display_type": template.get("taskDisplayType"),
        }
        resolved.append(task)
    return resolved


def _attach_condition_guids(results: list, conditions: list) -> list:
    """Restore condition identity by position when Prajna omits GUIDs in a 1:1 result set."""
    if len(results) != len(conditions):
        return results
    associated = []
    for result, condition in zip(results, conditions):
        if not isinstance(result, dict):
            associated.append(result)
            continue
        if result.get("uw_condition_guid"):
            associated.append(result)
            continue
        associated.append({
            **result,
            "uw_condition_guid": condition.get("uw_condition_guid") or condition.get("guid", ""),
        })
    return associated


_PURCHASE_ONLY_EXCLUDED_TITLES = {
    "Provide HOA Dues Documentation",
    "Provide Lease Agreement",
}


def _rule_exclude_on_purchase(task: dict, loan_data: dict, company_code: str, loan_number: str) -> Optional[dict]:
    if task.get("task-title") not in _PURCHASE_ONLY_EXCLUDED_TITLES:
        return task
    loan_purpose = (loan_data.get("19") or "").strip().lower()
    if loan_purpose == "purchase":
        logger.info("Dropping task '%s' — not applicable for Purchase loans", task.get("task-title"))
        return None
    return task

# Field 2962 (Lock Request Impound Types) values that mean the lender pays the insurance bill
_ESCROWED_INSURANCE_IMPOUND_TYPES = {"Taxes and Insurance", "Insurance only"}

def _homeowners_insurance_escrow_phrase(loan_data: dict) -> str:
    impound_type = (loan_data.get("2962") or "").strip()
    if impound_type in _ESCROWED_INSURANCE_IMPOUND_TYPES:
        return "Escrowing insurance"
    return "Not escrowing insurance"

# Closing date fields in precedence order: 
# loanProductData.loanScheduledClosingDate (field 763)
# rateLock.loanScheduledClosingDate (field 2966) 
# loanProductData.borrowerEstimatedClosingDate (field 4114)
_CLOSING_DATE_FIELDS = ("763", "2966", "4114")


def _parse_loan_date(raw) -> Optional[date]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        pass
    try:
        return datetime.strptime(text, "%m/%d/%Y").date()
    except ValueError:
        return None


def _homeowners_insurance_closing_date(loan_data: dict) -> Optional[str]:
    for field_id in _CLOSING_DATE_FIELDS:
        raw = loan_data.get(field_id)
        closing_date = _parse_loan_date(raw)
        if closing_date:
            return f"{closing_date.strftime('%B')} {closing_date.day}, {closing_date.year}"
        if raw:
            logger.warning("Unparseable closing date in field %s: %r", field_id, raw)
    return None

# Mortgagee clause lines by company code 
# gri is instead chosen by loan type in _homeowners_insurance_mortgagee_clause
_MORTGAGEE_CLAUSES_BY_COMPANY = {
    "gra": ("Guaranteed Rate Affinity, LLC. ISAOA/ATIMA", "1800 W. Larchmont Avenue", "Chicago, IL 60613"),
    "prate": ("Proper Rate, LLC ISAOA/ATIMA", "1800 W. Larchmont Ave. Suite 301", "Chicago, IL 60613"),
    "op": ("OriginPoint LLC ISAOA/ATIMA", "1800 W. Larchmont Ave. Suite 305", "Chicago, IL 60613"),
    "citywide": ("Citywide Home Loans ISAOA/ATIMA", "3940 N. Ravenswood Ave.", "Chicago, IL 60613"),
    "kbhs": ("KBHS Home Loans ISAOA/ATIMA", "3940 N. Ravenswood Ave.", "Chicago, IL 60613"),
    "premia": ("Premia Mortgage, LLC dba Premia Relocation Mortgage ISAOA/ATIMA", "3940 N. Ravenswood Ave.", "Chicago, IL 60613"),
}

# gri mortgagee clause lines by loan type 
_GRI_BOND_MORTGAGEE_CLAUSE = ("Guaranteed Rate, Inc. ISAOA/ATIMA", "3940 N Ravenswood Ave.", "Chicago, IL 60613")
_GRI_DEFAULT_MORTGAGEE_CLAUSE = ("Guaranteed Rate, Inc. ISAOA/ATIMA", "PO Box 29411", "Phoenix, AZ 85038-9411")

# Field 1401 (loan program name) substrings that mark a bond loan 
_BOND_PROGRAM_SUBSTRINGS = ("bond", "dpa", "hfa")

def _is_bond_loan(loan_data: dict) -> bool:
    program_name = str(loan_data.get("1401") or "").lower()
    return any(substring in program_name for substring in _BOND_PROGRAM_SUBSTRINGS)


def _homeowners_insurance_mortgagee_clause(loan_data: dict, company_code: str) -> Optional[str]:
    company = (company_code or "").strip().lower()
    if company == "gri":
        clause_lines = _GRI_BOND_MORTGAGEE_CLAUSE if _is_bond_loan(loan_data) else _GRI_DEFAULT_MORTGAGEE_CLAUSE
    else:
        clause_lines = _MORTGAGEE_CLAUSES_BY_COMPANY.get(company)
        if clause_lines is None:
            logger.warning("No mortgagee clause configured for company '%s'", company_code)
            return None
    return ", ".join(clause_lines)

_HOMEOWNERS_INSURANCE_TASK_KEY = "liability_mortgage_insurance"
_HOMEOWNERS_INSURANCE_TASK_TITLE = "Finalize your Homeowner's insurance"


def _rule_inject_homeowners_insurance(task: dict, loan_data: dict, company_code: str, loan_number: str) -> Optional[dict]:
    if task.get("task-key") != _HOMEOWNERS_INSURANCE_TASK_KEY:
        return task
    loan_purpose = (loan_data.get("19") or "").strip().lower()
    if loan_purpose != "purchase":
        logger.info(
            "Leaving homeowner's insurance task unchanged for non-purchase loan %s (purpose=%s)",
            loan_number,
            loan_purpose or "missing",
        )
        return task
    mortgagee_clause = _homeowners_insurance_mortgagee_clause(loan_data, company_code)
    if mortgagee_clause is None:
        logger.warning("Leaving AI-written homeowner's insurance task unchanged for loan %s", loan_number)
        return task
    escrow_phrase = _homeowners_insurance_escrow_phrase(loan_data)
    closing_date = _homeowners_insurance_closing_date(loan_data)
    description = (
        "Please reach out to your insurance agent and finalize your insurance quote. "
        "Once final, please have them send over the insurance binder and invoice (or paid receipt) "
        "for the first year's premium. "
        f"Please make sure they use the correct mortgagee clause needed to finalize the policy: {mortgagee_clause}. "
        f"Loan #{loan_number}. {escrow_phrase}."
    )
    if closing_date:
        description += f" Closing date {closing_date}."
    logger.info(
        "Injected homeowner's insurance task text for loan %s: closing_date_present=%s escrow=%s",
        loan_number,
        bool(closing_date),
        escrow_phrase,
    )
    return {**task, "task-title": _HOMEOWNERS_INSURANCE_TASK_TITLE, "task-description": description}

def _distinct_nonblank(values) -> list:
    """Return the non-blank values, trimmed, with case-insensitive duplicates removed
    (first spelling kept), in their original order"""
    if values is None:
        return []
    if isinstance(values, str):
        values = [values]
    distinct = []
    seen = set()
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        distinct.append(text)
    return distinct

# Asset holder names (field pattern DDNN02): the borrower's institutions, e.g. "Chase", "Fidelity".
# Deliberately not financialInstitutionName, which is the lender.
_ASSET_HOLDER_NAMES_FIELD = "DD0102"
_ACCOUNTS_ON_FILE_PLACEHOLDER_RE = re.compile(r"(we currently have your\s*)<[^<>]*>(\s*on file)", re.IGNORECASE)
# The whole sentence containing the token, used when there are no institutions to list.
_ACCOUNTS_ON_FILE_SENTENCE_RE = re.compile(r"we currently have your\s*<[^<>]*>\s*on file\.?", re.IGNORECASE)

def _fill_accounts_on_file(description: str, institutions: list) -> Optional[str]:
    """Fill the accounts-on-file placeholder with the institutions, or remove its sentence
    when there are none. Returns None if the placeholder sentence isn't in the description."""
    if not _ACCOUNTS_ON_FILE_PLACEHOLDER_RE.search(description):
        return None
    if institutions:
        filled = _ACCOUNTS_ON_FILE_PLACEHOLDER_RE.sub(
            lambda match: match.group(1) + ", ".join(institutions) + match.group(2),
            description,
        )
    else:
        filled = _ACCOUNTS_ON_FILE_SENTENCE_RE.sub("", description)
    return " ".join(filled.split())

_RESERVES_TASK_KEY = "reserves_required"
_RESERVES_TASK_TITLE = "Document Additional Assets for Reserves"

def _rule_inject_reserves_accounts(task: dict, loan_data: dict, company_code: str, loan_number: str) -> Optional[dict]:
    """Fill the reserves task's accounts-on-file placeholder from the borrower's asset
    institutions and set its locked title. All other tasks pass through."""
    if task.get("task-key") != _RESERVES_TASK_KEY:
        return task
    institutions = _distinct_nonblank(loan_data.get(_ASSET_HOLDER_NAMES_FIELD))
    description = _fill_accounts_on_file(task.get("task-description") or "", institutions)
    if description is None:
        logger.warning(
            "Accounts-on-file placeholder not found in reserves task for loan %s; description left unchanged",
            loan_number,
        )
        return {**task, "task-title": _RESERVES_TASK_TITLE}
    logger.info(
        "Injected accounts on file into reserves task for loan %s: institution_count=%d",
        loan_number,
        len(institutions),
    )
    return {**task, "task-title": _RESERVES_TASK_TITLE, "task-description": description}

# REO (other real estate owned) fields, as parallel lists in property order:
# street address (pattern FMNN04) and disposition status (pattern FMNN24).
_REO_ADDRESS_FIELD = "FM0104"
_REO_DISPOSITION_FIELD = "FM0124"
# Disposition statuses meaning a departing property is being sold (Encompass "PS" is PendingSale).
_REO_SALE_DISPOSITIONS = {"pendingsale", "sold"}

def _reo_sale_addresses(loan_data: dict, loan_number: str) -> Optional[list]:
    """Return None if no REO is pending sale or sold (the task should not exist);
    otherwise the distinct street addresses of the matched REOs (possibly empty)."""
    addresses = loan_data.get(_REO_ADDRESS_FIELD) or []
    dispositions = loan_data.get(_REO_DISPOSITION_FIELD) or []
    if isinstance(addresses, str):
        addresses = [addresses]
    if isinstance(dispositions, str):
        dispositions = [dispositions]
    sale_indexes = [
        index for index, disposition in enumerate(dispositions)
        if str(disposition or "").strip().casefold() in _REO_SALE_DISPOSITIONS
    ]
    if not sale_indexes:
        return None
    if len(addresses) != len(dispositions):
        logger.warning("Misaligned REO address/status details for loan %s; sale addresses not used", loan_number)
        return []
    return _distinct_nonblank([addresses[index] for index in sale_indexes])

_NET_PROCEEDS_TASK_KEY = "property_sold_proof"
_NET_PROCEEDS_TASK_TITLE = "Upload Final Settlement Statement"

def _rule_gate_net_proceeds(task: dict, loan_data: dict, company_code: str, loan_number: str) -> Optional[dict]:
    """Drop the net proceeds settlement-statement task unless a departing REO is pending sale
    or sold; otherwise fill in the sale address(es) from the REO records"""
    if task.get("task-key") != _NET_PROCEEDS_TASK_KEY:
        return task
    sale_addresses = _reo_sale_addresses(loan_data, loan_number)
    if sale_addresses is None:
        logger.info("Dropping net proceeds task for loan %s: no REO is pending sale or sold", loan_number)
        return None
    if not sale_addresses:
        logger.warning(
            "No street address for REO pending sale/sold on loan %s; net proceeds task description left unchanged",
            loan_number,
        )
        return {**task, "task-title": _NET_PROCEEDS_TASK_TITLE}
    address_text = ", ".join(sale_addresses)
    description = (
        "Please upload the fully executed final Settlement Statement for the sale of "
        f"{address_text}{'' if address_text.endswith('.') else '.'}"
    )
    logger.info(
        "Injected sale address(es) into net proceeds task for loan %s: address_count=%d",
        loan_number,
        len(sale_addresses),
    )
    return {**task, "task-title": _NET_PROCEEDS_TASK_TITLE, "task-description": description}

# Liability fields, as parallel lists in liability order (patterns FLNN02 / FLNN08 / FLNN10)
_LIABILITY_CREDITOR_NAMES_FIELD = "FL0102"
_LIABILITY_TYPES_FIELD = "FL0108"
_LIABILITY_ACCOUNT_LAST4_FIELD = "FL0110"
# An account number written after "#", e.g. "#4412"; captures its last 4 digits.
_ACCOUNT_NUMBER_RE = re.compile(r"#\s*\d*?(\d{4})(?!\d)")

def _payoff_liabilities(loan_data: dict, loan_number: str) -> Optional[tuple]:
    """Return the (creditor names, types, last 4s) liability lists, or None if they are
    missing or misaligned and can't be paired by position."""
    names = loan_data.get(_LIABILITY_CREDITOR_NAMES_FIELD) or []
    types = loan_data.get(_LIABILITY_TYPES_FIELD) or []
    last4s = loan_data.get(_LIABILITY_ACCOUNT_LAST4_FIELD) or []
    if not (isinstance(names, list) and isinstance(types, list) and isinstance(last4s, list)) or not (
        len(names) == len(types) == len(last4s)
    ):
        logger.warning("Missing or misaligned liability details for loan %s", loan_number)
        return None
    return names, types, last4s

def _is_mortgage_or_heloc_account(account: str, liabilities: tuple) -> bool:
    """True only if the account matches exactly one liability and
    that liability is a mortgage or HELOC."""
    numbers = set(_ACCOUNT_NUMBER_RE.findall(account))
    if len(numbers) != 1:
        return False
    account_last4 = numbers.pop()
    names, types, last4s = liabilities
    candidates = [
        index for index, last4 in enumerate(last4s)
        if str(last4 or "").strip()[-4:] == account_last4
    ]
    if len(candidates) > 1:
        # Tie-break: keep only liabilities whose creditor name's first word appears in this account's text.
        account_text = account.casefold()

        def _first_name_word_in_account(index: int) -> bool:
            words = str(names[index] or "").split()
            return bool(words) and words[0].casefold() in account_text

        candidates = [index for index in candidates if _first_name_word_in_account(index)]
    if len(candidates) != 1:
        return False
    liability_type = str(types[candidates[0]] or "").casefold()
    return "mortgage" in liability_type or "heloc" in liability_type

def _english_list(items: list) -> str:
    """Join items as an English list: "A", "A and B", "A, B, and C"."""
    if len(items) <= 1:
        return "".join(items)
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f", and {items[-1]}"

_ACCOUNT_PAYOFF_TASK_KEY = "account_payoff"
_ACCOUNT_PAYOFF_TITLE_PREFIX = "Confirm payoff amount for "

def _rule_exclude_mortgage_payoff(task: dict, loan_data: dict, company_code: str, loan_number: str) -> Optional[dict]:
    """Remove mortgage/HELOC accounts (ordered from the lender) from the account payoff
    statement task; drop the task if every account is one. Keep it unchanged when unsure."""
    if task.get("task-key") != _ACCOUNT_PAYOFF_TASK_KEY:
        return task
    title = task.get("task-title") or ""
    description = task.get("task-description") or ""
    if not title.casefold().startswith(_ACCOUNT_PAYOFF_TITLE_PREFIX.casefold()):
        logger.warning("Payoff task title not in the expected format for loan %s; task kept unchanged", loan_number)
        return task
    liabilities = _payoff_liabilities(loan_data, loan_number)
    if liabilities is None:
        return task
    title_prefix = title[:len(_ACCOUNT_PAYOFF_TITLE_PREFIX)]
    account_list = title[len(_ACCOUNT_PAYOFF_TITLE_PREFIX):].strip()
    accounts = [account.strip() for account in account_list.split(";") if account.strip()]
    if not accounts:
        return task
    kept_accounts = [account for account in accounts if not _is_mortgage_or_heloc_account(account, liabilities)]
    if not kept_accounts:
        logger.info(
            "Dropping payoff task for loan %s: all %d account(s) are mortgage/HELOC payoffs",
            loan_number,
            len(accounts),
        )
        return None
    new_account_list = _english_list(kept_accounts)
    if new_account_list == account_list:
        return task
    if description.count(account_list) != 1:
        logger.warning(
            "Payoff account list not found once in description for loan %s; task kept unchanged",
            loan_number,
        )
        return task
    
    logger.info(
        "Rewrote payoff task account list for loan %s: %d mortgage/HELOC account(s) removed, %d kept",
        loan_number,
        len(accounts) - len(kept_accounts),
        len(kept_accounts),
    )
    return {
        **task,
        "task-title": title_prefix + new_account_list,
        "task-description": description.replace(account_list, new_account_list),
    }




# Rules are applied in order; return None from a rule to drop the task entirely.
_TASK_RULES = [
    _rule_exclude_on_purchase,
    _rule_inject_homeowners_insurance,
    _rule_inject_reserves_accounts,
    _rule_gate_net_proceeds,
    _rule_exclude_mortgage_payoff
]


def _apply_task_rules(tasks: list, loan_data: dict, company_code: str, loan_number: str) -> list:
    result = []
    for task in tasks:
        for rule in _TASK_RULES:
            task = rule(task, loan_data, company_code, loan_number)
            if task is None:
                break
        else:
            result.append(task)
    return result


def _classify_task_ownership(
    description: str,
    borrower_full_name: str,
    coborrower_full_name: str,
) -> str:
    """Return 'borrower', 'coborrower', or 'both' based on task description hints.

    Borrower-specific signals (case-insensitive):
        'borrower1', 'borrower', the borrower's full name
    Coborrower-specific signals (case-insensitive):
        'coborrower', 'co-borrower', 'borrower2', the coborrower's full name

    If signals for both parties are found, or neither, returns 'both'.
    """
    desc_lower = description.lower()

    borrower_signals = ["borrower1"]
    if borrower_full_name:
        borrower_signals.append(borrower_full_name.lower())

    coborrower_signals = ["coborrower", "co-borrower", "borrower2"]
    if coborrower_full_name:
        coborrower_signals.append(coborrower_full_name.lower())

    # Generic 'borrower' only counts as a borrower signal if no coborrower
    # signal is already present — checked after the targeted pass.
    has_borrower = any(sig in desc_lower for sig in borrower_signals)
    has_coborrower = any(sig in desc_lower for sig in coborrower_signals)

    # Generic 'borrower' (without a number) is ambiguous on its own; only
    # treat it as borrower-specific when there is no coborrower signal.
    if not has_borrower and not has_coborrower:
        if "borrower" in desc_lower:
            has_borrower = True

    if has_borrower and has_coborrower:
        return "both"
    if has_borrower:
        return "borrower"
    if has_coborrower:
        return "coborrower"
    return "both"


def _pending_task_dedup_pair(task: dict) -> tuple:
    """Match the original template key to existing Taskmaster template IDs."""
    return task.get("gr-consumer-id"), task.get("template-key")


def _existing_task_dedup_pair(task: dict) -> tuple:
    return task.get("gr-consumer-id"), task.get("task-key")


async def _handler(event, context):
    environment = os.getenv("ENVIRONMENT", "dev").strip().lower()
    use_condition_templates = environment == "dev"
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
    gr_loan_id = event.get("detail", {}).get("identity", {}).get("grLoanGUID")
    loan_id = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not loan_id:
        logger.error("Encompass Loan ID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass Loan ID is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}

    logger.info("Received underwriting-approved event for loan number: %s w/ company code: %s", loan_number, company_code)

    # Debounce: reject duplicate events for the same loan within the TTL window.
    if not _acquire_idempotency_lock(loan_number):
        logger.warning(
            "Duplicate event detected for loan %s within debounce window; skipping processing.",
            loan_number,
        )
        return {"statusCode": 200, "body": json.dumps({"message": "Duplicate event ignored"})}

    # Fetch the underwriting conditions and borrower/coborrower email(s) for the loan
    raw = await GetLoanTool().execute({
        "loan_identifier": loan_number,
        "company": company_code,
        "requestedProperties": [
            "underwritingConditionLogs", 
            "team-members", 
            "CX.FASTPASS.ELIGIBLE", 
            "1240", 
            "1268", 
            "CX.LOCODE.1", 
            "CX.SECINVESTOR.10", 
            "19", 
            "4000", 
            "4002", 
            "4004", 
            "4006",
            "2962",
            "763",
            "2966",
            "4114",
            "1401",
            # Collection fields: return a list across all assets / REO properties (index ignored)
            "DD0102",
            "FM0104",
            "FM0124",
            "FL0102",
            "FL0108",
            "FL0110",
        ],
    })
    loan_data = json.loads(raw)
    team_members = loan_data.get("data", {}).get("team-members", [])
    loan_coordinator_id = next(
        (
            member.get("id")
            for member in team_members
            if member.get("roleName") == "Loan Coordinator"
        ),
        None,
    )

    # Check if the loan is part of the pilot; if not, exit early.
    # Pilot filtering is only enforced in prod — dev processes all loans.
    is_prod = environment == "prod"
    lo_code = loan_data.get("data", {}).get("CX.LOCODE.1")
    logger.info("Loan %s LO code=%s LC ID=%s", loan_number, lo_code, loan_coordinator_id)
    try:
        lo_code_int = int(lo_code)
    except (TypeError, ValueError):
        lo_code_int = None
    # lo_in_pilot = lo_code_int in PILOT_LO_IDS
    lc_in_pilot = (
        isinstance(loan_coordinator_id, str)
        and loan_coordinator_id.lower() in PILOT_LC_IDS
    )
    if is_prod and not lc_in_pilot:
        logger.info(
            "Loan %s is not part of the pilot; LO code=%s LC ID=%s",
            loan_number,
            lo_code,
            loan_coordinator_id,
        )
        return {"statusCode": 200, "body": json.dumps({"message": "Loan not in pilot, no conditions sent"})}

    if not loan_data.get("success"):
        logger.error("Failed to retrieve loan data for loan %s: %s", loan_number, loan_data.get("error"))
        return {"statusCode": 502, "body": json.dumps({"error": "Failed to retrieve loan data"})}

    condition_logs = loan_data.get("data", {}).get("underwritingConditionLogs", [])
    if not condition_logs:
        logger.info("No underwriting conditions found for loan %s", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No conditions to send"})}

    fast_track_raw = loan_data.get("data", {}).get("CX.FASTPASS.ELIGIBLE")
    fast_track_eligible = str(fast_track_raw).strip().upper() in ("TRUE", "Y", "YES", "1")
    logger.info("Loan %s fast track eligible: %s (raw=%s)", loan_number, fast_track_eligible, fast_track_raw)

    pre_filter_count = len(condition_logs)

    def _is_visible_condition(c: dict) -> bool:
        # Base visibility gate (mirrors YBR conditionsUtilities.ts)
        if c.get("cleared"):
            return False
        if c.get("isMarkedRemoved"):
            return False
        if c.get("waived"):
            return False
        if not c.get("isExternalIndicator"):
            return False
        # Prior-to scope gate
        prior_to = c.get("priorTo")
        if prior_to in ("PTF", "PTD"):
            return True
        if prior_to == "AC" and fast_track_eligible:
            return True
        return False

    all_condition_logs = condition_logs
    condition_by_guid: Dict[str, Dict] = {
        c.get("guid", ""): {
            "condition_title": c.get("title", ""),
            "condition_description": c.get("description", ""),
        }
        for c in all_condition_logs
    }
    visible_guids = {c.get("guid", "") for c in all_condition_logs if _is_visible_condition(c)}
    condition_logs = [c for c in condition_logs if _is_visible_condition(c)]
    logger.info(
        "Filtered conditions for loan %s: before=%d after=%d removed=%d fast_track=%s",
        loan_number,
        pre_filter_count,
        len(condition_logs),
        pre_filter_count - len(condition_logs),
        fast_track_eligible,
    )
    # Rows for conditions dropped by the visibility filter — recorded so the full
    # audit table includes every condition on the loan, not just the ones sent to Prajna.
    filtered_out_rows = [
        {
            "uw_condition_guid": guid,
            **fields,
            "condition_filtered_out": True,
        }
        for guid, fields in condition_by_guid.items()
        if guid not in visible_guids
    ]

    if not condition_logs:
        logger.info("No conditions remaining after filtering for loan %s", loan_number)
        try:
            _write_conditions_to_tasks_rows(loan_number, company_code, gr_loan_id, loan_id, filtered_out_rows)
        except Exception:
            logger.exception("Failed to write conditions-to-tasks rows for loan %s", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No conditions to send after filtering"})}
    
    borrower_email = loan_data.get("data", {}).get("1240", "")
    coborrower_email = loan_data.get("data", {}).get("1268", "")
    logger.info(
        "Resolved borrower email present: %s, coborrower email present: %s",
        bool(borrower_email),
        bool(coborrower_email),
    )

    borrower_first = (loan_data.get("data", {}).get("4000") or "").strip()
    borrower_last = (loan_data.get("data", {}).get("4002") or "").strip()
    coborrower_first = (loan_data.get("data", {}).get("4004") or "").strip()
    coborrower_last = (loan_data.get("data", {}).get("4006") or "").strip()
    borrower_full_name = " ".join(filter(None, [borrower_first, borrower_last]))
    coborrower_full_name = " ".join(filter(None, [coborrower_first, coborrower_last]))
    logger.info(
        "Resolved borrower full name: '%s', coborrower full name: '%s'",
        borrower_full_name,
        coborrower_full_name,
    )

    borrower_eid = await SearchBorrowerEntityTool().execute({
        "email": borrower_email, 
        "company-name": company_code
    })
    borrower_eid = json.loads(borrower_eid).get("data", {}).get("borrower-guid")
    if borrower_eid:
        logger.info("Found borrower entity ID: %s", borrower_eid)

    coborrower_eid = None
    if coborrower_email:
        coborrower_eid = await SearchBorrowerEntityTool().execute({
            "email": coborrower_email, 
            "company-name": company_code
        })
        coborrower_eid = json.loads(coborrower_eid).get("data", {}).get("borrower-guid")
        if coborrower_eid:
            logger.info("Found coborrower entity ID: %s", coborrower_eid)


    # Transform to target API shape and split into batches to avoid long-running Prajna calls
    max_conditions_per_prajna_call = 60
    condition_templates_by_guid = {}
    if use_condition_templates:
        try:
            task_templates_by_title = await _get_condition_task_templates(
                [c.get("title", "") for c in condition_logs]
            )
        except RuntimeError:
            logger.exception("Condition task template lookup failed for loan %s", loan_number)
            return {"statusCode": 502, "body": json.dumps({"error": "Failed to fetch condition task templates"})}

        condition_template_results = [
            {"conditionKey": title, "taskTemplates": templates}
            for title, templates in task_templates_by_title.items()
        ]
        condition_templates_by_title = _condition_task_template_fields(condition_template_results)
        condition_templates_by_guid = _condition_templates_by_guid(condition_logs, task_templates_by_title)
        all_conditions = _build_prajna_conditions(condition_logs, condition_templates_by_title)
    else:
        logger.info("Using Prajna-selected task templates for loan %s in %s", loan_number, environment)
        all_conditions = [
            {
                "condition_title": condition.get("title", ""),
                "condition_description": condition.get("description", ""),
                "uw_condition_guid": condition.get("guid", ""),
            }
            for condition in condition_logs
        ]
    condition_batches = [
        all_conditions[i:i + max_conditions_per_prajna_call]
        for i in range(0, len(all_conditions), max_conditions_per_prajna_call)
    ]
    logger.info(
        "Prepared Prajna payload batches for loan %s: total_conditions=%d batch_count=%d batch_sizes=%s sample_titles=%s",
        loan_number,
        len(all_conditions),
        len(condition_batches),
        [len(batch) for batch in condition_batches],
        [c.get("condition_title") for c in all_conditions[:5]],
    )

    # Send the conditions to the Prajna API
    logger.info("Sending conditions to Prajna API for loan %s", loan_number)
    prajna_domain = os.getenv("PRAJNA_CONDITIONS_DOMAIN")
    if not prajna_domain:
        logger.error("Prajna conditions domain not configured. Please set the PRAJNA_CONDITIONS_DOMAIN environment variable.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
    url = f"{prajna_domain}"
    headers = {
        "x-api-key": os.getenv("PRAJNA_ACCESS_TOKEN")
    }

    retry_strategy = Retry(
        total=3,
        backoff_factor=2,
        status_forcelist=[502, 503, 504],
        allowed_methods=["POST"],
        raise_on_status=False,
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry_strategy))
    session.mount("http://", HTTPAdapter(max_retries=retry_strategy))

    raw_results = []
    for batch_index, batch_conditions in enumerate(condition_batches, start=1):
        payload = {"conditions": batch_conditions}
        prajna_request_started = time.time()
        try:
            tasks_response = session.post(url, headers=headers, json=payload, timeout=300)
            tasks_response.raise_for_status()
            logger.info(
                "Prajna request completed for loan %s: batch=%d/%d condition_count=%d status=%s elapsed_ms=%d response_bytes=%d",
                loan_number,
                batch_index,
                len(condition_batches),
                len(batch_conditions),
                tasks_response.status_code,
                int((time.time() - prajna_request_started) * 1000),
                len(tasks_response.text or ""),
            )

        except requests.RequestException:
            logger.exception(
                "Failed to send conditions to Prajna API for loan %s: batch=%d/%d elapsed_ms=%d",
                loan_number,
                batch_index,
                len(condition_batches),
                int((time.time() - prajna_request_started) * 1000),
            )
            return {"statusCode": 502, "body": json.dumps({"error": "Failed to send conditions to Prajna API"})}

        logger.info(
            "Prajna API response for loan %s: batch=%d/%d %s",
            loan_number,
            batch_index,
            len(condition_batches),
            tasks_response.text or "",
        )
        try:
            prajna_json = tasks_response.json()
        except ValueError:
            logger.error(
                "Prajna response is not valid JSON for loan %s: batch=%d/%d",
                loan_number,
                batch_index,
                len(condition_batches),
            )
            return {"statusCode": 502, "body": json.dumps({"error": "Invalid response from Prajna API"})}

        batch_results = prajna_json.get("results", [])
        batch_results = _attach_condition_guids(batch_results, batch_conditions)
        raw_results.extend(batch_results)

    logger.info(
        "Prajna raw task results for loan %s: result_count=%d results=%s",
        loan_number,
        len(raw_results),
        raw_results,
    )
    new_tasks = _flatten_tasks(raw_results)
    logger.info(
        "Flattened Prajna tasks for loan %s: task_count=%d template_keys=%s",
        loan_number,
        len(new_tasks),
        [task.get("task_template_id") for task in new_tasks],
    )
    if not new_tasks:
        logger.info("No new tasks to create for loan %s", loan_number)
        no_task_rows = [
            {"uw_condition_guid": guid, **condition_by_guid.get(guid, {}), "condition_filtered_out": False}
            for guid in visible_guids
        ]
        try:
            _write_conditions_to_tasks_rows(
                loan_number, company_code, gr_loan_id, loan_id, filtered_out_rows + no_task_rows
            )
        except Exception:
            logger.exception("Failed to write conditions-to-tasks rows for loan %s", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No new tasks to create"})}

    if use_condition_templates:
        new_tasks = _resolve_condition_task_templates(new_tasks, condition_templates_by_guid)
    else:
        task_templates_result = await _get_task_templates()
        if not isinstance(task_templates_result, dict) or not task_templates_result.get("success"):
            logger.error("Failed to fetch task templates for loan %s", loan_number)
            return {"statusCode": 502, "body": json.dumps({"error": "Failed to fetch task templates"})}
        new_tasks = _resolve_task_template_ids(new_tasks, task_templates_result.get("data", []))
    logger.info(
        "Tasks after template resolution for loan %s: task_count=%d template_ids=%s",
        loan_number,
        len(new_tasks),
        [task.get("task_template_id") for task in new_tasks],
    )
    if not new_tasks:
        logger.warning("No tasks remained after template ID resolution for loan %s", loan_number)
        no_task_rows = [
            {"uw_condition_guid": guid, **condition_by_guid.get(guid, {}), "condition_filtered_out": False}
            for guid in visible_guids
        ]
        try:
            _write_conditions_to_tasks_rows(
                loan_number, company_code, gr_loan_id, loan_id, filtered_out_rows + no_task_rows
            )
        except Exception:
            logger.exception("Failed to write conditions-to-tasks rows for loan %s", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No resolvable tasks to create"})}

    # Normalize underscore keys to hyphenated keys expected by CreateTasksTool / Taskmaster API
    new_tasks = [{k.replace("_", "-"): v for k, v in task.items()} for task in new_tasks]

    # Apply static fields required on every task
    new_tasks = [
        {
            **{k: v for k, v in task.items() if k != "uw-condition-guid"},
            "task-assigned-to": "consumer",
            "task-meta": {
                "created-by": "Underwriting Conditions to Tasks Automation",
                "updated-by": "Underwriting Conditions to Tasks Automation",
                "task-display-type": task.get("task-display-type"),
                "uw-condition-guid": task.get("uw-condition-guid")
            },
        }
        for task in new_tasks
    ]
    logger.info("Tasks after static-field enrichment for loan %s: task_count=%d", loan_number, len(new_tasks))

    new_tasks = _apply_task_rules(new_tasks, loan_data.get("data", {}), company_code, loan_number)
    logger.info("Tasks after rule application for loan %s: task_count=%d", loan_number, len(new_tasks))

    # Classify each task as borrower-only, coborrower-only, or both, then assign
    # gr-consumer-id accordingly.
    borrower_only_titles = []
    coborrower_only_titles = []
    both_titles = []

    unlinked_tasks = []   # borrower-only / coborrower-only tasks → outer "tasks" list
    linked_pairs = []     # list of (borrower_task, coborrower_task) → taskGroups
    final_tasks = []      # flat list preserved for DynamoDB
    task_rows = []         # one row per generated task, for the full conditions-to-tasks audit table
    row_split_tasks = []   # parallel list: split task dict(s) backing each task_row, for dedup lookup

    for task in new_tasks:
        desc = task.get("task-description", "")
        ownership = _classify_task_ownership(desc, borrower_full_name, coborrower_full_name)
        title = task.get("task-title", task.get("task-template-id", "(unknown)"))
        guid = (task.get("task-meta") or {}).get("uw-condition-guid", "")
        row = {
            "uw_condition_guid": guid,
            **condition_by_guid.get(guid, {}),
            "condition_filtered_out": False,
            "task_template_id": task.get("task-template-id"),
            "task_key": task.get("task-key"),
            "task_title": task.get("task-title"),
            "task_description": task.get("task-description"),
            "task_type": task.get("task-type"),
            "task_action_type": task.get("task-action-type"),
            "task_category": task.get("task-category"),
            "task_display_type": task.get("task-display-type"),
            "task_meta": task.get("task-meta"),
            "task_assigned_to": ownership,
        }
        split_tasks = []
        task_rows.append(row)
        row_split_tasks.append(split_tasks)

        if ownership == "borrower":
            borrower_only_titles.append(title)
            if borrower_eid:
                t = {**task, "gr-consumer-id": borrower_eid}
                unlinked_tasks.append(t)
                final_tasks.append(t)
                split_tasks.append(t)
        elif ownership == "coborrower":
            coborrower_only_titles.append(title)
            if coborrower_eid:
                t = {**task, "gr-consumer-id": coborrower_eid}
                unlinked_tasks.append(t)
                final_tasks.append(t)
                split_tasks.append(t)
        else:  # both — create a linked pair (one group per borrower/coborrower pair)
            both_titles.append(title)
            borrower_task = {**task, "gr-consumer-id": borrower_eid} if borrower_eid else None
            coborrower_task = {**task, "gr-consumer-id": coborrower_eid} if coborrower_eid else None
            if borrower_task:
                final_tasks.append(borrower_task)
                split_tasks.append(borrower_task)
            if coborrower_task:
                final_tasks.append(coborrower_task)
                split_tasks.append(coborrower_task)
            if borrower_task and coborrower_task:
                # Both parties exist — link as a group so completing either auto-completes the other
                linked_pairs.append((borrower_task, coborrower_task))
            elif borrower_task:
                unlinked_tasks.append(borrower_task)
            elif coborrower_task:
                unlinked_tasks.append(coborrower_task)

    logger.info(
        "Task ownership classification for loan %s: borrower_only=%d %s | coborrower_only=%d %s | both=%d %s",
        loan_number,
        len(borrower_only_titles), borrower_only_titles,
        len(coborrower_only_titles), coborrower_only_titles,
        len(both_titles), both_titles,
    )
    new_tasks = final_tasks

    logger.info(
        "Final Taskmaster task payload for loan %s: task_count=%d payload=%s",
        loan_number,
        len(new_tasks),
        json.dumps(new_tasks),
    )

    # Normalize company header for Taskmaster create_tasks call.
    taskmaster_company = (company_code or "").lower()
    if taskmaster_company not in ("gra", "gri", "prate", "op", "citywide"):
        logger.info(
            "Company code '%s' is not supported for Taskmaster header, defaulting to 'gri'",
            company_code,
        )
        taskmaster_company = "gri"

    # Duplicate detection: compare the proposed template key with the existing task key.
    # When an AI-proposed task matches one of these (consumer, template) pairs, the existing task is
    # removed via Taskmaster and replaced by the AI-created task (see below),
    # rather than discarding the AI task.
    existing_task_by_pair: Dict[tuple, list] = {}
    try:
        existing_tasks_raw = await GetTasksTool().execute({
            "loan-id": loan_number,
            "company": taskmaster_company,
        })
        existing_tasks_result = json.loads(existing_tasks_raw)
        if existing_tasks_result.get("success"):
            existing_data = existing_tasks_result.get("data", {})
            existing_results = existing_data.get("results", []) if isinstance(existing_data, dict) else []
            for existing_task in existing_results:
                # Skip completed or removed tasks — only "live" tasks count as duplicates
                if existing_task.get("task-completed") or existing_task.get("task-removed"):
                    logger.info(
                        "Excluding completed/removed task from dedup consideration: task_id=%s completed=%s removed=%s",
                        existing_task.get("task-id"),
                        existing_task.get("task-completed"),
                        existing_task.get("task-removed"),
                    )
                    continue
                
                pair = _existing_task_dedup_pair(existing_task)
                if pair[0] and pair[1]:
                    existing_task_by_pair.setdefault(pair, []).append(existing_task.get("task-id"))
            logger.info(
                "Fetched existing Taskmaster tasks for duplicate filtering: loan=%s total_count=%d live_comparable_pairs=%d",
                loan_number,
                len(existing_results),
                len(existing_task_by_pair),
            )
        else:
            logger.warning(
                "GetTasksTool failed for loan %s; proceeding without duplicate filtering. Error=%s",
                loan_number,
                existing_tasks_result.get("error"),
            )
    except Exception:
        logger.exception(
            "Unexpected error while fetching existing tasks for loan %s; proceeding without duplicate filtering",
            loan_number,
        )

    # Mark rows whose generated task(s) matched (and thus replaced) an existing live task.
    for row, split_tasks in zip(task_rows, row_split_tasks):
        row["existing_task_removed"] = any(
            _pending_task_dedup_pair(t) in existing_task_by_pair
            for t in split_tasks
        )

    # Visible conditions that never produced a task (dropped by Prajna, task-rule
    # exclusion, or missing borrower/coborrower entity ID) still get a condition-only row.
    guids_with_task_rows = {row["uw_condition_guid"] for row in task_rows}
    no_task_rows = [
        {"uw_condition_guid": guid, **condition_by_guid.get(guid, {}), "condition_filtered_out": False}
        for guid in visible_guids
        if guid not in guids_with_task_rows
    ]

    # Write the full one-row-per-condition audit table, including conditions filtered
    # out before ever reaching Prajna.
    try:
        _write_conditions_to_tasks_rows(
            loan_number,
            company_code,
            gr_loan_id,
            loan_id,
            filtered_out_rows + no_task_rows + task_rows,
        )
    except Exception:
        logger.exception("Failed to write conditions-to-tasks rows for loan %s", loan_number)

    if existing_task_by_pair:
        async def _remove_duplicate_task(existing_task_id: str) -> None:
            """Remove the existing live task so the AI-created task takes its place."""
            logger.info("Removing duplicate existing task %s for loan %s", existing_task_id, loan_number)
            try:
                remove_raw = await RemoveTaskTool().execute({
                    "loan-id": loan_id,
                    "task-id": existing_task_id,
                    "company": taskmaster_company,
                })
                remove_result = json.loads(remove_raw)
                if not remove_result.get("success"):
                    logger.error(
                        "Failed to remove duplicate task %s for loan %s: %s",
                        existing_task_id,
                        loan_number,
                        remove_result.get("error"),
                    )
            except Exception:
                logger.exception(
                    "Unexpected error removing duplicate task %s for loan %s",
                    existing_task_id,
                    loan_number,
                )

        async def _remove_duplicates_for_task(task: dict) -> int:
            pair = _pending_task_dedup_pair(task)
            existing_task_ids = existing_task_by_pair.pop(pair, [])
            for existing_task_id in existing_task_ids:
                await _remove_duplicate_task(existing_task_id)
            return len(existing_task_ids)

        duplicates_replaced = 0
        for task in unlinked_tasks:
            duplicates_replaced += await _remove_duplicates_for_task(task)
        for borrower_task, coborrower_task in linked_pairs:
            for task in (borrower_task, coborrower_task):
                duplicates_replaced += await _remove_duplicates_for_task(task)
        logger.info(
            "Replaced %d duplicate live task(s) with AI-created tasks for loan %s",
            duplicates_replaced,
            loan_number,
        )

    if not unlinked_tasks and not linked_pairs:
        logger.info("No candidate tasks remain for loan %s; skipping create_tasks", loan_number)
        try:
            _write_loan_data_to_dynamodb(loan_number, all_conditions, [])
        except Exception:
            logger.exception("Failed to write loan data to DynamoDB for loan %s", loan_number)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to write loan data to DynamoDB"})}
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "No new tasks to create", "tasks_created": 0}),
        }

    # Build task groups: each borrower/coborrower pair for a shared condition forms its own group.
    # linkTasks=True means completing either task in the group auto-completes the other.
    task_groups = [
        {
            "name": f"condition-pair-{i + 1}",
            "linkTasks": True,
            "tasks": [borrower_task, coborrower_task],
        }
        for i, (borrower_task, coborrower_task) in enumerate(linked_pairs)
    ]

    logger.info(
        "Taskmaster payload breakdown for loan %s: unlinked_task_count=%d unlinked_tasks=%s",
        loan_number,
        len(unlinked_tasks),
        json.dumps(unlinked_tasks),
    )
    logger.info(
        "Taskmaster task_groups for loan %s: group_count=%d groups=%s",
        loan_number,
        len(task_groups),
        json.dumps(task_groups),
    )

    # Using the response from Prajna, create tasks in taskmaster.
    # Task creation is only enabled in dev until the pilot is fully validated.
    if os.getenv("ENVIRONMENT", "dev") != "GATEOFF":
        taskmaster_request_started = time.time()
        raw = await CreateTasksTool().execute({
            "tasks": [
                {key: value for key, value in task.items() if key != "template-key"}
                for task in unlinked_tasks
            ],
            "loan-id": loan_id,
            "company": taskmaster_company,
            "taskGroups": [
                {
                    **group,
                    "tasks": [
                        {key: value for key, value in task.items() if key != "template-key"}
                        for task in group["tasks"]
                    ],
                }
                for group in task_groups
            ],
        })
        logger.info(
            "Taskmaster create_tasks completed for loan %s: elapsed_ms=%d raw_response=%s",
            loan_id,
            int((time.time() - taskmaster_request_started) * 1000),
            raw,
        )
        result = json.loads(raw)
        if not result.get("success"):
            logger.error("Failed to create tasks for loan %s: %s", loan_id, result.get("error"))
            return {"statusCode": 502, "body": json.dumps({"error": "Failed to create tasks in Taskmaster"})}
        created_tasks = new_tasks
    else:
        logger.info("Skipping Taskmaster task creation for loan %s in prod (not yet enabled)", loan_number)
        created_tasks = []

    # Persist the successfully created tasks, not the earlier proposed task list.
    try:
        _write_loan_data_to_dynamodb(loan_number, all_conditions, created_tasks)
    except Exception:
        logger.exception("Failed to write loan data to DynamoDB for loan %s", loan_number)

    tasks_created = len(created_tasks)
    logger.info("Successfully created %d tasks for loan %s", tasks_created, loan_number)

    return {"statusCode": 200, "body": json.dumps({"message": "ok", "tasks_created": tasks_created})}

