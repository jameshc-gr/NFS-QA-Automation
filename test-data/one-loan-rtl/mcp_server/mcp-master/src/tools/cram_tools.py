"""
CRAM (Velocify) related tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict

logger = logging.getLogger(__name__)

class CreateLeadTool(BaseTool):
    """ Tool for creating a lead for a borrower """

    def __init__(self):
        super().__init__(
            name="create_lead",
            description="Tool for creating a lead in CRAM (Velocify)",
            input_schema={
                "type": "object",
                "properties": {
                    "firstName": {
                        "type": "string", 
                        "description": "First name of the borrower"
                    },
                    "lastName": {
                        "type": "string", 
                        "description": "Last name of the borrower"
                    },
                    "emailAddress": {
                        "type": "string", 
                        "description": "Email address of the borrower"
                    },
                    "homePhoneNumber": {
                        "type": "string",
                        "description": "Home phone number of the borrower"
                    },
                    "loanAmount": {
                        "type": "string",
                        "description": "Loan amount requested"
                    },
                    "mortgageType": {
                        "type": "string",
                        "description": "Type of mortgage (e.g. purchase, refinance)"
                    }, 
                    "encompassLoanNumber": {
                        "type": "string",
                        "description": "Encompass loan number to link the lead to"
                    },
                    "propertyCity": {
                        "type": "string",
                        "description": "City of the property associated with the lead"
                    },
                    "propertyLocation": {
                        "type": "string",
                        "description": "State of the property associated with the lead (use 2-letter state code)"
                    },
                    "fico": {
                        "type": "string",
                        "description": "FICO score of the borrower"
                    }
                },
                "required": ["firstName", "lastName", "emailAddress", "homePhoneNumber"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute lead creation in CRAM """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: firstName, lastName, emailAddress, homePhoneNumber"}, indent=2)
        
        domain = os.getenv("CRAM_DOMAIN")
        auth_token = os.getenv("CRAM_AUTH_TOKEN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "CRAM domain not configured. Please set CRAM_DOMAIN environment variable."
            }, indent=2)
        
        if not auth_token:
            return json.dumps({
                "success": False,
                "error": "CRAM auth token not configured. Please set CRAM_AUTH_TOKEN environment variable."
            }, indent=2)
        
        url = f"{domain}/v2/lead"
        headers = {
            "Authorization": f"{auth_token}"
        }

        try:
            result = requests.post(url, json=arguments, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True,"data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to create lead", e, logger=logger)
        

class UpdateLeadTool(BaseTool):
    """ Tool for updating lead information in CRAM (Velocify) """

    def __init__(self):
        super().__init__(
            name="update_lead",
            description="Tool to update lead information by ID in CRAM (Velocify)",
            input_schema={
                "type": "object",
                "properties": {
                    "cram-id": {
                        "type": "string",
                        "description": "CRAM ID of the lead to update"
                    },
                    "firstName": {
                        "type": "string", 
                        "description": "First name of the borrower"
                    },
                    "lastName": {
                        "type": "string", 
                        "description": "Last name of the borrower"
                    },
                    "emailAddress": {
                        "type": "string", 
                        "description": "Email address of the borrower"
                    },
                    "homePhoneNumber": {
                        "type": "string",
                        "description": "Home phone number of the borrower"
                    },
                    "loanAmount": {
                        "type": "string",
                        "description": "Loan amount requested"
                    },
                    "mortgageType": {
                        "type": "string",
                        "description": "Type of mortgage (e.g. purchase, refinance)"
                    }, 
                    "encompassLoanNumber": {
                        "type": "string",
                        "description": "Encompass loan number to link the lead to"
                    },
                    "propertyCity": {
                        "type": "string",
                        "description": "City of the property associated with the lead"
                    },
                    "propertyLocation": {
                        "type": "string",
                        "description": "State of the property associated with the lead (use 2-letter state code)"
                    },
                    "fico": {
                        "type": "string",
                        "description": "FICO score of the borrower"
                    }
                },
                "required": ["cram-id"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute lead update in CRAM """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required argument: cram-id"}, indent=2)
        
        domain = os.getenv("CRAM_DOMAIN")
        auth_token = os.getenv("CRAM_AUTH_TOKEN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "CRAM domain not configured. Please set CRAM_DOMAIN environment variable."
            }, indent=2)
        
        if not auth_token:
            return json.dumps({
                "success": False,
                "error": "CRAM auth token not configured. Please set CRAM_AUTH_TOKEN environment variable."
            }, indent=2)
        
        url = f"{domain}/v2/lead"
        headers = {
            "Authorization": f"{auth_token}"
        }

        try:
            result = requests.patch(url, json=arguments, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True,"data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to update lead", e, logger=logger)
