"""
Helpers for accumulating HELOAN decisions (and their PDF reports) so that a single
digest email can be sent out on a recurring daily basis instead of one email per
decision. Declines and passes share the queue table/bucket and are separated by the
``decision`` attribute. See heloan_decline_digest lambda for the consumer side.
"""

import logging
import os
import time

import boto3

logger = logging.getLogger()

TABLE_REGION = "us-east-1"


def _queue_for_digest(prajna_result: dict, pdf_bytes: bytes, encompass_guid: str, decision: str, decline_reason: str) -> None:
    bucket_name = os.getenv("DECLINE_PDF_BUCKET_NAME")
    table_name = os.getenv("DECLINE_QUEUE_TABLE_NAME")
    if not bucket_name or not table_name:
        logger.warning("DECLINE_PDF_BUCKET_NAME/DECLINE_QUEUE_TABLE_NAME not configured; skipping digest queueing")
        return

    loan_number = prajna_result.get("loan_number", "unknown")
    company = prajna_result.get("company", "unknown")

    session = boto3.Session(region_name=TABLE_REGION)
    s3_key = f"{loan_number}.pdf"

    s3 = session.client("s3")
    s3.put_object(Bucket=bucket_name, Key=s3_key, Body=pdf_bytes, ContentType="application/pdf")

    table = session.resource("dynamodb").Table(table_name)
    table.put_item(Item={
        "loan_number": str(loan_number),
        "company": company,
        "encompass_guid": encompass_guid or "",
        "s3_key": s3_key,
        "decision": decision,
        "decline_reason": decline_reason,
        "created_at": int(time.time()),
    })
    logger.info("Queued HELOAN %s for daily digest: loan_number=%s", decision, loan_number)


def queue_decline_for_digest(prajna_result: dict, pdf_bytes: bytes, encompass_guid: str, decline_reason: str) -> None:
    """Upload the decline PDF to S3 and record it in DynamoDB for the daily digest lambda.

    Raises on failure so the caller can log/handle it; this is best-effort and should
    not block the primary lambda flow from returning a success response.
    """
    _queue_for_digest(prajna_result, pdf_bytes, encompass_guid, "DECLINE", decline_reason)


def queue_pass_for_digest(prajna_result: dict, pdf_bytes: bytes, encompass_guid: str, decision: str = "PASS") -> None:
    """Upload the pass/needs-review PDF to S3 and record it in DynamoDB for the daily digest lambda.

    Raises on failure so the caller can log/handle it; this is best-effort and should
    not block the primary lambda flow from returning a success response.
    """
    _queue_for_digest(prajna_result, pdf_bytes, encompass_guid, decision, "")
