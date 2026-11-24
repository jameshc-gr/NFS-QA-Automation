"""
DMX tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_internal_service_auth_token
from typing import Any, Dict

logger = logging.getLogger(__name__)

class FinalizeLoanTool(BaseTool):
    """ Tool to finalize loans in Encompass using DMX service """

    def __init__(self):
        super().__init__(
            name="finalize_loan",
            description="Tool to finalize a loan in Encompass by its ID using the DMX service.",
            input_schema={
                "type": "object",
                "properties": {
                    "gr-loan-guid": {
                        "type": "string", 
                        "description": "The GUID of the loan to finalize"
                    }
                },
                "required": ["gr-loan-guid"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute the logic to finalize the loan using the provided GUID
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: gr-loan-guid"}, indent=2)
        
        domain = os.getenv("DMX_SERVICE_DOMAIN")

        if not domain: 
            return json.dumps({
                "success": False,
                "error": "DMX Service domain not configured. Please set DMX_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/api/finalize"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        body = {
            "gr-loan-guid": arguments["gr-loan-guid"],
            "submitted-by": "DM Avatar",
            "promote-lead": True
        }

        try:
            response = requests.post(url, headers=headers, json=body)
            response.raise_for_status()
            return json.dumps({"success": True, "message": f"Lead with GUID {arguments['gr-loan-guid']} finalized successfully."}, indent=2)
        
        except requests.exceptions.RequestException as e:
            return sanitized_error("Failed to finalize lead", e, logger=logger)