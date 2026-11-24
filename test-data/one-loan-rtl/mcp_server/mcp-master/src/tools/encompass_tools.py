"""
Encompass tools for MCP server
"""

import os
import json
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict, List
from datetime import datetime, timezone
from dotenv import load_dotenv
from ..internal_service_auth import get_encompass_auth_token, get_internal_service_auth_token
from .oneloan_tools import _extract_requested_fields

load_dotenv()

logger = logging.getLogger(__name__)

LO_EMAIL_DOMAIN_TO_COMPANY = {
    "owning.com": "owning",
    "rate.com": "gri",
    "citywidehm.com": "cwhm",
    "onqhomeloans.com": "qhl",
    "grarate.com": "gra",
    "certaintyhomelending.com": "certainty",
    "kbhshomeloans.com": "kbhs",
    "originpoint.com": "op",
}


def _company_from_lo_email(lo_email: str) -> str | None:
    """Map a loan officer's email domain to its company alias, or None if unrecognized."""
    _, _, domain = (lo_email or "").strip().lower().rpartition("@")
    return LO_EMAIL_DOMAIN_TO_COMPANY.get(domain)


def _format_encompass_loan_response(api_response: Dict[str, Any], requested: List[str] | None) -> Dict[str, Any]:
    if not requested:
        return {"success": True, "data": api_response}

    data = _extract_requested_fields(api_response, requested)
    return {"success": True, "data": data}


def _latest_started_loan(myaccount_response: Any) -> Dict[str, Any] | None:
    """Select the borrower's loan with the newest startedDate from a MyAccount response."""
    loans = myaccount_response.get("data", []) if isinstance(myaccount_response, dict) else myaccount_response
    if not isinstance(loans, list) or not loans:
        return None

    def started_at(loan: Dict[str, Any]) -> datetime:
        value = loan.get("startedDate")
        if not isinstance(value, str) or not value:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    return max((loan for loan in loans if isinstance(loan, dict)), key=started_at, default=None)


class GetEncompassLoan(BaseTool):
    """ Tool to retrieve a loan from Encompass, will return entire loan object unless specific fields IDs are requested """

    def __init__(self):
        super().__init__(
            name="get_encompass_loan",
            description="Retrieves a loan from Encompass, optionally specific Encompass field IDs",
            input_schema={
                "type": "object",
                "properties": {
                    "loanId": {
                        "type": "string", 
                        "description": "The ID of the Encompass loan to retrieve"
                    },
                    "requestedProperties": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "Optional list of Encompass field IDs or property names to retrieve (e.g. ['4000', '1389', '231', 'FL0102', 'FR0112', 'CX.LOCODE.1', 'UnderwritingConditionLogs']). Accepts numeric/IRS/NEWHUD field IDs, CX.* custom fields, collection patterns (FL/BR/BE/DD/FM/...), and PascalCase/camelCase property names. If omitted, the full loan object is returned."
                    }
                },
                "required": ["loanId"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute Encompass loan retrieval
        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required arguments: loanId"},
                indent=2
            )

        domain = os.getenv("ENCOMPASS_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Encompass domain not configured. Please set ENCOMPASS_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/encompass/v1/loans/{arguments['loanId']}"
        access_token = get_encompass_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            api_response = response.json()
            requested = arguments.get("requestedProperties")
            return json.dumps(_format_encompass_loan_response(api_response, requested), indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch loan from Encompass", e, logger=logger)


class GetEncompassLoanByEmail(BaseTool):
    """Tool to retrieve the most recent Encompass loan by the borrower's email address. """

    def __init__(self):
        super().__init__(
            name="get_encompass_loan_by_email",
            description="Retrieves an Encompass loan by the borrower's email address",
            input_schema={
                "type": "object",
                "properties": {
                    "borrowerEmail": {
                        "type": "string", 
                        "description": "The borrower's email address"
                    },
                    "loEmail": {
                        "type": "string",
                        "description": "The email of the loan officer (used to deduce the company of the borrower)"
                    },
                    "requestedProperties": {
                        "type": "array",
                        "description": "The list of requested properties to retrieve from the loan",
                        "items": {"type": "string"}
                    }
                },
                "required": ["borrowerEmail", "loEmail"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"success": False, "error": "Missing required arguments: borrowerEmail, loEmail"}, indent=2)

        borrower_domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")
        myaccount_domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")
        encompass_domain = os.getenv("ENCOMPASS_DOMAIN")
        if not borrower_domain:
            return json.dumps({"success": False, "error": "Borrower Entity Service domain is not configured"}, indent=2)
        if not myaccount_domain:
            return json.dumps({"success": False, "error": "MyAccount Service domain is not configured"}, indent=2)
        if not encompass_domain:
            return json.dumps({"success": False, "error": "Encompass domain is not configured"}, indent=2)

        company = _company_from_lo_email(arguments["loEmail"])
        if not company:
            return json.dumps({"success": False, "error": "Unable to determine company from loEmail domain"}, indent=2)
        try:
            borrower_response = requests.post(
                f"{borrower_domain}/borrower/search",
                json={"email": arguments["borrowerEmail"], "company-name": company},
                headers={
                    "Authorization": f"Bearer {get_internal_service_auth_token()}",
                    "company": company,
                },
            )
            borrower_response.raise_for_status()
            borrower_entity_id = borrower_response.json().get("borrower-guid")
            if not borrower_entity_id:
                return json.dumps({"success": False, "error": "Borrower entity was not found for the supplied email"}, indent=2)
        except requests.RequestException as exc:
            return sanitized_error("Failed to search borrower entity", exc, logger=logger)
        except (ValueError, AttributeError) as exc:
            return sanitized_error("Invalid borrower entity response", exc, logger=logger)

        try:
            myaccount_response = requests.get(
                f"{myaccount_domain}/api/v2/mortgage/loans",
                params={"user-id": borrower_entity_id},
                headers={
                    "Authorization": f"Bearer {get_internal_service_auth_token()}",
                    "company": company,
                    "originating-application": "dm-mcp",
                },
            )
            myaccount_response.raise_for_status()
            myaccount_data = myaccount_response.json()
        except requests.RequestException as exc:
            return sanitized_error("Failed to retrieve borrower loans", exc, logger=logger)
        except ValueError as exc:
            return sanitized_error("Invalid MyAccount loans response", exc, logger=logger)

        latest_loan = _latest_started_loan(myaccount_data)
        if latest_loan is None:
            return json.dumps({"success": False, "error": "No loans found for borrower"}, indent=2)
        loan_guid = latest_loan.get("loanGuid")
        if not loan_guid:
            return json.dumps({"success": False, "error": "The most recent borrower loan has no Encompass loan ID"}, indent=2)
        logger.info(f"Latest loan GUID: {loan_guid}")

        try:
            encompass_response = requests.get(
                f"{encompass_domain}/encompass/v1/loans/{loan_guid}",
                headers={"Authorization": f"Bearer {get_encompass_auth_token()}"},
            )
            encompass_response.raise_for_status()
            api_response = encompass_response.json()
            return json.dumps(
                _format_encompass_loan_response(api_response, arguments.get("requestedProperties")),
                indent=2,
            )
        except requests.RequestException as exc:
            return sanitized_error("Failed to fetch loan from Encompass", exc, logger=logger)
        except ValueError as exc:
            return sanitized_error("Invalid Encompass loan response", exc, logger=logger)
