"""Offline regression coverage for shared OneLoan/Encompass field resolution."""

import json
import unittest
from unittest.mock import Mock, patch

from src.tools.encompass_tools import _format_encompass_loan_response
from src.tools.oneloan_tools import GetLoanTool, _extract_requested_fields


class LoanFieldResolutionTests(unittest.TestCase):
    def setUp(self):
        self.fields = [
            "LOCKRATE.2149",
            "LOCKRATE.2151",
            "Log.MS.DateTime.Conditions_Submitted_to_UW",
        ]
        self.loan = {
            "virtualFields": {
                "LOCKRATE.2149": "2026-10-01",
                "LOCKRATE.2151": "2026-10-31",
            },
            "milestoneLogs": [{
                "stage": "Conditions Submitted to UW",
                "dateUtc": "2026-10-15T12:00:00Z",
            }],
        }
        self.expected = {
            **self.loan["virtualFields"],
            self.fields[2]: "2026-10-15T12:00:00Z",
        }

    def test_reported_fields_resolve_for_all_response_wrappers(self):
        for response in (
            self.loan,
            {"loan": self.loan},
            {"data": self.loan},
            {"data": {"loan": self.loan}},
        ):
            with self.subTest(wrapper=list(response)):
                self.assertEqual(_extract_requested_fields(response, self.fields), self.expected)
                self.assertEqual(
                    _format_encompass_loan_response(response, self.fields),
                    {"success": True, "data": self.expected},
                )

    def test_missing_virtual_values_do_not_use_live_rate_lock_values(self):
        loan = {"rateLock": {
            "buySideLockDate": "2026-09-01",
            "buySideLockExpires": "2026-09-30",
        }}
        result = _extract_requested_fields(loan, self.fields[:2] + ["2149", "2151"])
        self.assertEqual(result, {
            "LOCKRATE.2149": None,
            "LOCKRATE.2151": None,
            "2149": "2026-09-01",
            "2151": "2026-09-30",
        })

    def test_milestone_date_and_case_insensitive_stage(self):
        self.loan["milestoneLogs"][0]["stage"] = " conditions submitted TO uw "
        selector = "log.ms.date.Conditions_Submitted_to_UW"
        self.assertEqual(_extract_requested_fields(self.loan, [selector]), {
            selector: "2026-10-15",
        })

    def test_missing_milestone_returns_null(self):
        self.assertEqual(_extract_requested_fields({}, [self.fields[2]]), {
            self.fields[2]: None,
        })

    def test_null_collections_return_null_for_recognized_selectors(self):
        self.assertEqual(_extract_requested_fields({
            "milestoneLogs": None, "virtualFields": None,
        }, self.fields), dict.fromkeys(self.fields))

    def test_unknown_selectors_remain_unresolved(self):
        unknown = ["NOT.A.FIELD", "LOCKRATE.NOT_A_FIELD", "unknownProperty"]
        result = _extract_requested_fields(self.loan, self.fields + unknown)
        self.assertEqual(result, {**self.expected, "unresolved_field_ids": unknown})

    def test_virtual_field_falsey_values_are_preserved(self):
        for value in (None, "", 0, False):
            with self.subTest(value=value):
                self.assertEqual(_extract_requested_fields({
                    "virtualFields": {"VIRTUAL.TEST": value},
                }, ["VIRTUAL.TEST"]), {"VIRTUAL.TEST": value})

    def test_requested_email_lookup_properties_are_all_supported(self):
        fields = [
            "VEND.X141", "CX.BUYERAGENTADMINEML", "VEND.X119", "VEND.X152",
            "CX.SELLERAGENTADMINEML", "VEND.X130", "745", "LOCKRATE.2149",
            "LOCKRATE.2151", "CX.APPSENT.1", "CX.APPRCVD.1", "3197", "3153",
            "2298", "Log.MS.DateTime.Conditions_Submitted_to_UW", "CX.CTC.REQUESTED",
            "CX.CONDITIONSUBMIT.1", "2301", "2305", "CX.CTCCOMMIT.1",
            "CX.APPPAKCOMPLETE", "CX.APPR.OR.PIW.OR.ACE", "CX.APPRORDERTRANS.10",
            "CX.APPRDUE2.4", "CX.APPRINSPDATE2.4", "CX.COLLATERAL.UW.STATUS",
            "CX.APPRRECTRANS.10", "356", "3624", "CX.CONDODOCS.10",
            "CX.CONDORECV.10", "CX.UWCONDOAPPR", "3977", "CX.CDSIGNEDALL",
            "CX.HUDTOPOD", "CX.TITLEORDER.1", "CX.TITREQUEST", "CX.SFC1",
            "CX.TITLERCVD.1", "CX.CPL.DATE", "CX.TITLE.INVOICE", "CX.WIRE.IN",
            "CX.TITLE.COM", "CX.TITLE.CLEAR.DATE", "CX.CLSVOEDATE", "748",
            "CX.GR.INSURANCE.APPROVED", "CX.GR.INS.DATE", "CX.TRUSTAPPROVED",
            "CX.TRUST", "CX.POAAPPROVEDDATE", "CX.POA.EXPDATE", "CX.POA.TRACKING.INFO",
            "CX.ESTCLOSELASTVALIDBY", "CX.CLSSCHED.1", "CX.CLSTIME.1", "CX.TIME.ZONE",
        ]
        loan = {
            "contacts": [
                {"contactType": "BUYERS_AGENT", "email": "buyer-agent@example.test"},
                {"contactType": "BUYERS_ATTORNEY", "email": "buyer-attorney@example.test"},
                {"contactType": "SELLERS_AGENT", "email": "seller-agent@example.test"},
                {"contactType": "SELLERS_ATTORNEY", "email": "seller-attorney@example.test"},
            ],
            "customFields": [
                {"fieldName": "CX.BUYERAGENTADMINEML", "stringValue": "buyer-assistant@example.test"},
                {"fieldName": "CX.SELLERAGENTADMINEML", "stringValue": "seller-assistant@example.test"},
            ],
            "virtualFields": {
                "LOCKRATE.2149": "2026-10-01",
                "LOCKRATE.2151": "2026-10-31",
            },
            "milestoneLogs": [{
                "stage": "Conditions Submitted to UW",
                "dateUtc": "2026-10-15T12:00:00Z",
            }],
        }

        result = _extract_requested_fields(loan, fields)

        self.assertNotIn("unresolved_field_ids", result)
        self.assertEqual(result["VEND.X141"], "buyer-agent@example.test")
        self.assertEqual(result["VEND.X119"], "buyer-attorney@example.test")
        self.assertEqual(result["VEND.X152"], "seller-agent@example.test")
        self.assertEqual(result["VEND.X130"], "seller-attorney@example.test")
        self.assertEqual(result["CX.BUYERAGENTADMINEML"], "buyer-assistant@example.test")
        self.assertEqual(result["CX.SELLERAGENTADMINEML"], "seller-assistant@example.test")
        self.assertEqual(result["LOCKRATE.2149"], "2026-10-01")
        self.assertEqual(result["LOCKRATE.2151"], "2026-10-31")
        self.assertEqual(result["Log.MS.DateTime.Conditions_Submitted_to_UW"], "2026-10-15T12:00:00Z")


class GetOneLoanPropertiesTests(unittest.IsolatedAsyncioTestCase):
    async def test_tool_uses_shared_selector_resolution(self):
        loan = {
            "virtualFields": {"LOCKRATE.2149": "2026-10-01"},
            "milestoneLogs": [{"stage": "Conditions Submitted to UW", "dateUtc": "2026-10-15T12:00:00Z"}],
        }
        response = Mock()
        response.json.return_value = {"data": {"loan": loan}}
        fields = ["LOCKRATE.2149", "LOCKRATE.2151", "Log.MS.DateTime.Conditions_Submitted_to_UW"]
        with (
            patch.dict("os.environ", {"ONELOAN_DOMAIN": "https://oneloan.example.test"}),
            patch("src.tools.oneloan_tools.get_oneloan_auth_token", return_value="test-token"),
            patch("src.tools.oneloan_tools.requests.get", return_value=response),
        ):
            result = json.loads(await GetLoanTool().execute({
                "loan_identifier": "test-loan", "company": "gri", "requestedProperties": fields,
            }))
        self.assertEqual(result, {"success": True, "data": {
            fields[0]: "2026-10-01", fields[1]: None, fields[2]: "2026-10-15T12:00:00Z",
        }})


if __name__ == "__main__":
    unittest.main()