"""
MyAccount tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_internal_service_auth_token, get_oneloan_auth_token
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class GetBorrowerLoansTool(BaseTool):
    """ Tool to retrieve loan(s) information for a borrower by borrower entity ID """

    def __init__(self):
        super().__init__(
            name="get_borrower_loans",
            description="Retrieve loan(s) information for a borrower by borrower entity ID",
            input_schema={
                "type": "object",
                "properties": {
                    "user-id": {
                        "type": "string", 
                        "description": "The ID of the borrower entity"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the borrower"
                    }
                },
                "required": ["user-id", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute borrower loan(s) retrieval """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: user-id, company-name"}, indent=2)
        
        domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")

        if not domain: 
            return json.dumps({
                "success": False,
                "error": "MyAccount Service domain not configured. Please set MYACCOUNT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/v2/mortgage/loans?user-id={arguments.get("user-id")}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name"),
            "originating-application": "dm-mcp"
        }

        try:
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve borrower loan(s)", e, logger=logger)
        

class GetBorrowerLoansByEmailTool(BaseTool):
    """ This tool combines the functionality of search_borrower_entity and get_borrower_loans allowing the caller to retrieve loan(s) information for a borrower by email in a single request """

    def __init__(self):
        super().__init__(
            name="get_borrower_loans_by_email",
            description="Retrieve loan(s) information for a borrower by email",
            input_schema={
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string", 
                        "description": "The email of the borrower"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the borrower"
                    }
                },
                "required": ["email", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute borrower loan retrieval """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: email, company-name"}, indent=2)
        
        borrower_domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")
        myaccount_domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")

        if not borrower_domain:
            return json.dumps({
                "success": False,
                "error": "Borrower Entity Service domain not configured. Please set BORROWER_ENTITY_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        if not myaccount_domain:
            return json.dumps({
                "success": False,
                "error": "MyAccount Service domain not configured. Please set MYACCOUNT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{borrower_domain}/borrower/search"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name")
        }

        try:
            result = requests.post(url, json=arguments, headers=headers)
            result.raise_for_status()
            borrower_entity_id = result.json()["borrower-guid"]

        except requests.RequestException as e:
            return sanitized_error("Failed to search borrower entity", e, logger=logger)
        
        
        url = f"{myaccount_domain}/api/v2/mortgage/loans?user-id={borrower_entity_id}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name"),
            "originating-application": "dm-mcp"
        }

        def _extract_loan_status_fields(loan: Dict) -> Dict:
            """Extract comprehensive loan status fields for borrower communications."""
            def get_custom_field(field_name: str) -> Optional[Any]:
                for cf in loan.get("customFields", []):
                    if cf.get("fieldName") == field_name:
                        return cf.get("stringValue")
                return None

            def get_nested(obj: Any, path: str) -> Any:
                for key in path.split("."):
                    if isinstance(obj, dict):
                        obj = obj.get(key)
                    else:
                        return None
                return obj

            def get_borrower_info() -> Dict[str, Optional[str]]:
                apps = loan.get("applications", [])
                borrower = apps[0].get("borrower", {}) if apps else {}
                first_name = borrower.get("firstName")
                last_name = borrower.get("lastName")
                full_name = borrower.get("name") or " ".join(
                    part for part in [first_name, last_name] if part
                ).strip()
                if not full_name:
                    full_name = None
                return {
                    "borrowerName": full_name,
                    "borrowerEmail": borrower.get("emailAddressText") or borrower.get("email"),
                }

            def get_loan_officer_info() -> Dict[str, Optional[str]]:
                for milestone in loan.get("milestoneLogs", []):
                    associate = milestone.get("loanAssociate") or {}
                    if associate.get("roleName") == "Loan Officer":
                        return {
                            "loanOfficerName": associate.get("name"),
                            "loanOfficerEmail": associate.get("email"),
                            "loanOfficerPhone": associate.get("phone"),
                        }
                return {
                    "loanOfficerName": None,
                    "loanOfficerEmail": None,
                    "loanOfficerPhone": None,
                }

            borrower_info = get_borrower_info()
            loan_officer_info = get_loan_officer_info()

            return {
                **borrower_info,
                **loan_officer_info,
                "basic_loan_status": {
                    "loanNumber": loan.get("loanNumber"),
                    "milestoneCurrentName": loan.get("milestoneCurrentName"),
                    "milestoneStage": loan.get("milestoneStage"),
                    "milestoneCurrentDateUtc": loan.get("milestoneCurrentDateUtc"),
                    "milestoneNextName": loan.get("milestoneNextName"),
                    "milestoneLogs": [
                        {
                            "stage": m.get("stage"),
                            "doneIndicator": m.get("doneIndicator"),
                            "dateUtc": m.get("dateUtc"),
                            "loanAssociate": m.get("loanAssociate"),
                        }
                        for m in loan.get("milestoneLogs", [])
                    ],
                },
                "expected_dates": {
                    "submitted": loan.get("milestoneSubmittedDueDate"),
                    "approved": loan.get("milestoneApprovedDueDate"),
                    "doc_signed": loan.get("milestoneDocSignedDueDate"),
                    "funded": loan.get("milestoneFundedDueDate"),
                    "completed": loan.get("milestoneCompletedDueDate"),
                },
                "underwriting_approval_status": {
                    "processing": get_custom_field("CX.STATUS.PROCESSING"),
                    "app_fee_collected": get_custom_field("CX.STATUS.APPFEECOLLECTED"),
                    "assigned_uw": get_custom_field("CX.STATUS.ASSIGNED.UW"),
                    "submittal": get_custom_field("CX.STATUS.SUBMITTAL"),
                    "uw_decision_expected": get_custom_field("CX.LOGUWDECEXP"),
                    "conditions_uw": get_custom_field("CX.STATUS.CONDITIONS.UW"),
                    "uw_app_status": get_custom_field("CX.UWAPPSTAT"),
                    "aus_status": get_custom_field("CX.AUS.STATUS"),
                },
                "condition_summary": {
                    "open_count": get_nested(loan, "virtualFields.UWC.OPENCOUNT"),
                    "open_external_count": get_nested(loan, "virtualFields.UWC.OPENEXTERNALCOUNT"),
                    "received_count": get_nested(loan, "virtualFields.UWC.RECEIVEDCOUNT"),
                    "reviewed_count": get_nested(loan, "virtualFields.UWC.REVIEWEDCOUNT"),
                    "cleared_count": get_nested(loan, "virtualFields.UWC.CLEAREDCOUNT"),
                    "waived_count": get_nested(loan, "virtualFields.UWC.WAIVEDCOUNT"),
                    "rejected_count": get_nested(loan, "virtualFields.UWC.REJECTEDCOUNT"),
                    "prior_to_doc_count": get_nested(loan, "virtualFields.UWC.PTDCOUNT"),
                    "prior_to_purchase_count": get_nested(loan, "virtualFields.UWC.PTPCOUNT"),
                    "prior_to_approval_count": get_nested(loan, "virtualFields.UWC.PTACOUNT"),
                },
                "conditions": [
                    {
                        "id": c.get("id"),
                        "title": c.get("title"),
                        "description": c.get("description"),
                        "status": c.get("status"),
                        "statusText": c.get("statusText") or c.get("statusDescription"),
                        "priorTo": c.get("priorTo"),
                        "owner": c.get("owner"),
                        "borrowerFacing": c.get("borrowerFacing"),
                        "requestedFrom": c.get("requestedFrom"),
                        "requestedDate": c.get("requestedDate"),
                        "dueDate": c.get("dueDate"),
                        "receivedDate": c.get("receivedDate"),
                        "reviewedDate": c.get("reviewedDate"),
                        "clearedDate": c.get("clearedDate"),
                        "waivedDate": c.get("waivedDate"),
                        "rejectedDate": c.get("rejectedDate"),
                        "rejectedReason": c.get("rejectedReason"),
                        "commentsBorrowerSafe": c.get("commentsBorrowerSafe"),
                    }
                    for c in loan.get("underwritingConditionLogs", [])
                ],
                "documents": [
                    {
                        "id": d.get("id"),
                        "name": d.get("name"),
                        "type": d.get("type"),
                        "status": d.get("status"),
                        "requestedFrom": d.get("requestedFrom"),
                        "requestedDate": d.get("requestedDate"),
                        "dueDate": d.get("dueDate"),
                        "receivedDate": d.get("receivedDate"),
                        "acceptedDate": d.get("acceptedDate"),
                        "rejectedDate": d.get("rejectedDate"),
                        "rejectedReason": d.get("rejectedReason"),
                        "borrowerFacing": d.get("borrowerFacing"),
                    }
                    for d in loan.get("documents", [])
                ],
            }

        try:
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            loans = result.json()
            loan_list = loans.get("data", []) if isinstance(loans, dict) else loans

            oneloan_domain = os.getenv("ONELOAN_DOMAIN")
            if not oneloan_domain:
                return json.dumps({
                    "success": False,
                    "error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."
                }, indent=2)

            company = (arguments.get("company-name") or "").lower()
            if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
                company = "gri"
            oneloan_access_token = get_oneloan_auth_token(company)
            oneloan_headers = {
                "Authorization": f"Bearer {oneloan_access_token}",
                "X-GR-Company": company,
            }

            enriched_loans = []
            lookup_errors = []
            for loan in loan_list:
                loan_number = loan.get("loanNumber")
                loan_milestone = loan.get("loanMilestone")
                if not loan_number:
                    lookup_errors.append({
                        "loanMilestone": loan_milestone,
                        "error": "Loan number missing from MyAccount response",
                    })
                    continue

                oneloan_url = f"{oneloan_domain}/real-time-read/v1/loan/{loan_number}"
                try:
                    oneloan_result = requests.get(oneloan_url, headers=oneloan_headers, timeout=30)
                    oneloan_result.raise_for_status()
                    oneloan_data = oneloan_result.json()
                    loan_obj = oneloan_data.get("data", oneloan_data)
                    if isinstance(loan_obj, dict):
                        loan_obj = loan_obj.get("loan", loan_obj)

                    enriched_loans.append({
                        "loanMilestone": loan_milestone,
                        "loanNumber": loan_number,
                        "milestoneFileStartedDate": loan_obj.get("milestoneFileStartedDate") if isinstance(loan_obj, dict) else None,
                        "loanStatus": _extract_loan_status_fields(loan_obj if isinstance(loan_obj, dict) else {}),
                    })
                except requests.RequestException as ex:
                    logger.error(
                        "Failed to fetch OneLoan details for loan %s", loan_number, exc_info=ex
                    )
                    lookup_errors.append({
                        "loanNumber": loan_number,
                        "loanMilestone": loan_milestone,
                        "error": "Failed to fetch OneLoan details",
                    })

            def _loan_recency_key(loan_item: Dict[str, Any]) -> str:
                status = loan_item.get("loanStatus", {}) if isinstance(loan_item, dict) else {}
                basic = status.get("basic_loan_status", {}) if isinstance(status, dict) else {}
                expected = status.get("expected_dates", {}) if isinstance(status, dict) else {}
                return (
                    loan_item.get("milestoneFileStartedDate")
                    or basic.get("milestoneCurrentDateUtc")
                    or expected.get("funded")
                    or expected.get("completed")
                    or ""
                )

            most_recent_loan = max(enriched_loans, key=_loan_recency_key) if enriched_loans else None

            return json.dumps(
                {
                    "success": True,
                    "data": most_recent_loan,
                    "partial_errors": lookup_errors,
                },
                indent=2,
            )

        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve borrower loan(s)", e, logger=logger)
        

class GetMortgageGuids(BaseTool):
    """ Tool to retrieve a list of mortgage GUIDs for a user by their ID from MYA """

    def __init__(self):
        super().__init__(
            name="get_mortgage_guids",
            description="Tool to retrieve mortgage GUIDs for a user by their ID from MYA",
            input_schema={
                "type": "object",
                "properties": {
                    "user-id": {
                        "type": "string",
                        "description": "The ID of the borrower entity to retrieve mortgage GUIDs for"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the borrower"
                    }
                },
                "required": ["user-id", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute mortgage GUID retrieval
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: user-id, company-name"}, indent=2)

        domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")
        if not domain:
            return json.dumps({
                "success": False,
                "error": "MyAccount Service domain not configured. Please set MYACCOUNT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/v2/mortgage/guids?user-id={arguments.get('user-id')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name"),
            "originating-application": "dm-mcp"
        }

        try:
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve mortgage GUIDs", e, logger=logger)
        

class GetMortgageNumbers(BaseTool):
    """ Tool to retrieve a list of mortgage numbers for a user by their ID from MYA """

    def __init__(self):
        super().__init__(
            name="get_mortgage_numbers",
            description="Tool to retrieve mortgage numbers for a user by their ID from MYA",
            input_schema={
                "type": "object",
                "properties": {
                    "user-id": {
                        "type": "string",
                        "description": "The ID of the borrower entity to retrieve mortgage numbers for"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the borrower"
                    }
                },
                "required": ["user-id", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute mortgage numbers retrieval
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: user-id, company-name"}, indent=2)

        domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")
        if not domain:
            return json.dumps({
                "success": False,
                "error": "MyAccount Service domain not configured. Please set MYACCOUNT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/v2/mortgage/numbers?user-id={arguments.get('user-id')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name"),
            "originating-application": "dm-mcp"
        }

        try:
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve mortgage numbers", e, logger=logger)