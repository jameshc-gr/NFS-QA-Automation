import html
import io
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer

logger = logging.getLogger(__name__)

_CHECK_COLORS = {
    "green": "#1a7f37",
    "yellow": "#9a6700",
    "red": "#c0392b",
    "gray": "#6b7280",
}
_CHICAGO = ZoneInfo("America/Chicago")
_BORROWER_FIRST_NAME = "4000"
_BORROWER_LAST_NAME = "4002"
_COBORROWER_FIRST_NAME = "4004"
_COBORROWER_LAST_NAME = "4006"
_OCCUPANCY_LABELS = {
    "PrimaryResidence": "Primary Residence",
    "SecondHome": "Second Home",
    "Investor": "Investment Property",
}
_PROPERTY_TYPE_LABELS = {
    "Attached": "Attached",
    "Condominium": "Condominium",
    "Cooperative": "Co-Operative",
    "Detached": "Detached",
    "HighRiseCondominium": "High Rise Condominium",
    "ManufacturedHousing": "Manufactured Housing",
    "PUD": "PUD",
    "DetachedCondo": "Detached Condo",
    "ManufacturedHomeCondoPUDCoOp": "Manufactured Home / Condo / PUD / Co-Op",
    "MH HomeChoice": "MH CHOICEHome",
    "MHSelect": "MH Select",
    "MHAdvantage": "MH Advantage",
}
_ASSIGNED_ROLES = (
    ("loan_officer", "Loan Officer"),
    ("underwriter", "Underwriter"),
    ("processor_mortgage_consultant", "Processor/Mortgage Consultant"),
    ("loan_coordinator", "Loan Coordinator"),
    ("closing_coordinator", "Closing Coordinator"),
)
_TEAM_FIELD_SELECTORS = {
    "loan_officer": {
        "name": "LoanTeamMember.Name.Loan_Officer",
        "user_id": "LoanTeamMember.UserId.Loan_Officer",
        "email": "LoanTeamMember.Email.Loan_Officer",
    },
    "underwriter": {
        "name": "LoanTeamMember.Name.Underwriter",
        "user_id": "LoanTeamMember.UserId.Underwriter",
        "email": "LoanTeamMember.Email.Underwriter",
    },
    "processor_mortgage_consultant": {
        "name": "LoanTeamMember.Name.Mortgage_Consultant",
        "user_id": "LoanTeamMember.UserId.Mortgage_Consultant",
        "email": "LoanTeamMember.Email.Mortgage_Consultant",
    },
    "loan_coordinator": {
        "name": "LoanTeamMember.Name.Loan_Coordinator",
        "user_id": "LoanTeamMember.UserId.Loan_Coordinator",
        "email": "LoanTeamMember.Email.Loan_Coordinator",
    },
    "closing_coordinator": {
        "name": "LoanTeamMember.Name.Ops_Assist_-_CC",
        "user_id": "LoanTeamMember.UserId.Ops_Assist_-_CC",
        "email": "LoanTeamMember.Email.Ops_Assist_-_CC",
    },
}


def _escape(value: object) -> str:
    return html.escape(str(value))


def _information_number(fields: dict, field_id: str) -> Decimal | None:
    value = fields.get(field_id)
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        logger.warning("Invalid numeric value for loan-information field %s", field_id)
        return None
    if not number.is_finite():
        logger.warning("Non-finite numeric value for loan-information field %s", field_id)
        return None
    return number


def _information_amount(fields: dict, field_id: str, *, percent: bool = False) -> str:
    number = _information_number(fields, field_id)
    if number is None:
        return "Not available"
    number = number.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{number:.2f}%" if percent else f"${number:,.2f}"


def _information_text(value: object, labels: dict | None = None) -> str:
    text = str(value).strip() if value is not None else ""
    return (labels or {}).get(text, text) if text else "Not available"


def _self_employment_label(value: object) -> str:
    if value is None:
        return "No"
    token = str(value).strip().casefold()
    if token in ("true", "y", "yes", "1"):
        return "Yes"
    if token in ("false", "n", "no", "0"):
        return "No"
    if token:
        logger.warning("Unrecognized self-employment value in loan information")
    return "Not available"


_LIABILITY_TYPE_LABELS = {
    "ChildCare": "Child Care",
    "ChildSupport": "Child Support",
    "CollectionsJudgementsAndLiens": "Collections, Judgements and Liens",
    "HELOC": "HELOC",
    "Installment": "Installment",
    "LeasePayments": "Lease Payments",
    "MortgageLoan": "Mortgage",
    "Open30DayChargeAccount": "Open 30-Day Charge Account",
    "OtherLiability": "Other Liability",
    "Revolving": "Revolving",
    "SeparateMaintenanceExpense": "Separate Maintenance Expense",
    "OtherExpense": "Other Expense",
    "Taxes": "Taxes",
    "TaxLien": "Tax Lien",
}


def _liabilities_to_pay_off(fields: dict) -> list[str] | None:
    flags = fields.get("FL0118")
    if not isinstance(flags, list):
        logger.warning("Liability payoff flags were not returned as a list")
        return None
    details = {}
    for field_id in ("FL0102", "FL0108", "FL0110"):
        values = fields.get(field_id)
        if not isinstance(values, list) or len(values) != len(flags):
            logger.warning("Missing or misaligned liability details for field %s", field_id)
            details[field_id] = []
        else:
            details[field_id] = values
    liabilities = []
    for index, flag in enumerate(flags):
        if flag is not True:
            if flag is not None and flag is not False:
                logger.warning("Unrecognized liability payoff flag at position %s", index + 1)
                return None
            continue
        creditor = f"Unidentified liability (record {index + 1})"
        parts = []
        for field_id in ("FL0102", "FL0108", "FL0110"):
            values = details[field_id]
            value = values[index] if values else None
            if value is None or not str(value).strip():
                continue
            text = str(value).strip()
            if field_id == "FL0102":
                creditor = text
                continue
            if field_id == "FL0108":
                text = _LIABILITY_TYPE_LABELS.get(text, text)
            elif field_id == "FL0110":
                text = f"account ending {text[-4:]}"
            parts.append(text)
        liabilities.append(f"{creditor} ({', '.join(parts)})" if parts else creditor)
    return liabilities


def _loan_information_groups(fields: dict) -> list[tuple[str, list[tuple[str, str]]]]:
    rental_values = [_information_number(fields, field_id) for field_id in ("921", "1005")]
    if any(value is not None and value > 0 for value in rental_values):
        rental_income = "Yes"
    else:
        rental_income = "No"
    address = ", ".join(
        str(fields[field_id]).strip()
        for field_id in ("11", "12", "14", "15")
        if fields.get(field_id) is not None and str(fields[field_id]).strip()
    ) or "Not available"
    return [
        ("Loan & Qualification", [
            ("Base Loan Amount", _information_amount(fields, "1109")),
            ("Total Loan Amount", _information_amount(fields, "2")),
            ("Occupancy", _information_text(fields.get("1811"), _OCCUPANCY_LABELS)),
            ("Credit Score for Decision Making", _information_text(fields.get("2853"))),
            ("Back-End DTI", _information_amount(fields, "742", percent=True)),
            ("Front-End DTI", _information_amount(fields, "740", percent=True)),
            ("LTV", _information_amount(fields, "353", percent=True)),
            ("CLTV", _information_amount(fields, "976", percent=True)),
            ("HCLTV", _information_amount(fields, "1540", percent=True)),
        ]),
        ("Subject Property", [
            ("Property Address", address),
            ("County", _information_text(fields.get("13"))),
            ("Property Type", _information_text(fields.get("1041"), _PROPERTY_TYPE_LABELS)),
            ("Number of Units", _information_text(fields.get("16"))),
        ]),
        ("Borrower Profile", [
            ("Total Properties Owned", _information_text(fields.get("CX.MRTG.COUNT"))),
            ("Self-Employed", _self_employment_label(fields.get("CX.SELFEMPLOYED"))),
            ("Rental Income", rental_income),
        ]),
    ]


def _format_datetime(value: str | datetime | None) -> str:
    if value is None:
        return "Not available"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(_CHICAGO).strftime("%B %d, %Y at %I:%M %p CT")


def _format_date(value: object) -> str:
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.strftime("%B %d, %Y")
        except ValueError:
            return value
    return str(value)


def _person_name(fields: dict, first_field: str, last_field: str) -> str:
    parts = [
        fields[field_id].strip()
        for field_id in (first_field, last_field)
        if isinstance(fields.get(field_id), str) and fields[field_id].strip()
    ]
    return " ".join(parts) if parts else "not on file"


def _consent_names(fields: dict, *, missing: bool = False) -> list[str]:
    names = []
    if (fields.get("4073") is not True) == missing:
        names.append(_person_name(fields, _BORROWER_FIRST_NAME, _BORROWER_LAST_NAME))
    has_coborrower = fields.get(_COBORROWER_FIRST_NAME) or fields.get(_COBORROWER_LAST_NAME)
    if has_coborrower and (fields.get("4076") is not True) == missing:
        names.append(_person_name(fields, _COBORROWER_FIRST_NAME, _COBORROWER_LAST_NAME))
    return names


def _check_finding(key: str, result: dict, fields: dict, labels: dict) -> tuple[str, str]:
    if not isinstance(result, dict):
        logger.warning("First-review check %r has a malformed result of type %s", key, type(result).__name__)
        label = _escape(labels.get(key) or key.replace("_", " ").title())
        return f"Unable to determine {label.lower()}: the check result was malformed, see audit log", _CHECK_COLORS["gray"]
    status = str(result.get("status", "UNKNOWN")).upper()

    if key == "disclosure":
        signed_date = fields.get("CX.APPRCVD.1")
        if status == "PASS" and signed_date:
            return f"Disclosures signed on {_escape(_format_date(signed_date))}", _CHECK_COLORS["green"]
        if status == "FAIL":
            return "Disclosure not signed", _CHECK_COLORS["red"]
        return "Unable to determine disclosure due to missing fields, see audit log", _CHECK_COLORS["gray"]

    if key == "hard_credit":
        if status == "PASS":
            return "Hard credit is on file.", _CHECK_COLORS["green"]
        if status == "UNKNOWN":
            return "Unable to verify whether hard credit is on file. Please review the loan’s credit report.", _CHECK_COLORS["gray"]
        credit_description = _escape(result.get("reason") or "Hard credit was not pulled.")
        missing_consent = []
        if "4073" in fields and fields.get("4073") is not True:
            missing_consent.append(_person_name(fields, _BORROWER_FIRST_NAME, _BORROWER_LAST_NAME))
        coborrower_fields_present = _COBORROWER_FIRST_NAME in fields and _COBORROWER_LAST_NAME in fields
        has_coborrower = bool(fields.get(_COBORROWER_FIRST_NAME) or fields.get(_COBORROWER_LAST_NAME))
        if has_coborrower and "4076" in fields and fields.get("4076") is not True:
            missing_consent.append(_person_name(fields, _COBORROWER_FIRST_NAME, _COBORROWER_LAST_NAME))
        if missing_consent:
            names = " and ".join(_escape(name) for name in missing_consent)
            return f"{credit_description} Consent from {names} is missing.", _CHECK_COLORS["red"]

        consent_data_complete = "4073" in fields and coborrower_fields_present
        if has_coborrower:
            consent_data_complete = consent_data_complete and "4076" in fields
        if not consent_data_complete:
            return (
                f"{credit_description} Unable to determine consent status due to missing information, see audit log.",
                _CHECK_COLORS["gray"],
            )

        consent_names = _consent_names(fields)
        names = " and ".join(_escape(name) for name in consent_names) or "the required parties"
        return f"{credit_description} Consent from {names} was given.", _CHECK_COLORS["yellow"]

    if key == "dti":
        dti_value = result.get("reason")
        if status == "PASS":
            return _escape(dti_value) if dti_value else "DTI checked", _CHECK_COLORS["green"]
        if status == "UNKNOWN":
            return "Unable to determine Back-End DTI due to missing field, see audit log", _CHECK_COLORS["gray"]
        if status == "FAIL":
            return _escape(f"{dti_value} and exceeds 50% threshold") if dti_value else "DTI exceeds threshold", _CHECK_COLORS["red"]

    label = _escape(labels.get(key) or key.replace("_", " ").title())
    reason = result.get("reason")
    if status == "UNKNOWN":
        return f"Unable to determine {label.lower()} due to missing fields, see audit log", _CHECK_COLORS["gray"]
    if status == "FAIL":
        return _escape(reason) if reason else f"{label} needs attention", _CHECK_COLORS["red"]
    return _escape(reason) if reason else f"{label} checked", _CHECK_COLORS["green"]


def _assigned_team(item: dict, fields: dict) -> dict:
    team = dict(item.get("assigned_team") or {})
    for role_key, selectors in _TEAM_FIELD_SELECTORS.items():
        member = team.get(role_key)
        member_values = dict(member) if isinstance(member, dict) else {}
        for key, selector in selectors.items():
            value = fields.get(selector)
            if value:
                member_values[key] = value
        if member_values:
            team[role_key] = member_values
    return team


def _team_line(role_label: str, member: object, *, available: bool) -> str:
    label = f"<b>{_escape(role_label)}:</b>"
    if not available:
        return f"{label} Not available"
    if member is None or member is False or (isinstance(member, dict) and member.get("assigned") is False):
        return f"{label} Not assigned"
    if not isinstance(member, dict):
        return f"{label} Not available"

    reason_code = member.get("reason_code")
    if reason_code:
        if reason_code == "ONELOAN_ROLE_ASSIGNMENT_FAILED":
            return f"{label} Not assigned (OneLoan assignment failed)"
        if reason_code == "INVALID_EMPLOYEE_ID":
            return f"{label} Not assigned (employee ID unavailable)"
        if reason_code.startswith("NO_ELIGIBLE_"):
            return f"{label} Not assigned (no eligible team member)"
        if reason_code.startswith("PIPELINE_EXHAUSTED"):
            return f"{label} Not assigned (pipeline capacity reached)"

    name = member.get("name") or "Name unavailable"
    email = member.get("email") or "Email unavailable"
    return f"{label} {_escape(name)}, {_escape(email)}"


def generate_first_review_pdf(item: dict) -> bytes:
    """Render one processor-first-review record and return the PDF bytes.

    Expected input includes loan_number, loan_company, created_at, fields,
    results, and audit_log. Optional milestone_move_eligible enables an
    eligibility callout only when True. Optional assigned_team maps role keys to member
    records containing name, user_id, and email; IDs are used internally but
    omitted from displayed role lines.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
    )

    sample_styles = getSampleStyleSheet()
    body_style = sample_styles["BodyText"]
    check_style = ParagraphStyle("CheckResult", parent=body_style, spaceAfter=5)
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=sample_styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.white,
        backColor=colors.HexColor("#334155"),
        borderPadding=6,
        spaceBefore=20,
        spaceAfter=12,
        keepWithNext=True,
    )
    information_heading = ParagraphStyle(
        "LoanInformationHeading",
        parent=sample_styles["Heading4"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#334155"),
        backColor=colors.HexColor("#f1f5f9"),
        borderPadding=5,
        spaceBefore=18,
        spaceAfter=10,
        keepWithNext=True,
    )
    audit_style = ParagraphStyle("AuditLog", parent=sample_styles["Code"], fontSize=9, leading=11, leftIndent=0)

    fields = item.get("fields") or {}
    results = item.get("results") or {}
    labels = item.get("check_labels") or {}
    team = _assigned_team(item, fields)
    coborrower_name = _person_name(fields, _COBORROWER_FIRST_NAME, _COBORROWER_LAST_NAME)
    if (
        _COBORROWER_FIRST_NAME in fields
        and _COBORROWER_LAST_NAME in fields
        and not fields.get(_COBORROWER_FIRST_NAME)
        and not fields.get(_COBORROWER_LAST_NAME)
    ):
        coborrower_name = "N/A"
    story = [
        Paragraph("HELOAN Processor First Review", sample_styles["Title"]),
        Spacer(1, 0.15 * inch),
        Paragraph(f"<b>Loan Number:</b> {_escape(item.get('loan_number') or 'N/A')}", body_style),
        Paragraph(f"<b>Company:</b> {_escape(item.get('loan_company') or 'N/A')}", body_style),
        Paragraph(f"<b>Loan Type:</b> {_escape(item.get('loan_type') or fields.get('1401') or 'N/A')}", body_style),
        Paragraph(
            f"<b>Borrower:</b> {_escape(_person_name(fields, _BORROWER_FIRST_NAME, _BORROWER_LAST_NAME))}",
            body_style,
        ),
        Paragraph(
            f"<b>Co-Borrower:</b> {_escape(coborrower_name)}",
            body_style,
        ),
        Paragraph(f"<b>Check Completed:</b> {_escape(_format_datetime(item.get('created_at')))}", body_style),
        Paragraph("Assigned Team", section_heading),
    ]

    for role_key, role_label in _ASSIGNED_ROLES:
        story.append(Paragraph(
            _team_line(role_label, team.get(role_key), available=role_key in team),
            body_style,
        ))

    story.extend([
        Paragraph("First Review Checks", section_heading),
    ])

    for key, result in results.items():
        text, color = _check_finding(key, result, fields, labels)
        story.append(Paragraph(f"<font color='{color}'><b>{text}</b></font>", check_style))

    if not results:
        story.append(Paragraph(
            "No first-review check results were recorded",
            ParagraphStyle("MissingCheckResults", parent=body_style, textColor=colors.HexColor(_CHECK_COLORS["gray"])),
        ))

    if item.get("milestone_move_eligible") is True:
        story.append(Paragraph(
            f"<font color='{_CHECK_COLORS['green']}'><b>"
            "Eligible for automatic advancement to Underwriter"
            "</b></font>",
            check_style,
        ))

    story.extend([
        Paragraph("Loan Information", section_heading),
    ])
    for group_title, entries in _loan_information_groups(fields):
        group = [Paragraph(_escape(group_title), information_heading)]
        for label, value in entries:
            group.append(Paragraph(f"<b>{_escape(label)}:</b> {_escape(value)}", body_style))
        if group_title == "Borrower Profile":
            liabilities = _liabilities_to_pay_off(fields)
            label = "<b>Liabilities to be Paid Off:</b>"
            if not liabilities:
                value = "Not available" if liabilities is None else "None"
                group.append(Paragraph(f"{label} {value}", body_style))
            else:
                group.append(Paragraph(label, body_style))
                bullet_style = ParagraphStyle(
                    "LiabilityBullet", parent=body_style, leftIndent=12, bulletIndent=0,
                )
                for liability in liabilities:
                    group.append(Paragraph(_escape(liability), bullet_style, bulletText="\u2022"))
        story.append(KeepTogether(group))

    story.extend([
        Paragraph("Full Audit Trail", section_heading),
    ])
    for line in str(item.get("audit_log") or "").splitlines():
        if line.strip():
            story.append(Paragraph(_escape(line), audit_style))
        else:
            story.append(Spacer(1, audit_style.leading))
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    logger.info("Generated HELOAN processor first-review PDF for loan %s (%d bytes)", item.get("loan_number"), len(pdf_bytes))
    return pdf_bytes