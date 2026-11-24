"""
Bluesteel tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class PropertyValuationTool(BaseTool):
    """ Tool for estimating property valuation based on address using Bluesteel """

    def __init__(self):
        super().__init__(
            name="bluesteel_property_valuation",
            description="Tool to estimate the value of a property based on its address",
            input_schema={
                "type": "object",
                "properties": {
                    "street_address": {
                        "type": "string", 
                        "description": "Street address of the property"
                    },
                    "city": {
                        "type": "string", 
                        "description": "City where the property is located"
                    },
                    "state": {
                        "type": "string", 
                        "description": "State code where the property is located (e.g., CA, NY)"
                    },
                    "zip": {
                        "type": "string", 
                        "description": "ZIP code of the property's location"
                    }
                },
                "required": ["street_address", "city", "state", "zip"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute property valuation operation """
        if not self.validate_arguments(arguments): 
            return json.dumps({"error": "Missing required arguments: street_address, city, state, zip"}, indent=2)
        
        domain = os.getenv("BLUESTEEL_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Bluesteel service domain not configured. Please set BLUESTEEL_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/home-valuation"

        try: 
            result = requests.get(url, json=arguments)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to retrieve property valuation", e, logger=logger)