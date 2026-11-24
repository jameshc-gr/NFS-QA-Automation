import json
import logging
import os
from copy import deepcopy
import boto3
import asyncio
import uuid
import hashlib
import difflib
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from botocore.exceptions import ClientError

from src.tools.ecs_tools import GetECSCreditTool, ReissueCreditTool
from src.tools.oneloan_tools import GetLoanTool
from src.tools.borrower_entity_tools import SearchBorrowerEntityTool
from src.tools.taskmaster_tools import CreateTasksTool, GetTaskTool, GetTasksTool, RemoveTaskTool
from src.security.redaction import redact_pii
from .dev_fixtures import DEV_CREDIT_INQUIRIES, DEV_CREDIT_LIABILITIES, DEV_IR_BORROWER_ID, DEV_IR_COBORROWER_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

COMPANY_INQUIRY_SUBSCRIBER_CODES = {
    "gri": ("1032387", "3976516", "180ZB14543", "6217390", "9982890", "180ZB14954", "4435952", "9949695", "180ZB15506", "5151140", "3976518", "180ZB14525"),
    "gra": ("01209", "1661441", "31779611"),
    "prate": ("01217", "2000564", "31779638"),
    "op": ("01217", "2000564", "31779638"),
    "citywide": ("01217", "2000564", "31779638"),
}

def _credit_inquiries_for_environment(ecs_response: dict, environment: str) -> list:
    if (environment or "").lower() == "dev":
        return deepcopy(DEV_CREDIT_INQUIRIES)
    return _extract_latest_credit_inquiries(ecs_response)


def _latest_successful_ecs_entry(ecs_response: dict) -> dict | None:
    entries = (ecs_response.get("data") or {}).get("response") or []
    successful_entries = [
        entry
        for entry in entries
        if str(entry.get("upstreamStatus") or "").upper() == "OK"
        and str((entry.get("response") or {}).get("status") or "").upper() == "OK"
    ]
    return max(successful_entries, key=lambda entry: entry.get("created") or "", default=None)


def _extract_latest_credit_inquiries(ecs_response: dict) -> list:
    latest_entry = _latest_successful_ecs_entry(ecs_response)
    if not latest_entry:
        return []

    inquiries = []
    for credit_response in (latest_entry.get("response") or {}).get("credit-response") or []:
        inquiries.extend(credit_response.get("credit-inquiry") or [])
    return inquiries


def _get_ecs_borrower_ids(ecs_entry: dict) -> tuple[str | None, str | None]:
    keys = (ecs_entry.get("response") or {}).get("keys") or []
    values = {item.get("name"): item.get("value") for item in keys if item.get("name")}
    return values.get("irBorrowerID"), values.get("irCoBorrowerID")


def _extract_latest_credit_liabilities(ecs_response: dict) -> list:
    latest_entry = _latest_successful_ecs_entry(ecs_response)
    if not latest_entry:
        return []
    return [
        liability
        for credit_response in (latest_entry.get("response") or {}).get("credit-response") or []
        for liability in credit_response.get("credit-liability") or []
    ]


def _filter_explained_inquiries(
    inquiries: list,
    liabilities: list,
    borrower_ecs_id: str | None,
    *,
    explained_inquiries: list | None = None,
    role: str | None = None,
) -> list:
    accounts = []
    for liability in liabilities:
        owners = set(str(liability.get("borrower-id") or "").split("_")) - {""}
        if not borrower_ecs_id or borrower_ecs_id not in owners:
            continue
        name = _normalized_name((liability.get("creditor") or {}).get("name"))
        opened_day = _inquiry_day({"date": liability.get("opened-date")})
        if name and opened_day:
            accounts.append((name, opened_day, liability))

    unexplained = []
    for inquiry in inquiries:
        names = {
            _normalized_name(name)
            for name in [inquiry.get("name"), *(inquiry.get("merged-names") or [])]
            if _normalized_name(name)
        }
        inquiry_day = _inquiry_day(inquiry)
        match = next(
            (
                (liability, opened_day)
                for account_name, opened_day, liability in accounts
                if inquiry_day and account_name in names and opened_day >= inquiry_day
            ),
            None,
        )
        if match is None:
            unexplained.append(inquiry)
        else:
            liability, opened_day = match
            if explained_inquiries is not None:
                explained_inquiries.append({
                    "inquiry_id": _inquiry_id(inquiry),
                    "inquiry_date": inquiry_day,
                    "liability_id": liability.get("credit-liability-id"),
                    "creditor": (liability.get("creditor") or {}).get("name"),
                    "opened_date": opened_day,
                    "role": role,
                    "reason": "same_creditor_account_opened_on_or_after_inquiry",
                })
            logger.info(
                "Filtered credit inquiry %s: explained by a same-creditor liability opened on or after the inquiry date",
                _inquiry_id(inquiry),
            )
    return unexplained


def _group_credit_inquiries_by_borrower_id(
    inquiries: list,
    borrower_ecs_id: str,
    coborrower_ecs_id: str | None = None,
) -> dict[str, list]:
    groups = {"borrower": [], "coborrower": []}
    for inquiry in inquiries:
        inquiry_borrower_ids = set(str(inquiry.get("borrower-id") or "").split("_")) - {""}
        if borrower_ecs_id in inquiry_borrower_ids:
            groups["borrower"].append(inquiry)
        if coborrower_ecs_id and coborrower_ecs_id in inquiry_borrower_ids:
            groups["coborrower"].append(inquiry)
    return groups


def _filter_company_inquiries(inquiries: list, company_code: str) -> list:
    """Exclude company-owned inquiries and dates older than 90 UTC calendar days."""
    excluded_codes = COMPANY_INQUIRY_SUBSCRIBER_CODES.get((company_code or "").lower(), ())
    cutoff_date = datetime.now(timezone.utc).date() - timedelta(days=90)
    eligible_inquiries = []
    invalid_date_count = 0
    for inquiry in inquiries:
        try:
            inquiry_datetime = datetime.fromisoformat(inquiry.get("date") or "")
        except (ValueError, TypeError):
            invalid_date_count += 1
            continue
        # ECS dates without an offset are treated as UTC.
        if inquiry_datetime.tzinfo is None:
            inquiry_datetime = inquiry_datetime.replace(tzinfo=timezone.utc)
        if inquiry_datetime.astimezone(timezone.utc).date() < cutoff_date:
            continue
        if any(
            excluded_code == str(repository.get("subscriber-code") or "")
            or excluded_code in str(repository.get("subscriber-code") or "")
            for repository in inquiry.get("credit-repository") or []
            for excluded_code in excluded_codes
        ):
            continue
        eligible_inquiries.append(inquiry)
    if invalid_date_count:
        logger.warning("Skipped %d credit inquiries with missing or invalid dates", invalid_date_count)
    return eligible_inquiries


def _inquiry_explanation(inquiry: dict) -> dict:
    creditor = str(inquiry.get("name") or "").strip()
    if not creditor:
        creditor = ", ".join(dict.fromkeys(
            str(repository.get("source") or "").strip()
            for repository in inquiry.get("credit-repository") or []
            if str(repository.get("source") or "").strip()
        ))
    return {
        "explanationType": "CreditInquiry",
        "additionalData": {
            "inquiryDate": _format_inquiry_date(inquiry),
            "creditor": creditor,
        }
    }


def _format_inquiry_date(inquiry: dict) -> str:
    raw_date = str(inquiry.get("date") or "")
    day = _inquiry_day(inquiry)
    if not day:
        return raw_date
    return datetime.strptime(day, "%Y-%m-%d").strftime("%m/%d/%Y")


def _inquiry_id(inquiry: dict) -> str:
    """Return a stable, non-PII inquiry identity for cross-event deduplication."""
    inquiry_id = str(inquiry.get("credit-inquiry-id") or "").strip()
    if inquiry_id:
        return inquiry_id
    fallback = {
        "borrower_ids": sorted(str(inquiry.get("borrower-id") or "").split("_")),
        "date": str(inquiry.get("date") or ""),
        "repositories": sorted(
            str(repository.get("source") or "").strip().casefold()
            for repository in inquiry.get("credit-repository") or []
        ),
        "subscriber_codes": sorted(
            str(repository.get("subscriber-code") or "").strip()
            for repository in inquiry.get("credit-repository") or []
        ),
        "name": str(inquiry.get("name") or "").strip().casefold(),
    }
    encoded = json.dumps(fallback, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


def _inquiry_repository_sources(inquiry: dict) -> set[str]:
    return {
        str(repository.get("source") or "").strip().casefold()
        for repository in inquiry.get("credit-repository") or []
        if str(repository.get("source") or "").strip()
    }


def _normalized_name(name: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", str(name or "").casefold()))


_CREDITOR_LEGAL_SUFFIXES = {"inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company"}
_CREDITOR_GENERIC_WORDS = {"bank", "credit", "union", "financial", "finance", "services", "service", "mortgage", "lending", "national", "of", "the", "a", "and"}


def _is_word_prefix_abbreviation(abbreviation: list[str], words: list[str]) -> bool:
    if not abbreviation or (len(abbreviation) > 1 and not all(len(word) <= 2 for word in abbreviation)):
        return False
    compact = "".join(abbreviation)
    if not 2 <= len(compact) <= 12 or len(words) < 2 or len(compact) >= sum(map(len, words)):
        return False
    positions = {0}
    for word_index, word in enumerate(words):
        remaining_words = len(words) - word_index - 1
        positions = {
            offset + prefix_length
            for offset in positions
            for prefix_length in range(1, min(len(word), len(compact) - offset - remaining_words) + 1)
            if compact.startswith(word[:prefix_length], offset)
        }
        if not positions:
            return False
    return len(compact) in positions


def _creditor_name_match(name1: str, name2: str) -> tuple[float, str]:
    """Score equality, ordered abbreviations, and distinctive-word similarity."""
    normalized1 = _normalized_name(name1)
    normalized2 = _normalized_name(name2)
    if not normalized1 or not normalized2:
        return 0.0, "missing_name"
    if normalized1 == normalized2:
        return 1.0, "normalized_equality"

    best_score, method = 0.0, "no_match"
    parts1 = [_normalized_name(part) for part in str(name1).split("/") if part.strip()]
    parts2 = [_normalized_name(part) for part in str(name2).split("/") if part.strip()]
    for part1 in parts1:
        for part2 in parts2:
            words1 = [word for word in part1.split() if word not in _CREDITOR_LEGAL_SUFFIXES]
            words2 = [word for word in part2.split() if word not in _CREDITOR_LEGAL_SUFFIXES]
            if words1 and words1 == words2:
                return 1.0, "normalized_equality"
            if _is_word_prefix_abbreviation(words1, words2) or _is_word_prefix_abbreviation(words2, words1):
                if best_score < 0.85:
                    best_score, method = 0.85, "word_prefix_abbreviation"
            distinctive1 = [word for word in words1 if word not in _CREDITOR_GENERIC_WORDS]
            distinctive2 = [word for word in words2 if word not in _CREDITOR_GENERIC_WORDS]
            if not distinctive1 or not distinctive2:
                continue
            text1, text2 = " ".join(distinctive1), " ".join(distinctive2)
            score = difflib.SequenceMatcher(None, text1, text2).ratio()
            if min(len(text1), len(text2)) >= 4 and (text1 in text2 or text2 in text1):
                score = max(score, 0.8)
            if score > best_score:
                best_score, method = score, "distinctive_word_similarity"
    return best_score, method


def _name_similarity(name1: str, name2: str) -> float:
    return _creditor_name_match(name1, name2)[0]


def _inquiry_day(inquiry: dict) -> str | None:
    raw_date = str(inquiry.get("date") or "")
    try:
        value = datetime.fromisoformat(raw_date)
    except (TypeError, ValueError):
        try:
            value = datetime.strptime(raw_date, "%m/%d/%Y")
        except (TypeError, ValueError):
            return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).date().isoformat()


def _merge_inquiry_cluster(inquiries: list[dict]) -> dict:
    retained = max(
        inquiries,
        key=lambda inquiry: len(str(inquiry.get("name") or "")),
    )
    merged = deepcopy(retained)

    merged["merged-names"] = list(dict.fromkeys(
        name
        for inquiry in inquiries
        for name in [inquiry.get("name"), *(inquiry.get("merged-names") or [])]
        if isinstance(name, str) and name.strip()
    ))

    file_ids = list(dict.fromkeys(
        file_id
        for inquiry in inquiries
        for file_id in str(inquiry.get("credit-file-id") or "").split()
    ))
    if file_ids:
        merged["credit-file-id"] = " ".join(file_ids)

    repositories = []
    seen_repositories = set()
    for inquiry in inquiries:
        for repository in inquiry.get("credit-repository") or []:
            key = (
                str(repository.get("source") or "").strip().casefold(),
                str(repository.get("subscriber-code") or "").strip().casefold(),
            )
            if key not in seen_repositories:
                seen_repositories.add(key)
                repositories.append(deepcopy(repository))
    merged["credit-repository"] = repositories
    merged["tri-merge"] = True

    return merged


def _merge_tri_merge_credit_inquiries(inquiries: list[dict]) -> list[dict]:
    """Collapse same-day cross-bureau inquiries using dual- and tri-merge rules."""
    day_groups = {}
    for index, inquiry in enumerate(inquiries):
        day = _inquiry_day(inquiry)
        if day:
            day_groups.setdefault(day, []).append((index, inquiry))

    replacements = {}
    removed_indexes = set()
    for day_items in day_groups.values():
        day_inquiries = [inquiry for _, inquiry in day_items]
        clusters = []
        merge_matches = []

        if len(day_inquiries) >= 2:
            parent = list(range(len(day_inquiries)))

            def find(index):
                if parent[index] != index:
                    parent[index] = find(parent[index])
                return parent[index]

            candidate_pairs = []
            for left in range(len(day_inquiries)):
                for right in range(left + 1, len(day_inquiries)):
                    inquiry1 = day_inquiries[left]
                    inquiry2 = day_inquiries[right]
                    business1 = str(inquiry1.get("credit-business-type") or "").strip().casefold()
                    business2 = str(inquiry2.get("credit-business-type") or "").strip().casefold()
                    sources1 = _inquiry_repository_sources(inquiry1)
                    sources2 = _inquiry_repository_sources(inquiry2)
                    if not business1 or business1 != business2 or not sources1 or not sources2:
                        continue
                    if sources1 & sources2:
                        continue
                    score, method = _creditor_name_match(inquiry1.get("name"), inquiry2.get("name"))
                    if score >= 0.65:
                        candidate_pairs.append((score, left, right, method))

            for score, left, right, method in sorted(candidate_pairs, reverse=True):
                root_left = find(left)
                root_right = find(right)
                if root_left == root_right:
                    continue
                members_left = [index for index in range(len(day_inquiries)) if find(index) == root_left]
                members_right = [index for index in range(len(day_inquiries)) if find(index) == root_right]
                members = members_left + members_right
                if len(members) > 3:
                    continue
                member_sources = [_inquiry_repository_sources(day_inquiries[index]) for index in members]
                if any(
                    source_set1 & source_set2
                    for index, source_set1 in enumerate(member_sources)
                    for source_set2 in member_sources[index + 1:]
                ):
                    continue
                parent[root_right] = root_left
                merge_matches.append((left, right, {
                    "inquiry_ids": [_inquiry_id(day_inquiries[left]), _inquiry_id(day_inquiries[right])],
                    "method": method,
                    "score": score,
                }))

            grouped_indexes = {}
            for index in range(len(day_inquiries)):
                grouped_indexes.setdefault(find(index), []).append(index)
            clusters = [members for members in grouped_indexes.values() if len(members) > 1]

        for cluster in clusters:
            global_indexes = [day_items[index][0] for index in cluster]
            merged = _merge_inquiry_cluster(
                [inquiries[index] for index in global_indexes]
            )
            merged["merge-matches"] = [
                match for left, right, match in merge_matches
                if left in cluster and right in cluster
            ]
            logger.info(
                "Merged %d credit inquiries; inquiry_id=%s match_methods=%s min_match_score=%.2f",
                len(cluster), merged["credit-inquiry-id"],
                ",".join(sorted({match["method"] for match in merged["merge-matches"]})),
                min(match["score"] for match in merged["merge-matches"]),
            )
            replacements[min(global_indexes)] = merged
            removed_indexes.update(index for index in global_indexes if index != min(global_indexes))

    result = []
    for index, inquiry in enumerate(inquiries):
        if index in removed_indexes:
            continue
        result.append(replacements.get(index, inquiry))
    return result


def _inquiry_match_keys(inquiry: dict) -> set[tuple[str, str]]:
    raw_date = str(inquiry.get("date") or "")
    date = _inquiry_day(inquiry) or raw_date
    if not date:
        return set()
    keys = set()
    name = str(inquiry.get("name") or "").strip().casefold()
    if name:
        keys.add((date, name))
        if raw_date != date:
            keys.add((raw_date, name))
    sources = list(dict.fromkeys(
        str(repository.get("source") or "").strip()
        for repository in inquiry.get("credit-repository") or []
        if str(repository.get("source") or "").strip()
    ))
    if sources:
        keys.add((date, ", ".join(sources).casefold()))
        keys.update((date, source.casefold()) for source in sources)
        if raw_date != date:
            keys.add((raw_date, ", ".join(sources).casefold()))
            keys.update((raw_date, source.casefold()) for source in sources)
    return keys


def _new_credit_inquiry_task(consumer_id: str, explanations: list[dict]) -> dict:
    return {
        "task-template-id": "35d2fec9-462d-4f01-8b94-44d62bdbb113",
        "task-title": "Credit Inquiry Letter of Explanation",
        "task-description": "Please explain the purpose and outcome of the following inquiries that appear on your credit report. We need to know why you applied for credit and whether the credit resulted in new debt.",
        "task-key": "credit_inquiry_lox_gr",
        "task-type": "credit_inquiry_lox",
        "task-category": "LOX",
        "task-assigned-to": "consumer",
        "consumer-id": consumer_id,
        "gr-consumer-id": consumer_id,
        "task-meta": {
            "created-by": "Credit Inquiry Task Automation",
            "updated-by": "Credit Inquiry Task Automation",
            "task-display-type": "credit_inquiry_lox",
        },
        "task-explanations": explanations,
    }


def _task_result_data(response: dict) -> dict:
    if not response.get("success"):
        raise RuntimeError("Taskmaster task lookup failed")
    data = response.get("data") or {}
    return data if isinstance(data, dict) else {}


def _task_inquiry_match_keys(task: dict) -> set[tuple[str, str]]:
    keys = set()
    for explanation in task.get("task-explanations") or []:
        additional = explanation.get("additionalData") or {}
        inquiry_date = str(additional.get("inquiryDate") or "")
        creditor = str(additional.get("creditor") or "").strip().casefold()
        if inquiry_date:
            keys.add((inquiry_date, creditor))
            normalized_day = _inquiry_day({"date": inquiry_date})
            if normalized_day:
                keys.add((normalized_day, creditor))
    return keys


def _match_legacy_task_inquiries(task: dict, inquiries: list[dict]) -> dict[str, dict]:
    """Best-effort migration of pre-idempotency Taskmaster tasks into state."""
    task_keys = _task_inquiry_match_keys(task)
    matches = {}
    for inquiry in inquiries:
        explanation = _inquiry_explanation(inquiry)
        if _inquiry_match_keys(inquiry) & task_keys:
            matches[_inquiry_id(inquiry)] = explanation
    return matches


def _credit_inquiry_table():
    table_name = os.getenv("CREDIT_INQUIRY_TASK_TABLE_NAME")
    if not table_name:
        raise RuntimeError("CREDIT_INQUIRY_TASK_TABLE_NAME is not configured")
    return boto3.resource("dynamodb", region_name="us-east-1").Table(table_name)


class _LoanAlreadyProcessingError(RuntimeError):
    """The loan has an unexpired lock from another invocation."""


def _acquire_loan_lock(loan_number: str, company_code: str) -> tuple[object, str]:
    table = _credit_inquiry_table()
    token = str(uuid.uuid4())
    now = int(datetime.now(timezone.utc).timestamp())
    try:
        table.update_item(
            Key={"loan_number": str(loan_number)},
            UpdateExpression="SET #company = :company, lock_token = :token, lock_expires_at = :expiry",
            ConditionExpression="attribute_not_exists(lock_expires_at) OR lock_expires_at < :now",
            ExpressionAttributeNames={"#company": "company"},
            ExpressionAttributeValues={
                ":company": company_code,
                ":token": token,
                # Longer than Lambda's maximum execution window; lock expiry is
                # checked in the condition, not delegated to DynamoDB TTL.
                ":expiry": now + 1800,
                ":now": now,
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise _LoanAlreadyProcessingError(f"Credit inquiry processing is already locked for loan {loan_number}") from exc
        raise
    return table, token


def _release_loan_lock(table, loan_number: str, token: str) -> None:
    try:
        # Lock acquisition uses UpdateItem, which creates a row for a new loan.
        # Delete that row on exit if no workflow state was written; otherwise
        # non-pilot loans (which return before workflow processing) accumulate
        # as company-only records in the state table.
        table.delete_item(
            Key={"loan_number": str(loan_number)},
            ConditionExpression=(
                "lock_token = :token "
                "AND attribute_not_exists(borrower_active_task_id) "
                "AND attribute_not_exists(coborrower_active_task_id) "
                "AND attribute_not_exists(credit_inquiries) "
                "AND attribute_not_exists(task_credit_inquiries) "
                "AND attribute_not_exists(borrower_task) "
                "AND attribute_not_exists(coborrower_task) "
                "AND attribute_not_exists(workflow_state)"
            ),
            ExpressionAttributeValues={":token": token},
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        try:
            # A conditional delete fails for rows containing workflow state.
            # In that case, retain the row and only release this invocation's lock.
            table.update_item(
                Key={"loan_number": str(loan_number)},
                UpdateExpression="REMOVE lock_token, lock_expires_at",
                ConditionExpression="lock_token = :token",
                ExpressionAttributeValues={":token": token},
            )
        except ClientError as update_exc:
            if update_exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            logger.warning("Lock for loan %s expired or changed before release", loan_number)


def _load_credit_inquiry_state(table, loan_number: str) -> dict:
    response = table.get_item(Key={"loan_number": str(loan_number)}, ConsistentRead=True)
    item = response.get("Item") or {}
    legacy_state = item.get("workflow_state") or {}
    if not isinstance(legacy_state, dict):
        legacy_state = {}
    return {
        "borrower": {
            "active_task_id": item.get("borrower_active_task_id")
            or (legacy_state.get("borrower") or {}).get("active_task_id")
        },
        "coborrower": {
            "active_task_id": item.get("coborrower_active_task_id")
            or (legacy_state.get("coborrower") or {}).get("active_task_id")
        },
    }


def _save_credit_inquiry_state(
    table,
    loan_number: str,
    company_code: str,
    lock_token: str,
    borrower_active_task_id: str | None,
    coborrower_active_task_id: str | None,
    credit_inquiries: list,
    borrower_task: dict | None = None,
    coborrower_task: dict | None = None,
    explained_inquiries: list | None = None
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    snapshots = json.loads(
        json.dumps({
            "borrower": borrower_task,
            "coborrower": coborrower_task,
            "explained": explained_inquiries or [],
        }),
        parse_float=Decimal,
    )
    table.update_item(
        Key={"loan_number": str(loan_number)},
        UpdateExpression=(
            "SET #company = :company, borrower_active_task_id = :borrower_task_id, "
            "coborrower_active_task_id = :coborrower_task_id, credit_inquiries = :inquiries, "
            "borrower_task = :borrower_task, coborrower_task = :coborrower_task, "
            "explained_inquiries = :explained, "
            "created_at = :created REMOVE workflow_state, updated_at, credit_liabilities, task_credit_inquiries"
        ),
        ConditionExpression="lock_token = :token",
        ExpressionAttributeNames={"#company": "company"},
        ExpressionAttributeValues={
            ":company": company_code,
            ":borrower_task_id": borrower_active_task_id or "",
            ":coborrower_task_id": coborrower_active_task_id or "",
            ":borrower_task": snapshots["borrower"],
            ":coborrower_task": snapshots["coborrower"],
            ":inquiries": credit_inquiries,
            ":explained": snapshots["explained"],
            ":created": datetime.now(timezone.utc).isoformat(),
            ":token": lock_token,
        },
    )


async def _reconcile_party_task(
    role: str,
    consumer_id: str,
    inquiries: list[dict],
    party_state: dict,
    loan_id: str,
    company_code: str,
    legacy_tasks: list[dict],
) -> tuple[dict, dict | None]:
    # Taskmaster is the source of truth for task completion and explanations.
    completed_ids = set()
    for historical_task in legacy_tasks:
        if (
            historical_task.get("task-key") == "credit_inquiry_lox_gr"
            and (historical_task.get("gr-consumer-id") or historical_task.get("consumer-id")) == consumer_id
            and historical_task.get("task-completed")
            and not historical_task.get("task-removed")
        ):
            completed_ids.update(_match_legacy_task_inquiries(historical_task, inquiries))

    active_task_id = party_state.get("active_task_id")
    party_tasks = [
        task for task in legacy_tasks
        if task.get("task-key") == "credit_inquiry_lox_gr"
        and (task.get("gr-consumer-id") or task.get("consumer-id")) == consumer_id
        and not task.get("task-completed")
        and not task.get("task-removed")
        and task.get("task-id")
    ]
    if not active_task_id and party_tasks:
        latest = max(party_tasks, key=lambda task: task.get("created-on") or "")
        active_task_id = latest["task-id"]

    current_inquiries = {_inquiry_id(inquiry): _inquiry_explanation(inquiry) for inquiry in inquiries}
    active_inquiries = {}
    if active_task_id:
        task_response = json.loads(await GetTaskTool().execute({
            "loan-id": loan_id,
            "task-id": active_task_id,
            "company": company_code,
        }))
        task = _task_result_data(task_response)
        if task.get("task-completed"):
            completed_ids.update(_match_legacy_task_inquiries(task, inquiries))
            active_task_id = None
        elif task.get("task-removed"):
            active_task_id = None
        else:
            active_task_keys = _task_inquiry_match_keys(task)
            active_inquiries = {
                _inquiry_id(inquiry): _inquiry_explanation(inquiry)
                for inquiry in inquiries
                if _inquiry_match_keys(inquiry) & active_task_keys
            }

    new_inquiries = {
        inquiry_id: explanation
        for inquiry_id, explanation in current_inquiries.items()
        if inquiry_id not in completed_ids and inquiry_id not in active_inquiries
    }

    if active_task_id and not new_inquiries:
        return {"active_task_id": active_task_id, "task": task}, None

    if active_task_id and new_inquiries:
        remove_response = json.loads(await RemoveTaskTool().execute({
            "loan-id": loan_id,
            "task-id": active_task_id,
            "company": company_code,
        }))
        if not remove_response.get("success"):
            raise RuntimeError(f"Taskmaster failed to remove open {role} credit inquiry task")

    pending_inquiries = dict(active_inquiries)
    pending_inquiries.update(new_inquiries)
    task = _new_credit_inquiry_task(consumer_id, list(pending_inquiries.values())) if pending_inquiries else None
    return {"active_task_id": None}, task


class TaskmasterCreateResponseUnmatchedError(RuntimeError):
    pass


def _created_task_for_consumer(results: list[dict], consumer_id: str) -> dict:
    matches = [
        result for result in results
        if (result.get("gr-consumer-id") or result.get("consumer-id")) == consumer_id
    ]
    if len(matches) != 1 or not matches[0].get("task-id"):
        raise TaskmasterCreateResponseUnmatchedError(
            "Taskmaster create_tasks response did not uniquely identify the created task"
        )
    return matches[0]


def _write_credit_inquiry_task_record(
    loan_number: str,
    company_code: str,
    borrower_task: dict | None,
    coborrower_task: dict | None,
    credit_inquiries: list,
    explained_inquiries: list | None = None,
) -> None:
    table = _credit_inquiry_table()
    now = datetime.now(timezone.utc).isoformat()
    table.update_item(
        Key={"loan_number": str(loan_number)},
        UpdateExpression=(
            "SET #company = :company, borrower_task = :borrower_task, "
            "coborrower_task = :coborrower_task, credit_inquiries = :inquiries, "
            "explained_inquiries = :explained, "
            "created_at = :created REMOVE updated_at, credit_liabilities"
        ),
        ExpressionAttributeNames={"#company": "company"},
        ExpressionAttributeValues={
            ":company": company_code,
            ":borrower_task": borrower_task or {},
            ":coborrower_task": coborrower_task or {},
            ":inquiries": credit_inquiries,
            ":explained": explained_inquiries or [],
            ":created": now,
        },
    )


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def lambda_handler(event, context=None):
    result = asyncio.run(_handler(event))
    if result.get("statusCode", 200) >= 500:
        if result.get("error_code") in {
            "ecs_reissue_e0710",
            "ecs_reissue_e0424",
            "ecs_reissue_e0059",
            "ecs_reissue_missing_borrower_information",
            "ecs_no_successful_report",
            "taskmaster_create_http_500",
            "taskmaster_create_response_unmatched",
        }:
            logger.warning(
                "Credit inquiry processing failed without email alert: reason=%s status_code=%s",
                result["error_code"], result["statusCode"],
            )
        else:
            logger.error("CREDIT_INQUIRY_PROCESSING_FAILED status_code=%s", result["statusCode"])
    return result


async def _handler(event):
    identity = (event.get("detail", {}).get("identity") or {})
    company = (event.get("detail", {}).get("company") or {}).get("code")
    loan_number = identity.get("loanNumber")
    if not loan_number or not company:
        return await _process_event(event)

    try:
        table, lock_token = _acquire_loan_lock(loan_number, company)
    except _LoanAlreadyProcessingError:
        logger.info("Loan %s is already locked; skipping duplicate event", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "Loan already locked; duplicate event ignored"})}
    try:
        return await _process_event(event, lock_token)
    finally:
        _release_loan_lock(table, loan_number, lock_token)


async def _retrieve_ecs_credit(loan_number, company_code):
    """Retrieve credit, reissuing once on an unsuccessful response (non-dev only)."""
    try:
        ecs_response = json.loads(await GetECSCreditTool().execute({"loan_number": loan_number}))
    except Exception:
        logger.warning("Failed to retrieve ECS credit data; attempting reissue", exc_info=True)
        ecs_response = {"success": False}

    if not ecs_response.get("success"):
        logger.warning("Failed to retrieve ECS credit information for loan %s, attempting reissue", loan_number)
        try:
            reissue_response = json.loads(await ReissueCreditTool().execute({
                "loanId": loan_number,
                "company": company_code,
            }))
            if not reissue_response.get("success"):
                if reissue_response.get("error_code") == "ecs_reissue_missing_borrower_information":
                    logger.warning("ECS credit reissue rejected missing borrower information for loan %s", loan_number)
                    return {}, {
                        "statusCode": 500,
                        "error_code": "ecs_reissue_missing_borrower_information",
                        "body": json.dumps({"error": "Failed to reissue ECS credit information"}),
                    }
                data = reissue_response.get("data")
                if isinstance(data, dict) and data.get("status") == "Error":
                    errors = [
                        entry.get("description", "")
                        for field in ("credit-bureau-errors", "credit-report-status")
                        for entry in (data.get(field) or [])
                        if isinstance(entry, dict)
                    ]
                    if any(isinstance(description, str) and re.search(r"\bE0710\b", description) for description in errors):
                        logger.warning("ECS credit reissue rejected a non-CPS order for loan %s (E0710)", loan_number)
                        return {}, {
                            "statusCode": 500,
                            "error_code": "ecs_reissue_e0710",
                            "body": json.dumps({"error": "ECS credit reissue rejected a non-CPS order"}),
                        }
                    if errors and all(isinstance(description, str) and re.search(r"\bE0424\b", description) for description in errors):
                        logger.warning("ECS credit reissue rejected mismatched borrower information for loan %s (E0424)", loan_number)
                        return {}, {
                            "statusCode": 500,
                            "error_code": "ecs_reissue_e0424",
                            "body": json.dumps({"error": "Failed to reissue ECS credit information"}),
                        }
                    if (
                        errors
                        and all(
                            isinstance(entry, dict)
                            for field in ("credit-bureau-errors", "credit-report-status")
                            for entry in (data.get(field) or [])
                        )
                        and all(isinstance(description, str) and re.search(r"\bE0059\b", description) for description in errors)
                    ):
                        logger.warning("ECS credit reissue order number not found for loan %s (E0059)", loan_number)
                        return {}, {
                            "statusCode": 500,
                            "error_code": "ecs_reissue_e0059",
                            "body": json.dumps({"error": "Failed to reissue ECS credit information"}),
                        }
                logger.error("Failed to reissue ECS credit information for loan %s", loan_number)
                return {}, {"statusCode": 500, "body": json.dumps({"error": "Failed to reissue ECS credit information"})}
        except Exception:
            logger.exception("Failed to reissue ECS credit information")
            return {}, {"statusCode": 500, "body": json.dumps({"error": "Failed to reissue ECS credit information"})}

        try:
            ecs_response = json.loads(await GetECSCreditTool().execute({"loan_number": loan_number}))
            if not ecs_response.get("success"):
                logger.error("Failed to retrieve ECS credit information for loan %s after reissue", loan_number)
                return {}, {"statusCode": 500, "body": json.dumps({"error": "Failed to retrieve ECS credit information after reissue"})}
        except Exception:
            logger.exception("Failed to retrieve ECS credit data after reissue")
            return {}, {"statusCode": 500, "body": json.dumps({"error": "Failed to retrieve ECS credit data after reissue"})}
    return ecs_response, None


async def _process_event(event, lock_token=None):
    # Capture the Lambda configuration before secrets are copied into os.environ.
    environment = os.getenv("ENVIRONMENT", "")
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
    encompass_guid = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    if not loan_number:
        logger.warning("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not encompass_guid:
        logger.warning("Encompass GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass GUID is required in the event payload."})}
    if not company_code:
        logger.warning("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}

    logger.info("Received credit-order-ref-num-changed event for loan number: %s w/ company code: %s", loan_number, company_code)

    try:
        oneloan_response = json.loads(await GetLoanTool().execute({
            "loan_identifier": loan_number,
            "company": company_code,
            "requestedProperties": ["1240", "1268"],
        }))
        if oneloan_response.get("error_code") == "loan_not_found":
            logger.warning("Loan %s was not found in OneLoan; skipping credit inquiry processing", loan_number)
            return {"statusCode": 400, "body": json.dumps({"error": "Loan not found in OneLoan"})}
        if not oneloan_response.get("success"):
            raise RuntimeError("OneLoan lookup returned an unsuccessful response")
        loan_data = oneloan_response.get("data") or {}
    except Exception:
        logger.exception("Failed to retrieve borrower fields from OneLoan for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to retrieve loan information"})}

    if environment.lower() == "dev":
        logger.info("Skipping ECS retrieval and reissue in dev; using hardcoded credit inquiries")
        ecs_response = {}
        borrower_ecs_id, coborrower_ecs_id = DEV_IR_BORROWER_ID, DEV_IR_COBORROWER_ID
    else:
        ecs_response, error = await _retrieve_ecs_credit(loan_number, company_code)
        if error:
            return error
        latest_entry = _latest_successful_ecs_entry(ecs_response)
        if not latest_entry:
            logger.error("No successful ECS credit report found for loan %s", loan_number)
            return {
                "statusCode": 502,
                "error_code": "ecs_no_successful_report",
                "body": json.dumps({"error": "No successful ECS credit report found"}),
            }
        borrower_ecs_id, coborrower_ecs_id = _get_ecs_borrower_ids(latest_entry)

    all_credit_inquiries = _credit_inquiries_for_environment(ecs_response, environment)
    credit_inquiries = _filter_company_inquiries(all_credit_inquiries, company_code)
    if not credit_inquiries:
        logger.info("No eligible credit inquiries for loan %s; skipping task processing", loan_number)
        return {"statusCode": 200, "body": json.dumps({"message": "No eligible credit inquiries"})}
    if not borrower_ecs_id:
        logger.warning("ECS borrower identity is missing for loan %s; skipping processing", loan_number)
        return {"statusCode": 400, "body": json.dumps({"error": "ECS borrower identity is unavailable"})}

    grouped_inquiries = _group_credit_inquiries_by_borrower_id(
        credit_inquiries, borrower_ecs_id, coborrower_ecs_id
    )
    liabilities = (
        deepcopy(DEV_CREDIT_LIABILITIES)
        if environment.lower() == "dev"
        else _extract_latest_credit_liabilities(ecs_response)
    )
    ecs_party_ids = {"borrower": borrower_ecs_id, "coborrower": coborrower_ecs_id}
    explained_inquiries = []
    inquiries_by_party = {
        role: _filter_explained_inquiries(
            _merge_tri_merge_credit_inquiries(inquiries), liabilities, ecs_party_ids[role],
            explained_inquiries=explained_inquiries, role=role,
        )
        for role, inquiries in grouped_inquiries.items()
    }
    logger.info(
        "Selected %d borrower and %d coborrower eligible credit inquiries for loan %s",
        len(inquiries_by_party["borrower"]),
        len(inquiries_by_party["coborrower"]),
        loan_number,
    )
    borrower_email = loan_data.get("1240")
    coborrower_email = loan_data.get("1268")

    if not borrower_email:
        logger.warning("Borrower email field 1240 is missing for loan %s; skipping processing", loan_number)
        return {"statusCode": 400, "body": json.dumps({"error": "Borrower email is unavailable"})}

    try:
        borrower_search = json.loads(await SearchBorrowerEntityTool().execute({
            "email": borrower_email,
            "company-name": company_code,
        }))
        if borrower_search.get("error_code") == "borrower_not_found":
            borrower_id = None
        elif not borrower_search.get("success"):
            raise RuntimeError("Borrower entity search was unsuccessful")
        else:
            borrower_id = (borrower_search.get("data") or {}).get("borrower-guid")
    except Exception:
        logger.exception("Failed to resolve borrower entity for loan %s", loan_number)
        return {"statusCode": 502, "body": json.dumps({"error": "Failed to resolve borrower entity"})}
    if not borrower_id:
        logger.warning("Borrower entity is missing for loan %s; skipping credit inquiry processing", loan_number)
        return {"statusCode": 400, "body": json.dumps({"error": "Borrower entity not found"})}

    coborrower_id = None
    if coborrower_email:
        try:
            coborrower_search = json.loads(await SearchBorrowerEntityTool().execute({
                "email": coborrower_email,
                "company-name": company_code,
            }))
            if coborrower_search.get("error_code") == "borrower_not_found":
                coborrower_id = None
            elif not coborrower_search.get("success"):
                raise RuntimeError("Coborrower entity search was unsuccessful")
            else:
                coborrower_id = (coborrower_search.get("data") or {}).get("borrower-guid")
            if not coborrower_id:
                logger.warning("Optional coborrower entity was not found for loan %s; continuing with borrower only", loan_number)
        except Exception:
            logger.exception(
                "Could not resolve optional coborrower for loan %s; continuing with borrower task only",
                loan_number,
            )
    table = _credit_inquiry_table()
    workflow_state = _load_credit_inquiry_state(table, loan_number)
    party_ids = {"borrower": borrower_id}
    if coborrower_id:
        party_ids["coborrower"] = coborrower_id

    taskmaster_company = (company_code or "").lower()
    if taskmaster_company not in ("gra", "gri", "prate", "op", "citywide", "kbhs"):
        logger.info("Company code '%s' is unsupported by Taskmaster; defaulting to 'gri'", company_code)
        taskmaster_company = "gri"

    try:
        # Query Taskmaster every time; DynamoDB snapshots do not determine completion.
        legacy_response = json.loads(await GetTasksTool().execute({
            "loan-id": encompass_guid,
            "company": taskmaster_company,
        }))
        legacy_data = _task_result_data(legacy_response)
        legacy_tasks = legacy_data.get("results") or []
        if not isinstance(legacy_tasks, list):
            raise RuntimeError("Taskmaster get_tasks returned an invalid results field")
    except Exception:
        logger.exception("Failed to inspect existing Taskmaster tasks for loan %s", loan_number)
        return {"statusCode": 502, "body": json.dumps({"error": "Failed to inspect existing credit inquiry tasks"})}

    tasks_to_create_by_role = {}
    for role, consumer_id in party_ids.items():
        party_state, task = await _reconcile_party_task(
            role,
            consumer_id,
            inquiries_by_party[role],
            workflow_state.get(role) or {},
            encompass_guid,
            taskmaster_company,
            legacy_tasks,
        )
        workflow_state[role] = party_state
        if task:
            tasks_to_create_by_role[role] = task

    if tasks_to_create_by_role:
        payload = {
            "loan-id": encompass_guid,
            "company": taskmaster_company,
            "tasks": list(tasks_to_create_by_role.values()),
        }
        log_payload = redact_pii(payload)
        for logged_task in log_payload.get("tasks", []):
            logged_task["consumer-id"] = "[REDACTED]"
            logged_task["gr-consumer-id"] = "[REDACTED]"
        for task_group in log_payload.get("taskGroups", []):
            for logged_task in task_group.get("tasks", []):
                logged_task["consumer-id"] = "[REDACTED]"
                logged_task["gr-consumer-id"] = "[REDACTED]"
        logger.info("Taskmaster task payload (redacted): %s", json.dumps(log_payload, indent=2))
        try:
            taskmaster_raw = await CreateTasksTool().execute(payload)
            taskmaster_result = json.loads(taskmaster_raw)
            if not taskmaster_result.get("success"):
                logger.error("Taskmaster reported failure creating credit inquiry task(s) for loan %s", loan_number)
                failure = {"statusCode": 502, "body": json.dumps({"error": "Failed to create credit inquiry tasks"})}
                if taskmaster_result.get("error_code") == "taskmaster_create_http_500":
                    failure["error_code"] = "taskmaster_create_http_500"
                return failure
            created_results = (taskmaster_result.get("data") or {}).get("results") or []
            for role, task in tasks_to_create_by_role.items():
                try:
                    created_task = _created_task_for_consumer(created_results, task["gr-consumer-id"])
                except TaskmasterCreateResponseUnmatchedError:
                    logger.exception(
                        "Could not identify the created %s credit inquiry task for loan %s; "
                        "Taskmaster may have created tasks without saved workflow state",
                        role, loan_number,
                    )
                    return {
                        "statusCode": 502,
                        "error_code": "taskmaster_create_response_unmatched",
                        "body": json.dumps({"error": "Failed to create credit inquiry tasks"}),
                    }
                workflow_state[role]["active_task_id"] = created_task["task-id"]
                workflow_state[role]["task"] = {**task, **created_task}
        except Exception:
            logger.exception("Failed to create or reconcile credit inquiry task(s) for loan %s", loan_number)
            return {"statusCode": 502, "body": json.dumps({"error": "Failed to create credit inquiry tasks"})}
    
    try:
        _save_credit_inquiry_state(
            table,
            loan_number,
            company_code,
            lock_token,
            (workflow_state.get("borrower") or {}).get("active_task_id"),
            (workflow_state.get("coborrower") or {}).get("active_task_id"),
            all_credit_inquiries,
            borrower_task=(workflow_state.get("borrower") or {}).get("task"),
            coborrower_task=(workflow_state.get("coborrower") or {}).get("task"),
            explained_inquiries=explained_inquiries
        )
    except Exception:
        logger.exception("Failed to persist credit inquiry task state for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to record credit inquiry task state"})}

    active_task_count = sum(
        bool((workflow_state.get(role) or {}).get("active_task_id"))
        for role in ("borrower", "coborrower")
    )
    created_task_count = len(tasks_to_create_by_role)
    logger.info(
        "Credit inquiry task reconciliation complete for loan %s: active_task_count=%d, created_this_run=%d",
        loan_number,
        active_task_count,
        created_task_count,
    )
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Credit inquiry tasks reconciled",
            "active_task_count": active_task_count,
            "created_task_count": created_task_count,
        }),
    }
    