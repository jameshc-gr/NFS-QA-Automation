"""
Okta tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_borrower_okta_service_auth_token
from typing import Any, Dict

logger = logging.getLogger(__name__)

class CreateOktaUserTool(BaseTool):
    """ Tool to create a new user in Okta for the borrower """

    def __init__(self):
        super().__init__(
            name="create_okta_user",
            description="Tool to create a new user in Okta",
            input_schema={
                "type": "object",
                "properties": {
                    "profile": {
                        "type": "object",
                        "properties": {
                            "firstName": {
                                "type": "string", 
                                "description": "The user's first name"
                            },
                            "lastName": {
                                "type": "string", 
                                "description": "The user's last name"
                            },
                            "email": {
                                "type": "string", 
                                "description": "The user's email address"
                            },
                            "login": {
                                "type": "string", 
                                "description": "The user's login (usually same as email)"
                            },
                            "mobilePhone": {
                                "type": "string", 
                                "description": "The user's mobile phone number"
                            }
                        },
                        "required": ["firstName", "lastName", "email", "login", "mobilePhone"]
                    },
                    "credentials": {
                        "type": "object",
                        "properties": {
                            "password": {
                                "type": "object",
                                "properties": {
                                    "value": {
                                        "type": "string",
                                        "description": "The user's password for the account"
                                    }
                                },
                                "required": ["value"]
                            }
                        },
                        "required": ["password"]
                    }
                },
                "required": ["profile", "credentials"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute Okta user creation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: profile, credentials"}, indent=2)
        
        domain = os.getenv("BORROWER_OKTA_HOST")
        group_ids = [
            os.getenv("BORROWER_OKTA_BORROWER_GROUP_ID"),
            os.getenv("BORROWER_OKTA_FIRST_LOGIN_GROUP_ID"),
            os.getenv("BORROWER_OKTA_MFA_GROUP_ID")
        ]

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Okta domain not configured. Please set BORROWER_OKTA_HOST environment variable."
            }, indent=2)
        
        if not all(group_ids):
            return json.dumps({
                "success": False,
                "error": "Okta group IDs not configured. Please set BORROWER_OKTA_BORROWER_GROUP_ID, BORROWER_OKTA_FIRST_LOGIN_GROUP_ID, and BORROWER_OKTA_MFA_GROUP_ID environment variables."
            }, indent=2)
        
        url = f"{domain}api/v1/users"
        access_token = get_borrower_okta_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        # Add group ids to payload
        arguments["groupIds"] = group_ids

        try:
            result = requests.post(url, json=arguments, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to create Okta user", e, logger=logger)
        

class GetOktaUserTool(BaseTool):
    """ Tool to retrieve Okta user information given an ID """

    def __init__(self):
        super().__init__(
            name="get_okta_user",
            description="Tool to retrieve Okta user information given an ID",
            input_schema={
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string", 
                        "description": "The ID of the Okta user to retrieve"
                    }
                },
                "required": ["id"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute Okta user retrieval
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required argument: id"}, indent=2)
        
        domain = os.getenv("BORROWER_OKTA_HOST")
        if not domain:
            return json.dumps({
                "success": False,
                "error": "Okta domain not configured. Please set BORROWER_OKTA_HOST environment variable."
            }, indent=2)
        
        url = f"{domain}api/v1/users/{arguments.get('id')}"
        access_token = get_borrower_okta_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        try: 
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve Okta user", e, logger=logger)
    