""" 
Enterprise Credit Services (ECS) tools for MCP server
"""

import json
import os
import logging
import re
import requests

from src.internal_service_auth import get_internal_service_auth_token
from src.tools.oneloan_tools import GetLoanTool 
from .base import BaseTool, sanitized_error
from typing import Any, Dict

logger = logging.getLogger(__name__)


def _is_missing_borrower_information(response: requests.Response | None) -> bool:
    if response is None or response.status_code != 400:
        return False
    try:
        body = response.json()
    except (ValueError, TypeError):
        return False
    errors = body.get("errors") if isinstance(body, dict) else None
    return (
        isinstance(errors, dict)
        and bool(errors)
        and all(
            isinstance(field, str)
            and re.fullmatch(r"Borrowers\[[01]\]\.[A-Za-z0-9_.]+", field, re.IGNORECASE)
            and isinstance(messages, list)
            and bool(messages)
            and all(
                isinstance(message, str) and re.search(r"\bmust not be empty\b", message, re.IGNORECASE)
                for message in messages
            )
            for field, messages in errors.items()
        )
    )


class GetECSCreditTool(BaseTool):
    """ Tool to get ECS credit information for a particular loan """

    def __init__(self):
        super().__init__(
            name="get_ecs_credit",
            description="Get ECS credit information for a particular loan by its loan number",
            input_schema={
                "type": "object",
                "properties": {
                    "loan_number": {
                        "type": "string",
                        "description": "The loan number to search for ECS credit information."
                    }
                },
                "required": ["loan_number"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute credit information retrieval
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required argument: loan_number"}, indent=2)
        
        domain = os.getenv("ECS_DOMAIN")
        auth_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {auth_token}"
        }

        if not domain:
            return json.dumps({
                "success": False,
                "error": "ECS domain not configured. Please set ECS_DOMAIN environment variable."
            }, indent=2)

        try:
            response = requests.get(f"{domain}/api/v1/credit/details/{arguments["loan_number"]}", headers=headers)
            response.raise_for_status()
            response_data = response.json()
            if response_data.get("status") == "Error":
                logger.error("ECS get credit returned an error status: %s", response_data)
                return json.dumps({"success": False, "error": "ECS get credit returned an error status", "data": response_data}, indent=2)
            return json.dumps({"success": True, "data": response_data}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to get ECS credit information", e, logger=logger)


class GetECSCreditByReferenceTool(BaseTool):
    """ Tool to get ECS credit information by credit reference identifier """

    def __init__(self):
        super().__init__(
            name="get_ecs_credit_by_reference",
            description="Get ECS credit information using a credit reference identifier",
            input_schema={
                "type": "object",
                "properties": {
                    "credit_reference_identifier": {
                        "type": "string",
                        "description": "The credit reference identifier returned from a credit pull (e.g., '4213060641PQ')"
                    }
                },
                "required": ["credit_reference_identifier"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute credit information retrieval by reference
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required argument: credit_reference_identifier"}, indent=2)
        
        domain = os.getenv("ECS_DOMAIN")
        auth_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"******"
        }

        if not domain:
            return json.dumps({
                "success": False,
                "error": "ECS domain not configured. Please set ECS_DOMAIN environment variable."
            }, indent=2)

        try:
            response = requests.get(f"{domain}/api/v1/credit/CreditReport/{arguments["credit_reference_identifier"]}", headers=headers)
            response.raise_for_status()
            response_data = response.json()
            if response_data.get("status") == "Error":
                logger.error("ECS get credit by reference returned an error status: %s", response_data)
                return json.dumps({"success": False, "error": "ECS get credit by reference returned an error status", "data": response_data}, indent=2)
            return json.dumps({"success": True, "data": response_data}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to get ECS credit information by reference", e, logger=logger)


class ReissueCreditTool(BaseTool):
    """ Tool to reissue ECS credit for a specified loan """

    def __init__(self):
        super().__init__(
            name="reissue_credit",
            description="Reissue ECS credit for a specified loan",
            input_schema={
                "type": "object",
                "properties": {
                    "loanId": {
                        "type": "string", 
                        "description": "Loan identifier for which to reissue credit"
                    },
                    "company": {
                        "type": "string", 
                        "description": "Company name associated with the loan"
                    }
                },
                "required": ["loanId", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute credit reissue logic
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loanId, company"}, indent=2)

        # Grab required reissue information via OneLoan
        try:
            result = await GetLoanTool().execute({
                "loan_identifier": arguments["loanId"],
                "company": arguments["company"],
                "requestedProperties": ["300", "4000", "4002", "65", "66", "1402", "FR0126", "FR0106", "FR0107", "FR0108", "4004", "4006", "97", "98", "1403", "FR0226", "FR0206", "FR0207", "FR0208"]
            })
            result = json.loads(result)
            if not result.get("success"):
                return sanitized_error("Failed to get loan details from OneLoan", Exception(result.get("error")), logger=logger)
            result = result.get("data", {})

        except Exception as e:
            return sanitized_error("Failed to get loan details from OneLoan", e, logger=logger)

        # Make call to ECS to reissue credit
        domain = os.getenv("ECS_DOMAIN")
        if not domain:
            return json.dumps({
                "success": False,
                "error": "ECS domain not configured. Please set ECS_DOMAIN environment variable."
            }, indent=2)

        auth_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {auth_token}"
        }
        has_coborrower = bool(result.get("4004"))
        borrower_type = "joint" if has_coborrower else "individual"
        body = {
            "case-id": arguments["loanId"],
            "credit-report-id": result.get("300"),
            "company": arguments["company"],
            "consumer": "MCP Server",
            "loan-purpose": "mortgage",
            "credit-pull-type": "hardtri",
            "borrowers": [
                {
                    "first-name": result.get("4000"),
                    "last-name": result.get("4002"),
                    "ssn": result.get("65"),
                    "home-phone": result.get("66"),
                    "birthdate": result.get("1402"),
                    "type": borrower_type,
                    "residence": {
                        "address": result.get("FR0126"),
                        "city": result.get("FR0106"),
                        "state": result.get("FR0107"),
                        "postal-code": result.get("FR0108"),
                        "type": "Current"
                    }
                },
                *([{
                    "first-name": result.get("4004"),
                    "last-name": result.get("4006"),
                    "ssn": result.get("97"),
                    "home-phone": result.get("98"),
                    "birthdate": result.get("1403"),
                    "type": borrower_type,
                    "residence": {
                        "address": result.get("FR0226"),
                        "city": result.get("FR0206"),
                        "state": result.get("FR0207"),
                        "postal-code": result.get("FR0208"),
                        "type": "Current"
                    }
                }] if has_coborrower else [])
            ]
        }

        try:
            response = requests.post(f"{domain}/api/v1/credit", headers=headers, json=body)
            response.raise_for_status()
            response_data = response.json()
            if response_data.get("status") == "Error":
                logger.error("ECS reissue credit returned an error status: %s", response_data)
                return json.dumps({"success": False, "error": "ECS reissue credit returned an error status", "data": response_data}, indent=2)
            return json.dumps({"success": True, "data": response_data}, indent=2)

        except requests.RequestException as e:
            result = json.loads(sanitized_error("Failed to reissue ECS credit", e, logger=logger))
            if _is_missing_borrower_information(e.response):
                result["error_code"] = "ecs_reissue_missing_borrower_information"
            return json.dumps(result, indent=2)