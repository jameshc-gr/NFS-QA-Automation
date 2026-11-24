"""
Real-time email notification to the responsible Loan Officer and Mitch Michels
when a HELOAN loan receives a DECLINE recommendation from Prajna
"""

import html
import json
import logging
import os
import base64

from src.tools.email_tools import SendEmailTool
from src.tools.oneloan_tools import GetLoanTool
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

COMPANY_NAME = "Rate"
DECLINE_ESCALATION_EMAIL = "Mitch.Michels@rate.com"

async def _fetch_email_fields(encompass_guid: str, company_code: str) -> dict:
    """
    Fetch just the fields the LO/PM decline email needs: borrower name and the
    Loan Officer's email address. Everything else the template needs
    (loan number, decline reason) is already passed in by the caller.
    """
    raw = await GetLoanTool().execute({
        "loan_identifier": encompass_guid,
        "company": company_code,
        "requestedProperties": [
            "4000",  # Borrower.FirstName
            "4002",  # Borrower.LastName
            "LoanTeamMember.Email.Loan_Officer",
        ],
    })
    response = json.loads(raw)
    if not response.get("success"):
        raise RuntimeError(f"Failed to fetch loan fields for {encompass_guid} from OneLoan: {response}")
    return response.get("data", {})

def _resolve_team_recipients(fields: dict) -> list:
    
    recipients = []
    if fields.get("LoanTeamMember.Email.Loan_Officer"):
        recipients.append({"address": fields.get("LoanTeamMember.Email.Loan_Officer")})
    recipients.append({"address": DECLINE_ESCALATION_EMAIL})
    return recipients

def _render_decline_email(loan_number: str, decline_reason: str, fields: dict) -> str:
    """Render the LO/PM decline email template with real values."""
    template_path = os.path.join(os.path.dirname(__file__), "heloan-decline-simple.html")
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    logo_path = os.path.join(os.path.dirname(__file__), "assets", "rate-companies-2color.png")
    with open(logo_path, "rb") as f:
        logo_data_uri = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

    first_name = fields.get("4000") or ""
    last_name = fields.get("4002") or ""

    return (
        template
        .replace("{{ company.name }}", html.escape(COMPANY_NAME))
        .replace("{{Loan.LoanNumber}}", html.escape(str(loan_number)))
        .replace("{{Borrower.FirstName}}", html.escape(str(first_name)))
        .replace("{{Borrower.LastName}}", html.escape(str(last_name)))
        .replace("{{Loan.DeclineReason}}", html.escape(str(decline_reason)))
        .replace("assets/rate-companies-2color.png", logo_data_uri)
    )

async def send_member_decline_email(loan_number: str, encompass_guid: str, company_code: str, decline_reason: str) -> None:
    """
    Send a real-time decline notification email to the loan's responsible
    Loan Officer and Mitch Michels.
    """
    fields = await _fetch_email_fields(encompass_guid, company_code)

    recipients = _resolve_team_recipients(fields)
    body = _render_decline_email(loan_number, decline_reason, fields)

    send_result_raw = await SendEmailTool().execute({
        "body": body,
        "to": recipients,
        "from": {"name": "Digital Mortgage Systems MCP", "address": "no-reply@rate.com"},
        "subject": f"HELOAN #{loan_number} Declined",
    })
    send_result = json.loads(send_result_raw)
    if not send_result.get("success"):
        logger.error("Failed to send HELOAN member decline email for loan %s: %s", loan_number, send_result)
        raise RuntimeError("Failed to send member decline email")

    logger.info("Sent HELOAN member decline email for loan %s", loan_number)
    recipient_emails = ", ".join(r["address"] for r in recipients)
    logger.info(
        "Decline email record: recipients=%s, encompass_guid=%s, decision=%s, sent_at=%s, status=%s",
        recipient_emails,
        encompass_guid,
        "DECLINE",
        datetime.now(timezone.utc).isoformat(),
        "sent",
    )