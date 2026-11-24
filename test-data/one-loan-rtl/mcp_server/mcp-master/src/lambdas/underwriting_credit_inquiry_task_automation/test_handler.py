import json
import asyncio
import requests
import unittest
from contextlib import ExitStack
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from botocore.exceptions import ClientError

from src.lambdas.underwriting_credit_inquiry_task_automation.handler import (
    DEV_CREDIT_INQUIRIES,
    DEV_IR_BORROWER_ID,
    DEV_IR_COBORROWER_ID,
    _credit_inquiries_for_environment,
    _extract_latest_credit_inquiries,
    _extract_latest_credit_liabilities,
    _filter_explained_inquiries,
    _filter_company_inquiries,
    _merge_tri_merge_credit_inquiries,
    _name_similarity,
    _get_ecs_borrower_ids,
    _inquiry_explanation,
    _group_credit_inquiries_by_borrower_id,
    _handler,
    _process_event,
    lambda_handler,
    _acquire_loan_lock,
    _release_loan_lock,
    _reconcile_party_task,
    _created_task_for_consumer,
    _load_credit_inquiry_state,
    _save_credit_inquiry_state,
    _write_credit_inquiry_task_record,
)


class TestUnderwritingCreditInquiryTaskAutomation(unittest.TestCase):
    def test_entrypoint_logs_only_final_server_error_responses(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        for status_code in (200, 400, 404, 422, 499, 500, 502, 503):
            with (
                self.subTest(status_code=status_code),
                patch(f"{module}._handler", new_callable=AsyncMock) as process,
                patch(f"{module}.logger.error") as log_error,
            ):
                response = {"statusCode": status_code, "body": "{}"}
                process.return_value = response
                self.assertEqual(lambda_handler({}), response)
                if status_code >= 500:
                    log_error.assert_called_once_with(
                        "CREDIT_INQUIRY_PROCESSING_FAILED status_code=%s", status_code,
                    )
                else:
                    log_error.assert_not_called()

    def test_missing_event_identifiers_return_400_without_failure_marker(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {
            "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
            "company": {"code": "gri"},
        }}
        for section, field in (("identity", "loanNumber"), ("identity", "encompassGUID"), ("company", "code")):
            missing_field_event = deepcopy(event)
            del missing_field_event["detail"][section][field]
            with (
                self.subTest(field=field),
                patch(f"{module}.get_secret", return_value={}),
                patch(f"{module}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{module}._release_loan_lock"),
                patch(f"{module}.GetLoanTool") as get_loan,
                patch(f"{module}.logger.warning") as log_warning,
                patch(f"{module}.logger.error") as log_error,
            ):
                response = lambda_handler(missing_field_event)
                self.assertEqual(response["statusCode"], 400)
                log_warning.assert_called_once()
                log_error.assert_not_called()
                get_loan.assert_not_called()

    def test_oneloan_404_is_expected_and_does_not_emit_failure_marker(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {
            "identity": {"loanNumber": "missing-loan", "encompassGUID": "test-guid"},
            "company": {"code": "gri"},
        }}
        with (
            patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
            patch(f"{module}.get_secret", return_value={}),
            patch(f"{module}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{module}._release_loan_lock"),
            patch(f"{module}.GetLoanTool") as get_loan,
            patch(f"{module}._retrieve_ecs_credit", new_callable=AsyncMock) as get_ecs,
            patch(f"{module}.logger.warning") as log_warning,
            patch(f"{module}.logger.error") as log_error,
        ):
            get_loan.return_value.execute = AsyncMock(return_value=json.dumps({
                "success": False, "error": "Failed to fetch loan from OneLoan",
                "error_code": "loan_not_found",
            }))
            response = lambda_handler(event)
        self.assertEqual(response["statusCode"], 400)
        self.assertIn("Loan not found", json.loads(response["body"])["error"])
        log_warning.assert_called_once()
        log_error.assert_not_called()
        get_ecs.assert_not_awaited()

    def test_missing_primary_borrower_entity_is_expected_and_stops_processing(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {
            "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
            "company": {"code": "gri"},
        }}
        with (
            patch.dict("os.environ", {"ENVIRONMENT": "dev"}),
            patch(f"{module}.get_secret", return_value={}),
            patch(f"{module}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{module}._release_loan_lock"),
            patch(f"{module}.GetLoanTool") as get_loan,
            patch(f"{module}.SearchBorrowerEntityTool") as search_borrower,
            patch(f"{module}.logger.warning") as log_warning,
            patch(f"{module}.logger.error") as log_error,
        ):
            get_loan.return_value.execute = AsyncMock(return_value=json.dumps({
                "success": True,
                "data": {"1240": "borrower@example.test", "1268": None, "team-members": []},
            }))
            search_borrower.return_value.execute = AsyncMock(return_value=json.dumps({
                "success": False, "error": "Failed to search borrower entity",
                "error_code": "borrower_not_found",
            }))
            response = lambda_handler(event)
        self.assertEqual(response["statusCode"], 400)
        self.assertIn("Borrower entity not found", json.loads(response["body"])["error"])
        log_warning.assert_called_once()
        log_error.assert_not_called()
        search_borrower.return_value.execute.assert_awaited_once()

    def test_entrypoint_preserves_unhandled_exceptions_for_lambda_errors(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        with (
            patch(f"{module}._handler", new_callable=AsyncMock, side_effect=RuntimeError("failure")),
            patch(f"{module}.logger.error") as log_error,
        ):
            with self.assertRaises(RuntimeError):
                lambda_handler({})
            log_error.assert_not_called()

    def test_lock_contention_returns_success_without_processing_or_failure_marker(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {
            "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
            "company": {"code": "gri"},
        }}
        table = MagicMock()
        table.update_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "locked"}}, "UpdateItem",
        )
        with (
            patch(f"{module}._credit_inquiry_table", return_value=table),
            patch(f"{module}._process_event", new_callable=AsyncMock) as process,
            patch(f"{module}._release_loan_lock") as release,
            patch(f"{module}.logger.info") as log_info,
            patch(f"{module}.logger.error") as log_error,
        ):
            result = lambda_handler(event)
        self.assertEqual(result["statusCode"], 200)
        self.assertIn("already locked", json.loads(result["body"])["message"])
        process.assert_not_awaited()
        release.assert_not_called()
        log_error.assert_not_called()
        log_info.assert_called_once()
        table.update_item.assert_called_once()
        table.delete_item.assert_not_called()

    def test_unexpected_lock_errors_still_propagate(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {"identity": {"loanNumber": "test-loan"}, "company": {"code": "gri"}}}
        for error in (
            ClientError({"Error": {"Code": "AccessDeniedException", "Message": "denied"}}, "UpdateItem"),
            RuntimeError("Unexpected lock failure"),
        ):
            with (
                self.subTest(error=type(error).__name__),
                patch(f"{module}._credit_inquiry_table", return_value=MagicMock()) as credit_table,
                patch(f"{module}._process_event", new_callable=AsyncMock) as process,
                patch(f"{module}._release_loan_lock") as release,
            ):
                credit_table.return_value.update_item.side_effect = error
                with self.assertRaises(type(error)) as caught:
                    lambda_handler(event)
                self.assertIs(caught.exception, error)
                process.assert_not_awaited()
                release.assert_not_called()

    def test_handler_skips_ecs_in_dev_and_preserves_production_reissue(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {"identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"}, "company": {"code": "gri"}}}
        inquiries = [
            {"borrower-id": party_id, "date": "2026-10-01", "name": name,
             "credit-inquiry-id": name, "credit-business-type": "Finance",
             "credit-repository": [{"source": source}]}
            for party_id, name, source in [
                (DEV_IR_BORROWER_ID, "Borrower only", "TransUnion"),
                (DEV_IR_COBORROWER_ID, "Coborrower only", "Experian"),
                (f"{DEV_IR_BORROWER_ID}_{DEV_IR_COBORROWER_ID}", "Joint", "Equifax"),
            ]
        ]
        explained_inquiry = {
            "borrower-id": DEV_IR_BORROWER_ID, "date": "2026-10-02",
            "name": "JPMCB CARD", "credit-inquiry-id": "explained",
            "credit-business-type": "Banking", "credit-repository": [{"source": "Experian"}],
        }
        explained_pair = [explained_inquiry, {
            **explained_inquiry, "name": "JPMCB", "credit-inquiry-id": "explained-alias",
            "credit-repository": [{"source": "TransUnion"}],
        }]
        explained_id = _merge_tri_merge_credit_inquiries(explained_pair)[0]["credit-inquiry-id"]
        entry = self._entry("2026-10-01", inquiries + explained_pair)
        entry["response"]["credit-response"][0]["credit-liability"] = [{
            "credit-liability-id": "liability-explained",
            "borrower-id": DEV_IR_BORROWER_ID,
            "creditor": {"name": "JPMCB"},
            "opened-date": "2026-10-02",
        }, {
            "credit-liability-id": "unrelated",
            "borrower-id": DEV_IR_BORROWER_ID,
            "creditor": {"name": "UNRELATED BANK"},
            "opened-date": "2026-10-02",
        }]
        expected_explanations = [{
            "inquiry_id": explained_id, "inquiry_date": "2026-10-02",
            "liability_id": "liability-explained", "creditor": "JPMCB",
            "opened_date": "2026-10-02", "role": "borrower",
            "reason": "same_creditor_account_opened_on_or_after_inquiry",
        }]
        entry["response"]["keys"] = [
            {"name": "irBorrowerID", "value": DEV_IR_BORROWER_ID},
            {"name": "irCoBorrowerID", "value": DEV_IR_COBORROWER_ID},
        ]
        report = json.dumps({"success": True, "data": {"response": [entry]}})

        for environment, reissue, coborrower in [("dev", False, False), ("DEV", False, True), ("prod", False, True), ("prod", True, False)]:
            with self.subTest(environment=environment, reissue=reissue, coborrower=coborrower), ExitStack() as stack:
                clock = stack.enter_context(patch(f"{module}.datetime", wraps=datetime))
                clock.now.return_value = datetime(2026, 10, 6, tzinfo=timezone.utc)
                stack.enter_context(patch(f"{module}.DEV_CREDIT_INQUIRIES", inquiries + explained_pair))
                stack.enter_context(patch(
                    f"{module}.DEV_CREDIT_LIABILITIES",
                    entry["response"]["credit-response"][0]["credit-liability"],
                ))
                stack.enter_context(patch.dict("os.environ", {"ENVIRONMENT": environment}))
                fake_table = MagicMock()
                stack.enter_context(patch(f"{module}._acquire_loan_lock", return_value=(fake_table, "lock-token")))
                stack.enter_context(patch(f"{module}._release_loan_lock"))
                stack.enter_context(patch(f"{module}._credit_inquiry_table", return_value=fake_table))
                load_state = stack.enter_context(patch(f"{module}._load_credit_inquiry_state", return_value={}))
                save_state = stack.enter_context(patch(f"{module}._save_credit_inquiry_state"))
                # Secrets must not override the captured Lambda environment.
                stack.enter_context(patch(f"{module}.get_secret", return_value={"ENVIRONMENT": "prod"}))
                get_ecs = stack.enter_context(patch(f"{module}.GetECSCreditTool"))
                get_ecs.return_value.execute = AsyncMock(side_effect=[json.dumps({"success": False}), report] if reissue else [report])
                reissue_ecs = stack.enter_context(patch(f"{module}.ReissueCreditTool"))
                reissue_ecs.return_value.execute = AsyncMock(return_value=json.dumps({"success": True}))
                get_loan = stack.enter_context(patch(f"{module}.GetLoanTool"))
                get_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {
                    "1240": "borrower@example.com", "1268": "co@example.com" if coborrower else None,
                    "team-members": [{"roleName": "Mortgage Consultant", "id": "lkorizon"}],
                }}))
                search = stack.enter_context(patch(f"{module}.SearchBorrowerEntityTool"))
                search.return_value.execute = AsyncMock(side_effect=[json.dumps({"success": True, "data": {"borrower-guid": guid}}) for guid in ["borrower-entity", "co-entity"]])
                create = stack.enter_context(patch(f"{module}.CreateTasksTool"))
                created_by_id = {}
                async def create_task_response(arguments):
                    created_tasks = list(arguments["tasks"])
                    for group in arguments.get("taskGroups", []):
                        created_tasks.extend(group["tasks"])
                    results = [
                        {"task-id": f"task-{index}", "task-completed": False, "gr-consumer-id": task["gr-consumer-id"]}
                        for index, task in enumerate(created_tasks)
                    ]
                    for task, result in zip(created_tasks, results):
                        created_by_id[result["task-id"]] = {**task, **result}
                    return json.dumps({"success": True, "data": {"count": len(results), "results": results}})
                create.return_value.execute = AsyncMock(side_effect=create_task_response)
                get_task = stack.enter_context(patch(f"{module}.GetTaskTool"))

                async def get_created_task(arguments):
                    return json.dumps({"success": True, "data": created_by_id[arguments["task-id"]]})

                get_task.return_value.execute = AsyncMock(side_effect=get_created_task)
                get_tasks = stack.enter_context(patch(f"{module}.GetTasksTool"))
                get_tasks.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"results": []}}))
                result = asyncio.run(_handler(event))

                self.assertEqual(result["statusCode"], 200)
                response_body = json.loads(result["body"])
                create_payload = create.return_value.execute.call_args.args[0]
                tasks = list(create_payload["tasks"])
                task_groups = create_payload.get("taskGroups", [])
                for group in task_groups:
                    tasks.extend(group["tasks"])
                self.assertEqual(len(tasks), 2 if coborrower else 1)
                self.assertNotIn("taskGroups", create_payload)
                self.assertEqual(
                    {item["additionalData"]["creditor"] for item in tasks[0]["task-explanations"]},
                    {"Borrower only", "Joint"},
                )
                if coborrower:
                    self.assertEqual(
                        {item["additionalData"]["creditor"] for item in tasks[1]["task-explanations"]},
                        {"Coborrower only", "Joint"},
                    )
                self.assertEqual(response_body["active_task_count"], 2 if coborrower else 1)
                self.assertEqual(response_body["created_task_count"], 2 if coborrower else 1)
                self.assertEqual(len(tasks[0]["task-explanations"]), 2)
                get_tasks.return_value.execute.assert_awaited_once()
                fake_table.update_item.assert_not_called()
                save_state.assert_called_once()
                self.assertEqual(save_state.call_args.kwargs["mc_id"], "lkorizon")
                self.assertEqual(
                    save_state.call_args.kwargs["explained_inquiries"],
                    expected_explanations,
                )
                self.assertEqual(save_state.call_args.args[4], "task-0")
                self.assertEqual(save_state.call_args.kwargs["borrower_task"], created_by_id["task-0"])
                self.assertEqual(
                    save_state.call_args.kwargs["coborrower_task"],
                    created_by_id["task-1"] if coborrower else None,
                )
                if coborrower:
                    self.assertEqual(save_state.call_args.args[5], "task-1")
                if environment.lower() == "dev":
                    get_ecs.assert_not_called()
                    reissue_ecs.assert_not_called()
                else:
                    self.assertEqual(get_ecs.return_value.execute.await_count, 2 if reissue else 1)
                    self.assertEqual(reissue_ecs.return_value.execute.await_count, int(reissue))

                load_state.return_value = {
                    "borrower": {"active_task_id": "task-0"},
                    "coborrower": {"active_task_id": "task-1" if coborrower else None},
                }
                search.return_value.execute.side_effect = [
                    json.dumps({"success": True, "data": {"borrower-guid": guid}})
                    for guid in ["borrower-entity", "co-entity"]
                ]
                get_ecs.return_value.execute.side_effect = None
                get_ecs.return_value.execute.return_value = report
                repeated_result = asyncio.run(_handler(event))
                self.assertEqual(repeated_result["statusCode"], 200)
                self.assertEqual(json.loads(repeated_result["body"])["created_task_count"], 0)
                self.assertEqual(json.loads(repeated_result["body"])["active_task_count"], 2 if coborrower else 1)
                create.return_value.execute.assert_awaited_once()
                self.assertEqual(
                    save_state.call_args.kwargs["explained_inquiries"],
                    expected_explanations,
                )
                self.assertEqual(save_state.call_args.args[4], "task-0")
                self.assertEqual(save_state.call_args.args[5], "task-1" if coborrower else None)
                self.assertEqual(save_state.call_args.kwargs["borrower_task"], created_by_id["task-0"])
                self.assertEqual(
                    save_state.call_args.kwargs["coborrower_task"],
                    created_by_id["task-1"] if coborrower else None,
                )

    def test_handler_reports_existing_active_tasks_when_it_creates_none(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        event = {"detail": {"identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"}, "company": {"code": "gri"}}}
        active_ids = {"borrower": "borrower-task", "coborrower": "coborrower-task"}
        current_inquiries = _filter_company_inquiries(DEV_CREDIT_INQUIRIES, "gri")
        shared_inquiries = _merge_tri_merge_credit_inquiries(current_inquiries)

        with ExitStack() as stack:
            stack.enter_context(patch.dict("os.environ", {"ENVIRONMENT": "dev"}))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler._acquire_loan_lock", return_value=(MagicMock(), "lock")))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler._release_loan_lock"))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler._credit_inquiry_table", return_value=MagicMock()))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler._load_credit_inquiry_state", return_value={
                "borrower": {"active_task_id": active_ids["borrower"]},
                "coborrower": {"active_task_id": active_ids["coborrower"]},
            }))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler._save_credit_inquiry_state"))
            stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.get_secret", return_value={}))
            get_loan = stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.GetLoanTool"))
            get_loan.return_value.execute = AsyncMock(return_value=json.dumps({
                "success": True,
                "data": {"1240": "borrower@example.com", "1268": "coborrower@example.com"},
            }))
            search = stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.SearchBorrowerEntityTool"))
            search.return_value.execute = AsyncMock(side_effect=[
                json.dumps({"success": True, "data": {"borrower-guid": "borrower-entity"}}),
                json.dumps({"success": True, "data": {"borrower-guid": "coborrower-entity"}}),
            ])
            get_tasks = stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.GetTasksTool"))
            get_tasks.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"results": []}}))
            get_task = stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.GetTaskTool"))

            async def active_task_response(arguments):
                explanations = [_inquiry_explanation(inquiry) for inquiry in shared_inquiries]
                return json.dumps({"success": True, "data": {
                    "task-id": arguments["task-id"],
                    "task-completed": False,
                    "task-explanations": explanations,
                }})

            get_task.return_value.execute = AsyncMock(side_effect=active_task_response)
            create = stack.enter_context(patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.CreateTasksTool"))
            create.return_value.execute = AsyncMock()

            with self.assertLogs(level="INFO") as captured_logs:
                result = asyncio.run(_handler(event))

        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(json.loads(result["body"])["active_task_count"], 2)
        self.assertEqual(json.loads(result["body"])["created_task_count"], 0)
        create.return_value.execute.assert_not_awaited()
        self.assertEqual(get_task.return_value.execute.await_count, 2)
        self.assertTrue(any("active_task_count=2, created_this_run=0" in message for message in captured_logs.output))

    def test_uses_hardcoded_inquiries_only_in_dev(self):
        ecs_response = {
            "data": {
                "response": [
                    self._entry("2026-09-10T18:07:20", [{"credit-inquiry-id": "ecs-inquiry"}])
                ]
            }
        }

        dev_inquiries = _credit_inquiries_for_environment(ecs_response, "dev")
        production_inquiries = _credit_inquiries_for_environment(ecs_response, "prod")

        self.assertEqual(len(dev_inquiries), len(DEV_CREDIT_INQUIRIES))
        self.assertEqual(dev_inquiries[0]["credit-inquiry-id"], DEV_CREDIT_INQUIRIES[0]["credit-inquiry-id"])
        self.assertEqual(dev_inquiries[-1]["credit-inquiry-id"], DEV_CREDIT_INQUIRIES[-1]["credit-inquiry-id"])
        self.assertEqual(production_inquiries, [{"credit-inquiry-id": "ecs-inquiry"}])

    def test_dev_fixture_is_copied_before_use(self):
        inquiries = _credit_inquiries_for_environment({}, "dev")
        inquiries[0]["credit-repository"][0]["source"] = "changed"

        fresh_inquiries = _credit_inquiries_for_environment({}, "dev")

        self.assertEqual(fresh_inquiries[0]["credit-repository"][0]["source"], "TransUnion")

    def test_extracts_inquiries_from_latest_successful_report(self):
        older_inquiry = {"credit-inquiry-id": "old"}
        latest_inquiries = [
            {"credit-inquiry-id": "new-1"},
            {"credit-inquiry-id": "new-2"},
        ]
        ecs_response = {
            "success": True,
            "data": {
                "response": [
                    self._entry("2026-06-18T02:06:46", [older_inquiry]),
                    self._entry("2026-09-10T18:07:20", latest_inquiries),
                ]
            },
        }

        self.assertEqual(_extract_latest_credit_inquiries(ecs_response), latest_inquiries)

    def test_combines_inquiries_from_multiple_credit_responses(self):
        entry = self._entry("2026-09-10T18:07:20", [{"credit-inquiry-id": "one"}])
        entry["response"]["credit-response"].append(
            {"credit-inquiry": [{"credit-inquiry-id": "two"}]}
        )

        inquiries = _extract_latest_credit_inquiries({"data": {"response": [entry]}})

        self.assertEqual(
            [inquiry["credit-inquiry-id"] for inquiry in inquiries],
            ["one", "two"],
        )

    def test_skips_failed_newer_entry(self):
        good_entry = self._entry("2026-06-18T02:06:46", [{"credit-inquiry-id": "good"}])
        failed_entry = self._entry("2026-09-10T18:07:20", [{"credit-inquiry-id": "failed"}])
        failed_entry["upstreamStatus"] = "Error"

        inquiries = _extract_latest_credit_inquiries(
            {"data": {"response": [good_entry, failed_entry]}}
        )

        self.assertEqual(inquiries, [{"credit-inquiry-id": "good"}])

    def test_returns_empty_list_when_inquiries_are_missing(self):
        self.assertEqual(_extract_latest_credit_inquiries({}), [])
        self.assertEqual(
            _extract_latest_credit_inquiries(
                {"data": {"response": [self._entry("2026-09-10T18:07:20", [])]}}
            ),
            [],
        )

    def test_groups_inquiries_by_individual_borrower_id(self):
        borrower_inquiry = {
            "credit-inquiry-id": "borrower-inquiry",
            "borrower-id": "borrower-id",
        }
        coborrower_inquiry = {
            "credit-inquiry-id": "coborrower-inquiry",
            "borrower-id": "coborrower-id",
        }

        groups = _group_credit_inquiries_by_borrower_id(
            [borrower_inquiry, coborrower_inquiry], "borrower-id", "coborrower-id"
        )

        self.assertEqual(groups["borrower"], [borrower_inquiry])
        self.assertEqual(groups["coborrower"], [coborrower_inquiry])

    def test_joint_inquiry_is_in_both_borrower_groups(self):
        joint_inquiry = {
            "credit-inquiry-id": "joint-inquiry",
            "borrower-id": "borrower-id_coborrower-id",
        }

        groups = _group_credit_inquiries_by_borrower_id(
            [joint_inquiry], "borrower-id", "coborrower-id"
        )

        self.assertEqual(groups, {
            "borrower": [joint_inquiry],
            "coborrower": [joint_inquiry],
        })

    def test_collapses_three_same_day_different_bureau_inquiries(self):
        inquiries = [
            self._tri_merge_inquiry("TransUnion", "BOFA", "first"),
            self._tri_merge_inquiry("Experian", "BANK OF AMERICA", "second"),
            self._tri_merge_inquiry("Equifax", "B OF A", "third"),
        ]
        for inquiry, file_ids in zip(inquiries, ("TU1 TU2", "XPN1 XPN2", "EFX1 EFX2")):
            inquiry["credit-file-id"] = file_ids

        merged = _merge_tri_merge_credit_inquiries(inquiries)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["credit-file-id"], "TU1 TU2 XPN1 XPN2 EFX1 EFX2")
        self.assertEqual(merged[0]["name"], "BANK OF AMERICA")
        self.assertEqual(
            {repository["source"] for repository in merged[0]["credit-repository"]},
            {"TransUnion", "Experian", "Equifax"},
        )
        self.assertEqual(merged[0]["credit-inquiry-id"], "second")
        self.assertEqual(_inquiry_explanation(merged[0])["additionalData"]["creditor"], "BANK OF AMERICA")

    def test_dual_merge_keeps_id_and_metadata_of_longest_name_record(self):
        inquiries = [
            {**self._tri_merge_inquiry("Experian", "AMEX", "456"), "credit-file-id": "XPN1 XPN2"},
            {**self._tri_merge_inquiry("TransUnion", "AMERICAN EXPRESS", "123"),
             "credit-file-id": "TU1 TU2", "credit-loan-type": "CreditCard"},
        ]
        original = deepcopy(inquiries)
        merged = _merge_tri_merge_credit_inquiries(inquiries)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["credit-inquiry-id"], "123")
        self.assertEqual(merged[0]["name"], "AMERICAN EXPRESS")
        self.assertEqual(merged[0]["credit-loan-type"], "CreditCard")
        self.assertEqual(merged[0]["credit-file-id"], "XPN1 XPN2 TU1 TU2")
        self.assertEqual(merged[0]["merged-names"], ["AMEX", "AMERICAN EXPRESS"])
        self.assertEqual(len(merged[0]["credit-repository"]), 2)
        self.assertEqual(inquiries, original)

    def test_merge_keeps_first_original_id_when_names_have_equal_length(self):
        inquiries = [
            self._tri_merge_inquiry("Experian", "AMERICAN EXPRESS", "456"),
            self._tri_merge_inquiry("TransUnion", "AMERICAN EXPRESS", "123"),
        ]
        self.assertEqual(_merge_tri_merge_credit_inquiries(inquiries)[0]["credit-inquiry-id"], "456")

    def test_creditor_abbreviations_generalize_without_brand_aliases(self):
        for abbreviation, expanded in (
            ("AMEX", "AMERICAN EXPRESS"),
            ("JCP", "JC PENNY"),
            ("BOFA", "BANK OF AMERICA"),
            ("FD", "FACTUAL DATA"),
            ("CAPONE", "CAPITAL ONE"),
            ("ALBE", "ALPHA BETA"),
            ("A.M.E.X.", "AMERICAN EXPRESS INC"),
        ):
            with self.subTest(abbreviation=abbreviation, expanded=expanded):
                self.assertGreaterEqual(_name_similarity(abbreviation, expanded), 0.65)
                self.assertGreaterEqual(_name_similarity(expanded, abbreviation), 0.65)
                inquiries = [
                    self._tri_merge_inquiry("Experian", abbreviation, "short"),
                    self._tri_merge_inquiry("TransUnion", expanded, "long"),
                ]
                merged = _merge_tri_merge_credit_inquiries(inquiries)
                self.assertEqual(len(merged), 1)
                self.assertEqual(merged[0]["name"], expanded)
                self.assertEqual(merged[0]["merge-matches"][0]["method"], "word_prefix_abbreviation")
                self.assertGreaterEqual(merged[0]["merge-matches"][0]["score"], 0.65)

    def test_creditor_matching_rejects_generic_overlap_and_incomplete_abbreviations(self):
        for first, second in (
            ("ALPHA BANK", "BETA BANK"),
            ("FIRST NATIONAL BANK", "SECOND NATIONAL BANK"),
            ("CREDIT UNION", "CITY CREDIT"),
            ("BANK", "BANK OF AMERICA"),
            ("AMEX", "AMERICAN GENERAL"),
            ("AMEX", "EXPRESS AMERICAN"),
            ("JCP", "JPMCB CARD"),
        ):
            with self.subTest(first=first, second=second):
                self.assertLess(_name_similarity(first, second), 0.65)
                self.assertLess(_name_similarity(second, first), 0.65)

    def test_three_unrelated_creditors_do_not_merge_without_name_evidence(self):
        inquiries = [
            self._tri_merge_inquiry("Experian", "ALPHA BANK", "one"),
            self._tri_merge_inquiry("TransUnion", "BETA BANK", "two"),
            self._tri_merge_inquiry("Equifax", "MACYS", "three"),
        ]
        self.assertEqual(_merge_tri_merge_credit_inquiries(inquiries), inquiries)

    def test_abbreviation_merges_preserve_bureau_date_and_business_safeguards(self):
        first = self._tri_merge_inquiry("Experian", "AMEX", "one")
        second = self._tri_merge_inquiry("TransUnion", "AMERICAN EXPRESS", "two")
        for changed_fields in (
            {"date": "2026-10-02"},
            {"credit-repository": [{"source": "Experian"}]},
            {"credit-business-type": "Insurance"},
            {"credit-repository": []},
        ):
            with self.subTest(changed_fields=changed_fields):
                inquiries = [first, {**second, **changed_fields}]
                self.assertEqual(_merge_tri_merge_credit_inquiries(inquiries), inquiries)

    def test_dual_merge_uses_existing_fuzzy_rules_for_each_bureau_pair(self):
        for first_bureau, second_bureau in (
            ("Experian", "TransUnion"), ("Experian", "Equifax"), ("TransUnion", "Equifax"),
        ):
            with self.subTest(first_bureau=first_bureau, second_bureau=second_bureau):
                inquiries = [
                    self._tri_merge_inquiry(first_bureau, "ADVANTAGE CREDIT", "one"),
                    self._tri_merge_inquiry(second_bureau, "ADVANTAGE CREDIT INC", "two"),
                ]
                merged = _merge_tri_merge_credit_inquiries(inquiries)
                self.assertEqual(len(merged), 1)
                self.assertEqual(merged[0]["name"], "ADVANTAGE CREDIT INC")
                self.assertEqual(len(merged[0]["credit-repository"]), 2)

    def test_dual_merge_unions_file_ids_without_duplicates_or_input_mutation(self):
        for first_ids, second_ids, expected in (
            ("XPN1 XPN2", "TU1 TU2", "XPN1 XPN2 TU1 TU2"),
            (" XPN1 XPN2 XPN1 ", "XPN2 TU1  TU2", "XPN1 XPN2 TU1 TU2"),
            (None, "TU1 TU2", "TU1 TU2"),
            ("XPN1 XPN2", "", "XPN1 XPN2"),
        ):
            with self.subTest(first_ids=first_ids, second_ids=second_ids):
                inquiries = [
                    {**self._tri_merge_inquiry("Experian", "ADVANTAGE CREDIT", "one"), "credit-file-id": first_ids},
                    {**self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT INC", "two"), "credit-file-id": second_ids},
                ]
                original = deepcopy(inquiries)
                merged = _merge_tri_merge_credit_inquiries(inquiries)
                self.assertEqual(len(merged), 1)
                self.assertEqual(merged[0]["credit-file-id"], expected)
                self.assertEqual(inquiries, original)

    def test_dual_merge_preserves_date_bureau_business_and_name_safeguards(self):
        first = self._tri_merge_inquiry("Experian", "ADVANTAGE CREDIT", "one")
        second = self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT INC", "two")
        for changed_fields in (
            {"date": "2026-10-02"},
            {"credit-repository": [{"source": "Experian"}]},
            {"credit-repository": []},
            {"credit-business-type": "Insurance"},
            {"credit-business-type": ""},
            {"name": "MACYS"},
            {"name": ""},
        ):
            with self.subTest(changed_fields=changed_fields):
                inquiries = [first, {**second, **changed_fields}]
                self.assertEqual(_merge_tri_merge_credit_inquiries(inquiries), inquiries)

    def test_dual_merge_with_an_unrelated_third_inquiry(self):
        inquiries = [
            self._tri_merge_inquiry("Experian", "ADVANTAGE CREDIT", "one"),
            self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT INC", "two"),
            self._tri_merge_inquiry("TransUnion", "MACYS", "three"),
        ]
        merged = _merge_tri_merge_credit_inquiries(inquiries)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["name"], "ADVANTAGE CREDIT INC")
        self.assertEqual(merged[1], inquiries[2])

    def test_inquiry_explanation_uses_name_as_creditor_for_unmerged_inquiry(self):
        inquiry = self._tri_merge_inquiry("TransUnion", "LOCAL CREDIT UNION", "one")

        explanation = _inquiry_explanation(inquiry)

        self.assertEqual(
            explanation["additionalData"],
            {"inquiryDate": "10/01/2026", "creditor": "LOCAL CREDIT UNION"},
        )

    def test_formats_inquiry_explanation_dates_for_us_display(self):
        cases = [
            ("2026-10-01T00:00:00", "10/01/2026"),
            ("2026-02-09", "02/09/2026"),
            ("not-a-date", "not-a-date"),
        ]

        for inquiry_date, expected in cases:
            with self.subTest(inquiry_date=inquiry_date):
                explanation = _inquiry_explanation({"date": inquiry_date, "name": "Creditor"})
                self.assertEqual(explanation["additionalData"]["inquiryDate"], expected)

    def test_fuzzy_matching_keeps_overlapping_bureaus_separate(self):
        three = [
            self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT INC", "one"),
            self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT,INC", "two"),
            self._tri_merge_inquiry("Equifax", "UNRELATED BANK", "three"),
        ]
        self.assertEqual(len(_merge_tri_merge_credit_inquiries(three)), 3)

        four = three + [self._tri_merge_inquiry("Experian", "ADVANTAGE CREDIT INC", "four")]
        merged = _merge_tri_merge_credit_inquiries(four)
        self.assertEqual(len(merged), 3)
        self.assertEqual(
            sorted(len(inquiry["credit-repository"]) for inquiry in merged),
            [1, 1, 2],
        )

    def test_does_not_merge_repeated_same_bureau_or_different_business_type(self):
        inquiries = [
            self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT", "one"),
            self._tri_merge_inquiry("TransUnion", "ADVANTAGE CREDIT INC", "two"),
            self._tri_merge_inquiry("Experian", "ADVANTAGE CREDIT INC", "three", business_type="Insurance"),
            self._tri_merge_inquiry("Equifax", "UNRELATED", "four"),
        ]

        merged = _merge_tri_merge_credit_inquiries(inquiries)

        self.assertEqual(len(merged), 4)
        self.assertEqual([inquiry["credit-inquiry-id"] for inquiry in merged], [
            "one", "two", "three", "four",
        ])

    def test_liability_matches_any_original_name_after_dual_or_tri_merge(self):
        names = ["Bank of America", "BOA", "BankOfA"]
        for count in (2, 3):
            with self.subTest(count=count):
                inquiries = [
                    self._tri_merge_inquiry(source, name, f"inquiry-{index}")
                    for index, (source, name) in enumerate(zip(
                        ("Experian", "TransUnion", "Equifax"), names[:count],
                    ))
                ]
                original = deepcopy(inquiries)
                merged = _merge_tri_merge_credit_inquiries(inquiries)
                self.assertEqual(len(merged), 1)
                self.assertEqual(merged[0]["name"], "Bank of America")
                self.assertEqual(merged[0]["merged-names"], names[:count])
                self.assertEqual(inquiries, original)
                for alias in names[:count]:
                    with self.subTest(alias=alias):
                        liability = {
                            "credit-liability-id": "matching-account", "creditor": {"name": alias.lower()},
                            "opened-date": "2026-10-01", "borrower-id": "borrower-id",
                        }
                        audit = []
                        self.assertEqual(_filter_explained_inquiries(
                            merged, [liability], "borrower-id", explained_inquiries=audit, role="borrower",
                        ), [])
                        self.assertEqual(len(audit), 1)
                        self.assertEqual(audit[0]["inquiry_id"], merged[0]["credit-inquiry-id"])
                        self.assertEqual(audit[0]["liability_id"], "matching-account")
                        self.assertEqual(audit[0]["creditor"], alias.lower())

    def test_merged_alias_matches_preserve_liability_owner_date_and_exact_name_checks(self):
        merged = _merge_tri_merge_credit_inquiries([
            self._tri_merge_inquiry("Experian", "Bank of America", "one"),
            self._tri_merge_inquiry("TransUnion", "BOA", "two"),
        ])
        liability = {
            "creditor": {"name": "BOA"}, "opened-date": "2026-10-01", "borrower-id": "borrower-id",
        }
        for changed_fields in (
            {"borrower-id": "coborrower-id"},
            {"opened-date": "2026-09-30"},
            {"opened-date": None},
            {"creditor": {"name": "Bank of Amer"}},
            {"creditor": {"name": "OTHER BANK"}},
        ):
            with self.subTest(changed_fields=changed_fields):
                audit = []
                self.assertEqual(_filter_explained_inquiries(
                    merged, [{**liability, **changed_fields}], "borrower-id",
                    explained_inquiries=audit, role="borrower",
                ), merged)
                self.assertEqual(audit, [])

    def test_liabilities_explain_same_creditor_on_or_after_inquiry_date(self):
        inquiry = {"name": "JPMCB CARD", "date": "2026-10-12", "borrower-id": "borrower"}
        for opened_day in ("2026-10-12", "2026-10-13"):
            with self.subTest(opened_day=opened_day):
                liability = {
                    "creditor": {"name": " jpmcb card "},
                    "opened-date": opened_day,
                    "borrower-id": "borrower",
                }
                self.assertEqual(_filter_explained_inquiries([inquiry], [liability], "borrower"), [])

    def test_logs_only_explained_inquiries_without_creditor_or_owner_details(self):
        explained = {
            "credit-inquiry-id": "inquiry-explained", "name": "JPMCB CARD",
            "date": "2026-10-12", "borrower-id": "private-owner",
        }
        unmatched = {**explained, "credit-inquiry-id": "inquiry-unmatched", "name": "OTHER BANK"}
        liability = {
            "creditor": {"name": "JPMCB CARD"}, "opened-date": "2026-10-12",
            "borrower-id": "private-owner",
        }
        with self.assertLogs(level="INFO") as logs:
            remaining = _filter_explained_inquiries([explained, unmatched], [liability], "private-owner")
        self.assertEqual(remaining, [unmatched])
        self.assertEqual(len(logs.output), 1)
        self.assertIn("Filtered credit inquiry inquiry-explained", logs.output[0])
        self.assertIn("explained by a same-creditor liability", logs.output[0])
        for excluded_text in ("JPMCB CARD", "OTHER BANK", "private-owner", "inquiry-unmatched"):
            self.assertNotIn(excluded_text, logs.output[0])

    def test_unmatched_or_incomplete_liabilities_do_not_explain_inquiries(self):
        inquiry = {"name": "JPMCB CARD", "date": "2026-10-12", "borrower-id": "borrower"}
        liability = {
            "creditor": {"name": "JPMCB CARD"}, "opened-date": "2026-10-12",
            "borrower-id": "borrower",
        }
        for changed_fields in (
            {"opened-date": "2026-10-11"},
            {"opened-date": None},
            {"opened-date": "invalid"},
            {"creditor": {"name": "OTHER BANK"}},
            {"creditor": None},
            {"borrower-id": "coborrower"},
            {"borrower-id": None},
        ):
            with self.subTest(changed_fields=changed_fields):
                self.assertEqual(
                    _filter_explained_inquiries([inquiry], [{**liability, **changed_fields}], "borrower"),
                    [inquiry],
                )
        invalid_inquiry = {**inquiry, "date": "invalid"}
        self.assertEqual(_filter_explained_inquiries([invalid_inquiry], [liability], "borrower"), [invalid_inquiry])

    def test_joint_inquiry_is_explained_only_for_account_owners(self):
        inquiry = {"name": "JPMCB CARD", "date": "2026-10-12", "borrower-id": "borrower_coborrower"}
        liability = {
            "creditor": {"name": "JPMCB CARD"}, "opened-date": "2026-10-12",
            "borrower-id": "borrower",
        }
        self.assertEqual(_filter_explained_inquiries([inquiry], [liability], "borrower"), [])
        self.assertEqual(_filter_explained_inquiries([inquiry], [liability], "coborrower"), [inquiry])
        liability["borrower-id"] = "borrower_coborrower"
        self.assertEqual(_filter_explained_inquiries([inquiry], [liability], "coborrower"), [])

    def test_audit_records_only_actual_removals_for_each_party(self):
        inquiry = {
            "credit-inquiry-id": "joint", "name": "JPMCB CARD", "date": "2026-10-12",
            "borrower-id": "borrower_coborrower",
        }
        liability = {
            "credit-liability-id": "matched", "creditor": {"name": "JPMCB CARD"},
            "opened-date": "2026-10-13", "borrower-id": "borrower",
            "acct-id": "private-account", "unpaid-balance-amt": 123.45,
        }
        liabilities = [
            {**liability, "creditor": {"name": "OTHER BANK"}},
            liability,
            {**liability, "credit-liability-id": "another-match"},
        ]
        audit = []
        self.assertEqual(_filter_explained_inquiries(
            [inquiry], liabilities, "borrower", explained_inquiries=audit, role="borrower",
        ), [])
        self.assertEqual(_filter_explained_inquiries(
            [inquiry], liabilities, "coborrower", explained_inquiries=audit, role="coborrower",
        ), [inquiry])
        self.assertEqual(audit, [{
            "inquiry_id": "joint", "inquiry_date": "2026-10-12",
            "liability_id": "matched", "creditor": "JPMCB CARD", "opened_date": "2026-10-13",
            "role": "borrower", "reason": "same_creditor_account_opened_on_or_after_inquiry",
        }])
        liability["borrower-id"] = "borrower_coborrower"
        self.assertEqual(_filter_explained_inquiries(
            [inquiry], liabilities, "coborrower", explained_inquiries=audit, role="coborrower",
        ), [])
        self.assertEqual(len(audit), 2)
        self.assertEqual(audit[1]["role"], "coborrower")

    def test_liabilities_come_only_from_latest_successful_report(self):
        old = self._entry("2026-10-01", [])
        latest = self._entry("2026-10-02", [])
        failed = {**self._entry("2026-10-03", []), "upstreamStatus": "ERROR"}
        for entry, name in ((old, "old"), (latest, "latest"), (failed, "failed")):
            entry["response"]["credit-response"][0]["credit-liability"] = [{"creditor": {"name": name}}]
        self.assertEqual(
            _extract_latest_credit_liabilities({"data": {"response": [old, latest, failed]}}),
            [{"creditor": {"name": "latest"}}],
        )
        self.assertEqual(_extract_latest_credit_liabilities({}), [])

    def test_inquiry_without_borrower_id_is_not_grouped(self):
        self.assertEqual(
            _group_credit_inquiries_by_borrower_id(
                [{"credit-inquiry-id": "missing-borrower"}], "borrower-id", "coborrower-id"
            ),
            {"borrower": [], "coborrower": []},
        )

    def test_extracts_ir_party_ids_from_latest_report_keys(self):
        entry = self._entry("2026-09-10T18:07:20", [])
        entry["response"]["keys"] = [
            {"name": "irBorrowerID", "value": "ir-borrower"},
            {"name": "irCoBorrowerID", "value": "ir-coborrower"},
        ]

        self.assertEqual(_get_ecs_borrower_ids(entry), ("ir-borrower", "ir-coborrower"))

    def test_grouping_matches_single_and_joint_dev_inquiry_ids(self):
        borrower_only = {"borrower-id": DEV_IR_BORROWER_ID}
        coborrower_only = {"borrower-id": DEV_IR_COBORROWER_ID}
        joint = {"borrower-id": f"{DEV_IR_BORROWER_ID}_{DEV_IR_COBORROWER_ID}"}

        groups = _group_credit_inquiries_by_borrower_id(
            [borrower_only, coborrower_only, joint],
            DEV_IR_BORROWER_ID,
            DEV_IR_COBORROWER_ID,
        )

        self.assertEqual(groups["borrower"], [borrower_only, joint])
        self.assertEqual(groups["coborrower"], [coborrower_only, joint])

    def test_filters_company_owned_inquiries_by_subscriber_code(self):
        owned = {
            "credit-inquiry-id": "owned",
            "date": datetime.now(timezone.utc).date().isoformat(),
            "credit-repository": [{"subscriber-code": "01191"}],
        }
        external = {
            "credit-inquiry-id": "external",
            "date": datetime.now(timezone.utc).date().isoformat(),
            "credit-repository": [{"subscriber-code": "123456"}],
        }

        self.assertEqual(_filter_company_inquiries([owned, external], "gri"), [external])

    def test_reconcile_new_party_creates_task_for_all_current_inquiries(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        inquiries = [
            {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]},
            {"credit-inquiry-id": "i2", "date": "2026-10-02", "credit-repository": [{"source": "TransUnion"}]},
        ]
        with patch(f"{module}.GetTaskTool") as get_task, patch(f"{module}.RemoveTaskTool") as remove_task:
            next_state, task = asyncio.run(_reconcile_party_task(
                "borrower", "consumer-1", inquiries, {}, "loan-guid", "gri", []
            ))
        get_task.assert_not_called()
        remove_task.assert_not_called()
        self.assertEqual(next_state, {"active_task_id": None})
        self.assertEqual(len(task["task-explanations"]), 2)

    def test_reconcile_open_task_replaces_it_with_old_and_new_inquiries(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        prior_explanation = {"explanationType": "CreditInquiry", "additionalData": {"inquiryDate": "2026-10-01", "creditor": "Experian"}, "localId": "old"}
        old_state = {"active_task_id": "old-task"}
        inquiries = [
            {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]},
            {"credit-inquiry-id": "i2", "date": "2026-10-02", "credit-repository": [{"source": "TransUnion"}]},
        ]
        with patch(f"{module}.GetTaskTool") as get_task, patch(f"{module}.RemoveTaskTool") as remove_task:
            get_task.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {
                "task-id": "old-task", "task-completed": False, "task-explanations": [prior_explanation]
            }}))
            remove_task.return_value.execute = AsyncMock(return_value=json.dumps({"success": True}))
            next_state, task = asyncio.run(_reconcile_party_task(
                "borrower", "consumer-1", inquiries, old_state, "loan-guid", "gri", []
            ))
        remove_task.return_value.execute.assert_awaited_once()
        self.assertEqual(next_state, {"active_task_id": None})
        self.assertEqual(len(task["task-explanations"]), 2)

    def test_reconcile_completed_task_creates_only_new_inquiries(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        old_explanation = {"explanationType": "CreditInquiry", "additionalData": {"inquiryDate": "2026-10-01", "creditor": "Experian"}, "localId": "old"}
        old_state = {"active_task_id": "old-task"}
        inquiries = [
            {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]},
            {"credit-inquiry-id": "i2", "date": "2026-10-02", "credit-repository": [{"source": "TransUnion"}]},
        ]
        with patch(f"{module}.GetTaskTool") as get_task, patch(f"{module}.RemoveTaskTool") as remove_task:
            get_task.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {
                "task-id": "old-task", "task-completed": True, "task-explanations": [old_explanation]
            }}))
            next_state, task = asyncio.run(_reconcile_party_task(
                "borrower", "consumer-1", inquiries, old_state, "loan-guid", "gri", []
            ))
        remove_task.assert_not_called()
        self.assertEqual(next_state, {"active_task_id": None})
        self.assertEqual(len(task["task-explanations"]), 1)

    def test_reconcile_open_task_with_no_new_inquiries_is_noop(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        explanation = {"explanationType": "CreditInquiry", "additionalData": {"inquiryDate": "2026-10-01", "creditor": "Experian"}, "localId": "same"}
        state = {"active_task_id": "active-task"}
        inquiry = {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]}
        with patch(f"{module}.GetTaskTool") as get_task, patch(f"{module}.RemoveTaskTool") as remove_task:
            get_task.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {
                "task-id": "active-task", "task-completed": False, "task-explanations": [explanation]
            }}))
            next_state, task = asyncio.run(_reconcile_party_task(
                "borrower", "consumer-1", [inquiry], state, "loan-guid", "gri", []
            ))
        remove_task.assert_not_called()
        self.assertIsNone(task)
        self.assertEqual(next_state["active_task_id"], "active-task")
        self.assertEqual(set(next_state), {"active_task_id", "task"})
        self.assertEqual(next_state["task"]["task-id"], "active-task")
        self.assertEqual(next_state["task"]["task-explanations"], [explanation])

    def test_bootstraps_legacy_open_task_and_does_not_duplicate_it(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        inquiry = {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]}
        legacy_task = {
            "task-id": "legacy-task",
            "task-key": "credit_inquiry_lox_gr",
            "task-completed": False,
            "task-removed": False,
            "gr-consumer-id": "consumer-1",
            "task-explanations": [_inquiry_explanation(inquiry)],
        }
        with patch(f"{module}.GetTaskTool") as get_task:
            get_task.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": legacy_task}))
            next_state, task = asyncio.run(_reconcile_party_task(
                "borrower", "consumer-1", [inquiry], {}, "loan-guid", "gri", [legacy_task]
            ))
        self.assertIsNone(task)
        self.assertEqual(next_state["active_task_id"], "legacy-task")
        get_task.return_value.execute.assert_awaited_once()

    def test_completed_task_history_prevents_recreating_completed_inquiries(self):
        old_inquiry = {"credit-inquiry-id": "i1", "date": "2026-10-01", "credit-repository": [{"source": "Experian"}]}
        new_inquiry = {"credit-inquiry-id": "i2", "date": "2026-10-02", "credit-repository": [{"source": "TransUnion"}]}
        completed_task = {
            "task-id": "completed-task",
            "task-key": "credit_inquiry_lox_gr",
            "task-completed": True,
            "task-removed": False,
            "gr-consumer-id": "consumer-1",
            "task-explanations": [_inquiry_explanation(old_inquiry)],
        }
        task_state, task = asyncio.run(_reconcile_party_task(
            "borrower", "consumer-1", [old_inquiry, new_inquiry], {},
            "loan-guid", "gri", [completed_task],
        ))

        self.assertEqual(task_state, {"active_task_id": None})
        self.assertEqual(len(task["task-explanations"]), 1)
        self.assertEqual(task["task-explanations"][0]["additionalData"]["inquiryDate"], "2026-10-02")

    def test_create_response_task_id_is_mapped_by_consumer(self):
        result = _created_task_for_consumer(
            [
                {"task-id": "task-2", "gr-consumer-id": "coborrower"},
                {"task-id": "task-1", "gr-consumer-id": "borrower"},
            ],
            "borrower",
        )
        self.assertEqual(result["task-id"], "task-1")

    def test_loan_lock_uses_conditional_update_and_conflicts_fail(self):
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        table = MagicMock()
        with patch(f"{module}._credit_inquiry_table", return_value=table):
            _table, token = _acquire_loan_lock("loan-1", "gri")
            lock_write = table.update_item.call_args.kwargs
            self.assertEqual(lock_write["ConditionExpression"], "attribute_not_exists(lock_expires_at) OR lock_expires_at < :now")
            self.assertEqual(lock_write["ExpressionAttributeValues"][":token"], token)

            table.update_item.side_effect = ClientError(
                {"Error": {"Code": "ConditionalCheckFailedException", "Message": "locked"}},
                "UpdateItem",
            )
            with self.assertRaises(RuntimeError):
                _acquire_loan_lock("loan-1", "gri")

    def test_state_update_is_conditional_on_current_lock(self):
        table = MagicMock()
        _save_credit_inquiry_state(table, "loan-1", "gri", "owner-token", "borrower-task", "co-task", [], mc_id="pilot-mc")
        update = table.update_item.call_args.kwargs
        self.assertEqual(update["ConditionExpression"], "lock_token = :token")
        self.assertEqual(update["ExpressionAttributeValues"][":token"], "owner-token")
        values = update["ExpressionAttributeValues"]
        self.assertEqual(values[":borrower_task_id"], "borrower-task")
        self.assertEqual(values[":coborrower_task_id"], "co-task")
        self.assertEqual(values[":mc_id"], "pilot-mc")
        self.assertIn("mc_id = :mc_id", update["UpdateExpression"].split(" REMOVE ")[0])
        self.assertIn("borrower_active_task_id = :borrower_task_id", update["UpdateExpression"])
        self.assertIn("coborrower_active_task_id = :coborrower_task_id", update["UpdateExpression"])
        self.assertIn("created_at = :created", update["UpdateExpression"])
        self.assertNotIn("if_not_exists(created_at", update["UpdateExpression"])
        self.assertNotIn(":updated", values)
        self.assertIn("REMOVE workflow_state, updated_at", update["UpdateExpression"])

    @patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.datetime", wraps=datetime)
    def test_repeated_state_save_writes_new_ids_and_update_time(self, clock):
        table = MagicMock()
        clock.now.return_value = datetime(2026, 10, 28, tzinfo=timezone.utc)
        _save_credit_inquiry_state(table, "loan-1", "gri", "lock-1", "old-borrower", "old-co", [])
        clock.now.return_value = datetime(2026, 10, 29, tzinfo=timezone.utc)
        _save_credit_inquiry_state(table, "loan-1", "gri", "lock-2", "new-borrower", "new-co", [])
        first, second = [call.kwargs for call in table.update_item.call_args_list]
        self.assertEqual(first["Key"], second["Key"])
        self.assertEqual(second["ExpressionAttributeValues"][":borrower_task_id"], "new-borrower")
        self.assertEqual(second["ExpressionAttributeValues"][":coborrower_task_id"], "new-co")
        self.assertEqual(first["ExpressionAttributeValues"][":created"], "2026-10-28T00:00:00+00:00")
        self.assertEqual(second["ExpressionAttributeValues"][":created"], "2026-10-29T00:00:00+00:00")
        self.assertIn("created_at = :created", second["UpdateExpression"])

    def test_state_save_writes_separate_task_snapshots_and_clears_absent_tasks(self):
        table = MagicMock()
        borrower_task = {"task-id": "borrower-task", "task-explanations": [{"value": 1.25}]}
        coborrower_task = {"task-id": "co-task", "task-explanations": []}
        _save_credit_inquiry_state(
            table, "loan-1", "gri", "lock", "borrower-task", "co-task", [],
            borrower_task=borrower_task, coborrower_task=coborrower_task,
        )
        update = table.update_item.call_args.kwargs
        values = update["ExpressionAttributeValues"]
        self.assertIn("borrower_task = :borrower_task", update["UpdateExpression"])
        self.assertIn("coborrower_task = :coborrower_task", update["UpdateExpression"])
        self.assertEqual(values[":borrower_task"]["task-id"], values[":borrower_task_id"])
        self.assertEqual(values[":borrower_task"]["task-explanations"], [{"value": Decimal("1.25")}])
        self.assertEqual(values[":coborrower_task"], coborrower_task)
        self.assertEqual(values[":coborrower_task"]["task-id"], values[":coborrower_task_id"])
        _save_credit_inquiry_state(table, "loan-1", "gri", "lock", None, None, [])
        cleared = table.update_item.call_args.kwargs["ExpressionAttributeValues"]
        self.assertIsNone(cleared[":borrower_task"])
        self.assertIsNone(cleared[":coborrower_task"])

    def test_both_save_paths_store_compact_explanations_and_remove_full_liabilities(self):
        table = MagicMock()
        explanations = [{
            "inquiry_id": "inquiry-1", "inquiry_date": "2026-10-12",
            "liability_id": "liability-1", "creditor": "TEST BANK",
            "opened_date": "2026-10-12", "role": "borrower",
            "reason": "same_creditor_account_opened_on_or_after_inquiry",
        }]
        module = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
        with patch(f"{module}._credit_inquiry_table", return_value=table):
            for matches in (explanations, []):
                _save_credit_inquiry_state(
                    table, "loan-1", "gri", "lock", None, None, [], explained_inquiries=matches,
                )
                _write_credit_inquiry_task_record(
                    "loan-1", "gri", None, None, [], explained_inquiries=matches,
                )
        for index, call in enumerate(table.update_item.call_args_list):
            update = call.kwargs
            self.assertIn("explained_inquiries = :explained", update["UpdateExpression"])
            self.assertIn("credit_liabilities", update["UpdateExpression"].split(" REMOVE ")[1])
            self.assertNotIn(":liabilities", update["ExpressionAttributeValues"])
            self.assertEqual(update["ExpressionAttributeValues"][":explained"], explanations if index < 2 else [])

    def test_load_state_reads_flat_task_ids_and_migrates_legacy_state(self):
        table = MagicMock()
        table.get_item.return_value = {"Item": {
            "borrower_active_task_id": "flat-borrower-task",
            "workflow_state": {"coborrower": {"active_task_id": "legacy-co-task"}},
        }}

        loaded = _load_credit_inquiry_state(table, "loan-1")

        self.assertEqual(loaded, {
            "borrower": {"active_task_id": "flat-borrower-task"},
            "coborrower": {"active_task_id": "legacy-co-task"},
        })

    @patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.datetime", wraps=datetime)
    def test_filters_age_and_company_in_one_pass(self, clock):
        clock.now.return_value = datetime(2026, 10, 6, 23, 59, tzinfo=timezone.utc)
        inquiries = [
            {"date": "2026-07-07T23:59:59", "credit-inquiry-id": "91-days"},
            {"date": "2026-07-08T00:00:00", "credit-inquiry-id": "90-days"},
            {"date": "2026-07-09", "credit-inquiry-id": "89-days"},
            {"date": "2026-10-06T00:00:00Z", "credit-inquiry-id": "today"},
            {"date": "2026-10-01", "credit-repository": [{"subscriber-code": "01191"}]},
            {"date": "invalid"}, {"date": None}, {}, {"date": 123},
        ]
        self.assertEqual(_filter_company_inquiries(inquiries, "gri"), inquiries[1:4])
        # Unknown company codes still receive the age filter.
        self.assertEqual(_filter_company_inquiries(inquiries, "unknown"), inquiries[1:5])

    @patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.datetime", wraps=datetime)
    def test_cutoff_normalizes_timezone_offsets(self, clock):
        clock.now.return_value = datetime(2026, 10, 6, tzinfo=timezone.utc)
        before_cutoff = {"date": "2026-07-08T00:30:00+02:00"}
        at_cutoff = {"date": "2026-07-07T23:30:00-02:00"}
        self.assertEqual(_filter_company_inquiries([before_cutoff, at_cutoff], "gri"), [at_cutoff])

    @patch("src.lambdas.underwriting_credit_inquiry_task_automation.handler.datetime", wraps=datetime)
    def test_dev_fixture_still_applies_ninety_day_filter(self, clock):
        clock.now.return_value = datetime(2026, 10, 6, tzinfo=timezone.utc)
        inquiries = _credit_inquiries_for_environment({}, "dev")
        eligible = _filter_company_inquiries(inquiries, "gri")
        self.assertEqual(len(eligible), 8)
        self.assertTrue(all(inquiry["date"] >= "2026-07-08" for inquiry in eligible))

    @staticmethod
    def _entry(created, inquiries):
        return {
            "created": created,
            "upstreamStatus": "OK",
            "response": {
                "status": "OK",
                "credit-response": [{"credit-inquiry": inquiries}],
            },
        }

    @staticmethod
    def _tri_merge_inquiry(source, name, inquiry_id, business_type="Finance"):
        return {
            "date": "2026-10-01T00:00:00",
            "name": name,
            "borrower-id": "borrower-id",
            "credit-inquiry-id": inquiry_id,
            "credit-repository": [{"source": source, "subscriber-code": f"code-{source}"}],
            "credit-business-type": business_type,
        }


if __name__ == "__main__":
    unittest.main()