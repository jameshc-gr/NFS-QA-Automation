"""
Evaluates the HELOAN processor first review checks and decision-only
eligibility for advancing to Assigned to UW.
"""

import logging
import math
from decimal import Decimal, InvalidOperation

logger = logging.getLogger()

PASS = "PASS"
FAIL = "FAIL"
UNKNOWN = "UNKNOWN"

def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)


def _is_empty(value) -> bool:
    """None, False, and empty/whitespace-only strings all count as empty."""
    if value is None or value is False:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def _missing(fields: dict, field_ids: list[str], check_label: str, audit_lines: list[str]) -> bool:
    """True if any required field was not returned at all (key absent, as opposed to null)."""
    missing = [f for f in field_ids if f not in fields]
    if missing:
        _log(audit_lines, logging.ERROR,
             "%s: UNKNOWN — field(s) %s were not returned by GetLoanTool; not evaluating this check",
             check_label, missing)
        return True
    return False


def _format_name(fields: dict, first_name_field: str, last_name_field: str) -> str:
    if first_name_field not in fields or last_name_field not in fields:
        return "not returned"
    name_parts = [
        fields[field_id].strip()
        for field_id in (first_name_field, last_name_field)
        if isinstance(fields[field_id], str) and fields[field_id].strip()
    ]
    return " ".join(name_parts) if name_parts else "not on file"


def _disclosures_check(fields: dict, audit_lines: list[str]) -> dict:
    """Check 1 — Disclosures signed, tracked by field CX.APPRCVD.1."""
    label = "Disclosure Check"
    if _missing(fields, ["CX.APPRCVD.1"], label, audit_lines):
        return {"status": UNKNOWN, "reason": "Disclosure field was not returned"}

    value = fields.get("CX.APPRCVD.1")
    if _is_empty(value):
        _log(audit_lines, logging.INFO,
             "%s: FAIL — field CX.APPRCVD.1 (Disclosures Signed Date) is empty (%r)", label, value)
        return {"status": FAIL, "reason": "Initial disclosure has not been signed."}

    _log(audit_lines, logging.INFO,
         "%s: PASS — field CX.APPRCVD.1 (Disclosures Signed Date) is %r", label, value)
    return {"status": PASS, "reason": None}


def _has_coborrower(fields: dict, audit_lines: list[str]) -> bool:
    """Co-borrower exists if either co-borrower name field (4004 first, 4006 last) has a value"""
    first_set = not _is_empty(fields.get("4004"))
    last_set = not _is_empty(fields.get("4006"))
    present = first_set or last_set
    _log(audit_lines, logging.INFO,
         "Co-borrower %s — 4004 (first name) is %s, 4006 (last name) is %s",
         "present" if present else "not present",
         "set" if first_set else "empty",
         "set" if last_set else "empty")
    return present


def _hard_credit_check(fields: dict, audit_lines: list[str]) -> dict:
    """Check hard credit using the prequal indicator; consent is a separate follow-up."""
    label = "Hard Credit"
    unknown_reason = "Unable to verify whether hard credit is on file. Please review the loan’s credit report."
    if _missing(fields, ["4750"], label, audit_lines):
        return {"status": UNKNOWN, "reason": unknown_reason}

    value = fields["4750"]
    if value is False:
        _log(audit_lines, logging.INFO,
             "%s: PASS — field 4750 (Prequal Credit Report Indicator) is False; hard credit is on file.", label)
        return {"status": PASS, "reason": "Hard credit is on file."}

    if value is True:
        reason = "Soft credit is on file, but hard credit has not been completed."
    elif value is None or (isinstance(value, str) and not value.strip()):
        reason = "No credit pull is indicated on the loan."
    else:
        _log(audit_lines, logging.ERROR,
             "%s: UNKNOWN — field 4750 (Prequal Credit Report Indicator) has unexpected value %r (type %s); unable to verify hard-credit status.",
             label, value, type(value).__name__)
        return {"status": UNKNOWN, "reason": unknown_reason}

    _log(audit_lines, logging.INFO,
         "%s: FAIL — field 4750 (Prequal Credit Report Indicator) is %r; %s",
         label, value, reason)
    followup = _credit_consent_followup(fields, audit_lines)
    return {"status": FAIL, "reason": reason, "followup": followup}


def _credit_consent_followup(fields: dict, audit_lines: list[str]) -> str:
    has_coborrower = (
        _has_coborrower(fields, audit_lines)
        if all(field_id in fields for field_id in ("4004", "4006"))
        else False
    )
    required_fields = ["4073", "4004", "4006"]
    if has_coborrower:
        required_fields.append("4076")
    missing_fields = [field_id for field_id in required_fields if field_id not in fields]
    if missing_fields:
        _log(audit_lines, logging.WARNING,
             "Credit Authorization: unable to verify consent; missing fields %s", missing_fields)
        return (
            "Consent status could not be determined because required information was not returned; "
            "verify consent and obtain any required consent before completing a hard-credit pull."
        )

    parties = [("borrower", "4000", "4002")]
    if has_coborrower:
        parties.append(("co-borrower", "4004", "4006"))
    consent_names = {
        role: " ".join(
            fields[field_id].strip()
            for field_id in (first_field, last_field)
            if isinstance(fields.get(field_id), str) and fields[field_id].strip()
        ) or f"the {role}"
        for role, first_field, last_field in parties
    }

    missing_consent = [] if fields["4073"] is True else ["borrower"]
    if has_coborrower:
        if fields["4076"] is not True:
            missing_consent.append("co-borrower")

    if missing_consent:
        who = " and ".join(missing_consent)
        _log(audit_lines, logging.INFO,
             "Credit Authorization: consent is missing for the %s (4073 is %r, 4076 is %r)",
             who, fields.get("4073"), fields.get("4076"))
        names = " and ".join(consent_names[role] for role in missing_consent)
        return f"Credit consent is missing for {names}. Obtain consent to pull hard credit."

    _log(audit_lines, logging.INFO,
         "Credit Authorization: required consent is on file (4073 is %r, 4076 is %r)",
         fields.get("4073"), fields.get("4076"))
    names = " and ".join(consent_names[role] for role, _, _ in parties)
    return (
        f"Consent is on file for {names}, "
        "but a hard-credit pull is still required before proceeding."
    )


def _dti_check(fields: dict, audit_lines: list[str]) -> dict:
    """Check 3 — Back-End DTI below 50%, tracked by field 742."""
    label = "DTI Check"
    if _missing(fields, ["742"], label, audit_lines):
        return {"status": UNKNOWN, "reason": "DTI field was not returned"}

    value = fields.get("742")
    if _is_empty(value):
        _log(audit_lines, logging.INFO,
             "%s: UNKNOWN — field 742 (Back-End DTI) is empty (%r)", label, value)
        return {"status": UNKNOWN, "reason": "Back-End DTI is not available"}

    try:
        if isinstance(value, bool):
            raise ValueError("DTI cannot be a boolean")
        dti_value = float(value)
        if not math.isfinite(dti_value) or dti_value < 0:
            raise ValueError("DTI must be finite and nonnegative")
    except (ValueError, TypeError, OverflowError):
        _log(audit_lines, logging.ERROR,
             "%s: UNKNOWN — field 742 (Back-End DTI) has unexpected value %r (type %s); unable to parse as number",
             label, value, type(value).__name__)
        return {"status": UNKNOWN, "reason": "Unable to determine Back-End DTI due to invalid field value"}

    if dti_value < 50:
        _log(audit_lines, logging.INFO,
             "%s: PASS — field 742 (Back-End DTI) is %.2f%%, which is below 50%%", label, dti_value)
        return {"status": PASS, "reason": f"Back-End DTI is {dti_value:.1f}%"}

    _log(audit_lines, logging.INFO,
         "%s: FAIL — field 742 (Back-End DTI) is %.2f%%, which is 50%% or higher", label, dti_value)
    return {"status": FAIL, "reason": f"Back-End DTI is {dti_value:.1f}%"}


def get_verification_results(fields: dict, audit_lines: list[str]) -> dict:
    """
    Runs all first review checks against the raw field dict fetched by
    handler.py's single GetLoanTool call. All checks always run, so a loan
    that fails multiple checks gets one combined result
    """
    _log(audit_lines, logging.INFO, "Borrower: %s", _format_name(fields, "4000", "4002"))
    _log(audit_lines, logging.INFO, "Co-borrower: %s", _format_name(fields, "4004", "4006"))
    audit_lines.append("")
    return {
        "disclosure": _disclosures_check(fields, audit_lines),
        "hard_credit": _hard_credit_check(fields, audit_lines),
        "dti": _dti_check(fields, audit_lines),
    }


def _income_amount(value: object) -> Decimal:
    if value is None or (isinstance(value, str) and not value.strip()):
        return Decimal(0)
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        raise ValueError("Income must be numeric or empty")
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise ValueError("Income must be numeric or empty") from exc
    if not amount.is_finite():
        raise ValueError("Income must be finite")
    return amount


def _w2_income_check(fields: dict, audit_lines: list[str]) -> dict:
    blockers: list[str] = []
    unknowns: list[str] = []
    employment_fields = ("901", "902", "903", "904")
    other_fields = ["905", "906", "907", "908", "921", "1005", "FE0153", "FE0353"]
    if _missing(fields, ["4004", "4006"], "W2 Income", audit_lines):
        unknowns.append("Co-borrower presence could not be determined")
    elif _has_coborrower(fields, audit_lines):
        other_fields.extend(("FE0253", "FE0453"))

    amounts: dict[str, Decimal] = {}
    for field_id in (*employment_fields, *other_fields):
        if field_id not in fields:
            unknowns.append(f"Income field {field_id} was not returned")
            continue
        try:
            amounts[field_id] = _income_amount(fields[field_id])
        except ValueError:
            unknowns.append(f"Income field {field_id} has an invalid value")

    if all(field_id in amounts for field_id in employment_fields):
        if sum(amounts[field_id] for field_id in employment_fields) <= 0:
            blockers.append("Combined employment income is not greater than zero")
    for field_id in other_fields:
        if field_id in amounts and amounts[field_id] != 0:
            blockers.append(f"Non-W2 income field {field_id} is nonzero")

    if "CX.SELFEMPLOYED" not in fields:
        unknowns.append("Self-employment field was not returned")
    else:
        value = fields["CX.SELFEMPLOYED"]
        token = "" if value is None else str(value).strip().casefold()
        if token in ("true", "y", "yes", "1"):
            blockers.append("Self-employment is indicated")
        elif token not in ("", "false", "n", "no", "0"):
            unknowns.append("Self-employment field has an unrecognized value")

    status = FAIL if blockers else UNKNOWN if unknowns else PASS
    return {
        "status": status,
        "reasons": blockers + unknowns if blockers or unknowns else ["Income meets the W2-only rules"],
    }


def _auto_advance_result(eligible: bool, reasons: list[str], audit_lines: list[str]) -> dict:
    _log(
        audit_lines, logging.INFO,
        "Assigned to UW eligibility (decision only; milestone not moved): eligible=%s - %s",
        eligible, "; ".join(reasons),
    )
    return {"eligible": eligible, "reasons": reasons}


def get_auto_advance_decision(
    fields: dict, results: dict, assignment_results: dict, audit_lines: list[str],
) -> dict:
    """Evaluate eligibility only; never move a milestone or alter review checks."""
    failed = []
    unknown = []
    for name in ("disclosure", "hard_credit", "dti"):
        status = results.get(name, {}).get("status")
        if status == FAIL:
            failed.append(f"First-review check {name} did not pass")
        elif status != PASS:
            unknown.append(f"First-review check {name} is unknown")
    if failed or unknown:
        return _auto_advance_result(
            False, failed + unknown, audit_lines,
        )

    # OneLoan team fields may already include assignments made by this pipeline run.
    processor = assignment_results.get("processor")
    if not isinstance(processor, dict) or "reason_code" not in processor:
        return _auto_advance_result(
            False, ["Pre-run MC assignment outcome was not provided"], audit_lines,
        )
    reason_code = processor["reason_code"]
    if reason_code == "ALREADY_ASSIGNED":
        return _auto_advance_result(
            False, ["MC was already assigned before this pipeline run"], audit_lines,
        )
    if (
        reason_code not in (None, "DAILY_CAP_EXCEEDED_FALLBACK", "ASSIGNED_FROM_RESUBMISSION_POOL")
        or not isinstance(processor.get("id"), str)
        or not processor["id"].strip()
    ):
        return _auto_advance_result(
            False, ["Pipeline outcome does not confirm a newly assigned MC"], audit_lines,
        )

    income = _w2_income_check(fields, audit_lines)
    if income["status"] != PASS:
        return _auto_advance_result(
            False, income["reasons"], audit_lines,
        )
    return _auto_advance_result(
        True,
        ["All three review checks passed; MC was newly assigned; income meets the W2-only rules"],
        audit_lines,
    )
