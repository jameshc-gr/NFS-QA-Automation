import gzip
import json
import tempfile
from contextlib import closing
from datetime import datetime
from typing import Iterator

import pyarrow as pa
import pyarrow.parquet as pq
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError

PREFIX = "databricks"
KEY_COLUMNS = ("loan_number", "row_id")
STRING_COLUMNS = (
    *KEY_COLUMNS,
    "company", "gr_loan_guid", "encompass_guid", "datetime_stamp",
    "uw_condition_guid", "condition_title", "condition_description",
    "task_template_id", "task_key", "task_title", "task_description",
    "task_type", "task_action_type", "task_category", "task_display_type",
    "task_meta", "task_assigned_to",
)
BOOLEAN_COLUMNS = ("condition_filtered_out", "existing_task_removed")
DATA_COLUMNS = frozenset((*STRING_COLUMNS, *BOOLEAN_COLUMNS))
SCHEMA = pa.schema([
    *(pa.field(name, pa.string(), nullable=name not in KEY_COLUMNS) for name in STRING_COLUMNS),
    *(pa.field(name, pa.bool_()) for name in BOOLEAN_COLUMNS),
    pa.field("_operation", pa.string(), nullable=False),
    pa.field("_window_end", pa.timestamp("us", tz="UTC"), nullable=False),
    pa.field("_extra_attributes_json", pa.string()),
])
ROW_GROUP_SIZE = 2048
DESERIALIZER = TypeDeserializer()


def _records(s3, bucket: str, summary_key: str) -> Iterator[dict]:
    with closing(s3.get_object(Bucket=bucket, Key=summary_key)["Body"]) as body:
        manifest_key = json.load(body)["manifestFilesS3Key"]
    with closing(s3.get_object(Bucket=bucket, Key=manifest_key)["Body"]) as manifest:
        for line in manifest.iter_lines():
            data_key = json.loads(line)["dataFileS3Key"]
            with closing(s3.get_object(Bucket=bucket, Key=data_key)["Body"]) as body:
                with gzip.GzipFile(fileobj=body) as data:
                    for record in data:
                        yield json.loads(record)


def _row(record: dict, snapshot: bool, end: datetime) -> dict:
    if snapshot:
        image = keys = record["Item"]
        operation = "SNAPSHOT"
    else:
        keys = record["Keys"]
        if "NewImage" in record:
            image = record["NewImage"]
            operation = "UPDATE" if "OldImage" in record else "INSERT"
        elif "OldImage" in record:
            image = {}
            operation = "DELETE"
        else:
            raise ValueError("Incremental record has neither a new image nor an old image")

    row = {name: DESERIALIZER.deserialize(value) for name, value in image.items() if name in DATA_COLUMNS}
    for name in KEY_COLUMNS:
        row[name] = DESERIALIZER.deserialize(keys[name])
    extra = {name: value for name, value in image.items() if name not in DATA_COLUMNS}
    row.update(
        _operation=operation,
        _window_end=end,
        _extra_attributes_json=json.dumps(extra, sort_keys=True) if extra else None,
    )
    return row


def publish(s3, bucket: str, summary_key: str, export_arn: str, end: datetime, *, snapshot: bool) -> str:
    kind = "snapshot" if snapshot else "changes"
    key = f"{PREFIX}/{end:%Y%m%dT%H%M%SZ}-{kind}.parquet"
    with tempfile.TemporaryFile(dir="/tmp") as output:
        with pq.ParquetWriter(output, SCHEMA, compression="snappy") as writer:
            rows = []
            with closing(_records(s3, bucket, summary_key)) as records:
                for record in records:
                    rows.append(_row(record, snapshot, end))
                    if len(rows) == ROW_GROUP_SIZE:
                        writer.write_table(pa.Table.from_pylist(rows, schema=SCHEMA))
                        rows.clear()
            if rows:
                writer.write_table(pa.Table.from_pylist(rows, schema=SCHEMA))

        size = output.tell()
        output.seek(0)
        try:
            s3.put_object(
                Bucket=bucket, Key=key, Body=output, ContentLength=size,
                ContentType="application/vnd.apache.parquet",
                IfNoneMatch="*", Metadata={"export-arn": export_arn},
            )
        except ClientError as error:
            if error.response["Error"]["Code"] != "PreconditionFailed":
                raise
            existing = s3.head_object(Bucket=bucket, Key=key)
            if existing["Metadata"].get("export-arn") != export_arn:
                raise RuntimeError(f"Different export already published at {key}") from error
    return key
