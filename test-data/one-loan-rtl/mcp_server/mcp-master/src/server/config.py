"""
Configuration management for MCP server
"""

import os
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class ServerConfig:
    """Configuration class for MCP server"""
    
    def __init__(self):
        # Server settings
        self.host = os.getenv('MCP_HOST', '0.0.0.0')
        self.port = int(os.getenv('MCP_PORT', '8080'))
        
        # Authentication settings
        self.auth_enabled = os.getenv('MCP_AUTH_ENABLED', 'true').lower() == 'true'
        
        # Public access settings
        self.public_access_enabled = os.getenv('MCP_PUBLIC_ACCESS', 'true').lower() == 'true'
        
        # Tool settings
        self.tools_enabled = {
            'credit_check': os.getenv('TOOL_CREDIT_CHECK_ENABLED', 'true').lower() == 'true',
            'loan_eligibility': os.getenv('TOOL_LOAN_ELIGIBILITY_ENABLED', 'true').lower() == 'true',
            'property_valuation': os.getenv('TOOL_PROPERTY_VALUATION_ENABLED', 'true').lower() == 'true',
            'send_sms': os.getenv('TOOL_SEND_SMS_ENABLED', 'true').lower() == 'true',
            'pull_credit': os.getenv('TOOL_PULL_CREDIT_ENABLED', 'true').lower() == 'true',
            'patch_and_pull_credit': os.getenv('TOOL_PATCH_AND_PULL_CREDIT_ENABLED', 'true').lower() == 'true',
        }
        
        # External service settings
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER')
        
        # Cache configuration
        # CACHE_TOOLS – comma-separated list of tool names whose results should be
        # cached. Add/remove names and redeploy. Only add read-only lookup tools;
        # never add mutation tools (create/update/send/pull/upload).
        # Example: CACHE_TOOLS=get_loan,search_loans,get_borrower_loans
        _tools_raw = os.getenv("CACHE_TOOLS", "")
        self.cache_tools: list[str] = [
            t.strip() for t in _tools_raw.split(",") if t.strip()
        ]

        # CACHE_TTL – seconds before a cached result expires. Default: 3600 (1 h).
        self.cache_ttl: int = int(os.getenv("CACHE_TTL", "3600"))

        # REDIS_URL – connection URL for the cache backend.
        self.redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        # Logging settings
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.log_format = os.getenv('LOG_FORMAT', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    def is_tool_enabled(self, tool_name: str) -> bool:
        """Check if a tool is enabled"""
        # First check the predefined tools
        if tool_name in self.tools_enabled:
            return self.tools_enabled[tool_name]
        
        # For auto-discovered tools, check environment variable
        env_key = f"TOOL_{tool_name.upper()}_ENABLED"
        return os.getenv(env_key, 'true').lower() == 'true'
    
    def get_twilio_config(self) -> Dict[str, Optional[str]]:
        """Get Twilio configuration"""
        return {
            'account_sid': self.twilio_account_sid,
            'auth_token': self.twilio_auth_token,
            'phone_number': self.twilio_phone_number
        }
    
    def is_twilio_configured(self) -> bool:
        """Check if Twilio is properly configured"""
        return all([
            self.twilio_account_sid,
            self.twilio_auth_token,
            self.twilio_phone_number
        ])
