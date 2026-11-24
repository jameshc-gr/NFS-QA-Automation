import sys
import os
import importlib.util
import unittest
from unittest.mock import patch, MagicMock

# Allow running from the project root or directly from this folder
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# "1003" is not a valid Python identifier; load the module by file path
_handler_path = os.path.join(_project_root, "src", "lambdas", "1003", "handler.py")
_spec = importlib.util.spec_from_file_location("handler_1003", _handler_path)
_handler_module = importlib.util.module_from_spec(_spec)
sys.modules["handler_1003"] = _handler_module
_spec.loader.exec_module(_handler_module)
lambda_handler = _handler_module.lambda_handler

_MODULE = "handler_1003"


class TestLambdaHandler(unittest.TestCase):

    def _make_event(self, loan_number="1234567890", company_code="GRI"):
        return {
            "detail": {
                "identity": {"loanNumber": loan_number},
                "company": {"code": company_code},
            }
        }

    @patch(f"{_MODULE}.requests.post")
    @patch(f"{_MODULE}.get_secret")
    def test_success(self, mock_get_secret, mock_post):
        mock_get_secret.return_value = {
            "PRAJNA_1003_DOMAIN": "https://prajna.example.com/1003",
            "PRAJNA_ACCESS_TOKEN": "test-token",
        }
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp

        result = lambda_handler(self._make_event(), {})

        self.assertEqual(result["statusCode"], 200)
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"]["loan_number"], "1234567890")
        self.assertEqual(kwargs["json"]["company"], "GRI")

    @patch(f"{_MODULE}.get_secret")
    def test_missing_loan_number(self, mock_get_secret):
        mock_get_secret.return_value = {
            "PRAJNA_1003_DOMAIN": "https://prajna.example.com/1003",
            "PRAJNA_ACCESS_TOKEN": "test-token",
        }
        event = {"detail": {"identity": {}, "company": {"code": "GRI"}}}
        result = lambda_handler(event, {})
        self.assertEqual(result["statusCode"], 400)

    @patch(f"{_MODULE}.get_secret")
    def test_missing_company_code(self, mock_get_secret):
        mock_get_secret.return_value = {
            "PRAJNA_1003_DOMAIN": "https://prajna.example.com/1003",
            "PRAJNA_ACCESS_TOKEN": "test-token",
        }
        event = {"detail": {"identity": {"loanNumber": "1234567890"}, "company": {}}}
        result = lambda_handler(event, {})
        self.assertEqual(result["statusCode"], 400)

    @patch(f"{_MODULE}.get_secret")
    def test_secrets_manager_failure(self, mock_get_secret):
        mock_get_secret.side_effect = Exception("Secrets Manager unavailable")
        result = lambda_handler(self._make_event(), {})
        self.assertEqual(result["statusCode"], 500)

    @patch(f"{_MODULE}.requests.post")
    @patch(f"{_MODULE}.get_secret")
    def test_prajna_request_failure(self, mock_get_secret, mock_post):
        import requests as req_lib
        mock_get_secret.return_value = {
            "PRAJNA_1003_DOMAIN": "https://prajna.example.com/1003",
            "PRAJNA_ACCESS_TOKEN": "test-token",
        }
        mock_post.side_effect = req_lib.RequestException("timeout")
        result = lambda_handler(self._make_event(), {})
        self.assertEqual(result["statusCode"], 500)


if __name__ == "__main__":
    unittest.main()
