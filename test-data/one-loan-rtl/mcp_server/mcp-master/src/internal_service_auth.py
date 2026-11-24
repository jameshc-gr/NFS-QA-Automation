import os
import uuid
import requests
import base64
import time
import jwt
from typing import Dict, Optional
from dotenv import load_dotenv

load_dotenv()

_TOKEN_CACHE: Dict[str, Optional[float | str]] = {
    "access_token": None,
    "expires_at": None,
}

_BORROWER_OKTA_TOKEN_CACHE: Dict[str, Optional[float | str]] = {
    "access_token": None,
    "expires_at": None,
}

_DATA_PLATFORM_TOKEN_CACHE: Dict[str, Optional[float | str]] = {
    "access_token": None,
    "expires_at": None,
}

_ONELOAN_TOKEN_CACHE: Dict[str, Dict[str, Optional[float | str]]] = {}

_ENCOMPASS_TOKEN_CACHE: Dict[str, Optional[float | str]] = {
    "access_token": None,
    "expires_at": None,
}

_FITBUX_IDR_TOKEN_CACHE: Dict[str, Optional[float | str]] = {
    "access_token": None,
    "expires_at": None,
}


def get_internal_service_auth_token() -> str:
    """Get internal service auth token and cache it in memory until it expires."""
    access_token = _TOKEN_CACHE.get("access_token")
    expires_at = _TOKEN_CACHE.get("expires_at")
    current_time = time.time()

    if access_token and isinstance(expires_at, float) and current_time < expires_at:
        return access_token

    domain = os.getenv("OKTA_DOMAIN")
    client_id = os.getenv("INTERNAL_SERVICE_CLIENT_ID")
    client_secret = os.getenv("INTERNAL_SERVICE_CLIENT_SECRET")
    auth_server_id = os.getenv("INTERNAL_SERVICE_AUTH_SERVER_ID")

    if not domain:
        raise ValueError("Okta domain not configured. Please set OKTA_DOMAIN environment variable.")

    if not client_id or not client_secret:
        raise ValueError(
            "Okta internal client credentials are not configured. "
            "Please set INTERNAL_SERVICE_CLIENT_ID and INTERNAL_SERVICE_CLIENT_SECRET environment variables."
        )

    if not auth_server_id:
        raise ValueError(
            "Okta internal auth server ID is not configured. "
            "Please set INTERNAL_SERVICE_AUTH_SERVER_ID environment variable."
        )

    url = f"{domain}/oauth2/{auth_server_id}/v1/token"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()}",
    }
    payload = {
        "grant_type": "client_credentials",
        "scope": "api.all.loan-credit-service api.lead.leads-manager api.all.doc-storage-service api.consumer.consumer-entity-service myaccount-api api.loan.consent.simon api.loan.finalize.dmx taskmaster api.mortgage-servicing.data-platform",
    }

    try:
        result = requests.post(url, data=payload, headers=headers, timeout=20)
        result.raise_for_status()
        token_response = result.json()
    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve Okta token: {str(ex)}") from ex

    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError("Failed to retrieve Okta token: response did not include access_token.")

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _TOKEN_CACHE["access_token"] = new_access_token
    _TOKEN_CACHE["expires_at"] = current_time + max(expires_in - refresh_buffer_seconds, 1)

    return new_access_token


def get_data_platform_auth_token() -> str:
    """Get a token scoped only to api.mortgage-servicing.data-platform, as required by the data platform API."""
    access_token = _DATA_PLATFORM_TOKEN_CACHE.get("access_token")
    expires_at = _DATA_PLATFORM_TOKEN_CACHE.get("expires_at")
    current_time = time.time()

    if access_token and isinstance(expires_at, float) and current_time < expires_at:
        return access_token

    domain = os.getenv("OKTA_DOMAIN")
    client_id = os.getenv("INTERNAL_SERVICE_CLIENT_ID")
    client_secret = os.getenv("INTERNAL_SERVICE_CLIENT_SECRET")
    auth_server_id = os.getenv("INTERNAL_SERVICE_AUTH_SERVER_ID")

    if not domain:
        raise ValueError("Okta domain not configured. Please set OKTA_DOMAIN environment variable.")
    if not client_id or not client_secret:
        raise ValueError(
            "Okta internal client credentials are not configured. "
            "Please set INTERNAL_SERVICE_CLIENT_ID and INTERNAL_SERVICE_CLIENT_SECRET environment variables."
        )
    if not auth_server_id:
        raise ValueError(
            "Okta internal auth server ID is not configured. "
            "Please set INTERNAL_SERVICE_AUTH_SERVER_ID environment variable."
        )

    url = f"{domain}/oauth2/{auth_server_id}/v1/token"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()}",
    }
    payload = {
        "grant_type": "client_credentials",
        "scope": "api.mortgage-servicing.data-platform",
    }

    try:
        result = requests.post(url, data=payload, headers=headers, timeout=20)
        result.raise_for_status()
        token_response = result.json()
    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve data platform Okta token: {str(ex)}") from ex

    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError("Failed to retrieve data platform Okta token: response did not include access_token.")

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _DATA_PLATFORM_TOKEN_CACHE["access_token"] = new_access_token
    _DATA_PLATFORM_TOKEN_CACHE["expires_at"] = current_time + max(expires_in - refresh_buffer_seconds, 1)

    return new_access_token


def get_borrower_okta_service_auth_token() -> str:
    """Get a borrower okta service auth token using Okta private key JWT client assertion."""
    access_token = _BORROWER_OKTA_TOKEN_CACHE.get("access_token")
    expires_at = _BORROWER_OKTA_TOKEN_CACHE.get("expires_at")
    current_time = time.time()

    if access_token and isinstance(expires_at, float) and current_time < expires_at:
        return access_token

    client_id = os.getenv("BORROWER_OKTA_CLIENT_ID")
    kid = os.getenv("BORROWER_OKTA_JWKS_KID")
    private_key = os.getenv("BORROWER_OKTA_PRIVATE_KEY")
    scopes = os.getenv("BORROWER_OKTA_SCOPES")
    okta_host = os.getenv("BORROWER_OKTA_HOST")

    missing = [
        name for name, val in {
            "BORROWER_OKTA_CLIENT_ID": client_id,
            "BORROWER_OKTA_JWKS_KID": kid,
            "BORROWER_OKTA_PRIVATE_KEY": private_key,
            "BORROWER_OKTA_SCOPES": scopes,
            "BORROWER_OKTA_HOST": okta_host,
        }.items() if not val
    ]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    token_url = f"{okta_host}oauth2/v1/token"

    # Build the private key JWT client assertion (RS256)
    now = int(current_time)
    client_assertion = jwt.encode(
        payload={
            "iss": client_id,
            "sub": client_id,
            "aud": token_url,
            "iat": now,
            "exp": now + 300,
            "jti": str(uuid.uuid4()),
        },
        key=private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )

    payload = {
        "grant_type": "client_credentials",
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": client_assertion,
        "scope": scopes,
    }
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        result = requests.post(token_url, data=payload, headers=headers, timeout=20)
        if not result.ok:
            raise RuntimeError(
                f"Failed to retrieve Borrower Okta token: {result.status_code} - {result.text}"
            )
        token_response = result.json()
    except RuntimeError:
        raise
    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve Borrower Okta token: {str(ex)}") from ex

    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError(
            "Failed to retrieve Borrower Okta token: response did not include access_token."
        )

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _BORROWER_OKTA_TOKEN_CACHE["access_token"] = new_access_token
    _BORROWER_OKTA_TOKEN_CACHE["expires_at"] = current_time + max(expires_in - refresh_buffer_seconds, 1)

    return new_access_token


def get_oneloan_auth_token(company: str) -> str:
    """ Get an auth token for OneLoan using associated company credentials """
    current_time = time.time()
    cached = _ONELOAN_TOKEN_CACHE.get(company)
    if cached:
        access_token = cached.get("access_token")
        expires_at = cached.get("expires_at")
        if access_token and isinstance(expires_at, float) and current_time < expires_at:
            return access_token

    # Map company to Okta client ID and secret
    company_mapping = {
        "gri": {
            "client_id": os.getenv("ONELOAN_GRI_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_GRI_OKTA_CLIENT_SECRET")
        },
        "gra": {
            "client_id": os.getenv("ONELOAN_GRA_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_GRA_OKTA_CLIENT_SECRET")
        },
        "prate": {
            "client_id": os.getenv("ONELOAN_PR_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_PR_OKTA_CLIENT_SECRET")
        },
        "op": {
            "client_id": os.getenv("ONELOAN_OP_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_OP_OKTA_CLIENT_SECRET")
        },
        "kbhs": {
            "client_id": os.getenv("ONELOAN_KBHS_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_KBHS_OKTA_CLIENT_SECRET")
        },
        "premia": {
            "client_id": os.getenv("ONELOAN_PREMIA_OKTA_CLIENT_ID"),
            "client_secret": os.getenv("ONELOAN_PREMIA_OKTA_CLIENT_SECRET")
        }
    }

    credentials = company_mapping.get(company, company_mapping["gri"])
    client_id = credentials["client_id"]
    client_secret = credentials["client_secret"]

    domain = os.getenv("OKTA_DOMAIN")
    auth_server_id = os.getenv("INTERNAL_SERVICE_AUTH_SERVER_ID")

    if not domain:
        raise ValueError("Okta domain not configured. Please set OKTA_DOMAIN environment variable.")

    if not auth_server_id:
        raise ValueError(
            "Okta internal auth server ID is not configured. "
            "Please set INTERNAL_SERVICE_AUTH_SERVER_ID environment variable."
        )
    
    if not client_id or not client_secret:
        raise ValueError(
            f"Okta client credentials for company '{company}' are not configured. "
            "Please set the appropriate environment variables."
        )
    
    url = f"{domain}/oauth2/{auth_server_id}/v1/token"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()}",
    }
    payload = {
        "grant_type": "client_credentials",
        "scope": "api.loan.oneloan",
    }

    try:
        result = requests.post(url, data=payload, headers=headers)
        result.raise_for_status()
        token_response = result.json()

    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve Okta token for OneLoan: {str(ex)}") from ex
    
    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError(
            "Failed to retrieve OneLoan Okta token: response did not include access_token."
        )

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _ONELOAN_TOKEN_CACHE[company] = {
        "access_token": new_access_token,
        "expires_at": current_time + max(expires_in - refresh_buffer_seconds, 1),
    }

    return new_access_token


def get_encompass_auth_token() -> str:
    """Get an Encompass access token using password grant and cache it until it expires."""
    access_token = _ENCOMPASS_TOKEN_CACHE.get("access_token")
    expires_at = _ENCOMPASS_TOKEN_CACHE.get("expires_at")
    current_time = time.time()

    if access_token and isinstance(expires_at, float) and current_time < expires_at:
        return access_token

    domain = os.getenv("ENCOMPASS_DOMAIN")
    username = os.getenv("ENCOMPASS_USERNAME")
    password = os.getenv("ENCOMPASS_PASSWORD")
    instance_id = os.getenv("ENCOMPASS_INSTANCE_ID")
    client_id = os.getenv("ENCOMPASS_CLIENT_ID")
    client_secret = os.getenv("ENCOMPASS_CLIENT_SECRET")

    missing = [
        name for name, val in {
            "ENCOMPASS_DOMAIN": domain,
            "ENCOMPASS_USERNAME": username,
            "ENCOMPASS_PASSWORD": password,
            "ENCOMPASS_INSTANCE_ID": instance_id,
            "ENCOMPASS_CLIENT_ID": client_id,
            "ENCOMPASS_CLIENT_SECRET": client_secret,
        }.items() if not val
    ]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    url = f"{domain}/oauth2/v1/token"
    payload = {
        "grant_type": "password",
        "username": f"{username}@encompass:{instance_id}",
        "password": password,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    }

    try:
        result = requests.post(url, data=payload, headers=headers, timeout=20)
        if not result.ok:
            raise RuntimeError(
                f"Failed to retrieve Encompass token: {result.status_code} - {result.text}"
            )
        token_response = result.json()
    except RuntimeError:
        raise
    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve Encompass token: {str(ex)}") from ex

    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError("Failed to retrieve Encompass token: response did not include access_token.")

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _ENCOMPASS_TOKEN_CACHE["access_token"] = new_access_token
    _ENCOMPASS_TOKEN_CACHE["expires_at"] = current_time + max(expires_in - refresh_buffer_seconds, 1)

    return new_access_token

def get_fitbux_idr_auth_token() -> str:
    """Get a FitBUX IDR tracking (Rate Wealth API v3) token and cache it until it expires"""
    access_token = _FITBUX_IDR_TOKEN_CACHE.get("access_token")
    expires_at = _FITBUX_IDR_TOKEN_CACHE.get("expires_at")
    current_time = time.time()

    if access_token and isinstance(expires_at, float) and current_time < expires_at:
        return access_token

    issuer = os.getenv("FITBUX_OKTA_ISSUER")
    client_id = os.getenv("FITBUX_OKTA_CLIENT_ID")
    client_secret = os.getenv("FITBUX_OKTA_CLIENT_SECRET")
    scope = os.getenv("FITBUX_OKTA_SCOPE", "api.consumer.consumer-entity-service")

    missing = [
        name for name, val in {
            "FITBUX_OKTA_ISSUER": issuer,
            "FITBUX_OKTA_CLIENT_ID": client_id,
            "FITBUX_OKTA_CLIENT_SECRET": client_secret,
        }.items() if not val
    ]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    # The issuer is the full authorization server URL, so the token endpoint
    # is directly beneath it.
    url = f"{issuer.rstrip('/')}/v1/token"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()}",
    }
    payload = {
        "grant_type": "client_credentials",
        "scope": scope,
    }

    try:
        result = requests.post(url, data=payload, headers=headers, timeout=20)
        result.raise_for_status()
        token_response = result.json()
    except Exception as ex:
        raise RuntimeError(f"Failed to retrieve FitBUX IDR Okta token: {str(ex)}") from ex

    new_access_token = token_response.get("access_token")
    expires_in = int(token_response.get("expires_in", 3600))

    if not new_access_token:
        raise RuntimeError("Failed to retrieve FitBUX IDR Okta token: response did not include access_token.")

    refresh_buffer_seconds = min(300, max(60, int(expires_in * 0.05)))
    _FITBUX_IDR_TOKEN_CACHE["access_token"] = new_access_token
    _FITBUX_IDR_TOKEN_CACHE["expires_at"] = current_time + max(expires_in - refresh_buffer_seconds, 1)

    return new_access_token
