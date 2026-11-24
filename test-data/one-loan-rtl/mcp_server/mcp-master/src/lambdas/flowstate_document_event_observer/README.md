# Flowstate document event observer

This dev-only test Lambda logs the entire incoming event as JSON, including the
EventBridge envelope and nested payload. It does not invoke Flowstate or modify
documents. It logs the event before validating its shape.

Build the dependency-free deployment package with:

```sh
./src/lambdas/flowstate_document_event_observer/build-flowstate-document-event-observer-lambda.sh
```

The script writes `/tmp/flowstate-document-event-observer.zip`. In the
[dev Terraform stack](../../../deploy/terraform/infrastructure/instances/nonprod-saas-dev/flowstate-document-event-observer.tf),
set `flowstate_observer_test_loan_guid` to the synthetic test loan GUID when
planning and applying the deployment. The observer is not provisioned when
the variable is omitted. To remove it after testing, plan and apply with the
variable unset.

Three separate rules on `erc_events_bus` send full events to the same observer:

- `pdf-process-completed` from `doc-storage-service` matches the test GUID in
  `detail.eventData.loanGuid`.
- `encompass-attachment-event` from `enc-loan-sync` matches the test GUID in
  `detail.identity.encompassGUID`.
- `document-holder-updated` from `doc-storage-service` matches the test GUID in
  `detail.eventData.loanGuid`.

None of the rules filter by holder. If one action produces multiple matching
events, the observer logs them separately. The payload is unredacted, so use synthetic
test data only. Logs are retained for one day in
`/aws/lambda/flowstate-document-event-observer-dev`.
