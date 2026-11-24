import json
import sys
import os
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

import requests

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from src.lambdas.heloan.handler import lambda_handler
from src.lambdas.heloan.decision_record import extract_credit_reference_identifier, filter_ecs_to_latest_report

_MODULE = "src.lambdas.heloan.handler"


class TestHeloanLambdaHandler(unittest.TestCase):

    def _make_event(self, loan_number="1234567890"):
        return {
            "detail": {
                "loanNumber": loan_number,
            }
        }

    @patch(f"{_MODULE}.get_secret")
    def test_success(self, mock_get_secret):
        mock_get_secret.return_value = {}

        result = lambda_handler(self._make_event(), {})

        self.assertEqual(result["statusCode"], 200)
        body = __import__("json").loads(result["body"])
        self.assertEqual(body["loan_number"], "1234567890")

    def test_missing_loan_number(self):
        result = lambda_handler({"detail": {}}, {})
        self.assertEqual(result["statusCode"], 400)


_FAILED_REISSUE_1 = {"created": "2026-09-29T22:15:40.88685", "upstreamStatus": "Error", "consumerId": "MCP Server"}
_FAILED_REISSUE_2 = {"created": "2026-09-29T22:14:23.261514", "upstreamStatus": "Error", "consumerId": "MCP Server"}
_GOOD_HARD_PULL = {"created": "2026-09-23T22:58:34.09366", "upstreamStatus": "OK", "creditReferenceIdentifier": "4213060641PQ"}
_GOOD_SOFT_PULL = {"created": "2026-09-23T18:29:38.229264", "upstreamStatus": "OK", "creditReferenceIdentifier": "4213034541PQ"}
_ECS_ENTRIES = [_FAILED_REISSUE_1, _FAILED_REISSUE_2, _GOOD_HARD_PULL, _GOOD_SOFT_PULL]


class TestLatestSuccessfulEcsEntry(unittest.TestCase):

    def test_extract_skips_failed_entries(self):
        self.assertEqual(extract_credit_reference_identifier({"data": {"response": _ECS_ENTRIES}}), "4213060641PQ")

    def test_filter_skips_failed_entries(self):
        result = filter_ecs_to_latest_report({"response": _ECS_ENTRIES, "success": True})
        self.assertEqual(result["response"], [_GOOD_HARD_PULL])
        self.assertTrue(result["success"])

    def test_order_independent(self):
        entries = list(reversed(_ECS_ENTRIES))
        self.assertEqual(extract_credit_reference_identifier({"data": {"response": entries}}), "4213060641PQ")

    def test_ok_entry_without_reference_is_skipped(self):
        entries = [{"created": "2026-09-30T00:00:00", "upstreamStatus": "OK"}, _GOOD_SOFT_PULL]
        self.assertEqual(extract_credit_reference_identifier({"data": {"response": entries}}), "4213034541PQ")

    def test_only_failed_entries(self):
        failed = [_FAILED_REISSUE_1, _FAILED_REISSUE_2]
        self.assertEqual(extract_credit_reference_identifier({"data": {"response": failed}}), "")
        self.assertEqual(filter_ecs_to_latest_report({"response": failed})["response"], [])

    def test_empty_and_missing(self):
        self.assertEqual(extract_credit_reference_identifier({}), "")
        self.assertEqual(extract_credit_reference_identifier({"data": {"response": []}}), "")
        self.assertEqual(filter_ecs_to_latest_report({}), {})
        self.assertEqual(filter_ecs_to_latest_report({"response": []})["response"], [])


@patch.dict(os.environ, {"ENVIRONMENT": "test", "PRAJNA_HELOAN_DOMAIN": "https://prajna.invalid"})
@patch(f"{_MODULE}.GetLoanTool")
@patch(f"{_MODULE}.GetECSCreditTool")
@patch(f"{_MODULE}.ReissueCreditTool")
@patch(f"{_MODULE}.get_secret", return_value={})
class TestHandlerEcsSelection(unittest.TestCase):

    _EVENT = {"detail": {"identity": {"loanNumber": "265184071DEV", "encompassGUID": "guid-1"}, "company": {"code": "gri"}}}

    def _wire(self, mock_reissue, mock_ecs, mock_loan, entries):
        mock_reissue.return_value.execute = AsyncMock(return_value=json.dumps({"success": True}))
        mock_ecs.return_value.execute = AsyncMock(
            return_value=json.dumps({"success": True, "data": {"response": entries, "success": True}})
        )
        mock_loan.return_value.execute = AsyncMock(
            return_value=json.dumps({"success": True, "data": {"11": "123 Example St", "1401": "HELOAN"}})
        )

    @patch(f"{_MODULE}.requests.post", side_effect=requests.RequestException("stop"))
    @patch(f"{_MODULE}.claim_loan", return_value=True)
    def test_uses_latest_successful_report(self, mock_claim, mock_post, _secret, mock_reissue, mock_ecs, mock_loan):
        self._wire(mock_reissue, mock_ecs, mock_loan, _ECS_ENTRIES)

        with patch(f"{_MODULE}._invoke_flowstate_lambda", new_callable=AsyncMock) as mock_flowstate:
            lambda_handler(self._EVENT, {})

        self.assertEqual(mock_claim.call_args.args[3], "4213060641PQ")
        sent = mock_post.call_args.kwargs["json"]["ecs_data"]["response"]
        self.assertEqual(sent, [_GOOD_HARD_PULL])
        self.assertEqual(
            mock_loan.return_value.execute.await_args_list[0].args[0]["requestedProperties"],
            ["1401", "MS.STATUS", "300", "11"],
        )
        mock_flowstate.assert_awaited_once_with({
            "encompassGUID": "guid-1",
            "company": "gri",
            "propertyAddress": "123 Example St",
        })

    @patch(f"{_MODULE}.requests.post")
    @patch(f"{_MODULE}.claim_loan")
    def test_no_successful_report_returns_500(self, mock_claim, mock_post, _secret, mock_reissue, mock_ecs, mock_loan):
        self._wire(mock_reissue, mock_ecs, mock_loan, [_FAILED_REISSUE_1, _FAILED_REISSUE_2])

        with patch(f"{_MODULE}._invoke_flowstate_lambda", new_callable=AsyncMock):
            result = lambda_handler(self._EVENT, {})

        self.assertEqual(result["statusCode"], 500)
        self.assertIn("No successful ECS credit report", json.loads(result["body"])["error"])
        mock_claim.assert_not_called()
        mock_post.assert_not_called()

    def test_production_filter_still_skips_unsupported_program(self, _secret, mock_reissue, mock_ecs, mock_loan):
        mock_loan.return_value.execute = AsyncMock(
            return_value=json.dumps({"success": True, "data": {"1401": "Conventional", "11": "123 Example St"}})
        )

        with patch.dict(os.environ, {"ENVIRONMENT": "prod"}), patch(
            f"{_MODULE}._invoke_flowstate_lambda", new_callable=AsyncMock
        ) as mock_flowstate:
            result = lambda_handler(self._EVENT, {})

        self.assertEqual(result["statusCode"], 200)
        mock_loan.return_value.execute.assert_awaited_once()
        mock_flowstate.assert_not_awaited()

    def test_dev_fetches_properties_and_triggers_flowstate_only(self, _secret, mock_reissue, mock_ecs, mock_loan):
        self._wire(mock_reissue, mock_ecs, mock_loan, _ECS_ENTRIES)

        with patch.dict(os.environ, {"ENVIRONMENT": "dev"}), patch(
            f"{_MODULE}._invoke_flowstate_lambda", new_callable=AsyncMock
        ) as mock_flowstate:
            result = lambda_handler(self._EVENT, {})

        self.assertEqual(result["statusCode"], 200)
        mock_loan.return_value.execute.assert_awaited_once()
        mock_flowstate.assert_awaited_once_with({
            "encompassGUID": "guid-1",
            "company": "gri",
            "propertyAddress": "123 Example St",
        })
        mock_reissue.return_value.execute.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
