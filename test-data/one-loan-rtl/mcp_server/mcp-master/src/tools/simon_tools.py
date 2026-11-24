"""
Simon related eConsent tools for MCP server
"""


import os
import json
import logging
import requests
from ..internal_service_auth import get_internal_service_auth_token
from .base import BaseTool, sanitized_error
from typing import Any, Dict

logger = logging.getLogger(__name__)

class SetBatchEconsent(BaseTool):
    """ Tool for setting batch eConsent for borrowers/coborrowers/consent types for a specific loan """

    def __init__(self):
        super().__init__(
            name="set_batch_simon_econsent",
            description="Tool for setting batch eConsent on a loan for borrowers/coborrowers/consent types",
            input_schema={
                "type": "object",
                "properties": {
                    "borrower": {
                        "type": "object", 
                        "properties": {
                            "name": {"type": "string", "description": "Full name of the borrower"},
                            "email": {"type": "string", "description": "Email of the borrower"},
                            "source": {"type": "string", "description": "Source of the borrower's consent"},
                            "agreed-eConsent": {"type": "boolean", "description": "Whether the borrower agreed to eConsent"},
                            "agreed-twnConsent": {"type": "boolean", "description": "Whether the borrower agreed to twnConsent"},
                            "language": {"type": "string", "description": "Language of the borrower's consent (es, en, etc)"}
                        },
                        "required": ["name", "email", "source", "agreed-eConsent", "agreed-twnConsent", "language"]
                    },
                    "coborrower": {
                        "type": "object", 
                        "properties": {
                            "name": {"type": "string", "description": "Full name of the coborrower"},
                            "email": {"type": "string", "description": "Email of the coborrower"},
                            "source": {"type": "string", "description": "Source of the coborrower's consent"},
                            "agreed-eConsent": {"type": "boolean", "description": "Whether the coborrower agreed to eConsent"},
                            "agreed-twnConsent": {"type": "boolean", "description": "Whether the coborrower agreed to twnConsent"},
                            "language": {"type": "string", "description": "Language of the coborrower's consent (es, en, etc)"}
                        },
                        "required": ["name", "email", "source", "agreed-eConsent", "agreed-twnConsent", "language"]
                    },
                    "loan-guid": {"type": "string", "description": "GUID of the loan"}
                },
                "required": ["borrower", "loan-guid"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute batch eConsent operation """
        if not self.validate_arguments(arguments): 
            return json.dumps({"error": "Missing required arguments: borrower, loan-guid"}, indent=2)
        
        domain = os.getenv("SIMON_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Simon service domain not configured. Please set SIMON_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v3/consent/batch"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        borrower_info = arguments.get("borrower")
        loan_guid = arguments.get("loan-guid")
        payload = [
            {
                "full-name": borrower_info.get("name"),
                "email": borrower_info.get("email"),
                "source": borrower_info.get("source"),
                "agreed": borrower_info.get("agreed-eConsent"),
                "consent-type": "eConsent",
                "loan-guid": loan_guid,
                "language": borrower_info.get("language")
            },
            {
                "full-name": borrower_info.get("name"),
                "email": borrower_info.get("email"),
                "source": borrower_info.get("source"),
                "agreed": borrower_info.get("agreed-twnConsent"),
                "consent-type": "twnConsent",
                "loan-guid": loan_guid,
                "language": borrower_info.get("language")
            }
        ]

        # Add coborrower information if it was provided
        coborrower_info = arguments.get("coborrower")
        if coborrower_info:
            payload.extend([
            {
                "full-name": coborrower_info.get("name"),
                "email": coborrower_info.get("email"),
                "source": coborrower_info.get("source"),
                "agreed": coborrower_info.get("agreed-eConsent"),
                "consent-type": "eConsent",
                "loan-guid": loan_guid,
                "language": coborrower_info.get("language")
            },
            {
                "full-name": coborrower_info.get("name"),
                "email": coborrower_info.get("email"),
                "source": coborrower_info.get("source"),
                "agreed": coborrower_info.get("agreed-twnConsent"),
                "consent-type": "twnConsent",
                "loan-guid": loan_guid,
                "language": coborrower_info.get("language")
            }
            ])

        try:
            result = requests.post(url, headers=headers, json=payload)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to set eConsent", e, logger=logger)