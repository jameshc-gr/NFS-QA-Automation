"""
Computes the 12 HELOAN segmentation attributes from the raw Encompass field
dict returned by GetLoanTool (see handler.py). Every attribute resolves to a
plain True/False — no richer values.
"""

import logging

logger = logging.getLogger()

def _log(audit_lines: list[str], level: int, message: str, *args) -> None:
    formatted = message % args if args else message
    logger.log(level, formatted)
    audit_lines.append(formatted)

def _language_preference_flag(fields: dict, audit_lines: list[str]) -> bool:
    """
    Attribute 1 — Borrower Language Preference
    """
    borrower_lang = fields.get("URLA.X21")
    coborrower_lang = fields.get("URLA.X22")

    if borrower_lang is None:
        _log(audit_lines, logging.INFO, "URLA.X21 (borrower language preference) missing/unknown — defaulting to True")
        return True

    borrower_flag = borrower_lang != "EnglishIndicator"
    coborrower_flag = coborrower_lang is not None and coborrower_lang != "EnglishIndicator"

    if borrower_flag:
        _log(audit_lines, logging.INFO, "Language Preference: True — borrower language preference is %s", borrower_lang)
    elif coborrower_flag:
        _log(audit_lines, logging.INFO, "Language Preference: True — co-borrower language preference is %s", coborrower_lang)
    else:
        _log(
            audit_lines, logging.INFO,
            "Language Preference: False — borrower is %s and co-borrower is %s",
            borrower_lang, coborrower_lang if coborrower_lang is not None else "null (no co-borrower)",
        )

    return borrower_flag or coborrower_flag


def _club_membership_flag(fields: dict, prefix: str, audit_lines: list[str]) -> bool:
    """
    Attributes 3/4 — Chairman's Club (CC) / President's Club (PC)
    """
    label = "Chairman's Club" if prefix == "CC" else "President's Club"
    membership = fields.get("CX.VP.MEMBERSHIP")
    if membership is None:
        _log(audit_lines, logging.INFO, "CX.VP.MEMBERSHIP is null — %s defaults to False (no membership on file)", label)
        return False

    flag = str(membership).upper().startswith(prefix)
    if flag:
        _log(audit_lines, logging.INFO, "%s: True — CX.VP.MEMBERSHIP is %s", label, membership)
    else:
        _log(audit_lines, logging.INFO, "%s: False — CX.VP.MEMBERSHIP is %s (does not start with %s)", label, membership, prefix)
    return flag


def _loan_amount_flag(fields: dict, audit_lines: list[str]) -> bool:
    """Attribute 5 — Loan Amount > $400k"""
    amount = fields.get("2")
    if amount is None:
        _log(audit_lines, logging.INFO, "Field 2 (Base Loan Amount) missing/unknown — defaulting to True")
        return True

    flag = amount > 400000
    if flag:
        _log(
            audit_lines, logging.INFO,
            "Loan Amount Over 400k: True — base loan amount is $%s, which is over the $400,000 threshold",
            f"{amount:,.2f}",
        )
    else:
        _log(
            audit_lines, logging.INFO,
            "Loan Amount Over 400k: False — base loan amount is $%s, which is at or under the $400,000 threshold",
            f"{amount:,.2f}",
        )
    return flag


def _self_employed_flag(fields: dict, audit_lines: list[str]) -> bool:
    """Attribute 6 — Self-Employed (CX.ANY.BORR.SELF.EMPLOYED == "Y")"""
    indicator = fields.get("CX.ANY.BORR.SELF.EMPLOYED")
    if indicator is None:
        _log(audit_lines, logging.INFO, "CX.ANY.BORR.SELF.EMPLOYED missing/unknown — defaulting to True")
        return True

    flag = str(indicator).upper() == "Y"
    if flag:
        _log(audit_lines, logging.INFO, "Self Employed: True — CX.ANY.BORR.SELF.EMPLOYED is %r, which indicates self-employment", indicator)
    else:
        _log(audit_lines, logging.INFO, "Self Employed: False — CX.ANY.BORR.SELF.EMPLOYED is %r, not the self-employed indicator (\"Y\")", indicator)
    return flag


def _multiple_employers_flag(fields: dict, audit_lines: list[str]) -> bool:
    """
    Attribute 7 — Number of Employers > 1.
    BE0109/CE0109 each resolve to a list of CurrentEmploymentIndicator
    values (one per employment record on file, current + prior). We count
    how many are True across borrower + co-borrower combined and flag if
    that combined count exceeds 1 — this is a household total, not a
    per-person "both employed" check.

    NOTE: missing/None here is treated as an empty list (0 contribution)
    """
    borrower_current = fields.get("BE0109") or []
    coborrower_current = fields.get("CE0109") or []
    borrower_count = sum(1 for v in borrower_current if v is True)
    coborrower_count = sum(1 for v in coborrower_current if v is True)
    count = borrower_count + coborrower_count

    flag = count > 1
    if flag:
        _log(
            audit_lines, logging.INFO,
            "Multiple Employers: True — %d current employer(s) for borrower (BE0109) + %d for co-borrower (CE0109) = %d combined, over the 1-employer threshold",
            borrower_count, coborrower_count, count,
        )
    else:
        _log(
            audit_lines, logging.INFO,
            "Multiple Employers: False — %d current employer(s) for borrower (BE0109) + %d for co-borrower (CE0109) = %d combined, at or under the 1-employer threshold",
            borrower_count, coborrower_count, count,
        )
    return flag


def _multiple_properties_flag(fields: dict, audit_lines: list[str]) -> bool:
    """
    Attribute 8 — Owning Multiple Properties.
    FM0146 resolves to a list of Owner values ("Borrower" / "CoBorrower" /
    "Both") across every REO property on the Schedule of REO. Borrower's
    count = entries that are "Borrower" or "Both"; co-borrower's count =
    entries that are "CoBorrower" or "Both" ("Both" counts toward both
    tallies). Flag = True if EITHER count exceeds 1
    """
    reo_owners = fields.get("FM0146") or []
    borrower_count = sum(1 for owner in reo_owners if owner in ("Borrower", "Both"))
    coborrower_count = sum(1 for owner in reo_owners if owner in ("CoBorrower", "Both"))
    flag = borrower_count > 1 or coborrower_count > 1
    if flag:
        _log(
            audit_lines, logging.INFO,
            "Multiple Properties: True — FM0146 shows %d REO propert(y/ies) attributed to borrower and %d to co-borrower (%s exceeds the 1-property threshold)",
            borrower_count, coborrower_count,
            "borrower" if borrower_count > 1 else "co-borrower",
        )
    else:
        _log(
            audit_lines, logging.INFO,
            "Multiple Properties: False — FM0146 shows %d REO propert(y/ies) attributed to borrower and %d to co-borrower, neither exceeds the 1-property threshold",
            borrower_count, coborrower_count,
        )
    return flag


def _investment_second_home_flag(fields: dict, audit_lines: list[str]) -> bool:
    """Attribute 9 — Investment / Second Home. Field id 1811 """
    value = fields.get("1811")
    if value is None:
        _log(audit_lines, logging.INFO, "Field 1811 (Property Will Be) missing/unknown — defaulting to True")
        return True

    flag = value in ("Investor", "SecondHome")
    if flag:
        _log(audit_lines, logging.INFO, "Investment Second Home: True — Property Will Be (field 1811) is %r", value)
    else:
        _log(
            audit_lines, logging.INFO,
            "Investment Second Home: False — Property Will Be (field 1811) is %r, not Investor or SecondHome",
            value,
        )
    return flag


def _multi_family_flag(fields: dict, audit_lines: list[str]) -> bool:
    """
    Attribute 10 — Multi-Family. Field 16 (Property.FinancedNumberOfUnits) 
    """
    units = fields.get("16")
    if units is None:
        _log(audit_lines, logging.INFO, "Field 16 (# Units) missing/unknown — defaulting to True")
        return True

    flag = units > 1
    if flag:
        _log(audit_lines, logging.INFO, "Multi Family: True — subject property has %s units (field 16), over the 1-unit threshold", units)
    else:
        _log(audit_lines, logging.INFO, "Multi Family: False — subject property has %s unit(s) (field 16), at or under the 1-unit threshold", units)
    return flag


def _condo_flag(fields: dict, audit_lines: list[str]) -> bool:
    """
    Attribute 11 — Condo. Field 1041 (GsePropertyType). Includes high-rise
    and detached/manufactured condo variants
    """
    value = fields.get("1041")
    if value is None:
        _log(audit_lines, logging.INFO, "Field 1041 (Subject Property Type) missing/unknown — defaulting to True")
        return True

    flag = value in ("Condominium", "HighRiseCondominium", "DetachedCondo", "ManufacturedHomeCondoPUDCoOp")
    if flag:
        _log(audit_lines, logging.INFO, "Condo: True — Subject Property Type (field 1041) is %r, a condo variant", value)
    else:
        _log(
            audit_lines, logging.INFO,
            "Condo: False — Subject Property Type (field 1041) is %r, not one of Condominium/HighRiseCondominium/DetachedCondo/ManufacturedHomeCondoPUDCoOp",
            value,
        )
    return flag


def _retail_flag(fields: dict, audit_lines: list[str]) -> bool:
    """3000-3999 = CD (Consumer Direct), not retail. Any other cost center = retail."""
    raw = fields.get("CX.PLOCSTCNTR")
    try:
        cost_center = int(str(raw).strip())
    except (TypeError, ValueError):
        _log(audit_lines, logging.INFO, "Field CX.PLOCSTCNTR (Cost Center) missing/invalid (%r) — defaulting to False", raw)
        return False
    flag = not (3000 <= cost_center < 4000)
    if flag:
        _log(audit_lines, logging.INFO, "Retail: True — Cost Center (field CX.PLOCSTCNTR) is %r, not in 3000-3999 range", cost_center)
    else:
        _log(audit_lines, logging.INFO, "Retail: False — Cost Center (field CX.PLOCSTCNTR) is %r, in 3000-3999 range", cost_center)
    return flag


def _employee_loan_access_flag(audit_lines: list[str]) -> bool:
    """Employee Loan Access. Hardcoded to False until the loan-level source is defined."""
    _log(audit_lines, logging.INFO, "Employee Loan Access: False — not yet derived from loan data (hardcoded)")
    return False


def get_loan_attributes(fields: dict, audit_lines: list[str]) -> dict:
    """
    Computes all 12 HELOAN segmentation attributes from the raw field dict
    fetched by handler.py's single GetLoanTool call. Every value is a plain
    bool. 
    """
    return {
        "language_preference_flag": _language_preference_flag(fields, audit_lines),
        "chairmans_club_flag": _club_membership_flag(fields, "CC", audit_lines),
        "presidents_club_flag": _club_membership_flag(fields, "PC", audit_lines),
        "loan_amount_over_400k_flag": _loan_amount_flag(fields, audit_lines),
        "self_employed_flag": _self_employed_flag(fields, audit_lines),
        "multiple_employers_flag": _multiple_employers_flag(fields, audit_lines),
        "multiple_properties_flag": _multiple_properties_flag(fields, audit_lines),
        "investment_second_home_flag": _investment_second_home_flag(fields, audit_lines),
        "multi_family_flag": _multi_family_flag(fields, audit_lines),
        "condo_flag": _condo_flag(fields, audit_lines),
        "retail_flag": _retail_flag(fields, audit_lines),
        "employee_loan_access_flag": _employee_loan_access_flag(audit_lines),
    }