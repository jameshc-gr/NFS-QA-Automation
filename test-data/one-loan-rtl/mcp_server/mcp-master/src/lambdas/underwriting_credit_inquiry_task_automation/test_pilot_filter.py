import json
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from botocore.exceptions import ClientError

from src.lambdas.underwriting_credit_inquiry_task_automation import handler


class TestCompanySubscriberCodeFilter(unittest.TestCase):
    def test_excludes_exact_and_decorated_company_subscriber_codes(self):
        today = datetime.now(timezone.utc).date().isoformat()
        inquiries = [
            {
                "credit-inquiry-id": "exact",
                "date": today,
                "credit-repository": [{"subscriber-code": "1032387"}],
            },
            {
                "credit-inquiry-id": "decorated",
                "date": today,
                "credit-repository": [{"subscriber-code": "Q01032387"}],
            },
            {
                "credit-inquiry-id": "external",
                "date": today,
                "credit-repository": [{"subscriber-code": "Q09999999"}],
            },
        ]

        eligible = handler._filter_company_inquiries(inquiries, "gri")

        self.assertEqual([inquiry["credit-inquiry-id"] for inquiry in eligible], ["external"])


class TestMortgageConsultantPilotFilter(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.event = {
            "detail": {
                "identity": {"loanNumber": "test-loan", "encompassGUID": "test-guid"},
                "company": {"code": "gri"},
            }
        }

    async def _process_with_team_members(self, team_members):
        oneloan_response = json.dumps({"success": True, "data": {"team-members": team_members}})
        with (
            patch.dict(os.environ, {"ENVIRONMENT": "prod"}),
            patch.object(handler, "get_secret", return_value={}),
            patch.object(handler, "GetLoanTool") as get_loan,
            patch.object(handler, "_retrieve_ecs_credit", new_callable=AsyncMock) as retrieve_ecs,
        ):
            get_loan.return_value.execute = AsyncMock(return_value=oneloan_response)
            retrieve_ecs.return_value = (
                {},
                {"statusCode": 502, "body": json.dumps({"error": "test ECS response"})},
            )
            result = await handler._process_event(self.event)
            return result, get_loan, retrieve_ecs

    async def test_pilot_check_uses_mortgage_consultant_id_case_insensitively(self):
        result, get_loan, retrieve_ecs = await self._process_with_team_members([
            {"roleName": "Loan Coordinator", "id": "not-a-pilot"},
            {"roleName": "Mortgage Consultant", "id": "LKORIZON"},
        ])

        self.assertEqual(result["statusCode"], 502)
        requested_properties = get_loan.return_value.execute.call_args.args[0]["requestedProperties"]
        self.assertIn("team-members", requested_properties)
        retrieve_ecs.assert_awaited_once_with("test-loan", "gri")

    async def test_non_pilot_mortgage_consultant_is_skipped_before_ecs(self):
        result, get_loan, retrieve_ecs = await self._process_with_team_members([
            {"roleName": "Loan Coordinator", "id": "lkorizon"},
            {"roleName": "Mortgage Consultant", "id": "not-a-pilot"},
        ])

        self.assertEqual(result["statusCode"], 200)
        self.assertIn("not in pilot", json.loads(result["body"])["message"])
        get_loan.return_value.execute.assert_awaited_once()
        retrieve_ecs.assert_not_awaited()

    async def test_no_eligible_inquiries_do_not_create_a_table_row(self):
        successful_ecs_response = {
            "data": {
                "response": [{
                    "upstreamStatus": "OK",
                    "response": {"status": "OK", "credit-response": [{"credit-inquiry": []}]},
                }]
            }
        }
        with (
            patch.dict(os.environ, {"ENVIRONMENT": "prod"}),
            patch.object(handler, "get_secret", return_value={}),
            patch.object(handler, "GetLoanTool") as get_loan,
            patch.object(handler, "_retrieve_ecs_credit", new_callable=AsyncMock) as retrieve_ecs,
            patch.object(handler, "_credit_inquiry_table") as credit_table,
        ):
            get_loan.return_value.execute = AsyncMock(return_value=json.dumps({
                "success": True,
                "data": {"team-members": [{"roleName": "Mortgage Consultant", "id": "lkorizon"}]},
            }))
            retrieve_ecs.return_value = (successful_ecs_response, None)

            result = await handler._process_event(self.event)

        self.assertEqual(result["statusCode"], 200)
        self.assertIn("No eligible credit inquiries", json.loads(result["body"])["message"])
        credit_table.assert_not_called()


class TestLoanLockCleanup(unittest.TestCase):
    def test_releasing_lock_deletes_row_without_workflow_state(self):
        table = MagicMock()

        handler._release_loan_lock(table, "loan-1", "owner-token")

        delete = table.delete_item.call_args.kwargs
        self.assertEqual(delete["Key"], {"loan_number": "loan-1"})
        self.assertIn("lock_token = :token", delete["ConditionExpression"])
        self.assertIn("attribute_not_exists(credit_inquiries)", delete["ConditionExpression"])
        self.assertEqual(delete["ExpressionAttributeValues"][":token"], "owner-token")
        table.update_item.assert_not_called()

    def test_releasing_lock_preserves_row_with_workflow_state(self):
        table = MagicMock()
        table.delete_item.side_effect = ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "state exists"}},
            "DeleteItem",
        )

        handler._release_loan_lock(table, "loan-1", "owner-token")

        update = table.update_item.call_args.kwargs
        self.assertEqual(update["UpdateExpression"], "REMOVE lock_token, lock_expires_at")
        self.assertEqual(update["ConditionExpression"], "lock_token = :token")
        self.assertEqual(update["ExpressionAttributeValues"][":token"], "owner-token")


class TestMortgageConsultantPersistence(unittest.TestCase):
    def test_state_save_persists_requested_fields_and_removes_legacy_task_inquiries(self):
        table = MagicMock()
        raw_inquiries = [{"credit-inquiry-id": "raw"}]

        handler._save_credit_inquiry_state(
            table,
            "loan-1",
            "gri",
            "owner-token",
            "borrower-task",
            None,
            raw_inquiries,
            mc_id="lkorizon",
        )

        update = table.update_item.call_args.kwargs
        self.assertIn("mc_id = :mc_id", update["UpdateExpression"])
        set_clause, remove_clause = update["UpdateExpression"].split(" REMOVE ")
        attributes = {
            update["ExpressionAttributeNames"].get(assignment.split(" = ")[0], assignment.split(" = ")[0])
            for assignment in set_clause.removeprefix("SET ").split(", ")
        } | set(update["Key"])
        self.assertEqual(attributes, {
            "loan_number", "borrower_active_task_id", "borrower_task",
            "coborrower_active_task_id", "coborrower_task", "company", "created_at",
            "credit_inquiries", "explained_inquiries", "mc_id",
        })
        self.assertIn("task_credit_inquiries", remove_clause.split(", "))
        self.assertEqual(update["ExpressionAttributeValues"][":mc_id"], "lkorizon")
        self.assertEqual(update["ExpressionAttributeValues"][":inquiries"], raw_inquiries)
        self.assertNotIn(":task_inquiries", update["ExpressionAttributeValues"])



if __name__ == "__main__":
    unittest.main()
