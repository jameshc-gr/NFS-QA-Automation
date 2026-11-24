"""Tests for retrieving a borrower's latest loan from OneLoan by email."""

import json
import unittest
from unittest.mock import Mock, patch

from src.tools.oneloan_tools import GetOneLoanPropertiesByEmailTool


def response(data):
    result = Mock()
    result.json.return_value = data
    return result


class GetOneLoanPropertiesByEmailTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tool = GetOneLoanPropertiesByEmailTool()
        self.arguments = {
            "borrowerEmail": "borrower@example.com",
            "loEmail": "loan.officer@rate.com",
            "requestedProperties": ["loanNumber"],
        }
        self.env_patcher = patch.dict("os.environ", {
            "BORROWER_ENTITY_SERVICE_DOMAIN": "https://borrower.example.test",
            "MYACCOUNT_SERVICE_DOMAIN": "https://myaccount.example.test",
            "ONELOAN_DOMAIN": "https://oneloan.example.test",
        })
        self.env_patcher.start()
        self.addCleanup(self.env_patcher.stop)

    async def test_fetches_latest_loan_from_oneloan_and_filters_properties(self):
        borrower_result = response({"borrower-guid": "borrower-123"})
        myaccount_result = response({"data": [
            {"loanGuid": "older-loan", "startedDate": "2025-01-01T00:00:00Z"},
            {"loanGuid": "latest-loan", "startedDate": "2026-02-01T00:00:00Z"},
        ]})
        oneloan_result = response({"data": {"loan": {"loanNumber": "12345"}}})
        with (
            patch("src.tools.oneloan_tools.get_internal_service_auth_token", return_value="internal-token"),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="oneloan-token") as get_token,
            patch("src.tools.oneloan_tools.requests.post", return_value=borrower_result) as post,
            patch("src.tools.oneloan_tools.requests.get", side_effect=[myaccount_result, oneloan_result]) as get,
            patch("src.tools.oneloan_tools._extract_requested_fields", return_value={"loanNumber": "12345"}) as extract,
        ):
            result = json.loads(await self.tool.execute(self.arguments))

        self.assertEqual(result, {"success": True, "data": {"loanNumber": "12345"}})
        self.assertEqual(post.call_args.args[0], "https://borrower.example.test/borrower/search")
        self.assertEqual(post.call_args.kwargs["json"], {
            "email": "borrower@example.com",
            "company-name": "gri",
        })
        self.assertEqual(get.call_args_list[0].args[0], "https://myaccount.example.test/api/v2/mortgage/loans")
        self.assertEqual(get.call_args_list[0].kwargs["params"], {"user-id": "borrower-123"})
        self.assertEqual(get.call_args_list[1].args[0],
                         "https://oneloan.example.test/real-time-read/v1/loan/latest-loan")
        self.assertEqual(get.call_args_list[1].kwargs["headers"]["X-GR-Company"], "gri")
        get_token.assert_called_once_with("gri")
        extract.assert_called_once_with({"data": {"loan": {"loanNumber": "12345"}}}, ["loanNumber"])

    async def test_returns_not_found_when_borrower_entity_is_missing(self):
        with (
            patch("src.tools.oneloan_tools.get_internal_service_auth_token", return_value="internal-token"),
            patch("src.tools.oneloan_tools.requests.post", return_value=response({})),
            patch("src.tools.oneloan_tools.requests.get") as get,
        ):
            result = json.loads(await self.tool.execute(self.arguments))

        self.assertEqual(result, {
            "success": False,
            "error": "Borrower entity was not found for the supplied email",
        })
        get.assert_not_called()

    async def test_returns_not_found_when_borrower_has_no_loans(self):
        with (
            patch("src.tools.oneloan_tools.get_internal_service_auth_token", return_value="internal-token"),
            patch("src.tools.oneloan_tools.requests.post", return_value=response({"borrower-guid": "borrower-123"})),
            patch("src.tools.oneloan_tools.requests.get", return_value=response({"data": []})),
        ):
            result = json.loads(await self.tool.execute(self.arguments))

        self.assertEqual(result, {"success": False, "error": "No loans found for borrower"})

    async def test_rejects_unrecognized_loan_officer_email_domain(self):
        with patch("src.tools.oneloan_tools.requests.post") as post:
            result = json.loads(await self.tool.execute({
                **self.arguments,
                "loEmail": "loan.officer@unknown.example",
            }))

        self.assertEqual(result, {
            "success": False,
            "error": "Unable to determine company from loEmail domain",
        })
        post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
