import io
import logging
import re

from reportlab.lib import colors
from reportlab.lib import styles
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger()

_ASSIGNED_HEX = "#1a7f37"
_FAILED_HEX = "#c0392b"
_ALREADY_ASSIGNED_HEX = "#6b7280"
_FLAG_LINE_RE = re.compile(r"^([^:\n]+:\s*(?:True|False))(.*)$")
_STANDALONE_BOOL_RE = re.compile(r"\b(True|False)\b")

ROLE_DISPLAY = (
    ("uw", "Underwriter"),
    ("processor", "Processor/Loan Coordinator"),
    ("cc", "Closing Coordinator"),
)

_FAILURE_REASON_DISPLAY = {
    "NO_ELIGIBLE_UW": "no eligible team member on the roster matches this loan's attributes",
    "NO_ELIGIBLE_PROCESSOR": "no eligible team member on the roster matches this loan's attributes",
    "NO_ELIGIBLE_CC": "no eligible team member on the roster matches this loan's attributes",
    "PIPELINE_EXHAUSTED": "every eligible team member is at their maximum pipeline size",
    "PIPELINE_EXHAUSTED_PROCESSOR": "every eligible team member is at their maximum pipeline size",
    "PIPELINE_EXHAUSTED_CC": "every eligible team member is at their maximum pipeline size",
    "ONELOAN_ROLE_ASSIGNMENT_FAILED": "a team member was selected but the assignment could not be written to OneLoan",
    "INVALID_EMPLOYEE_ID": "a team member was selected but has no valid employee ID for OneLoan assignment",
}

# Duplicated from handler.py's ATTRIBUTE_TO_ROSTER_COLUMN
ATTRIBUTE_TO_ROSTER_COLUMN = {
    "language_preference_flag": "Language Preference",
    "chairmans_club_flag": "Chairmans Club",
    "presidents_club_flag": "Presidents Club",
    "loan_amount_over_400k_flag": "Loan Amount Over 400k",
    "self_employed_flag": "Self Employed",
    "multiple_employers_flag": "Multiple Employers",
    "multiple_properties_flag": "Multiple Properties",
    "investment_second_home_flag": "Investment Second Home",
    "multi_family_flag": "Multi Family",
    "condo_flag": "Condo",
    "retail_flag": "Retail",
    "employee_loan_access_flag": "Employee Loan Access",
}

def _escape(text: str) -> str:
    """Escape XML-special chars so a name/userid/reason_code can't break
    Paragraph's markup parsing."""
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def _escape_audit_log(audit_log: str) -> str:
    """Prep raw audit_log text for Paragraph: escape XML-special chars so
    stray '&'/'<'/'>' in a log message don't break parsing, then convert
    literal newlines to <br/> so each log entry still lands on its own line."""
    lines = (audit_log or "").split("\n")
    escaped_lines = []
    for line in lines:
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        match = _FLAG_LINE_RE.match(escaped)
        if match:
            escaped = f"<b>{match.group(1)}</b>{match.group(2)}"
        else:
            escaped = _STANDALONE_BOOL_RE.sub(lambda m: f"<b>{m.group(1)}</b>", escaped, count=1)
        escaped_lines.append(escaped)
    return "<br/>".join(escaped_lines)


def _format_datetime(created_at_iso: str) -> str:
    from datetime import datetime
    dt = datetime.fromisoformat(created_at_iso)
    return dt.strftime("%B %d, %Y, %I:%M %p UTC")

def _role_summary_line(role_label: str, result: dict) -> tuple[str, str]:
    """Build the (text, color_hex) pair for one role's summary line, per the
    scheme: clean success, resubmission, success-via-fallback-pool, already-assigned
    (Processor/CC only), or failure. `result` is the {"id", "name",
    "reason_code"} dict produced by handler.py's _assign_role for this role."""
    name = _escape(result.get("name") or "")
    userid = _escape(result.get("id") or "")
    reason_code = result.get("reason_code")

    if reason_code == "SKIPPED_BY_REQUEST":
        text = f"Skipped {role_label} assignment by request"
        color_hex = _ALREADY_ASSIGNED_HEX
    elif reason_code == "ALREADY_ASSIGNED":
        text = f"Already assigned to {name} ({userid}), didn't assign new {role_label}"
        color_hex = _ALREADY_ASSIGNED_HEX
    elif reason_code is None:
        text = f"Assigned to {role_label} {name} ({userid})"
        color_hex = _ASSIGNED_HEX
    elif reason_code == "DAILY_CAP_EXCEEDED_FALLBACK":
        text = f"Assigned to {role_label} {name} ({userid}), using fallback pool"
        color_hex = _ASSIGNED_HEX
    elif reason_code == "ASSIGNED_FROM_RESUBMISSION_POOL":
        text = f"Assigned to {role_label} {name} ({userid}), using resubmission pool"
        color_hex = _ASSIGNED_HEX
    else:
        reason_text = _FAILURE_REASON_DISPLAY.get(reason_code)
        if reason_text:
            text = f"Failed to assign {role_label}: {reason_text} ({_escape(reason_code)})"
        else:
            text = f"Failed to assign {role_label} due to {_escape(reason_code)}"
        color_hex = _FAILED_HEX

    return text, color_hex


def _attributes_table(attributes: dict) -> Table:
    rows = [["Attribute", "Value"]]
    for key, label in ATTRIBUTE_TO_ROSTER_COLUMN.items():
        value = "Yes" if attributes.get(key) else "No"
        rows.append([label, value])

    table = Table(rows, repeatRows=1, hAlign="LEFT", colWidths=[3 * inch, 1 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def generate_assignment_pdf(item: dict) -> bytes:
    """Render one heloan_pipeline_assignment_audit row into a PDF report and
    return the raw bytes. `item` carries the same fields as the audit table
    row."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    body_style = styles["BodyText"]
    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading3"],
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
    audit_log_style = ParagraphStyle("AuditLog", parent=styles["Code"], fontSize=9, leading=11, leftIndent=0, rightIndent=0)
    
    when = _format_datetime(item["created_at"])
    results = item.get("results") or {}

    summary_paragraphs = []
    for key, role_label in ROLE_DISPLAY:
        text, color_hex = _role_summary_line(role_label, results.get(key) or {})
        summary_paragraphs.append(Paragraph(f"<b><font color='{color_hex}'>{text}</font></b>", body_style))
    summary_paragraphs.append(Paragraph(f"<b>Assignment happened at {when}</b>", body_style))

    story = [
        Paragraph("HELOAN Pipeline Assignment Report", styles["Title"]),
        Spacer(1, 0.15 * inch),
        Paragraph(f"<b>Loan Number:</b> {item.get('loan_number', 'N/A')}", body_style),
        Paragraph(f"<b>Company:</b> {item.get('loan_company', 'N/A')}", body_style),
        Paragraph(f"<b>Loan Type:</b> {_escape(item.get('loan_type') or 'N/A')}", body_style),
        *summary_paragraphs,
        Paragraph("Loan Attributes", section_heading_style),
        _attributes_table(item.get("attributes") or {}),
        Paragraph("Full Audit Trail", section_heading_style),
    ]
    for line in (item.get("audit_log") or "").split("\n"):
        if line.strip():
            story.append(Paragraph(_escape_audit_log(line), audit_log_style))
        else:
            story.append(Spacer(1, audit_log_style.leading))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    logger.info("Generated HELOAN pipeline assignment PDF for loan %s (%d bytes)", item.get("loan_number"), len(pdf_bytes))
    return pdf_bytes