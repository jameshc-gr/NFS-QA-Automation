import json
import unittest
from unittest.mock import AsyncMock, patch

from src.lambdas.heloan_decline_digest import handler


class TestFailureNotifications(unittest.TestCase):
    def test_only_final_error_responses_log_alert_marker(self):
        for status_code in (200, 400, 500, 502):
            with (
                self.subTest(status_code=status_code),
                patch.object(handler, "_handler", new_callable=AsyncMock) as process,
                patch.object(handler.logger, "error") as log_error,
            ):
                response = {"statusCode": status_code, "body": "{}"}
                process.return_value = response
                self.assertEqual(handler.lambda_handler({}, None), response)
                process.assert_awaited_once_with({}, None)
                if status_code >= 400:
                    log_error.assert_called_once_with(
                        "HELOAN_DECLINE_DIGEST_PROCESSING_FAILED status_code=%s", status_code,
                    )
                else:
                    log_error.assert_not_called()

    def test_unhandled_exceptions_propagate_without_duplicate_marker(self):
        with (
            patch.object(handler, "_handler", new_callable=AsyncMock, side_effect=RuntimeError("failure")),
            patch.object(handler.logger, "error") as log_error,
        ):
            with self.assertRaises(RuntimeError):
                handler.lambda_handler({}, None)
            log_error.assert_not_called()

    def test_outside_schedule_is_a_healthy_skip(self):
        with (
            patch.object(handler, "_is_digest_send_time", return_value=False),
            patch.object(handler, "get_secret") as get_secret,
            patch.object(handler.logger, "error") as log_error,
        ):
            response = handler.lambda_handler({}, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(json.loads(response["body"])["message"], "Not scheduled send time")
        get_secret.assert_not_called()
        log_error.assert_not_called()