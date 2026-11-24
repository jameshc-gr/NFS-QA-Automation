"""
Borrower entity tools for MCP server
"""

import os
import json
import logging
import requests
from ..internal_service_auth import get_internal_service_auth_token
from .base import BaseTool, sanitized_error
from typing import Any, Dict

logger = logging.getLogger(__name__)

class CreateBorrowerEntityTool(BaseTool):
    """ Tool to create a new borrower entity in borrower-entity-service. If one already exists for the given parameters, it will be returned instead"""

    def __init__(self):
        super().__init__(
            name="create_borrower_entity",
            description="Tool to create a new borrower entity",
            input_schema={
                "type": "object",
                "properties": {
                    "email-address": {
                        "type": "object",
                        "properties": {
                            "primary": {
                                "type": "string", 
                                "description": "Primary email address of the borrower"
                            }
                        },
                        "required": ["primary"]
                    },
                    "identifier": {
                        "type": "object",
                        "properties": {
                            "okta-id": {
                                "type": "string", 
                                "description": "Okta user ID of the borrower"
                            }
                        },
                        "required": ["okta-id"]
                    },
                    "name": {
                        "type": "object",
                        "properties": {
                            "first": {
                                "type": "string", 
                                "description": "First name of the borrower"
                            },
                            "last": {
                                "type": "string", 
                                "description": "Last name of the borrower"
                            }
                        },
                        "required": ["first", "last"]
                    },
                    "phone": {
                        "type": "object",
                        "properties": {
                            "home": {
                                "type": "string", 
                                "description": "Home phone number of the borrower"
                            }
                        },
                        "required": ["home"]
                    },
                    "language-preference": {
                        "type": "string",
                        "description": "Language preference of the borrower (e.g. 'en' for English, 'es' for Spanish)"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "Name of the company associated with the borrower"
                    }
                },
                "required": ["email-address", "identifier", "name", "phone", "language-preference", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute borrower entity creation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: email-address, identifier, name, phone, language-preference, company-name"}, indent=2)
        
        domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Borrower Entity Service domain not configured. Please set BORROWER_ENTITY_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/borrower"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name")
        }

        try:
            result = requests.post(url, json=arguments, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to create borrower entity", e, logger=logger)


class UpdateBorrowerEntityTool(BaseTool):
    """ Tool to update an existing borrower entity in borrower-entity-service"""

    def __init__(self):
        super().__init__(
            name="update_borrower_entity",
            description="Tool to update an existing borrower entity",
            input_schema={
                "type": "object",
                "properties": {
                    "borrower-guid": {
                        "type": "string", 
                        "description": "The unique identifier of the borrower entity to update"
                    },
                    "email-address": {
                        "type": "object",
                        "properties": {
                            "primary": {
                                "type": "string", 
                                "description": "Primary email address of the borrower"
                            }
                        }
                    },
                    "identifier": {
                        "type": "object",
                        "properties": {
                            "okta-id": {
                                "type": "string", 
                                "description": "Okta user ID of the borrower"
                            }
                        }
                    },
                    "name": {
                        "type": "object",
                        "properties": {
                            "first": {
                                "type": "string", 
                                "description": "First name of the borrower"
                            },
                            "last": {
                                "type": "string", 
                                "description": "Last name of the borrower"
                            }
                        }
                    },
                    "phone": {
                        "type": "object",
                        "properties": {
                            "home": {
                                "type": "string", 
                                "description": "Home phone number of the borrower"
                            }
                        },
                    },
                    "language-preference": {
                        "type": "string",
                        "description": "Language preference of the borrower (e.g. 'en' for English, 'es' for Spanish)"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "Name of the company associated with the borrower"
                    }
                },
                "required": ["borrower-guid", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute borrower entity update """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: borrower-guid, company-name"}, indent=2)
        
        domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Borrower Entity Service domain not configured. Please set BORROWER_ENTITY_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/borrower/{arguments.get('borrower-guid')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name")
        }

        # Remove non-payload keys
        exclude_keys = {"borrower-guid", "company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.put(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to update borrower entity", e, logger=logger)
        

class SearchBorrowerEntityTool(BaseTool):
    """ Tool to search for a borrower entity by email in borrower-entity-service """

    def __init__(self):
        super().__init__(
            name="search_borrower_entity",
            description="Tool to search for a borrower entity by email",
            input_schema={
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string", 
                        "description": "Email of the borrower to search for"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "Name of the company to search in"
                    }
                },
                "required": ["email", "company-name"]
            }
        )
      
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute borrower search operation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: email, company-name"}, indent=2)
        
        domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Borrower Entity Service domain not configured. Please set BORROWER_ENTITY_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/borrower/search"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": arguments.get("company-name")
        }

        try:
            result = requests.post(url, json=arguments, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            response = getattr(e, "response", None)
            if response is not None and response.status_code == 404:
                try:
                    error_body = response.json()
                except (ValueError, TypeError):
                    error_body = None
                message = str((error_body or {}).get("message") or "").strip().casefold() if isinstance(error_body, dict) else ""
                details = str((error_body or {}).get("error") or "").casefold() if isinstance(error_body, dict) else ""
                if ("borrower" in message and "not found" in message) or (
                    message == "unable to find requested entity"
                    and "no borrower entity with matching email found" in details
                ):
                    logger.warning("Borrower entity search returned not found")
                    return json.dumps({
                        "success": False,
                        "error": "Failed to search borrower entity",
                        "error_code": "borrower_not_found",
                    }, indent=2)
            return sanitized_error("Failed to search borrower entity", e, logger=logger)
