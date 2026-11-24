"""
Loan credit-related tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_internal_service_auth_token
from typing import Any, Dict
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

class PullCreditTool(BaseTool):
    """ Tool for pulling credit from the loan credit service """

    def __init__(self):
        super().__init__(
            name="pull_credit",
            description="Tool to pull credit information for a given loan from the loan credit service",
            input_schema={
                "type": "object",
                "properties": {
                    "company-name": {
                        "type": "string", 
                        "description": "The name of the company the loan is associated with"
                    },
                    "application-id": {
                        "type": "string", 
                        "description": "The application ID associated with the credit pull"
                    },
                    "loan-id": {
                        "type": "string", 
                        "description": "The ID of the loan to pull credit for"
                    },
                    "product": {
                        "type": "string", 
                        "description": "The product type for the credit pull"
                    }, 
                    "credit-pull-type": {
                        "type": "string", 
                        "description": "The type of credit pull"
                    }, 
                    "timeout-secs": {
                        "type": "integer", 
                        "description": "Timeout in seconds for the credit pull operation"
                    }
                },
                "required": ["company-name", "loan-id"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute credit pull operation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: company-name, loan-id"}, indent=2)
        
        domain = os.getenv("LOAN_CREDIT_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Loan credit service domain is not configured. Please set LOAN_CREDIT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/credit/pull"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non-payload keys 
        exclude_keys = {"company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to pull credit", e, logger=logger)
        

class PatchAndPullCreditTool(BaseTool):
    """ Tool for pulling credit information with the addition of borrower field patching """

    def __init__(self):
        super().__init__(
            name="patch_and_pull_credit",
            description="Pulls credit information for a loan, and allows for patching of borrower fields",
            input_schema={
                "type": "object",
                "properties": {
                    "company-name": { "type": "string", "description": "The name of the company the loan is associated with" },
                    "application-id": { "type": "string", "description": "The application ID associated with the credit pull" },
                    "loan-id": { "type": "string", "description": "The ID of the loan to pull credit for" },
                    "product": { "type": "string", "description": "The product type for the credit pull" },
                    "credit-pull-type": { "type": "string", "description": "The type of credit pull" }, 
                    "borrower": {
                        "type": "object",
                        "properties": {
                            "ssn": { "type": "string", "description": "Social Security Number of the borrower" },
                            "first-name": { "type": "string", "description": "First name of the borrower" },
                            "last-name": { "type": "string", "description": "Last name of the borrower" },
                            "birth-date": { "type": "string", "description": "Birth date of the borrower" },
                            "address": { "type": "string", "description": "Address of the borrower" },
                            "address-unit-designator-type": { "type": "string", "description": "Unit designator type of the borrower's address" },
                            "address-unit-identifier": { "type": "string", "description": "Unit identifier of the borrower's address" },
                            "city": { "type": "string", "description": "City that the borrower resides in" },
                            "state": { "type": "string", "description": "State that the borrower resides in (2 letter code abbreviation, ex: CA)" },
                            "postal-code": { "type": "string", "description": "Postal code of the borrower's address" },
                            "consent-date": { "type": "string", "description": "Date of consent for credit pull" },
                            "consent-type": { "type": "string", "description": "Type of consent for credit pull" }
                        },
                        "required": ["ssn", "first-name", "last-name", "birth-date", "address", "city", "state", "postal-code", "consent-date", "consent-type"]
                    }, 
                    "coborrower": {
                        "type": "object",
                        "properties": {
                            "ssn": { "type": "string", "description": "Social Security Number of the coborrower" },
                            "first-name": { "type": "string", "description": "First name of the coborrower" },
                            "last-name": { "type": "string", "description": "Last name of the coborrower" },
                            "birth-date": { "type": "string", "description": "Birth date of the coborrower" },
                            "address": { "type": "string", "description": "Address of the coborrower" },
                            "address-unit-designator-type": { "type": "string", "description": "Unit designator type of the coborrower's address" },
                            "address-unit-identifier": { "type": "string", "description": "Unit identifier of the coborrower's address" },
                            "city": { "type": "string", "description": "City that the coborrower resides in" },
                            "state": { "type": "string", "description": "State that the coborrower resides in (2 letter code abbreviation, ex: CA)" },
                            "postal-code": { "type": "string", "description": "Postal code of the coborrower's address" },
                            "consent-date": { "type": "string", "description": "Date of consent for credit pull" },
                            "consent-type": { "type": "string", "description": "Type of consent for credit pull" }
                        }, 
                        "required": ["ssn", "first-name", "last-name", "birth-date", "address", "city", "state", "postal-code", "consent-date", "consent-type"]
                    }
                },
                "required": ["loan-id", "company-name", "borrower"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute patch and pull credit operation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: company-name, loan-id, borrower"}, indent=2)
        
        domain = os.getenv("LOAN_CREDIT_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Loan credit service domain is not configured. Please set LOAN_CREDIT_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v2/credit/patch-and-pull"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non-payload keys
        exclude_keys = {"company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            response_data = result.json()

            # Extract middle credit scores per borrower/coborrower
            middle_scores = self._extract_middle_credit_scores(response_data)
            return json.dumps({"success": True, "data": middle_scores}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to patch and pull credit", e, logger=logger)
    
    def _extract_middle_credit_scores(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract middle (median) credit score per borrower and coborrower from all three bureaus"""
        try:
            enterprise_credit = response_data.get("enterpriseCredit", {})
            credit_responses = enterprise_credit.get("credit-response", [])
            
            if not credit_responses:
                return {}
            
            credit_scores = credit_responses[0].get("credit-score", [])

            # Group scores by borrower-id
            scores_by_borrower: Dict[str, list] = {}
            for score in credit_scores:
                borrower_id = score.get("borrower-id")
                value = score.get("value")
                if borrower_id and value is not None:
                    scores_by_borrower.setdefault(borrower_id, []).append(value)

            # Compute middle score per borrower
            middle_scores_by_id: Dict[str, int] = {}
            for borrower_id, scores in scores_by_borrower.items():
                scores.sort()
                middle_scores_by_id[borrower_id] = scores[len(scores) // 2]

            # Determine borrower/coborrower roles from credit-request-data
            credit_request = credit_responses[0].get("credit-request-data", {})
            combined_id = credit_request.get("borrower-id", "")
            id_parts = combined_id.split("_") if combined_id else []

            result: Dict[str, Any] = {}
            if len(id_parts) >= 1 and id_parts[0] in middle_scores_by_id:
                result["borrowerScore"] = middle_scores_by_id[id_parts[0]]
            elif len(middle_scores_by_id) == 1:
                result["borrowerScore"] = next(iter(middle_scores_by_id.values()))

            if len(id_parts) >= 2 and id_parts[1] in middle_scores_by_id:
                result["coborrowerScore"] = middle_scores_by_id[id_parts[1]]

            return result
        except (KeyError, IndexError, AttributeError):
            return {}

