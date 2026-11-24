"""
Persists a row per HELOAN credit decision in DynamoDB.

Serves two purposes: a human-readable record of what the lambda decided for a loan
(instead of digging through CloudWatch logs), and a deduplication guard against the
upstream credit-order-ref-num-changed event firing more than once for the same loan
and credit pull in quick succession.
"""

import logging
import os
from datetime import datetime, timezone
import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _latest_successful_entry(entries: list) -> dict | None:
    """Return the newest ECS entry that actually produced a credit report, or None."""
    # Failed pulls/reissues (e.g. bureau errors) are still recorded by ECS but have no report.
    successful = [
        e for e in entries
        if str(e.get("upstreamStatus") or "").upper() == "OK" and e.get("creditReferenceIdentifier")
    ]
    return max(successful, key=lambda e: e.get("created") or "", default=None)


def extract_credit_reference_identifier(ecs_response: dict) -> str:
    """Pull the credit reference identifier from the most recent successful ECS credit entry."""
    entries = (ecs_response.get("data") or {}).get("response") or []
    latest_entry = _latest_successful_entry(entries)
    return (latest_entry or {}).get("creditReferenceIdentifier") or ""


def filter_ecs_to_latest_report(ecs_data: dict) -> dict:
    """Return a copy of ecs_data whose response holds only the most recent successful credit report."""
    if not ecs_data or "response" not in ecs_data:
        return ecs_data

    latest_entry = _latest_successful_entry(ecs_data.get("response") or [])
    return {
        **ecs_data,
        "response": [latest_entry] if latest_entry else []
    }


def _get_table():
    table_name = os.getenv("HELOAN_DECISIONS_TABLE_NAME")
    if not table_name:
        logger.warning("HELOAN_DECISIONS_TABLE_NAME not configured; skipping decision record")
        return None
    return boto3.Session(region_name="us-east-1").resource("dynamodb").Table(table_name)


def _pull_already_recorded(table, loan_number: str, reference: str) -> bool:
    """Whether an earlier event already recorded this pull or the one it derives from.

    A reissue appends 'R', so 1015965673PQR also has to check 1015965673PQ. The
    reference itself is checked too, since a first event can legitimately arrive
    already ending in 'R' and a repeat of it is still a duplicate.
    """
    candidate_references = [reference]
    if reference.endswith("R"):
        candidate_references.append(reference[:-1])

    for candidate in candidate_references:
        response = table.get_item(Key={
            "loan_number": str(loan_number),
            "credit_reference_identifier": candidate,
        })
        if "Item" in response:
            return True
    return False


def claim_loan(
    loan_number: str,
    encompass_guid: str,
    company: str,
    credit_reference_identifier: str,
    loan_program: str,
    lo_email: str,
    pm_email: str,
) -> bool:
    """Record the in-progress decision, returning False if this credit pull was already claimed.

    A later event carrying a genuinely new credit reference for the same loan is
    processed normally; reprocessing an already-claimed pull requires deleting its
    item from the table.
    """
    table = _get_table()
    if table is None:
        return True

    try:
        if _pull_already_recorded(table, loan_number, credit_reference_identifier):
            logger.info(
                "Loan %s already has a HELOAN decision record for the pull behind credit reference %s; skipping duplicate event",
                loan_number,
                credit_reference_identifier
            )
            return False
    except Exception:
        # Don't let a DynamoDB outage block decisioning entirely.
        logger.exception("Failed to check existing HELOAN decision records for loan %s; proceeding", loan_number)

    try:
        table.put_item(
            Item={
                "loan_number": str(loan_number),
                "credit_reference_identifier": credit_reference_identifier,
                "encompass_guid": encompass_guid or "",
                "company": company or "",   
                "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "loan_program": loan_program or "",
                "loan_officer_email": lo_email or "",
                "process_manager_email": pm_email or "",
                "decision": "PENDING",
            },
        )
    except Exception:
        logger.exception("Failed to write HELOAN decision record for loan %s; proceeding", loan_number)

    return True


def record_decision(loan_number: str, credit_reference_identifier: str, decision: str, rules_count: int = 0) -> None:
    """Patch the claimed record with the final Prajna decision."""
    table = _get_table()
    if table is None:
        return

    table.update_item(
        Key={
            "loan_number": str(loan_number),
            "credit_reference_identifier": credit_reference_identifier
        },
        UpdateExpression="SET #d = :decision, #t = :timestamp, #r = :rules_count",
        ExpressionAttributeNames={"#d": "decision", "#t": "timestamp", "#r": "rules_count"},
        ExpressionAttributeValues={
            ":decision": decision,
            ":timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ":rules_count": int(rules_count or 0),
        },
    )
    logger.info("Recorded HELOAN decision %s for loan %s (%s rule(s))", decision, loan_number, rules_count)
