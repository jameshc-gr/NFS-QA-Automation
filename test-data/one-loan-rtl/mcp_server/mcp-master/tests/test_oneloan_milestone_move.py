import json
import unittest
from unittest.mock import AsyncMock, MagicMock, call, patch

from src.tools.oneloan_tools import MoveOneLoanMilestoneTool


class MoveOneLoanMilestoneTests(unittest.IsolatedAsyncioTestCase):
    async def test_polls_until_target_or_sixth_read(self):
        for successful_attempt in (1, 3, 6, None):
            with self.subTest(successful_attempt=successful_attempt):
                reads = [
                    json.dumps({"success": True, "data": {"MS.STATUS": "Processing"}}),
                ]
                for attempt in range(1, 7):
                    status = "App Fee Collected" if attempt == successful_attempt else "Processing"
                    reads.append(json.dumps({"success": True, "data": {"MS.STATUS": status}}))

                session = MagicMock()
                session.json.return_value = {"session-id": "test-session"}
                sequence = MagicMock()
                read = AsyncMock(side_effect=reads)
                sleep = AsyncMock()
                sequence.attach_mock(read, "read")
                sequence.attach_mock(sleep, "sleep")
                with (
                    patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://example.test"}),
                    patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="token"),
                    patch("src.tools.oneloan_tools.requests.post", return_value=session),
                    patch("src.tools.oneloan_tools.requests.patch") as write,
                    patch("src.tools.oneloan_tools.GetLoanTool") as loan_tool,
                    patch("src.tools.oneloan_tools.asyncio.sleep", sleep),
                ):
                    loan_tool.return_value.execute = read
                    result = json.loads(await MoveOneLoanMilestoneTool().execute({
                        "loan_guid": "test-guid",
                        "company": "gri",
                        "target_milestone": "App Fee Collected",
                    }))

                expected_attempts = successful_attempt or 6
                self.assertEqual(result["success"], successful_attempt is not None)
                if successful_attempt is None:
                    self.assertIn("still at 'Processing'", result["failure_reason"])
                else:
                    self.assertEqual(result["data"]["milestone"], "App Fee Collected")
                read_args = {
                    "loan_identifier": "test-guid",
                    "company": "gri",
                    "requestedProperties": ["MS.STATUS"],
                }
                self.assertEqual(
                    sequence.mock_calls,
                    [call.read(read_args)] + [item for _ in range(expected_attempts)
                                              for item in (call.sleep(10), call.read(read_args))],
                )
                write.assert_called_once()

    async def test_failed_verification_read_is_reported(self):
        with (
            patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://example.test"}),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="token"),
            patch("src.tools.oneloan_tools.requests.post") as post,
            patch("src.tools.oneloan_tools.requests.patch"),
            patch("src.tools.oneloan_tools.GetLoanTool") as loan_tool,
            patch("src.tools.oneloan_tools.asyncio.sleep", new_callable=AsyncMock) as sleep,
        ):
            post.return_value.json.return_value = {"session-id": "test-session"}
            loan_tool.return_value.execute = AsyncMock(side_effect=[
                json.dumps({"success": True, "data": {"MS.STATUS": "Processing"}}),
                json.dumps({"success": False}),
            ])
            result = json.loads(await MoveOneLoanMilestoneTool().execute({
                "loan_guid": "test-guid",
                "company": "gri",
                "target_milestone": "App Fee Collected",
            }))

        self.assertEqual(result, {"success": False, "failure_reason": "The verification loan read failed."})
        sleep.assert_awaited_once_with(10)


if __name__ == "__main__":
    unittest.main()
