import sys
import os
import json
import asyncio
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, patch

# Allow running from the project root or directly from this folder
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from src.lambdas.underwriting_approved.handler import (
    _existing_task_dedup_pair,
    _condition_task_template_fields,
    _build_prajna_conditions,
    _attach_condition_guids,
    _resolve_condition_task_templates,
    _flatten_tasks,
    _pending_task_dedup_pair,
    _resolve_task_template_ids,
    _write_loan_data_to_dynamodb,
    _write_conditions_to_tasks_rows,
    lambda_handler,
    _handler,
    PILOT_LC_IDS,
)


class TestTemplateEnvironmentRouting(unittest.TestCase):
    def _run_until_template_resolution(self, environment, catalog_success=True, condition_lookup_fails=False):
        module = "src.lambdas.underwriting_approved.handler"
        condition = {
            "title": "Income Documents", "description": "Provide documents", "guid": "condition-1",
            "isExternalIndicator": True, "priorTo": "PTD",
        }
        template = {
            "taskTemplateId": "template-uuid", "taskTemplateKey": "prajna-template-key",
            "taskTitleTemplates": {"en": "Provide income documents"},
            "taskDescriptionTemplates": {"en": "Upload documents"},
        }
        event = {"detail": {
            "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
            "company": {"code": "gri"},
        }}
        with ExitStack() as stack:
            stack.enter_context(patch.dict(os.environ, {
                "ENVIRONMENT": environment, "PRAJNA_CONDITIONS_DOMAIN": "https://prajna.example.test",
            }))
            stack.enter_context(patch(f"{module}.get_secret", return_value={
                "ENVIRONMENT": "dev" if environment == "prod" else "prod",
            }))
            stack.enter_context(patch(f"{module}._acquire_idempotency_lock", return_value=True))
            loan = stack.enter_context(patch(f"{module}.GetLoanTool"))
            loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {
                "underwritingConditionLogs": [condition], "1240": "borrower@example.test",
                "team-members": [{"roleName": "Loan Coordinator", "id": next(iter(PILOT_LC_IDS))}],
            }}))
            borrower = stack.enter_context(patch(f"{module}.SearchBorrowerEntityTool"))
            borrower.return_value.execute = AsyncMock(return_value=json.dumps({"data": {"borrower-guid": "borrower-1"}}))
            condition_lookup = stack.enter_context(patch(f"{module}._get_condition_task_templates", new_callable=AsyncMock))
            condition_lookup.return_value = {"income documents": [template]}
            if condition_lookup_fails:
                condition_lookup.side_effect = RuntimeError("Template lookup failed")
            catalog_lookup = stack.enter_context(patch(f"{module}._get_task_templates", new_callable=AsyncMock))
            catalog_lookup.return_value = {"success": catalog_success, "data": [template]}
            legacy_resolver = stack.enter_context(patch(f"{module}._resolve_task_template_ids", return_value=[]))
            condition_resolver = stack.enter_context(patch(f"{module}._resolve_condition_task_templates", return_value=[]))
            stack.enter_context(patch(f"{module}._write_conditions_to_tasks_rows"))
            session = stack.enter_context(patch(f"{module}.requests.Session"))
            post = session.return_value.post
            post.return_value.status_code = 200
            post.return_value.text = "synthetic Prajna response"
            post.return_value.json.return_value = {"results": [{
                "task_template_id": "prajna-template-key", "task_title": "Generated title",
                "task_description": "Generated description", "task_type": "Upload",
            }]}
            result = asyncio.run(_handler(event, None))
        return result, condition_lookup, catalog_lookup, legacy_resolver, condition_resolver, post

    def test_prod_uses_prajna_keys_without_condition_template_endpoint(self):
        result, condition_lookup, catalog, legacy_resolver, condition_resolver, post = self._run_until_template_resolution("prod")
        self.assertEqual(result["statusCode"], 200)
        condition_lookup.assert_not_awaited()
        catalog.assert_awaited_once()
        condition_resolver.assert_not_called()
        legacy_resolver.assert_called_once()
        self.assertEqual(legacy_resolver.call_args.args[0][0]["task_template_id"], "prajna-template-key")
        self.assertEqual(post.call_args.kwargs["json"], {"conditions": [{
            "condition_title": "Income Documents", "condition_description": "Provide documents",
            "uw_condition_guid": "condition-1",
        }]})

    def test_dev_still_uses_condition_templates_and_hints(self):
        result, condition_lookup, catalog, legacy_resolver, condition_resolver, post = self._run_until_template_resolution("dev")
        self.assertEqual(result["statusCode"], 200)
        condition_lookup.assert_awaited_once_with(["Income Documents"])
        catalog.assert_not_awaited()
        legacy_resolver.assert_not_called()
        condition_resolver.assert_called_once()
        condition = post.call_args.kwargs["json"]["conditions"][0]
        self.assertEqual(condition["task_title_template"], "Provide income documents")
        self.assertEqual(condition["task_description_template"], "Upload documents")

    def test_prod_global_catalog_failure_returns_error(self):
        result, condition_lookup, catalog, legacy_resolver, condition_resolver, _ = self._run_until_template_resolution(
            "prod", catalog_success=False,
        )
        self.assertEqual(result["statusCode"], 502)
        condition_lookup.assert_not_awaited()
        catalog.assert_awaited_once()
        legacy_resolver.assert_not_called()
        condition_resolver.assert_not_called()

    def test_dev_condition_lookup_failure_stops_before_prajna(self):
        result, _, catalog, legacy_resolver, condition_resolver, post = self._run_until_template_resolution(
            "dev", condition_lookup_fails=True,
        )
        self.assertEqual(result["statusCode"], 502)
        post.assert_not_called()
        catalog.assert_not_awaited()
        legacy_resolver.assert_not_called()
        condition_resolver.assert_not_called()


class TestFailureNotifications(unittest.TestCase):
    def test_only_final_error_responses_log_alert_marker(self):
        module = "src.lambdas.underwriting_approved.handler"
        for status_code in (200, 400, 500, 502):
            with (
                self.subTest(status_code=status_code),
                patch(f"{module}._handler", new_callable=AsyncMock) as process,
                patch(f"{module}.logger.error") as log_error,
            ):
                response = {"statusCode": status_code, "body": "{}"}
                process.return_value = response
                self.assertEqual(lambda_handler({}, None), response)
                process.assert_awaited_once_with({}, None)
                if status_code >= 400:
                    log_error.assert_called_once_with(
                        "UNDERWRITING_APPROVED_PROCESSING_FAILED status_code=%s", status_code,
                    )
                else:
                    log_error.assert_not_called()

    def test_unhandled_exceptions_propagate_without_duplicate_marker(self):
        module = "src.lambdas.underwriting_approved.handler"
        with (
            patch(f"{module}._handler", new_callable=AsyncMock, side_effect=RuntimeError("failure")),
            patch(f"{module}.logger.error") as log_error,
        ):
            with self.assertRaises(RuntimeError):
                lambda_handler({}, None)
            log_error.assert_not_called()


class TestFlattenTasks(unittest.TestCase):

    def test_single_task_no_extras(self):
        """A plain task_xxx object passes through unchanged."""
        results = [
            {
                "task_template_id": "income_w2",
                "task_title": "Upload Most Recent Paystubs",
                "task_description": "Please upload the co-borrower's most recent paystubs.",
                "task_type": "Upload",
            }
        ]
        flat = _flatten_tasks(results)
        self.assertEqual(len(flat), 1)
        self.assertEqual(flat[0]["task_template_id"], "income_w2")
        self.assertEqual(flat[0]["task_type"], "Upload")

    def test_task_with_task2(self):
        """An object with both task_xxx and task2_xxx is split into two tasks."""
        results = [
            {
                "task_template_id": "standard_lox",
                "task_title": "Explain Large Deposit",
                "task_description": "Please explain the $48,000 deposit.",
                "task_type": "LOX",
                "task2_template_id": "additional_documents",
                "task2_title": "Upload Documentation for Large Deposit",
                "task2_description": "Please upload a copy of the $48,000 check.",
                "task2_type": "Upload",
            }
        ]
        flat = _flatten_tasks(results)
        self.assertEqual(len(flat), 2)

        first, second = flat
        self.assertEqual(first["task_template_id"], "standard_lox")
        self.assertEqual(first["task_title"], "Explain Large Deposit")
        self.assertEqual(first["task_type"], "LOX")

        self.assertEqual(second["task_template_id"], "additional_documents")
        self.assertEqual(second["task_title"], "Upload Documentation for Large Deposit")
        self.assertEqual(second["task_type"], "Upload")

    def test_task_with_task2_and_task3(self):
        """task3_xxx is also expanded, and ordering is task, task2, task3."""
        results = [
            {
                "task_template_id": "a",
                "task_title": "Task A",
                "task_type": "LOX",
                "task2_template_id": "b",
                "task2_title": "Task B",
                "task2_type": "Upload",
                "task3_template_id": "c",
                "task3_title": "Task C",
                "task3_type": "Upload",
            }
        ]
        flat = _flatten_tasks(results)
        self.assertEqual(len(flat), 3)
        self.assertEqual(flat[0]["task_template_id"], "a")
        self.assertEqual(flat[1]["task_template_id"], "b")
        self.assertEqual(flat[2]["task_template_id"], "c")

    def test_multiple_results_mixed(self):
        """Mirrors the full example from the Prajna API response."""
        results = [
            {
                "task_template_id": "standard_lox",
                "task_title": "Explain Large Deposit",
                "task_description": "Please explain the $48,000 deposit on March 31, 2026 in your BOA account.",
                "task_type": "LOX",
                "task2_template_id": "additional_documents",
                "task2_title": "Upload Documentation for Large Deposit",
                "task2_description": "Please upload a copy of the $48,000 check deposited on March 31, 2026.",
                "task2_type": "Upload",
            },
            {
                "task_template_id": "income_w2",
                "task_title": "Upload Most Recent Paystubs",
                "task_description": "Please upload the co-borrower's most recent paystubs covering 30 days.",
                "task_type": "Upload",
            },
        ]
        flat = _flatten_tasks(results)
        self.assertEqual(len(flat), 3)

        self.assertEqual(flat[0]["task_template_id"], "standard_lox")
        self.assertEqual(flat[1]["task_template_id"], "additional_documents")
        self.assertEqual(flat[2]["task_template_id"], "income_w2")

        # All keys should start with task_ (no task2_ or task3_ leak through)
        for task in flat:
            for key in task:
                self.assertTrue(key.startswith("task_"), f"Unexpected key: {key}")

    def test_empty_results(self):
        """Empty input returns empty list."""
        self.assertEqual(_flatten_tasks([]), [])

    def test_no_task2_keys_leak(self):
        """Ensures task2_xxx keys never appear in the output."""
        results = [
            {
                "task_template_id": "x",
                "task_title": "X",
                "task_type": "LOX",
                "task2_template_id": "y",
                "task2_title": "Y",
                "task2_type": "Upload",
            }
        ]
        flat = _flatten_tasks(results)
        for task in flat:
            for key in task:
                self.assertFalse(key.startswith("task2_"), f"task2_ key leaked: {key}")


class TestConditionTaskTemplates(unittest.TestCase):

    def test_attaches_guid_to_one_to_one_prajna_results_without_guid(self):
        result = {
            "task_title": "Explain Large Deposit(s)",
            "task_description": "Please explain the deposit.",
            "task2_title": "Upload Documentation for Large Deposit(s)",
            "task2_description": "Provide a copy of the check.",
        }

        associated = _attach_condition_guids(
            [result],
            [{"uw_condition_guid": "condition-1"}],
        )

        self.assertEqual(associated[0]["uw_condition_guid"], "condition-1")
        self.assertNotIn("uw_condition_guid", result)

    def test_preserves_prajna_returned_guid_for_template_association(self):
        result = {
            "uw_condition_guid": "condition-from-prajna",
            "task_title": "AI-generated title",
            "task_description": "AI-generated description",
        }

        associated = _attach_condition_guids(
            [result],
            [{"uw_condition_guid": "different-positional-condition"}],
        )
        resolved = _resolve_condition_task_templates(
            _flatten_tasks(associated),
            {"condition-from-prajna": [{
                "taskTemplateId": "template-id",
                "taskTemplateKey": "template-key",
                "taskCategory": "assets",
            }]},
        )

        self.assertEqual(resolved[0]["uw_condition_guid"], "condition-from-prajna")
        self.assertEqual(resolved[0]["task_template_id"], "template-id")
        self.assertEqual(resolved[0]["task_title"], "AI-generated title")
        self.assertEqual(resolved[0]["task_description"], "AI-generated description")

    def test_maps_english_templates_for_one_and_two_task_templates(self):
        fields = _condition_task_template_fields([
            {
                "conditionKey": "Assets - Large Deposit Source",
                "taskTemplates": [{
                    "taskTitleTemplates": {"en": "Explain Large Deposit(s)", "es": "TODO"},
                    "taskDescriptionTemplates": {"en": "Please explain the source of funds."},
                }],
            },
            {
                "conditionKey": "Income - Variable",
                "taskTemplates": [
                    {
                        "taskTitleTemplates": {"en": "Explain Variable Income"},
                        "taskDescriptionTemplates": {"en": "Explain the income changes."},
                    },
                    {
                        "taskTitleTemplates": {"en": "Upload Income Documents"},
                        "taskDescriptionTemplates": {"en": "Upload supporting documents."},
                    },
                ],
            },
        ])

        self.assertEqual(fields["assets - large deposit source"], {
            "task_title_template": "Explain Large Deposit(s)",
            "task_description_template": "Please explain the source of funds.",
        })
        self.assertEqual(fields["income - variable"], {
            "task_title_template": "Explain Variable Income",
            "task_description_template": "Explain the income changes.",
            "task2_title_template": "Upload Income Documents",
            "task2_description_template": "Upload supporting documents.",
        })

    def test_ignores_non_english_values_and_malformed_template_entries(self):
        fields = _condition_task_template_fields([
            {"conditionKey": "Other", "taskTemplates": [{
                "taskTitleTemplates": {"es": "TODO"},
                "taskDescriptionTemplates": "invalid",
            }]},
            None,
        ])

        self.assertEqual(fields["other"], {
            "task_title_template": "",
            "task_description_template": "",
        })

    def test_builds_prajna_condition_payload_with_optional_second_template(self):
        conditions = _build_prajna_conditions(
            [
                {"title": "Assets - Large Deposit Source", "description": "Condition", "guid": "guid-1"},
                {"title": "Income - Variable", "description": "Income", "guid": "guid-2"},
                {"title": "No Matching Template", "description": "Other", "guid": "guid-3"},
            ],
            {
                "assets - large deposit source": {
                    "task_title_template": "Explain Large Deposit(s)",
                    "task_description_template": "Explain the source of funds.",
                },
                "income - variable": {
                    "task_title_template": "Explain Variable Income",
                    "task_description_template": "Explain changes.",
                    "task2_title_template": "Upload Income Documents",
                    "task2_description_template": "Upload documents.",
                },
            },
        )

        self.assertEqual(conditions[0], {
            "condition_title": "Assets - Large Deposit Source",
            "condition_description": "Condition",
            "uw_condition_guid": "guid-1",
            "task_title_template": "Explain Large Deposit(s)",
            "task_description_template": "Explain the source of funds.",
        })
        self.assertEqual(conditions[1]["task2_title_template"], "Upload Income Documents")
        self.assertEqual(conditions[1]["task2_description_template"], "Upload documents.")
        self.assertNotIn("task2_title_template", conditions[0])
        self.assertEqual(len(conditions), 2)
        self.assertNotIn("No Matching Template", [condition["condition_title"] for condition in conditions])

    def test_omits_condition_when_taskmaster_returns_no_templates(self):
        conditions = _build_prajna_conditions(
            [
                {"title": "Has Template", "guid": "guid-1"},
                {"title": "No Templates", "guid": "guid-2"},
                {"title": "Missing From Lookup", "guid": "guid-3"},
            ],
            {
                "has template": {"task_title_template": "Explain", "task_description_template": "Details"},
                "no templates": {},
            },
        )

        self.assertEqual([condition["condition_title"] for condition in conditions], ["Has Template"])

    def test_resolves_ai_task_text_to_condition_taskmaster_templates(self):
        ai_tasks = _flatten_tasks([{
            "uw_condition_guid": "condition-1",
            "task_title": "Explain Large Deposit(s)",
            "task_description": "Explain Chase #3356 deposit of $32,820.",
            "task2_title": "Upload Documentation for Large Deposit(s)",
            "task2_description": "Provide a copy of the $32,820 check.",
        }])
        templates_by_guid = {
            "condition-1": [
                {
                    "taskTemplateId": "explanation-template-id",
                    "taskTemplateKey": "assets_large_deposits",
                    "taskCategory": "assets",
                    "taskActionType": "data_lox",
                    "taskDisplayType": "data_lox",
                },
                {
                    "taskTemplateId": "document-template-id",
                    "taskTemplateKey": "assets_large_deposit_docs",
                    "taskCategory": "assets",
                    "taskActionType": "upload",
                    "taskDisplayType": "upload",
                },
            ]
        }

        resolved = _resolve_condition_task_templates(ai_tasks, templates_by_guid)

        self.assertEqual(len(resolved), 2)
        self.assertEqual(resolved[0]["task_title"], "Explain Large Deposit(s)")
        self.assertEqual(resolved[0]["task_description"], "Explain Chase #3356 deposit of $32,820.")
        self.assertEqual(resolved[0]["task_template_id"], "explanation-template-id")
        self.assertEqual(resolved[0]["task_key"], "assets_large_deposits")
        self.assertEqual(resolved[0]["task_action_type"], "data_lox")
        self.assertEqual(resolved[1]["task_title"], "Upload Documentation for Large Deposit(s)")
        self.assertEqual(resolved[1]["task_description"], "Provide a copy of the $32,820 check.")
        self.assertEqual(resolved[1]["task_template_id"], "document-template-id")


class TestTaskDedupPairs(unittest.TestCase):

    def test_pending_template_key_matches_existing_template_id_for_same_consumer(self):
        pending = {
            "gr-consumer-id": "consumer-1",
            "template-key": "earnest_money_deposit",
            "task-key": "possibly-different-derived-key",
            "task-template-id": "template-uuid-for-new-task",
        }
        existing = {
            "gr-consumer-id": "consumer-1",
            "task-key": "earnest_money_deposit",
            "task-template-id": "existing-template-guid",
        }

        self.assertEqual(_pending_task_dedup_pair(pending), _existing_task_dedup_pair(existing))

    def test_different_consumer_does_not_match(self):
        pending = {"gr-consumer-id": "consumer-1", "template-key": "earnest_money_deposit"}
        existing = {"gr-consumer-id": "consumer-2", "task-template-id": "earnest_money_deposit"}

        self.assertNotEqual(_pending_task_dedup_pair(pending), _existing_task_dedup_pair(existing))

    def test_resolution_preserves_template_key_before_uuid_replacement(self):
        tasks = [{
            "task_template_id": "standard_lox",
            "template_key": "assets_large_deposits",
        }]
        templates = [{
            "taskTemplateKey": "standard_lox",
            "taskTemplateId": "template-guid-123",
        }]

        resolved = _resolve_task_template_ids(tasks, templates)

        self.assertEqual(resolved[0]["template_key"], "assets_large_deposits")
        self.assertEqual(resolved[0]["task_key"], "standard_lox")
        self.assertEqual(resolved[0]["task_template_id"], "template-guid-123")
        normalized = {key.replace("_", "-"): value for key, value in resolved[0].items()}
        self.assertEqual(_pending_task_dedup_pair(normalized), (None, "assets_large_deposits"))

    def test_resolution_uses_lookup_key_if_prajna_template_key_is_missing(self):
        resolved = _resolve_task_template_ids(
            [{"task_template_id": "standard_lox"}],
            [{"taskTemplateKey": "standard_lox", "taskTemplateId": "template-guid-123"}],
        )

        self.assertEqual(resolved[0]["template_key"], "standard_lox")


class TestConditionsToTasksRows(unittest.TestCase):

    @patch("src.lambdas.underwriting_approved.handler.boto3.resource")
    def test_writes_both_loan_guids(self, mock_resource):
        batch = MagicMock()
        mock_resource.return_value.Table.return_value.batch_writer.return_value.__enter__.return_value = batch

        _write_conditions_to_tasks_rows(
            "1234567890",
            "gri",
            "gr-loan-guid-1",
            "encompass-guid-1",
            [{"uw_condition_guid": "condition-1"}],
        )

        item = batch.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["gr_loan_guid"], "gr-loan-guid-1")
        self.assertEqual(item["encompass_guid"], "encompass-guid-1")


class TestLoanDataToDynamodb(unittest.TestCase):

    @patch("src.lambdas.underwriting_approved.handler.boto3.resource")
    def test_writes_conditions_and_new_task_counts(self, mock_resource):
        conditions = [{"id": "condition-1"}, {"id": "condition-2"}]
        new_tasks = [{"id": "task-1"}]
        table = mock_resource.return_value.Table.return_value

        _write_loan_data_to_dynamodb("1234567890", conditions, new_tasks)

        item = table.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["conditions_count"], 2)
        self.assertEqual(item["new_tasks_count"], 1)
        self.assertEqual(json.loads(item["conditions_list"]), conditions)
        self.assertEqual(json.loads(item["new_tasks_list"]), new_tasks)


if __name__ == "__main__":
    unittest.main()
