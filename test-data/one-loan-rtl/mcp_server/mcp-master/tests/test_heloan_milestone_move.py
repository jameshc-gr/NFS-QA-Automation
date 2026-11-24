import json
import unittest
from unittest.mock import AsyncMock, patch

from src.lambdas.heloan_milestone_move import handler


class MilestoneMoveAuditGateTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_completed_move_skips_processing(self):
        event = {
            "source": "nfs-ai.flowstate",
            "detail-type": "Loan Classification",
            "detail": {
                "eventName": "loan-classification-finished",
                "eventData": {"completed": True},
                "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
                "company": {"code": "gri"},
            },
        }
        cases = ({"milestone_moved": True}, {"milestone_moved": False}, {})
        for attributes in cases:
            with self.subTest(attributes=attributes):
                review = {"id": 123, "milestone_move_eligible": True, **attributes}
                already_moved = attributes.get("milestone_moved") is True
                with (
                    patch.dict(handler.os.environ, {
                        "FIRST_REVIEW_AUDIT_TABLE_NAME": "test-audit",
                        "AWS_SECRET_NAME": "test-secret",
                    }),
                    patch.object(handler, "_find_recent_first_review", return_value=review),
                    patch.object(handler, "get_secret", return_value={}) as get_secret,
                    patch.object(handler, "_call_tool", new_callable=AsyncMock) as call_tool,
                    patch.object(handler, "_advance_milestones", new_callable=AsyncMock) as advance,
                    patch.object(handler, "_write_milestone_audit_log") as write_audit,
                ):
                    call_tool.return_value = {
                        "success": True,
                        "data": {"1401": "HELOAN", "MS.STATUS": "Processing"},
                    }
                    advance.return_value = True
                    result = await handler._handler(event, None)

                    self.assertEqual(result["statusCode"], 200)
                    self.assertIs(json.loads(result["body"])["milestone_moved"], not already_moved)
                    write_audit.assert_called_once()
                    table, review_id, audit_lines, moved = write_audit.call_args.args
                    self.assertEqual((table, review_id, moved), ("test-audit", 123, not already_moved))
                    if already_moved:
                        get_secret.assert_not_called()
                        call_tool.assert_not_awaited()
                        advance.assert_not_awaited()
                        self.assertTrue(any("already has milestone_moved=True" in line for line in audit_lines))
                    else:
                        call_tool.assert_awaited_once()
                        advance.assert_awaited_once()
