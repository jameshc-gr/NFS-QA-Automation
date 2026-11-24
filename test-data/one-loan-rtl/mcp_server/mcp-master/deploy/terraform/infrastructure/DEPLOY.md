## Deploying a Lambda to Dev

This infrastructure uses the `nonprod-saas-dev` Terraform instance for the dev environment. Lambda packages are built locally into `/tmp`, and Terraform reads those ZIP files through the service module's `source_path` values.

### Credit Inquiry Error Alerts

The production credit inquiry alarm emails on unhandled Lambda errors or final
alertable 5xx responses, not on every error-level log. Initial ECS lookup
failures, including exceptions, trigger one credit reissue and a subsequent
lookup if reissue succeeds. Successful recovery does not email.

The Lambda logs but does not email when no successful ECS credit report is found,
for an ECS reissue error `E0710`, `E0424`, or `E0059` (order number not found),
an ECS HTTP 400 validation response
consisting only of empty borrower or coborrower fields, a confirmed missing
borrower entity, an HTTP 500 response from Taskmaster's create-tasks call, or a
successful create response that does not uniquely identify the created task.
In the last case, Taskmaster may already have created tasks without saved
workflow state. Verify existing tasks before replaying the event.
Inspect logs and coordinate with the appropriate downstream owner. Other ECS errors, Taskmaster
failures, and Lambda runtime errors remain alertable. This suppression does not
change processing responses or disable other monitoring systems.

For HELOAN specifically, the service module is defined as `module.heloan_lambda` in `services/digital-mortgage-systems-mcp`, and the dev instance addresses it as:

```text
module.digital_mortgage_systems_mcp.module.heloan_lambda
```

### 1. Build the HELOAN Lambda Package

From the HELOAN Lambda directory, build the deployment ZIP:

```sh
cd src/lambdas/heloan
./build-heloan-lambda.sh
```

The build script creates:

```text
/tmp/mcp-heloan.zip
```

Terraform uses that ZIP when applying the `heloan_lambda` module.

### Underwriting Conditions Export to Databricks (Production)

From the repository root, build the deployment package before planning the `prod-saas`
Terraform instance:

```sh
bash src/lambdas/underwriting_conditions_export/build-underwriting-conditions-export-lambda.sh
```

The package is `/tmp/mcp-underwriting-conditions-export.zip`. Review that the plan
enables point-in-time recovery **in place** on `mcp-underwriting-conditions-to-tasks-prod`.
After apply, use the `underwriting_conditions_export_bucket` Terraform output for
the bucket name and confirm the SNS subscription at `danny.cowles@rate.com`.
The Databricks team must grant
`arn:aws:iam::125302850010:role/databricks-cross-account-role-prod` corresponding
identity permissions: `s3:GetBucketLocation`, `s3:ListBucket` under `databricks/`,
and `s3:GetObject` on `databricks/*.parquet`. The bucket policy grants that role
read-only access to the Parquet folder, not to the raw DynamoDB exports under
`exports/` or the checkpoint under `_state/`.

**Databricks ingestion contract**

1. List `databricks/` and process its Parquet files in filename order. The first
   file is `YYYYMMDDTHHMMSSZ-snapshot.parquet`, containing the full table as of
   the UTC time in the filename. Use it to seed the target table.
2. Each completed hour publishes `YYYYMMDDTHHMMSSZ-changes.parquet`, named for
   the UTC end of the window, including a zero-row file for an hour with no
   changes. All files use the same schema; loan numbers and IDs are strings.
3. Use `(loan_number, row_id)` as the merge key. `_operation` is `SNAPSHOT`,
   `INSERT`, `UPDATE`, or `DELETE`. Upsert inserts and updates; delete matching
   keys for deletes. Delete rows contain the keys and batch metadata, not
   the old row values. `_window_end` is the UTC batch timestamp, and
   `_extra_attributes_json` preserves DynamoDB attributes outside the known
   columns. Track the last applied filename and make each merge safe to replay.
   Don't append the entire folder as a current-state table. DynamoDB compacts
   multiple writes to a key within a window into one net change.

The Lambda polls every five minutes and submits contiguous one-hour windows as
they become restorable. If a scheduled run is missed, it resumes from the last
published boundary. An export that fails is retried for the same window and
raises a Lambda error for the CloudWatch alarm. The Lambda writes Parquet
incrementally to temporary disk and publishes the completed file before
advancing its checkpoint. The current Lambda has 512 MiB of temporary disk and
a five-minute invocation limit; if a batch outgrows either, move the conversion
to a larger worker before retrying. If the checkpoint falls outside
the DynamoDB recovery window, the Lambda alarms instead of silently skipping the
gap. Restore the checkpoint if needed, or coordinate a new baseline with
Databricks; do not delete the checkpoint to force a rerun. Point-in-time recovery,
DynamoDB exports, and S3 storage incur charges. Completed exports are retained
without automatic expiration.

### Pipeline Assignment PDF Storage

Pipeline assignment PDFs use Chicago-date object keys (`YYYY-MM-DD/<assignment-id>.pdf`).
The assignment Lambda can upload objects and the daily roster-reset/digest Lambda can
read objects throughout the dedicated assignment PDF bucket, including legacy keys.
Completed PDFs and their versions do not expire automatically; the only lifecycle
cleanup aborts incomplete multipart uploads after seven days.

Processor first-review records mirror pipeline assignment when invoked by it: the
audit record's `id` and the PDF ID are the assignment audit ID, `created_at` is the
assignment's `created_at`, and `audit_date` is its `assignment_date`. The PDF uses the
same key in its own bucket (`YYYY-MM-DD/<assignment-id>.pdf`, dated by the
assignment's Chicago `created_at`). Only the PDF's "Check completed" time uses the
review's own execution time. Events without an assignment ID fall back to the
review's own ID and timestamps.

The production assignment alarm monitors the `AWS/Lambda` `Errors` metric, not
error-level log messages. PDF upload exceptions currently get logged and caught,
so they do not fail the invocation or trigger that alarm.

### Combined Assignment and First-Review Digest

Processor first review fetches the loan once, with no propagation delay or
polling. Its hard-credit check uses the Prequal Credit Report Indicator (4750):
boolean false passes, boolean true indicates soft-only credit, and blank/null
indicates no credit pull. Missing or unexpected values are UNKNOWN. Credit
authorization follow-ups remain separate from that result. The indicator provides
no credit-pull date; field IDs and raw values appear only in the audit log, not
the email or PDF check descriptions.
Consent retains its original interpretation: only boolean true indicates consent;
returned false, null, blank, or other values indicate consent is missing. An
absent required field prevents determining consent. Email follow-ups retain the
Borrower Summary Origination instructions and prior-file report exception, and
identify the affected borrowers by name. PDF findings retain the original
consent-dependent colors (red for missing consent, yellow for consent on file,
gray for unavailable information).

For successful pipeline assignments (no reason code or
`DAILY_CAP_EXCEEDED_FALLBACK` or `ASSIGNED_FROM_RESUBMISSION_POOL`), it uses the name, user ID, and email from the
pipeline-assignment payload instead of OneLoan's team fields, because OneLoan may
not reflect the assignment yet. The processor result fills both Mortgage
Consultant and Loan Coordinator. The email comes from the roster's `Email`
column; if the payload has no email, OneLoan's email is used only when its user ID
matches the payload. Already-assigned roles keep OneLoan's values, since the
Mortgage Consultant and Loan Coordinator can be different people. Differences
between OneLoan and the payload are recorded in the audit log.
The configured timeout remains 900 seconds and the duplicate-event lock 15 minutes.

The daily roster-reset Lambda sends one digest with the existing assignment
columns plus Disclosures and Hard Credit. Recipients, roster resets, the existing
06:00 UTC schedule, and immediate per-loan emails are unchanged.
Cells and headers use no-wrap styling; wide tables may still exceed narrow email
windows.

Pipeline assignment calculates `assignment_date` once from its UTC audit timestamp
plus 30 minutes, converted to `America/Chicago` and formatted as `YYYY-MM-DD`.
Assignments at or after 23:30 Chicago time belong to the next reporting date.
It passes that date and timestamp to first review, which stores the same date as
`audit_date` and the original timestamp as both `created_at` and
`assignment_created_at`. PDF folders use the assignment's actual Chicago date
without the reporting buffer.

The digest selects yesterday's Chicago reporting date. At the existing 06:00 UTC
schedule, the reporting cutoff precedes the digest by 30 minutes in standard time
and 90 minutes in daylight saving time. This is a completion buffer, not a guarantee
that failed or unusually delayed reviews will be available.

The digest queries `FIRST_REVIEW_AUDIT_TABLE_NAME` through its
`audit_date-created_at-index` from the day before the reporting date through the
send date, accommodating older reviews without inherited dates. Reviews match
on `assignment_audit_id`, not loan number. If multiple reviews match, the latest
`created_at` wins, with review ID breaking ties. Missing reviews display
`No review recorded`; an unsuccessful review query is logged and prevents sending
a misleading combined digest.

Available PDFs from `ASSIGNMENT_PDF_BUCKET_NAME` and `FIRST_REVIEW_PDF_BUCKET_NAME`
are attached as `<loan number> HELOAN Pipeline Assignment Report.pdf` and
`<loan number> HELOAN First Review.pdf`. Missing or unreadable PDFs are logged and
omitted independently. The digest role needs query access to the first-review
date index and read access to its PDF bucket; it receives no first-review write
permissions. Existing audit records without `assignment_audit_id` cannot be matched.
Legacy invocations without either date field retain review-local Chicago dating
and log a warning when associated with an assignment. Partial or malformed date
metadata is rejected and logged. Existing records are not backfilled; deploy first
review before pipeline assignment, then deploy the digest with the new reporting
convention. During transition, assignments already written under the old bucket
definition keep that definition.

### Milestone Movement Notifications

The milestone-move Lambda emails the configured internal recipients after a
confirmed move to Assigned to UW, or when an eligible first-review record was
not already marked moved but the move cannot be confirmed. Already-moved,
ineligible, and missing review records do not trigger email. Both notifications
attach the PDF identified by the review's `pdf_s3_key`; if the PDF cannot be
retrieved, the email says so and is sent without it. Notification delivery
failures are logged and do not retry milestone writes.

When deploying milestone-move notifications, build the milestone-move ZIP and
include its Terraform configuration and read-only first-review PDF bucket
permission. A code-only deploy will not enable PDF retrieval.

### 2. Deploy HELOAN to Dev

From the dev Terraform instance directory:

```sh
cd deploy/terraform/infrastructure/instances/nonprod-saas-dev
terraform init
terraform apply -target='module.digital_mortgage_systems_mcp.module.heloan_lambda'
```

Use the targeted apply when you only need to update the Lambda code/configuration.

### 3. Test the Dev Lambda

In AWS Lambda, open the dev function:

```text
mcp-heloan-dev
```

Create a test event using the JSON below, then invoke the function.

```json
{
	"version": "0",
	"id": "c58141d8-5a5e-ce7e-2c2d-58114bc3ad52",
	"detail-type": "esprit-rtl-business-event",
	"source": "Pipe erc-rtl-business-event-pipe",
	"account": "336015931235",
	"time": "2025-08-04T19:01:03Z",
	"region": "us-east-1",
	"resources": [],
	"detail": {
		"product": "mortgage",
		"eventName": "loan-status-changed",
		"eventData": {
			"loan-status": {
				"old": null,
				"new": "Active Loan"
			},
			"alp-lead-type": "VAR HELOC"
		},
		"version": "",
		"metadata": {
			"uuid": "5e155fa0-7165-11f0-b009-320338556dd3",
			"time": "2025-08-04T19:01:03.258118832Z",
			"source": "real-time-loan",
			"producer": "esprit"
		},
		"company": {
			"code": "gri"
		},
		"identity": {
			"version": {
				"source": "real-time-data-store",
				"value": 4
			},
			"grLoanGUID": "64773a7b-3d1b-48a6-89c0-355fb11df5b6",
			"encompassGUID": "38893483-85cc-40c7-899c-5422f79e3571",
			"loanNumber": "265172123DEV"
		}
	}
}
```

The handler requires `detail.identity.loanNumber`, `detail.identity.encompassGUID`, and `detail.company.code`.

Check the invocation result and CloudWatch logs for `mcp-heloan-dev` to verify the deployment.
