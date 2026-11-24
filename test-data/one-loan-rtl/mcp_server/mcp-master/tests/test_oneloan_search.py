"""Offline tests for opt-in multi-loan search and legacy compatibility."""

import json
import unittest
from unittest.mock import AsyncMock, Mock, patch

import requests

from src.tools.oneloan_tools import SearchOneLoanTool


def response(data):
    result = Mock()
    result.json.return_value = data
    return result


class OneLoanSearchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tool = SearchOneLoanTool()
        self.tool.SEARCH_PAGE_SIZE = 2
        self.args = {"company": "gri", "loanNumber": "test-number"}
        for patcher in (
            patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://oneloan.example.test"}),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="test-token"),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    async def test_default_and_false_preserve_single_response(self):
        expected = {"success": True, "data": {"loanNumber": "newest", "loanMilestone": "Submittal", "loanStatus": {}}}
        for flag in ({}, {"returnAllLoans": False}):
            with (
                self.subTest(flag=flag),
                patch("src.tools.oneloan_tools.requests.post", return_value=response([{"EncompassId": "newest"}])) as post,
                patch.object(self.tool, "_get_search_loan_details", new_callable=AsyncMock, return_value=json.dumps(expected)) as details,
            ):
                result = json.loads(await self.tool.execute({**self.args, **flag}))
                self.assertEqual(result, expected)
                self.assertEqual(post.call_args.kwargs["json"]["size"], 1)
                self.assertNotIn("from", post.call_args.kwargs["json"])
                details.assert_awaited_once_with("newest", "gri")

    async def test_existing_enrichment_path_preserves_response_shape(self):
        with (
            patch("src.tools.oneloan_tools.get_internal_service_auth_token", return_value="test-token"),
            patch.dict("os.environ", {
                "BORROWER_ENTITY_SERVICE_DOMAIN": "https://borrower.example.test",
                "MYACCOUNT_SERVICE_DOMAIN": "https://myaccount.example.test",
            }),
            patch("src.tools.oneloan_tools.requests.post", side_effect=[
                response([{"EncompassId": "a"}]), response({"borrower-guid": "borrower-a"}),
            ]),
            patch("src.tools.oneloan_tools.requests.get", side_effect=[
                response({"data": {"loan": {"applications": [{"borrower": {
                    "firstName": "Test", "emailAddressText": "borrower@example.test",
                }}]}}}),
                response({"data": {"loanNumber": "test-number", "loanMilestone": "Submittal"}}),
            ]),
        ):
            result = json.loads(await self.tool.execute(self.args))
        self.assertTrue(result["success"])
        self.assertEqual(set(result["data"]), {"loanNumber", "loanMilestone", "loanStatus"})
        self.assertEqual(result["data"]["loanMilestone"], "Submittal")
        self.assertEqual(result["data"]["loanStatus"]["borrowerName"], "Test")

    async def test_all_pages_are_enriched_in_order(self):
        with (
            patch("src.tools.oneloan_tools.requests.post", side_effect=[
                response([{"EncompassId": "a"}, {"EncompassId": "b"}]),
                response([{"EncompassId": "c"}]),
            ]) as post,
            patch.object(self.tool, "_get_search_loan_details", new_callable=AsyncMock,
                         return_value=json.dumps({"success": True, "data": {"loanNumber": "test"}})) as details,
        ):
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertTrue(result["success"])
        self.assertEqual([item["loanId"] for item in result["data"]], ["a", "b", "c"])
        self.assertEqual(details.await_count, 3)
        self.assertEqual(post.call_args_list[0].kwargs["json"]["size"], 2)
        self.assertEqual(post.call_args_list[1].kwargs["json"]["from"], 2)

    async def test_full_page_requires_final_empty_page(self):
        with (
            patch("src.tools.oneloan_tools.requests.post", side_effect=[
                response([{"EncompassId": "a"}, {"EncompassId": "b"}]), response([]),
            ]) as post,
            patch.object(self.tool, "_get_search_loan_details", new_callable=AsyncMock,
                         return_value=json.dumps({"success": True, "data": {}})),
        ):
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertTrue(result["success"])
        self.assertEqual(len(result["data"]), 2)
        self.assertEqual(post.call_count, 2)

    async def test_enrichment_failure_is_explicit_and_other_loans_continue(self):
        with (
            patch("src.tools.oneloan_tools.requests.post", side_effect=[
                response([{"EncompassId": "a"}, {"EncompassId": "b"}]), response([]),
            ]),
            patch.object(self.tool, "_get_search_loan_details", new_callable=AsyncMock, side_effect=[
                json.dumps({"success": False, "error": "BorrowerEmail not present on loan."}),
                json.dumps({"success": True, "data": {"loanNumber": "b"}}),
            ]),
        ):
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertFalse(result["success"])
        self.assertEqual(result["data"], [{"loanId": "b", "loanNumber": "b"}])
        self.assertEqual(result["errors"][0]["loanId"], "a")

    async def test_pagination_failure_does_not_claim_complete_results(self):
        with (
            patch("src.tools.oneloan_tools.requests.post", side_effect=[
                response([{"EncompassId": "a"}, {"EncompassId": "b"}]), requests.HTTPError("search limit"),
            ]),
            patch.object(self.tool, "_get_search_loan_details", new_callable=AsyncMock) as details,
            patch("src.tools.oneloan_tools.logger"),
        ):
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertFalse(result["success"])
        self.assertNotIn("data", result)
        details.assert_not_awaited()

    async def test_ignored_pagination_does_not_loop_forever(self):
        with patch("src.tools.oneloan_tools.requests.post", return_value=response([
            {"EncompassId": "a"}, {"EncompassId": "b"},
        ])) as post:
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertFalse(result["success"])
        self.assertIn("overlapping", result["error"])
        self.assertEqual(post.call_count, 2)

    async def test_no_matches_preserves_existing_error(self):
        for flag in (False, True):
            with patch("src.tools.oneloan_tools.requests.post", return_value=response([])):
                result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": flag}))
            self.assertEqual(result, {"success": False, "error": "No loans found matching the provided criteria."})

    async def test_invalid_flag_rejected_before_http(self):
        with patch("src.tools.oneloan_tools.requests.post") as post:
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": "true"}))
        self.assertFalse(result["success"])
        post.assert_not_called()

    async def test_missing_search_id_is_explicit(self):
        with patch("src.tools.oneloan_tools.requests.post", return_value=response([{}])):
            result = json.loads(await self.tool.execute({**self.args, "returnAllLoans": True}))
        self.assertFalse(result["success"])
        self.assertIn("EncompassId", result["error"])


if __name__ == "__main__":
    unittest.main()