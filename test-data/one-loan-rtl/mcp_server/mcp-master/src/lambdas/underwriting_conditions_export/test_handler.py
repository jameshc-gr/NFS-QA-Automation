import gzip
import io
import json
import unittest
from unittest.mock import Mock

import pyarrow.parquet as pq
from botocore.exceptions import ClientError
from botocore.response import StreamingBody

from src.lambdas.underwriting_conditions_export import handler, parquet_export

TABLE_ARN = "arn:aws:dynamodb:us-east-1:123456789012:table/mcp-underwriting-conditions-to-tasks-prod"
BUCKET = "conditions-export"
BASELINE = 1_800_000_000
SNAPSHOT = "databricks/20270115T080000Z-snapshot.parquet"
FIRST_CHANGES = "databricks/20270115T090000Z-changes.parquet"
SUMMARY = "exports/private/manifest-summary.json"
FILES = "exports/private/manifest-files.json"
DATA = "exports/private/data/file.json.gz"


class MemoryS3:
    def __init__(self):
        self.objects = {}
        self.metadata = {}
        self.fail_checkpoint = False

    def list_objects_v2(self, *, Bucket, Prefix):
        return {"Contents": [{"Key": key} for key in self.objects if key.startswith(Prefix)]}

    def get_object(self, *, Bucket, Key):
        data = self.objects[Key]
        return {"Body": StreamingBody(io.BytesIO(data), len(data))}

    def head_object(self, *, Bucket, Key):
        return {"Metadata": self.metadata[Key]}

    def put_object(self, *, Bucket, Key, ContentType, Body, IfNoneMatch=None, Metadata=None, ContentLength=None):
        if Key == handler.STATE_KEY and self.fail_checkpoint:
            raise RuntimeError("interrupted checkpoint write")
        if IfNoneMatch == "*" and Key in self.objects:
            raise ClientError({"Error": {"Code": "PreconditionFailed"}}, "PutObject")
        data = Body if isinstance(Body, bytes) else Body.read()
        if ContentLength is not None and ContentLength != len(data):
            raise ValueError("Invalid content length")
        self.objects[Key] = data
        self.metadata[Key] = Metadata or {}


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.s3 = MemoryS3()
        self.ddb = Mock()
        self.ddb.export_table_to_point_in_time.return_value = {"ExportDescription": {"ExportArn": "job"}}
        self.recovery_window(BASELINE + 300)

    def recovery_window(self, latest, earliest=BASELINE - 7200):
        self.ddb.describe_continuous_backups.return_value = {
            "ContinuousBackupsDescription": {
                "PointInTimeRecoveryDescription": {
                    "PointInTimeRecoveryStatus": "ENABLED",
                    "EarliestRestorableDateTime": handler._utc(earliest),
                    "LatestRestorableDateTime": handler._utc(latest),
                }
            }
        }

    def poll(self):
        handler._run(self.ddb, self.s3, TABLE_ARN, BUCKET)

    def describe(self, status, manifest=SUMMARY):
        self.ddb.describe_export.return_value = {
            "ExportDescription": {
                "ExportStatus": status,
                "ExportArn": "job",
                "ExportManifest": manifest,
                "FailureCode": "S3AccessDenied",
            }
        }

    def raw_export(self, *records):
        self.s3.objects[SUMMARY] = json.dumps({"manifestFilesS3Key": FILES}).encode()
        self.s3.objects[FILES] = json.dumps({"dataFileS3Key": DATA}).encode() + b"\n"
        self.s3.objects[DATA] = gzip.compress(b"".join(json.dumps(record).encode() + b"\n" for record in records))

    def parquet(self, key):
        return pq.read_table(io.BytesIO(self.s3.objects[key]))

    def checkpoint(self):
        return json.loads(self.s3.objects[handler.STATE_KEY])

    def test_publishes_baseline_then_contiguous_hourly_windows_even_if_late(self):
        self.poll()
        initial = self.ddb.export_table_to_point_in_time.call_args.kwargs
        self.assertEqual(initial["ExportType"], "FULL_EXPORT")
        self.assertEqual(initial["ExportTime"], handler._utc(BASELINE))
        self.describe("IN_PROGRESS")
        self.poll()
        self.assertNotIn(SNAPSHOT, self.s3.objects)
        self.ddb.export_table_to_point_in_time.assert_called_once()

        self.describe("COMPLETED")
        keys = {"loan_number": {"S": "000123"}, "row_id": {"S": "cond-a:template-a:0"}}
        item = {**keys, "condition_filtered_out": {"BOOL": False}, "new_attribute": {"N": "5"}}
        self.raw_export({"Item": item})
        self.recovery_window(BASELINE + 3 * handler.HOUR)
        self.poll()
        snapshot = self.parquet(SNAPSHOT)
        self.assertEqual(snapshot.schema, parquet_export.SCHEMA)
        row, = snapshot.to_pylist()
        self.assertEqual(row["loan_number"], "000123")
        self.assertEqual(row["_operation"], "SNAPSHOT")
        self.assertIs(row["condition_filtered_out"], False)
        self.assertEqual(json.loads(row["_extra_attributes_json"]), {"new_attribute": {"N": "5"}})
        first = self.ddb.export_table_to_point_in_time.call_args.kwargs
        self.assertEqual(first["ExportType"], "INCREMENTAL_EXPORT")
        self.assertEqual(first["IncrementalExportSpecification"], {
            "ExportFromTime": handler._utc(BASELINE),
            "ExportToTime": handler._utc(BASELINE + handler.HOUR),
            "ExportViewType": "NEW_AND_OLD_IMAGES",
        })

        inserted = {**keys, "row_id": {"S": "cond-b:no-task:0"}}
        deleted = {**keys, "row_id": {"S": "cond-c:no-task:0"}}
        updated = {**item, "condition_title": {"S": "Verifies income"}}
        self.raw_export(
            {"Keys": inserted, "NewImage": inserted},
            {"Keys": keys, "OldImage": item, "NewImage": updated},
            {"Keys": deleted, "OldImage": {**deleted, "condition_title": {"S": "Deleted"}}},
        )
        self.poll()
        changes = self.parquet(FIRST_CHANGES)
        self.assertEqual(changes.schema, snapshot.schema)
        rows = changes.to_pylist()
        self.assertEqual([row["_operation"] for row in rows], ["INSERT", "UPDATE", "DELETE"])
        self.assertEqual(rows[1]["condition_title"], "Verifies income")
        self.assertEqual(rows[2]["row_id"], "cond-c:no-task:0")
        self.assertIsNone(rows[2]["condition_title"])
        self.assertTrue(all(row["_window_end"] == handler._utc(BASELINE + handler.HOUR) for row in rows))
        second = self.ddb.export_table_to_point_in_time.call_args.kwargs["IncrementalExportSpecification"]
        self.assertEqual(second["ExportFromTime"], first["IncrementalExportSpecification"]["ExportToTime"])
        self.assertEqual(second["ExportToTime"], handler._utc(BASELINE + 2 * handler.HOUR))

        self.raw_export()
        self.poll()
        empty = self.parquet("databricks/20270115T100000Z-changes.parquet")
        self.assertEqual(empty.num_rows, 0)
        self.assertEqual(empty.schema, snapshot.schema)

    def test_ambiguous_submission_reuses_request_and_token(self):
        submit = self.ddb.export_table_to_point_in_time
        submit.side_effect = TimeoutError("response lost")
        with self.assertRaises(TimeoutError):
            self.poll()
        request = submit.call_args
        submit.side_effect = None
        self.poll()
        self.assertEqual(submit.call_args, request)

    def test_failed_export_retries_same_window_without_publication(self):
        self.poll()
        first = self.ddb.export_table_to_point_in_time.call_args.kwargs
        self.describe("FAILED")
        with self.assertRaisesRegex(RuntimeError, "S3AccessDenied"):
            self.poll()
        self.assertNotIn(SNAPSHOT, self.s3.objects)
        self.poll()
        retry = self.ddb.export_table_to_point_in_time.call_args.kwargs
        self.assertEqual(retry["ExportTime"], first["ExportTime"])
        self.assertNotEqual(retry["ClientToken"], first["ClientToken"])
        self.assertNotEqual(retry["S3Prefix"], first["S3Prefix"])

    def test_checkpoint_failure_can_replay_publication_without_advancing_twice(self):
        self.poll()
        self.describe("COMPLETED")
        self.raw_export()
        self.s3.fail_checkpoint = True
        with self.assertRaisesRegex(RuntimeError, "checkpoint write"):
            self.poll()
        original = self.s3.objects[SNAPSHOT]
        self.assertIsNone(self.checkpoint()["through"])

        self.s3.fail_checkpoint = False
        self.poll()
        self.assertEqual(self.s3.objects[SNAPSHOT], original)
        self.assertEqual(self.checkpoint(), {"through": BASELINE, "pending": None})
        self.ddb.export_table_to_point_in_time.assert_called_once()

    def test_bad_raw_export_does_not_publish_or_advance(self):
        self.poll()
        self.describe("COMPLETED")
        self.raw_export({"Item": {"loan_number": {"S": "000123"}}})
        with self.assertRaisesRegex(KeyError, "row_id"):
            self.poll()
        self.assertNotIn(SNAPSHOT, self.s3.objects)
        self.assertIsNone(self.checkpoint()["through"])

    def test_different_export_cannot_overwrite_published_file(self):
        self.poll()
        self.describe("COMPLETED")
        self.raw_export()
        self.s3.objects[SNAPSHOT] = b"existing-data"
        self.s3.metadata[SNAPSHOT] = {"export-arn": "different-job"}
        with self.assertRaisesRegex(RuntimeError, "Different export already published"):
            self.poll()
        self.assertEqual(self.s3.objects[SNAPSHOT], b"existing-data")
        self.assertIsNone(self.checkpoint()["through"])

    def test_expired_checkpoint_fails_rather_than_skipping_a_window(self):
        self.s3.objects[handler.STATE_KEY] = json.dumps({"through": BASELINE, "pending": None}).encode()
        self.recovery_window(BASELINE + 7200, earliest=BASELINE + 1)
        with self.assertRaisesRegex(RuntimeError, "outside the DynamoDB recovery window"):
            self.poll()
        self.ddb.export_table_to_point_in_time.assert_not_called()


if __name__ == "__main__":
    unittest.main()
