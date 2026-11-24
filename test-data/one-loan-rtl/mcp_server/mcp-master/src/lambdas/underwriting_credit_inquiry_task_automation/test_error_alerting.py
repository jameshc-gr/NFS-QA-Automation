import asyncio
import json
import unittest
from contextlib import ExitStack
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import requests

from src.lambdas.underwriting_credit_inquiry_task_automation import handler
from src.tools.borrower_entity_tools import SearchBorrowerEntityTool
from src.tools.ecs_tools import ReissueCreditTool
from src.tools.taskmaster_tools import CreateTasksTool

MODULE = "src.lambdas.underwriting_credit_inquiry_task_automation.handler"
EVENT = {"detail": {
    "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
    "company": {"code": "gri"},
}}


class CreditInquiryAlertingTests(unittest.TestCase):
    def test_reissue_e0059_suppresses_only_matching_final_failure(self):
        cases = [
            ({"status": "Error", "credit-bureau-errors": [{"description": "Transaction Type: XML REQUEST ERROR Error Response: E0059 - order number not found 41985964590100"}], "credit-report-status": [{"code": "E999", "description": "Error Response: E0059 - order number not found 41985964590100"}]}, True),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E0059 - order number not found"}]}, True),
            ({"status": "Error", "credit-report-status": [{"description": "E0059 - order number not found"}]}, True),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E00590 - other error"}]}, False),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E0059 - order number not found"}, {"description": "E9999 - other error"}]}, False),
            ({"status": "Success", "credit-bureau-errors": [{"description": "E0059 - order number not found"}]}, False),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E0059 - order number not found"}, {}]}, False),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E0059 - order number not found"}, "invalid entry"]}, False),
        ]
        for data, suppressed in cases:
            with (
                self.subTest(data=data),
                patch(f"{MODULE}.GetECSCreditTool") as get_credit,
                patch(f"{MODULE}.ReissueCreditTool") as reissue,
                patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{MODULE}._release_loan_lock") as release,
                patch(f"{MODULE}.get_secret", return_value={}),
                patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
                patch(f"{MODULE}.GetLoanTool") as loan,
                patch(f"{MODULE}.logger.error") as log_error,
                patch(f"{MODULE}.CreateTasksTool") as create,
            ):
                loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                get_credit.return_value.execute = AsyncMock(return_value=json.dumps({"success": False}))
                reissue.return_value.execute = AsyncMock(return_value=json.dumps({"success": False, "data": data}))
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 500)
                self.assertEqual(json.loads(response["body"]), {"error": "Failed to reissue ECS credit information"})
                self.assertEqual(response.get("error_code"), "ecs_reissue_e0059" if suppressed else None)
                marker_calls = [c for c in log_error.call_args_list if c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED")]
                self.assertEqual(len(marker_calls), 0 if suppressed else 1)
                get_credit.return_value.execute.assert_awaited_once()
                reissue.return_value.execute.assert_awaited_once()
                create.assert_not_called()
                release.assert_called_once()

    def test_e0059_from_real_reissue_tool_does_not_alert(self):
        with (
            patch(f"{MODULE}.GetECSCreditTool") as get_credit,
            patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{MODULE}._release_loan_lock"),
            patch(f"{MODULE}.get_secret", return_value={}),
            patch.dict("os.environ", {"ENVIRONMENT": "prod", "ECS_DOMAIN": "https://example.test"}),
            patch(f"{MODULE}.GetLoanTool") as loan,
            patch("src.tools.ecs_tools.GetLoanTool") as reissue_loan,
            patch("src.tools.ecs_tools.get_internal_service_auth_token", return_value="token"),
            patch("src.tools.ecs_tools.requests.post") as post,
            patch(f"{MODULE}.logger.error") as log_error,
            patch(f"{MODULE}.CreateTasksTool") as create,
        ):
            loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
            reissue_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"300": "test-order"}}))
            get_credit.return_value.execute = AsyncMock(return_value=json.dumps({"success": False}))
            post.return_value.json.return_value = {
                "status": "Error",
                "credit-bureau-errors": [{"description": "Error Response: E0059 - order number not found"}],
                "credit-report-status": [{"code": "E999", "description": "Error Response: E0059 - order number not found"}],
            }
            response = handler.lambda_handler(EVENT)
            self.assertEqual(response["statusCode"], 500)
            self.assertEqual(response["error_code"], "ecs_reissue_e0059")
            self.assertFalse(any(c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED") for c in log_error.call_args_list))
            create.assert_not_called()

    def test_reissue_e0424_suppresses_only_matching_final_failure(self):
        cases = [
            (["Error Response: E0424 - borrower information mismatch", "Error Response: E0424 - borrower information mismatch"], True),
            (["E04240 - different error"], False),
            (["E0424 - borrower mismatch", "E9999 - other error"], False),
            (["E9999 - other error"], False),
        ]
        for descriptions, suppressed in cases:
            with (
                self.subTest(descriptions=descriptions),
                patch(f"{MODULE}.GetECSCreditTool") as get_credit,
                patch(f"{MODULE}.ReissueCreditTool") as reissue,
                patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{MODULE}._release_loan_lock"),
                patch(f"{MODULE}.get_secret", return_value={}),
                patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
                patch(f"{MODULE}.GetLoanTool") as loan,
                patch(f"{MODULE}.logger.error") as log_error,
            ):
                loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                get_credit.return_value.execute = AsyncMock(return_value=json.dumps({"success": False}))
                reissue.return_value.execute = AsyncMock(return_value=json.dumps({
                    "success": False,
                    "data": {
                        "status": "Error",
                        "credit-bureau-errors": [{"description": descriptions[0]}],
                        "credit-report-status": [{"description": description} for description in descriptions[1:]],
                    },
                }))
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 500)
                self.assertEqual(response.get("error_code"), "ecs_reissue_e0424" if suppressed else None)
                marker_calls = [c for c in log_error.call_args_list if c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED")]
                self.assertEqual(len(marker_calls), 0 if suppressed else 1)

    def test_missing_borrower_validation_from_real_reissue_suppresses_marker(self):
        with (
            patch(f"{MODULE}.GetECSCreditTool") as get_credit,
            patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{MODULE}._release_loan_lock"),
            patch(f"{MODULE}.get_secret", return_value={}),
            patch.dict("os.environ", {"ENVIRONMENT": "prod", "ECS_DOMAIN": "https://example.test"}),
            patch(f"{MODULE}.GetLoanTool") as loan,
            patch("src.tools.ecs_tools.GetLoanTool") as reissue_loan,
            patch("src.tools.ecs_tools.get_internal_service_auth_token", return_value="token"),
            patch("src.tools.ecs_tools.requests.post") as post,
            patch(f"{MODULE}.logger.error") as log_error,
            patch(f"{MODULE}.CreateTasksTool") as create,
        ):
            loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
            reissue_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
            get_credit.return_value.execute = AsyncMock(return_value=json.dumps({"success": False}))
            downstream = Mock(status_code=400)
            downstream.json.return_value = {"errors": {"Borrowers[1].Ssn": ["'Ssn' must not be empty for a hard credit pull."]}}
            downstream.raise_for_status.side_effect = requests.HTTPError("400", response=downstream)
            post.return_value = downstream
            response = handler.lambda_handler(EVENT)
            self.assertEqual(response["statusCode"], 500)
            self.assertEqual(response.get("error_code"), "ecs_reissue_missing_borrower_information")
            self.assertFalse(any(c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED") for c in log_error.call_args_list))
            create.assert_not_called()

    def test_no_successful_report_keeps_failure_but_does_not_alert(self):
        cases = [
            [],
            [{"upstreamStatus": "ERROR", "response": {"status": "OK"}}],
            [{"upstreamStatus": "OK", "response": {"status": "Error"}}],
        ]
        for entries in cases:
            with (
                self.subTest(entries=entries),
                patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{MODULE}._release_loan_lock") as release,
                patch(f"{MODULE}.get_secret", return_value={}),
                patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
                patch(f"{MODULE}.GetLoanTool") as loan,
                patch(f"{MODULE}.GetECSCreditTool") as get_credit,
                patch(f"{MODULE}.ReissueCreditTool") as reissue,
                patch(f"{MODULE}.SearchBorrowerEntityTool") as search,
                patch(f"{MODULE}.CreateTasksTool") as create,
                patch(f"{MODULE}.logger.error") as log_error,
                patch(f"{MODULE}.logger.warning") as log_warning,
            ):
                loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                get_credit.return_value.execute = AsyncMock(return_value=json.dumps({
                    "success": True, "data": {"response": entries},
                }))
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 502)
                self.assertEqual(response["error_code"], "ecs_no_successful_report")
                self.assertEqual(json.loads(response["body"]), {"error": "No successful ECS credit report found"})
                log_error.assert_called_once_with("No successful ECS credit report found for loan %s", "test-loan")
                log_warning.assert_called_once_with(
                    "Credit inquiry processing failed without email alert: reason=%s status_code=%s",
                    "ecs_no_successful_report", 502,
                )
                get_credit.return_value.execute.assert_awaited_once()
                reissue.assert_not_called()
                search.assert_not_called()
                create.assert_not_called()
                release.assert_called_once()

    def test_initial_ecs_exception_reissues_and_retrieves_again(self):
        with (
            patch(f"{MODULE}.GetECSCreditTool") as get_credit,
            patch(f"{MODULE}.ReissueCreditTool") as reissue,
        ):
            get_credit.return_value.execute = AsyncMock(side_effect=[
                RuntimeError("initial lookup failed"),
                json.dumps({"success": True, "data": {"response": []}}),
            ])
            reissue.return_value.execute = AsyncMock(return_value=json.dumps({"success": True}))
            result, error = asyncio.run(handler._retrieve_ecs_credit("test-loan", "gri"))
        self.assertIsNone(error)
        self.assertTrue(result["success"])
        self.assertEqual(get_credit.return_value.execute.await_count, 2)
        reissue.return_value.execute.assert_awaited_once_with({"loanId": "test-loan", "company": "gri"})

    def test_reissue_e0710_suppresses_only_matching_final_failure(self):
        cases = [
            ({"status": "Error", "credit-bureau-errors": [{"description": "Error E0710 - Non-CPS order"}]}, "ecs_reissue_e0710"),
            ({"status": "Error", "credit-report-status": [{"description": "E0710 - Non-CPS order"}]}, "ecs_reissue_e0710"),
            ({"status": "Error", "credit-report-status": [{"code": "E999", "description": "different error"}]}, None),
            ({"status": "Error", "credit-bureau-errors": [{"description": "E07101"}]}, None),
            ({"status": "Success", "credit-bureau-errors": [{"description": "E0710"}]}, None),
            ({}, None),
        ]
        for data, expected in cases:
            with (
                self.subTest(data=data),
                patch(f"{MODULE}.GetECSCreditTool") as get_credit,
                patch(f"{MODULE}.ReissueCreditTool") as reissue,
                patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{MODULE}._release_loan_lock"),
                patch(f"{MODULE}.get_secret", return_value={}),
                patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
                patch(f"{MODULE}.GetLoanTool") as get_loan,
                patch(f"{MODULE}.logger.error") as log_error,
            ):
                get_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                get_credit.return_value.execute = AsyncMock(return_value=json.dumps({"success": False}))
                reissue.return_value.execute = AsyncMock(return_value=json.dumps({"success": False, "data": data}))
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 500)
                self.assertEqual(response.get("error_code"), expected)
                marker_calls = [c for c in log_error.call_args_list if c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED")]
                self.assertEqual(len(marker_calls), 0 if expected else 1)

    def test_initial_ecs_exception_and_successful_reissue_do_not_alert(self):
        with (
            patch(f"{MODULE}.GetECSCreditTool") as get_credit,
            patch(f"{MODULE}.ReissueCreditTool") as reissue,
            patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{MODULE}._release_loan_lock"),
            patch(f"{MODULE}.get_secret", return_value={}),
            patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
            patch(f"{MODULE}.GetLoanTool") as get_loan,
            patch(f"{MODULE}._latest_successful_ecs_entry", return_value={"id": "report"}),
            patch(f"{MODULE}._get_ecs_borrower_ids", return_value=("borrower", None)),
            patch(f"{MODULE}._credit_inquiries_for_environment", return_value=[]),
            patch(f"{MODULE}.logger.error") as log_error,
        ):
            get_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
            get_credit.return_value.execute = AsyncMock(side_effect=[
                RuntimeError("initial lookup failed"), json.dumps({"success": True}),
            ])
            reissue.return_value.execute = AsyncMock(return_value=json.dumps({"success": True}))
            response = handler.lambda_handler(EVENT)
        self.assertEqual(response["statusCode"], 200)
        log_error.assert_not_called()
        self.assertEqual(get_credit.return_value.execute.await_count, 2)

    def test_reissue_and_second_lookup_exceptions_remain_alertable(self):
        for failure in ("reissue", "second_lookup"):
            with (
                self.subTest(failure=failure),
                patch(f"{MODULE}.GetECSCreditTool") as get_credit,
                patch(f"{MODULE}.ReissueCreditTool") as reissue,
                patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
                patch(f"{MODULE}._release_loan_lock"),
                patch(f"{MODULE}.get_secret", return_value={}),
                patch.dict("os.environ", {"ENVIRONMENT": "prod"}),
                patch(f"{MODULE}.GetLoanTool") as get_loan,
                patch(f"{MODULE}.logger.error") as log_error,
            ):
                get_loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                get_credit.return_value.execute = AsyncMock(side_effect=[
                    RuntimeError("initial lookup"),
                    RuntimeError("retry lookup"),
                ])
                reissue.return_value.execute = AsyncMock(
                    side_effect=RuntimeError("reissue failed") if failure == "reissue" else None,
                    return_value=json.dumps({"success": True}),
                )
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 500)
                self.assertNotIn("error_code", response)
                log_error.assert_called_with("CREDIT_INQUIRY_PROCESSING_FAILED status_code=%s", 500)

    def test_only_known_taskmaster_create_failures_are_suppressed(self):
        for create_result, expected_code in [
            ({"success": False, "error_code": "taskmaster_create_http_500"}, "taskmaster_create_http_500"),
            ({"success": False, "error_code": "other"}, None),
            ({"success": False}, None),
            ({"success": True, "data": {"results": [
                {"gr-consumer-id": "consumer", "task-id": "first"},
                {"gr-consumer-id": "consumer", "task-id": "second"},
            ]}}, "taskmaster_create_response_unmatched"),
            ({"success": True, "data": {"results": [{"gr-consumer-id": "consumer"}]}},
             "taskmaster_create_response_unmatched"),
            ({"success": True, "data": {"results": []}}, "taskmaster_create_response_unmatched"),
            ({"success": True, "data": {"results": [None]}}, None),
        ]:
            with self.subTest(create_result=create_result), ExitStack() as stack:
                stack.enter_context(patch.dict("os.environ", {"ENVIRONMENT": "dev"}))
                stack.enter_context(patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")))
                release = stack.enter_context(patch(f"{MODULE}._release_loan_lock"))
                stack.enter_context(patch(f"{MODULE}.get_secret", return_value={}))
                loan = stack.enter_context(patch(f"{MODULE}.GetLoanTool"))
                loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"1240": "test@example.test"}}))
                borrower = stack.enter_context(patch(f"{MODULE}.SearchBorrowerEntityTool"))
                borrower.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"borrower-guid": "consumer"}}))
                stack.enter_context(patch(f"{MODULE}._credit_inquiries_for_environment", return_value=[{"test": "inquiry"}]))
                stack.enter_context(patch(f"{MODULE}._filter_company_inquiries", return_value=[{"test": "inquiry"}]))
                stack.enter_context(patch(f"{MODULE}._group_credit_inquiries_by_borrower_id", return_value={"borrower": [], "coborrower": []}))
                stack.enter_context(patch(f"{MODULE}._credit_inquiry_table"))
                stack.enter_context(patch(f"{MODULE}._load_credit_inquiry_state", return_value={}))
                tasks = stack.enter_context(patch(f"{MODULE}.GetTasksTool"))
                tasks.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"results": []}}))
                stack.enter_context(patch(f"{MODULE}._reconcile_party_task", new_callable=AsyncMock, return_value=({}, {"gr-consumer-id": "consumer"})))
                create = stack.enter_context(patch(f"{MODULE}.CreateTasksTool"))
                create.return_value.execute = AsyncMock(return_value=json.dumps(create_result))
                save = stack.enter_context(patch(f"{MODULE}._save_credit_inquiry_state"))
                log_error = stack.enter_context(patch(f"{MODULE}.logger.error"))
                response = handler.lambda_handler(EVENT)
                self.assertEqual(response["statusCode"], 502)
                self.assertEqual(response.get("error_code"), expected_code)
                create.return_value.execute.assert_awaited_once()
                save.assert_not_called()
                release.assert_called_once()
                marker_calls = [c for c in log_error.call_args_list if c.args and str(c.args[0]).startswith("CREDIT_INQUIRY_PROCESSING_FAILED")]
                self.assertEqual(len(marker_calls), 0 if expected_code else 1)

    def test_borrower_service_actual_not_found_returns_without_alert(self):
        with (
            patch.dict("os.environ", {
                "ENVIRONMENT": "dev",
                "BORROWER_ENTITY_SERVICE_DOMAIN": "https://example.test",
            }),
            patch(f"{MODULE}._acquire_loan_lock", return_value=(MagicMock(), "lock")),
            patch(f"{MODULE}._release_loan_lock"),
            patch(f"{MODULE}.get_secret", return_value={}),
            patch(f"{MODULE}.GetLoanTool") as loan,
            patch(f"{MODULE}._credit_inquiries_for_environment", return_value=[{"test": "inquiry"}]),
            patch(f"{MODULE}._filter_company_inquiries", return_value=[{"test": "inquiry"}]),
            patch(f"{MODULE}._group_credit_inquiries_by_borrower_id", return_value={"borrower": [], "coborrower": []}),
            patch("src.tools.borrower_entity_tools.get_internal_service_auth_token", return_value="token"),
            patch("src.tools.borrower_entity_tools.requests.post") as post,
            patch(f"{MODULE}.logger.error") as log_error,
        ):
            loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {"1240": "test@example.test"}}))
            downstream = Mock(status_code=404)
            downstream.json.return_value = {
                "message": "Unable to find requested entity",
                "error": "clojure.lang.ExceptionInfo: No borrower entity with matching email found",
            }
            downstream.raise_for_status.side_effect = requests.HTTPError("404", response=downstream)
            post.return_value = downstream
            response = handler.lambda_handler(EVENT)
        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(json.loads(response["body"])["error"], "Borrower entity not found")
        log_error.assert_not_called()


class DownstreamClassificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_ecs_missing_borrower_information_classification(self):
        cases = [
            (400, {"Borrowers[0].FirstName": ["'First Name' must not be empty."]}, True),
            (400, {"Borrowers[1].Ssn": ["'Ssn' must not be empty for a hard credit pull."]}, True),
            (400, {"Borrowers[0].Residence.City": ["'City' must not be empty."], "Borrowers[1].LastName": ["'Last Name' must not be empty."]}, True),
            (400, {"Borrowers[0].Ssn": ["'Ssn' must not be empty."], "CreditReportId": ["'Credit Report Id' must not be empty."]}, False),
            (400, {"Borrowers[0].Ssn": ["'Ssn' must not be empty.", "'Ssn' is invalid."]}, False),
            (400, {"Borrowers[1].Ssn": ["'Ssn' is invalid."]}, False),
            (400, {"CreditReportId": ["'Credit Report Id' must not be empty."]}, False),
            (500, {"Borrowers[1].Ssn": ["'Ssn' must not be empty."]}, False),
            (400, {}, False),
            (400, {"Borrowers[1].Ssn": []}, False),
            (400, {"Borrowers[2].Ssn": ["'Ssn' must not be empty."]}, False),
        ]
        for status, errors, expected in cases:
            with (
                self.subTest(status=status, errors=errors),
                patch.dict("os.environ", {"ECS_DOMAIN": "https://example.test"}),
                patch("src.tools.ecs_tools.GetLoanTool") as loan,
                patch("src.tools.ecs_tools.get_internal_service_auth_token", return_value="token"),
                patch("src.tools.ecs_tools.requests.post") as post,
            ):
                loan.return_value.execute = AsyncMock(return_value=json.dumps({"success": True, "data": {}}))
                response = Mock(status_code=status)
                response.json.return_value = {"errors": errors}
                response.raise_for_status.side_effect = requests.HTTPError(str(status), response=response)
                post.return_value = response
                result = json.loads(await ReissueCreditTool().execute({"loanId": "id", "company": "gri"}))
                self.assertFalse(result["success"])
                self.assertEqual(result.get("error_code"), "ecs_reissue_missing_borrower_information" if expected else None)
                self.assertNotIn("errors", result)

    async def test_real_borrower_not_found_shape_and_unrelated_404(self):
        cases = [
            ({"message": "Unable to find requested entity", "error": "clojure.lang.ExceptionInfo: No borrower entity with matching email found"}, True),
            ({"message": "Unable to find requested entity", "error": "other failure"}, False),
            ({"message": "Route not found"}, False),
        ]
        for body, expected in cases:
            with (
                self.subTest(body=body),
                patch.dict("os.environ", {"BORROWER_ENTITY_SERVICE_DOMAIN": "https://example.test"}),
                patch("src.tools.borrower_entity_tools.get_internal_service_auth_token", return_value="token"),
                patch("src.tools.borrower_entity_tools.requests.post") as post,
            ):
                response = Mock(status_code=404)
                response.json.return_value = body
                response.raise_for_status.side_effect = requests.HTTPError("404", response=response)
                post.return_value = response
                result = json.loads(await SearchBorrowerEntityTool().execute({"email": "test@example.test", "company-name": "gri"}))
                self.assertEqual(result.get("error_code"), "borrower_not_found" if expected else None)

    async def test_taskmaster_http_500_is_structured_without_suppressing_other_errors(self):
        for status in (400, 404, 500, 503):
            with (
                self.subTest(status=status),
                patch.dict("os.environ", {"TASKMASTER_DOMAIN": "https://example.test"}),
                patch("src.tools.taskmaster_tools.get_internal_service_auth_token", return_value="token"),
                patch("src.tools.taskmaster_tools.requests.post") as post,
            ):
                response = Mock(status_code=status)
                response.json.return_value = {"message": "failure"}
                response.raise_for_status.side_effect = requests.HTTPError(str(status), response=response)
                post.return_value = response
                result = json.loads(await CreateTasksTool().execute({"loan-id": "id", "company": "gri", "tasks": []}))
                self.assertEqual(result.get("error_code"), "taskmaster_create_http_500" if status == 500 else None)
                self.assertFalse(result["success"])
