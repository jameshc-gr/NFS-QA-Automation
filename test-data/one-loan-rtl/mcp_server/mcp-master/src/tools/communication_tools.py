"""
Communication tools for MCP server
"""

import json
import os
import logging
from typing import Any, Dict
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
from .base import BaseTool

logger = logging.getLogger(__name__)


class SMSTool(BaseTool):
    """Tool for sending SMS messages using Twilio"""
    
    def __init__(self):
        super().__init__(
            name="send_sms",
            description="Send SMS message using Twilio",
            input_schema={
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Phone number to send SMS to (e.g., +1234567890)"},
                    "message": {"type": "string", "description": "Message content to send"},
                    "from_number": {"type": "string", "description": "Twilio phone number to send from (optional, uses default if not provided)"}
                },
                "required": ["to", "message"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """Execute SMS sending"""
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments"}, indent=2)
        
        to_number = arguments.get('to', '')
        message = arguments.get('message', '')
        from_number = arguments.get('from_number', '')
        
        # Get Twilio credentials from environment variables
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        default_from_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        if not account_sid or not auth_token:
            return json.dumps({
                "success": False,
                "error": "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables."
            }, indent=2)
        
        if not from_number:
            from_number = default_from_number
        
        if not from_number:
            return json.dumps({
                "success": False,
                "error": "No Twilio phone number configured. Please set TWILIO_PHONE_NUMBER environment variable or provide from_number parameter."
            }, indent=2)
        
        try:
            # Initialize Twilio client
            client = Client(account_sid, auth_token)
            
            # Send the message
            message_obj = client.messages.create(
                body=message,
                from_=from_number,
                to=to_number
            )
            
            result = {
                "success": True,
                "message_sid": message_obj.sid,
                "to": to_number,
                "from": from_number,
                "body": message,
                "status": message_obj.status,
                "date_created": message_obj.date_created.isoformat() if message_obj.date_created else None,
                "error_code": message_obj.error_code,
                "error_message": message_obj.error_message
            }
            
            return json.dumps(result, indent=2)
            
        except TwilioException as e:
            logger.error("Twilio error sending SMS to %s", to_number, exc_info=e)
            return json.dumps({
                "success": False,
                "error": "Failed to send SMS",
                "to": to_number,
                "from": from_number
            }, indent=2)
        except Exception as e:
            logger.exception("Unexpected error sending SMS to %s", to_number)
            return json.dumps({
                "success": False,
                "error": "Unexpected error",
                "to": to_number,
                "from": from_number
            }, indent=2)
