import io
import logging
import html

from reportlab.lib import colors
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

_PASS_HEX = "#1a7f37"
_DECLINE_HEX = "#c0392b"
_REVIEW_HEX = "#f0c000"
_FROZEN_HEX = "#52a85d"
_DEFAULT_HEX = "#333333"


def _decision_hex(decision: str) -> str:
    decision = (decision or "").strip().upper()
    if decision == "PASS, FLAG AS FROZEN":
        return _FROZEN_HEX
    if decision == "PASS":
        return _PASS_HEX
    if decision == "DECLINE":
        return _DECLINE_HEX
    if decision == "NEEDS REVIEW" or decision == "FLAG":
        return _REVIEW_HEX
    return _DEFAULT_HEX


def _decision_color(decision: str):
    return colors.HexColor(_decision_hex(decision))


def _liabilities_table(liabilities: list, available_width: float) -> Table:
    """Dynamically build a liabilities table based on all available fields in the data.
    
    Standard columns appear first (creditor_name, type, decision), followed by any
    additional fields present in the liabilities data. This allows flexibility to handle
    different rule outputs (e.g., some rules have payment_pattern_excerpt, others have
    unpaid_balance_amt, monthly_payment_amt, status, etc.).
    """
    cell_style = ParagraphStyle("LiabilityCell", fontName="Helvetica", fontSize=7, leading=9)
    header_style = ParagraphStyle("LiabilityHeader", fontName="Helvetica-Bold", fontSize=7, leading=9)

    if not liabilities:
        return Table([["No liabilities data"]])
    
    # Standard columns that should always appear first
    standard_columns = ["creditor_name", "type", "decision"]
    
    # Collect all available fields across all liabilities items
    all_fields = set()
    for item in liabilities:
        all_fields.update(item.keys())
    
    # Build column list: standard columns first, then other fields alphabetically
    other_columns = sorted(all_fields - set(standard_columns))
    columns = standard_columns + other_columns
    decision_col = columns.index("decision")

    # Create header row with formatted column names
    header = [Paragraph(col.replace("_", " ").title(), header_style) for col in columns]
    rows = [header]
    
    # Add data rows
    for item in liabilities:
        row = []
        for col_idx, col in enumerate(columns):
            value = item.get(col, "")
            # Format values for display
            if isinstance(value, float):
                text = f"${value:,.2f}" if value else ""
            elif isinstance(value, str) and "T00:00:00" in value:
                # Format ISO dates to simple date format
                text = value.split("T")[0]
            else:
                text = str(value)

            escaped_text = html.escape(text)
            if col_idx == decision_col and text:
                row.append(Paragraph(f"<font color='{_decision_hex(text)}'>{escaped_text}</font>", cell_style))
            else:
                row.append(Paragraph(escaped_text, cell_style))
        rows.append(row)

    col_width = available_width / len(columns)
    table = Table(rows, colWidths=[col_width] * len(columns), repeatRows=1, hAlign="LEFT")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    
    table.setStyle(TableStyle(style))
    return table


def generate_decision_pdf(prajna_result: dict) -> bytes:
    """Render a Prajna HELOAN credit decision result into a PDF report and return the raw bytes."""
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
    rule_heading_style = ParagraphStyle("RuleHeading", parent=styles["Heading3"], spaceBefore=12, spaceAfter=4)
    body_style = styles["BodyText"]

    story = [
        Paragraph("HELOAN Credit Decision Report", styles["Title"]),
        Spacer(1, 0.15 * inch),
        Paragraph(f"Loan Number: {prajna_result.get('loan_number', 'N/A')}", body_style),
        Paragraph(f"Company: {prajna_result.get('company', 'N/A')}", body_style),
        Paragraph(f"Latest Credit Report Date: {prajna_result.get('latest_credit_report_date', 'N/A')}", body_style),
        Paragraph(f"Loan Application Date: {prajna_result.get('loan_application_date', 'N/A')}", body_style),
        Paragraph(f"Heloan Credit Decision Report Date: {prajna_result.get('heloan_credit_decision_report_date', 'N/A')}", body_style),
        Paragraph(
            f"<b>Overall Decision: "
            f"<font color='{_decision_hex(prajna_result.get('overall_decision'))}'>"
            f"{prajna_result.get('overall_decision', 'N/A')}</font></b>",
            body_style,
        ),
        Spacer(1, 0.2 * inch),
    ]

    for rule in prajna_result.get("rules", []):
        rule_id = rule.get("rule_id", "Unnamed Rule")
        decision = rule.get("decision", "N/A")
        color_hex = _decision_hex(decision)
        story.append(
            Paragraph(
                f"{rule_id} &mdash; <font color='{color_hex}'><b>{decision}</b></font>",
                rule_heading_style,
            )
        )

        proposed_reason = rule.get("proposed_decline_reason")
        if proposed_reason:
            story.append(Paragraph(f"<i>Reason: {proposed_reason}</i>", body_style))

        output_for_pdf = rule.get("output_for_pdf")
        if output_for_pdf:
            # Prajna sends embedded newlines in this field; convert to <br/> for reportlab
            story.append(Paragraph(output_for_pdf.replace("\n", "<br/>"), body_style))

        liabilities = rule.get("liabilities")
        if liabilities:
            story.append(Spacer(1, 0.05 * inch))
            story.append(_liabilities_table(liabilities, doc.width))

        story.append(Spacer(1, 0.1 * inch))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    logger.info("Generated HELOAN decision PDF (%d bytes)", len(pdf_bytes))
    return pdf_bytes
