import json
import unittest
from unittest.mock import Mock, patch

import requests

from src.tools.borrower_entity_tools import SearchBorrowerEntityTool
from src.tools.oneloan_tools import GetLoanTool


class ExpectedEntityNotFoundTests(unittest.IsolatedAsyncioTestCase):
    async def test_oneloan_not_found_adds_code_and_preserves_existing_error(self):
        response = Mock(status_code=404)
        response.json.return_value = {"message": "Loan not found"}
        response.raise_for_status.side_effect = requests.HTTPError("404 Not Found", response=response)
        with (
            patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://oneloan.example.test"}),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="test-token"),
            patch("src.tools.oneloan_tools.requests.get", return_value=response),
            patch("src.tools.oneloan_tools.logger.warning") as log_warning,
            patch("src.tools.oneloan_tools.logger.error") as log_error,
        ):
            result = json.loads(await GetLoanTool().execute({
                "loan_identifier": "test-loan", "company": "gri", "requestedProperties": ["1240"],
            }))

        self.assertEqual(result, {
            "success": False,
            "error": "Failed to fetch loan from OneLoan",
            "error_code": "loan_not_found",
        })
        log_warning.assert_called_once()
        log_error.assert_not_called()

    async def test_non_not_found_oneloan_errors_keep_existing_sanitized_behavior(self):
        response = Mock(status_code=503)
        response.json.return_value = {"message": "Service unavailable"}
        response.raise_for_status.side_effect = requests.HTTPError("503 unavailable", response=response)
        with (
            patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://oneloan.example.test"}),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="test-token"),
            patch("src.tools.oneloan_tools.requests.get", return_value=response),
        ):
            result = json.loads(await GetLoanTool().execute({
                "loan_identifier": "test-loan", "company": "gri", "requestedProperties": ["1240"],
            }))

        self.assertFalse(result["success"])
        self.assertNotIn("error_code", result)
        self.assertEqual(result["error"], "Failed to fetch loan from OneLoan")

    async def test_borrower_search_404_adds_code_and_preserves_existing_error(self):
        response = Mock(status_code=404)
        response.json.return_value = {"message": "Borrower not found"}
        response.raise_for_status.side_effect = requests.HTTPError("404 Not Found", response=response)
        with (
            patch.dict("os.environ", {"BORROWER_ENTITY_SERVICE_DOMAIN": "https://borrower.example.test"}),
            patch("src.tools.borrower_entity_tools.get_internal_service_auth_token", return_value="test-token"),
            patch("src.tools.borrower_entity_tools.requests.post", return_value=response),
            patch("src.tools.borrower_entity_tools.logger.warning") as log_warning,
            patch("src.tools.borrower_entity_tools.logger.error") as log_error,
        ):
            result = json.loads(await SearchBorrowerEntityTool().execute({
                "email": "borrower@example.test", "company-name": "gri",
            }))

        self.assertEqual(result, {
            "success": False,
            "error": "Failed to search borrower entity",
            "error_code": "borrower_not_found",
        })
        log_warning.assert_called_once()
        log_error.assert_not_called()

    async def test_borrower_search_route_404_keeps_existing_error_behavior(self):
        response = Mock(status_code=404)
        response.json.return_value = {"message": "Route not found"}
        response.raise_for_status.side_effect = requests.HTTPError("404 Not Found", response=response)
        with (
            patch.dict("os.environ", {"BORROWER_ENTITY_SERVICE_DOMAIN": "https://borrower.example.test"}),
            patch("src.tools.borrower_entity_tools.get_internal_service_auth_token", return_value="test-token"),
            patch("src.tools.borrower_entity_tools.requests.post", return_value=response),
        ):
            result = json.loads(await SearchBorrowerEntityTool().execute({
                "email": "borrower@example.test", "company-name": "gri",
            }))

        self.assertFalse(result["success"])
        self.assertNotIn("error_code", result)
        self.assertEqual(result["error"], "Failed to search borrower entity")


if __name__ == "__main__":
    unittest.main()