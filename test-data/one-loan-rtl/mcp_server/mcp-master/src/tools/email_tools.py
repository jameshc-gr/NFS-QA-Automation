"""
Email tools for MCP server
"""

import html
import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict

logger = logging.getLogger(__name__)

class SendApplicationCompletionEmailTool(BaseTool):
    """ Tool to send an email to the borrower when their loan application is completed """

    def __init__(self):
        super().__init__(
            name="send_application_completion_email",
            description="Tool to send an email to the borrower when their loan application is completed",
            input_schema={
                "type": "object",
                "properties": {
                    "firstName": {
                        "type": "string", 
                        "description": "The first name of the loan applicant"
                    },
                    "emailAddress": {
                        "type": "string",
                        "description": "The email address of the loan applicant"
                    },
                    "language": {
                        "type": "string",
                        "description": "The language the loan applicant used (e.g., 'en' for English, 'es' for Spanish)"
                    }
                },
                "required": ["firstName", "emailAddress"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute email sending """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: firstName, emailAddress"}, indent=2)
        
        domain = os.getenv("MUSTACHE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Mustache domain not configured. Please set MUSTACHE_DOMAIN environment variable."
            }, indent=2)
        
        language = arguments.get("language", "en") # Default to English if not provided
        url = f"{domain}/v100/document"
        payload = {
            "templateId": "8856d13b-21b3-4a22-8606-6f75c569580e" if language == "es" else "ae6f2987-525c-4f59-86ca-986c28e86276",
            "data": {
                "borrower-first-name": arguments["firstName"]
            }
        }

        # Fetch the email template from Mustache
        try:
            result = requests.post(url, json=payload)
            result.raise_for_status()
            
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch email template from Mustache", e, logger=logger)
        
        domain = os.getenv("MERCURY_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Mercury domain not configured. Please set MERCURY_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/v100/email"
        payload = {
            "body": result.text,
            "from": {
                "name": "Owning Support",
                "address": "customersuccess@owning.com"
            },
            "to": [{
                "address": arguments["emailAddress"]
            }],
            "subject": "¡Gracias por postularte!" if language == "es" else "Thanks for applying!"
        }

        # Send the email via Mercury
        try:
            result = requests.post(url, json=payload)
            result.raise_for_status()
            return json.dumps({"success": True,"data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to send email via Mercury", e, logger=logger)
        

class SendEmailTool(BaseTool):
    """ Tool to send any email using Mercury email service """

    def __init__(self, *, timeout: float | None = None):
        self._request_options = {} if timeout is None else {"timeout": timeout}
        super().__init__(
            name="send_email",
            description="Send the given email using Mercury email service",
            input_schema={
                "type": "object",
                "properties": {
                    "body": {
                        "type": "string", 
                        "description": "The body of the email to be sent"
                    },
                    "to": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "The name of the recipient"
                                },
                                "address": {
                                    "type": "string",
                                    "description": "The email address of the recipient"
                                }
                            },
                            "required": ["address"]
                        }
                    },
                    "from": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "The name of the sender"
                            },
                            "address": {
                                "type": "string",
                                "description": "The email address of the sender"
                            }
                        },
                        "required": ["name", "address"]
                    },
                    "cc": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "The name of the CC recipient"
                                },
                                "address": {
                                    "type": "string",
                                    "description": "The email address of the CC recipient"
                                }
                            },
                            "required": ["address"]
                        }
                    },
                    "subject": {
                        "type": "string",
                        "description": "The subject of the email"
                    },
                    "attachments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "The content of the attachment"
                                },
                                "encoding": {
                                    "type": "string",
                                    "description": "The encoding of the attachment content"
                                },
                                "contentType": {
                                    "type": "string",
                                    "description": "The MIME type of the attachment"
                                },
                                "filename": {
                                    "type": "string",
                                    "description": "The filename of the attachment"
                                }
                            }
                        }
                    }
                },
                "required": ["body", "to", "from", "subject"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute email sending """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: body, to, from, subject"}, indent=2)
        
        domain = os.getenv("MERCURY_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Mercury domain not configured. Please set MERCURY_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/v100/email"

        # Unescape HTML in body since the request validator HTML-escapes all string arguments
        payload = {**arguments, "body": html.unescape(arguments["body"])}

        # Send the email via Mercury
        try:            
            result = requests.post(url, json=payload, **self._request_options)
            result.raise_for_status()
            return json.dumps({"success": True,"data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to send email via Mercury", e, logger=logger)