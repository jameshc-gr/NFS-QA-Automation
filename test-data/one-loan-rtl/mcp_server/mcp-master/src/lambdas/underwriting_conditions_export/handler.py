import json
import logging
import math
import os
from datetime import datetime, timezone
from typing import TypedDict
from uuid import uuid4

import boto3

from . import parquet_export

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

HOUR = 3600
STATE_KEY = "_state/checkpoint.json"


class PendingExport(TypedDict):
    start: int | None
    end: int
    token: str
    arn: str | None


class Checkpoint(TypedDict):
    through: int | None
    pending: PendingExport | None


def _utc(epoch: int) -> datetime:
    return datetime.fromtimestamp(epoch, timezone.utc)


def _write_checkpoint(s3, bucket: str, state: Checkpoint) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=STATE_KEY,
        ContentType="application/json",
        Body=json.dumps(state, sort_keys=True).encode("utf-8"),
    )


def _load_checkpoint(s3, bucket: str) -> Checkpoint:
    # A missing GetObject can be a 403 with prefix-scoped ListBucket access.
    objects = s3.list_objects_v2(Bucket=bucket, Prefix=STATE_KEY)
    if not any(obj["Key"] == STATE_KEY for obj in objects.get("Contents", [])):
        return {"through": None, "pending": None}
    with s3.get_object(Bucket=bucket, Key=STATE_KEY)["Body"] as body:
        return json.load(body)


def _new_window(dynamodb, table_name: str, through: int | None) -> PendingExport | None:
    recovery = dynamodb.describe_continuous_backups(TableName=table_name)[
        "ContinuousBackupsDescription"
    ]["PointInTimeRecoveryDescription"]
    if recovery["PointInTimeRecoveryStatus"] != "ENABLED":
        raise RuntimeError("DynamoDB point-in-time recovery is not enabled")

    earliest = math.ceil(recovery["EarliestRestorableDateTime"].timestamp())
    latest = math.floor(recovery["LatestRestorableDateTime"].timestamp())
    if through is not None and through < earliest:
        raise RuntimeError("Export checkpoint is outside the DynamoDB recovery window; rebaseline required")
    end = max(latest // HOUR * HOUR, earliest) if through is None else through + HOUR
    if end > latest:
        return None
    return {"start": through, "end": end, "token": uuid4().hex, "arn": None}


def _submit(dynamodb, table_arn: str, bucket: str, pending: PendingExport) -> str:
    args = {
        "TableArn": table_arn,
        "S3Bucket": bucket,
        "S3Prefix": f"exports/{pending['end']:010d}/{pending['token']}",
        "S3SseAlgorithm": "AES256",
        "ClientToken": pending["token"],
        "ExportFormat": "DYNAMODB_JSON",
    }
    if pending["start"] is None:
        location = dynamodb.export_table_to_point_in_time(
            **args, ExportType="FULL_EXPORT", ExportTime=_utc(pending["end"])
        )
    else:
        location = dynamodb.export_table_to_point_in_time(
            **args,
            ExportType="INCREMENTAL_EXPORT",
            IncrementalExportSpecification={
                "ExportFromTime": _utc(pending["start"]),
                "ExportToTime": _utc(pending["end"]),
                "ExportViewType": "NEW_AND_OLD_IMAGES",
            },
        )
    return location["ExportDescription"]["ExportArn"]


def _run(dynamodb, s3, table_arn: str, bucket: str) -> None:
    state = _load_checkpoint(s3, bucket)
    pending = state["pending"]
    if pending and pending["arn"]:
        result = dynamodb.describe_export(ExportArn=pending["arn"])["ExportDescription"]
        status = result["ExportStatus"]
        if status == "IN_PROGRESS":
            return
        if status == "FAILED":
            pending.update(token=uuid4().hex, arn=None)
            _write_checkpoint(s3, bucket, state)
            raise RuntimeError(f"DynamoDB export failed: {result['ExportArn']} ({result.get('FailureCode')})")
        if status != "COMPLETED":
            raise RuntimeError(f"Unexpected DynamoDB export status: {status}")

        end = pending["end"]
        published = parquet_export.publish(
            s3, bucket, result["ExportManifest"], pending["arn"], _utc(end),
            snapshot=pending["start"] is None,
        )
        state = {"through": end, "pending": None}
        _write_checkpoint(s3, bucket, state)
        logger.info("Published %s", published)
        pending = None

    if pending is None:
        pending = _new_window(dynamodb, table_arn.rsplit("/", 1)[-1], state["through"])
        if pending is None:
            return
        state["pending"] = pending
        # Persist the request before submission so ambiguous API errors reuse the token.
        _write_checkpoint(s3, bucket, state)

    pending["arn"] = _submit(dynamodb, table_arn, bucket, pending)
    _write_checkpoint(s3, bucket, state)
    logger.info("Started %s", pending["arn"])


def lambda_handler(event, context) -> None:
    _run(
        boto3.client("dynamodb"),
        boto3.client("s3"),
        os.environ["TABLE_ARN"],
        os.environ["EXPORT_BUCKET"],
    )
