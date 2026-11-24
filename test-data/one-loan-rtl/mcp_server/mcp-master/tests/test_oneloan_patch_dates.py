"""Offline payload tests; these do not establish upstream write permissions."""

import unittest

from src.tools.oneloan_tools import _build_patch_body


class PatchDateTests(unittest.TestCase):
    def test_all_requested_custom_fields(self):
        names = """CX.APPSENT.1 CX.APPRCVD.1 CX.CTC.REQUESTED CX.CONDITIONSUBMIT.1
        CX.CTCCOMMIT.1 CX.APPPAKCOMPLETE CX.APPR.OR.PIW.OR.ACE CX.APPRORDERTRANS.10
        CX.APPRDUE2.4 CX.APPRINSPDATE2.4 CX.COLLATERAL.UW.STATUS CX.APPRRECTRANS.10
        CX.CONDODOCS.10 CX.CONDORECV.10 CX.UWCONDOAPPR CX.CDSIGNEDALL CX.HUDTOPOD
        CX.TITLEORDER.1 CX.TITREQUEST CX.SFC1 CX.TITLERCVD.1 CX.CPL.DATE CX.TITLE.INVOICE
        CX.WIRE.IN CX.TITLE.COM CX.TITLE.CLEAR.DATE CX.CLSVOEDATE CX.GR.INSURANCE.APPROVED
        CX.GR.INS.DATE CX.TRUSTAPPROVED CX.TRUST CX.POAAPPROVEDDATE CX.POA.EXPDATE
        CX.POA.TRACKING.INFO CX.ESTCLOSELASTVALIDBY CX.CLSSCHED.1 CX.CLSTIME.1 CX.TIME.ZONE""".split()
        result = _build_patch_body("app", dict.fromkeys(names, "test"))[0][1]
        self.assertEqual(result["customFields"], [
            {"fieldName": name, "stringValue": "test"} for name in names
        ])

    def test_standard_date_destinations(self):
        date = "2026-10-15"
        result = _build_patch_body("app", dict.fromkeys([
            "745", "748", "3197", "3624", "2298", "2301", "2305",
        ], date))
        self.assertEqual(result, [["patch-loan", {
            "originationDate": date,
            "fhaVaLoan": {"closingDate": date},
            "regulationZ": {
                "borrowerIntendToContinueDate": date,
                "initialGFEAppraisalProvidedDate": date,
            },
            "underwriterSummary": {
                "submittedDate": date, "approvedDate": date, "clearToCloseDate": date,
            },
        }]])

    def test_combined_custom_appraisal_and_milestone_patch(self):
        selector = "Log.MS.DateTime.Conditions_Submitted_to_UW"
        existing = {"milestoneLogs": [{
            "id": "milestone-1", "stage": "Conditions Submitted to UW",
            "doneIndicator": True, "dateUtc": "2026-10-01T12:00:00Z",
        }]}
        result = _build_patch_body("app", {
            "CX.CTC.REQUESTED": "10/15/2026", "356": 250000,
            selector: "2026-10-15T12:00:00Z",
        }, existing)[0][1]
        self.assertEqual(result["customFields"], [{"fieldName": "CX.CTC.REQUESTED", "stringValue": "10/15/2026"}])
        self.assertEqual(result["propertyAppraisedValueAmount"], 250000)
        self.assertEqual(result["milestoneLogs"], [{
            "id": "milestone-1", "stage": "Conditions Submitted to UW", "dateUtc": "2026-10-15T12:00:00Z",
        }])
        self.assertEqual(existing["milestoneLogs"][0]["dateUtc"], "2026-10-01T12:00:00Z")

    def test_missing_ambiguous_or_unidentified_milestone_rejected(self):
        milestone = {"id": "m", "stage": "Conditions Submitted to UW"}
        for logs in ([], [dict(milestone, id=None)], [milestone, milestone]):
            with self.subTest(logs=logs), self.assertRaisesRegex(ValueError, "one existing milestone"):
                _build_patch_body("app", {"Log.MS.DateTime.Conditions_Submitted_to_UW": None}, {"milestoneLogs": logs})

    def test_read_only_fields_remain_blocked(self):
        for fid in ("3153", "3977"):
            with self.subTest(fid=fid), self.assertRaisesRegex(ValueError, fid):
                _build_patch_body("app", {fid: "2026-10-15"})

    def test_lockrate_fields_use_literal_virtual_keys(self):
        fields = {"LOCKRATE.2149": "2026-10-15", "LOCKRATE.2151": "2026-11-15"}
        self.assertEqual(_build_patch_body("app", fields), [[
            "patch-loan", {"virtualFields": fields},
        ]])

    def test_lockrate_patch_only_sends_requested_keys(self):
        existing = {"virtualFields": {
            "LOCKRATE.2149": "2026-10-01", "LOCKRATE.2151": "2026-11-01", "UWC.OPENCOUNT": 5,
        }, "rateLock": {"buySideLockDate": "2026-09-01"}}
        result = _build_patch_body("app", {
            "LOCKRATE.2149": None, "CX.CTC.REQUESTED": "10/15/2026", "745": "2026-10-15",
        }, existing)[0][1]
        self.assertEqual(result["virtualFields"], {"LOCKRATE.2149": None})
        self.assertNotIn("rateLock", result)
        self.assertEqual(result["originationDate"], "2026-10-15")
        self.assertEqual(result["customFields"], [{"fieldName": "CX.CTC.REQUESTED", "stringValue": "10/15/2026"}])
        self.assertEqual(existing["virtualFields"]["LOCKRATE.2149"], "2026-10-01")

    def test_unknown_lockrate_fields_are_not_enabled(self):
        with self.assertRaisesRegex(ValueError, "Unmapped field IDs"):
            _build_patch_body("app", {"LOCKRATE.UNKNOWN": "test"})

    def test_clear_date(self):
        self.assertEqual(_build_patch_body("app", {"2305": None}), [[
            "patch-loan", {"underwriterSummary": {"clearToCloseDate": None}},
        ]])


if __name__ == "__main__":
    unittest.main()