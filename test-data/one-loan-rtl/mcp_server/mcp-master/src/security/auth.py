"""
Authentication and authorization module
"""

import os
import hashlib
import hmac
import logging
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class SimpleTokenValidator:
    """Simple token validation"""

    REQUIRED_SCOPE = "api.all.digital-mortgage-systems-mcp"

    def introspect_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Introspect an access token via Okta.

        Returns the introspection payload (which identifies the calling
        application via ``cid`` / ``client_id`` / ``sub``) when the token is
        active and carries the required scope. Returns ``None`` otherwise.
        """
        domain = os.getenv("OKTA_DOMAIN", "")
        client_id = os.getenv("OKTA_CLIENT_ID", "")
        client_secret = os.getenv("OKTA_CLIENT_SECRET", "")
        auth_server_id = os.getenv("OKTA_AUTH_SERVER_ID", "")

        url = f"{domain}/oauth2/{auth_server_id}/v1/introspect"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        payload = {
            "token": token,
            "token_type_hint": "access_token"
        }

        try:
            result = requests.post(
                url, data=payload, headers=headers,
                auth=(client_id, client_secret), timeout=10
            )
            result.raise_for_status()
            token_info = result.json()

            if not token_info.get("active", False):
                return None

            # Check to ensure required scope is present
            scopes = token_info.get("scope", "").split()
            if self.REQUIRED_SCOPE not in scopes:
                return None
            return token_info

        except requests.RequestException:
            return None

    def validate_token(self, token: str) -> bool:
        """Validate access token and check scope"""
        return self.introspect_token(token) is not None





class AuthManager:
    """Simple authentication manager"""
    
    def __init__(self):
        self.token_validator = SimpleTokenValidator()
    
    def validate_bearer_token(self, token: str) -> bool:
        """Validate Bearer token"""
        return self.token_validator.validate_token(token)

    def introspect_bearer_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Introspect a Bearer token and return its payload (or None if invalid)."""
        return self.token_validator.introspect_token(token)

    @staticmethod
    def extract_caller_identity(token_info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract the calling application's identity from an introspection payload.

        Okta returns the OAuth client ID under ``cid`` (and sometimes
        ``client_id``); for client-credentials tokens ``sub`` is also the
        client ID. ``username`` is present for user-context tokens.
        """
        return {
            "client_id": token_info.get("cid") or token_info.get("client_id"),
            "subject": token_info.get("sub"),
            "username": token_info.get("username"),
            "token_type": token_info.get("token_type"),
            "scope": token_info.get("scope"),
        }

    def log_auth_attempt(self, token: str, success: bool, endpoint: str, ip: str,
                         caller: Optional[Dict[str, Any]] = None):
        """Log authentication attempt with hashed token to prevent information leakage"""
        # Hash token for logging to prevent information leakage
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
        logger.info(
            "Auth attempt",
            extra={
                "event": "auth_attempt",
                "token_hash": token_hash,
                "success": success,
                "endpoint": endpoint,
                "ip": ip,
                "caller_client_id": (caller or {}).get("client_id"),
                "caller_subject": (caller or {}).get("subject"),
            },
        )

