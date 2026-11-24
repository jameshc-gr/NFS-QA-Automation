"""
Rate Wealth / FitBUX tools for MCP server

Covers two FitBUX services on the FitBUX internal ALB:
  - IDR tracking (Rate Wealth API v3)  port 5200  Okta bearer + encrypted email header
  - Rate Wealth User API (v1)          port 5300  no app-level auth
"""

import os
import html
import json
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, Optional

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from .base import BaseTool

from ..internal_service_auth import get_fitbux_idr_auth_token
from ..security.redaction import redact_pii

logger = logging.getLogger(__name__)


def _encrypted_email(email: str) -> str:
    """Build the `x-encrypted-email` header: AES-256-GCM, formatted as
    `iv:authTag:ciphertext`, all hex
    """
    key_hex = os.getenv("FITBUX_EMAIL_ENCRYPTION_KEY")
    if not key_hex:
        raise ValueError("Missing required environment variable: FITBUX_EMAIL_ENCRYPTION_KEY")

    key = bytes.fromhex(key_hex)
    # AESGCM also accepts 16- and 24-byte keys (AES-128/192), so check explicitly
    # rather than relying on it to reject a wrong-length key.
    if len(key) != 32:
        raise ValueError(f"Encryption key must be 32 bytes (64 hex chars), got {len(key)}")

    iv = os.urandom(16)
    sealed = AESGCM(key).encrypt(iv, email.encode("utf-8"), None)
    ciphertext, tag = sealed[:-16], sealed[-16:]
    return f"{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"

def _safe_body(text: str, limit: int = 300) -> str:
    """A loggable version of a response body: JSON has PII redacted, HTML is summarised."""
    try:
        return json.dumps(redact_pii(json.loads(text)))[:limit]
    except ValueError:
        pass
    if text.lstrip().startswith("<"):
        return f"<HTML page, {len(text)} chars>"
    return text[:limit]

def _idr_request(method: str, path: str, email: str, body: Optional[Any] = None) -> Dict[str, Any]:
    """Call the IDR tracking service and sort the result into an outcome.

    Returns {"ok": True, "data": ...} or {"ok": False, "reason": ..., "detail": ...}
    where reason is one of "no_record", "no_data", "not_found" or "error"
    """
    base_url = os.getenv("FITBUX_IDR_BASE_URL")
    if not base_url:
        logger.error("FitBUX IDR request not sent: FITBUX_IDR_BASE_URL is not set")
        return {"ok": False, "reason": "error", "detail": "FitBUX IDR service is not configured."}

    url = f"{base_url.rstrip('/')}{path}"

    try:
        headers = {
            "Authorization": f"Bearer {get_fitbux_idr_auth_token()}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-encrypted-email": _encrypted_email(email),
            "X-GR-FSP-TENANT-ID": os.getenv("FITBUX_TENANT_ID", "gri"),
            "X-REQUEST-ID": str(uuid.uuid4()),
        }
    except (ValueError, RuntimeError) as e:
        # Missing or bad configuration, or Okta refused the token request.
        logger.error("FitBUX IDR request not sent: could not build auth headers | %s %s | %s", method, path, e)
        return {"ok": False, "reason": "error", "detail": "Could not authenticate to the FitBUX IDR service."}

    # Gateway only. Dropping it in-VPC is correct, not an omission.
    gateway_api_key = os.getenv("FITBUX_GATEWAY_API_KEY")
    if gateway_api_key:
        headers["X-API-Key"] = gateway_api_key

    try:
        response = requests.request(
            method,
            url,
            headers=headers,
            data=None if body is None else json.dumps(body),
            timeout=25,
        )
    except requests.exceptions.ConnectionError as e:
        # Includes DNS failures. Network, not a credential problem.
        logger.error("FitBUX IDR unreachable (DNS or connection) | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "Could not reach the FitBUX IDR service."}
    except requests.exceptions.Timeout as e:
        logger.error("FitBUX IDR timed out | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "The FitBUX IDR service timed out."}
    except requests.RequestException as e:
        logger.error("FitBUX IDR request failed | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "The FitBUX IDR request failed."}

    # A 401 here means this email has no Rate Wealth record. It is NOT an auth
    # failure: the token was accepted. Retrying or re-minting will not help;
    # the household has to be registered first.
    if response.status_code == 401:
        return {"ok": False, "reason": "no_record", "detail": "No Rate Wealth record for this borrower (401). Register them first."}

    if response.status_code == 404:
        return {"ok": False, "reason": "not_found", "detail": f"404 {path}"}

    text = response.text

    if not response.ok:
        logger.error("FitBUX IDR returned %s | %s %s | body=%s", response.status_code, method, path, _safe_body(text))
        return {"ok": False, "reason": "error", "detail": f"The FitBUX IDR service returned HTTP {response.status_code}."}

    # The service answers 200 with a Flask HTML error page when it cannot
    # resolve the household. Parsed loosely that becomes an object full of
    # nothing, which is worse than an error.
    if not text.strip():
        return {"ok": False, "reason": "no_data", "detail": "200 with an empty body"}
    if text.lstrip().startswith("<"):
        return {"ok": False, "reason": "no_data", "detail": "200 with an HTML error page — the service could not resolve the household"}

    try:
        return {"ok": True, "data": json.loads(text)}
    except ValueError:
        logger.error("FitBUX IDR returned non-JSON | %s %s | body=%s", method, path, _safe_body(text, 200))
        return {"ok": False, "reason": "no_data", "detail": "Non-JSON response body"}

def _user_api_request(method: str, path: str, user_id: str) -> Dict[str, Any]:
    """
    Calls the Rate Wealth User API and sort the result into an outcome
    """
    base_url = os.getenv("FITBUX_USER_API_BASE_URL")
    if not base_url:
        logger.error("Rate Wealth User API request not sent: FITBUX_USER_API_BASE_URL is not set")
        return {"ok": False, "reason": "error", "detail": "Rate Wealth User API is not configured."}

    url = f"{base_url.rstrip('/')}/api/v1{path}"

    try:
        response = requests.request(
            method,
            url,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "X-Rate-Wealth-User-Id": user_id,
            },
            timeout=25,
        )
    except requests.exceptions.ConnectionError as e:
        logger.error("Rate Wealth User API unreachable (DNS or connection) | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "Could not reach the Rate Wealth User API."}
    except requests.exceptions.Timeout as e:
        logger.error("Rate Wealth User API timed out | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "The Rate Wealth User API timed out."}
    except requests.RequestException as e:
        logger.error("Rate Wealth User API request failed | %s %s | %s", method, url, e)
        return {"ok": False, "reason": "error", "detail": "The Rate Wealth User API request failed."}

    if response.status_code == 404:
        return {"ok": False, "reason": "not_found", "detail": f"404 {path}"}

    text = response.text

    if not response.ok:
        logger.error("Rate Wealth User API returned %s | %s %s | body=%s", response.status_code, method, path, _safe_body(text))
        return {"ok": False, "reason": "error", "detail": f"The Rate Wealth User API returned HTTP {response.status_code}."}

    if not text.strip():
        return {"ok": False, "reason": "no_data", "detail": "empty body"}

    try:
        return {"ok": True, "data": json.loads(text)}
    except ValueError:
        logger.error("Rate Wealth User API returned non-JSON | %s %s | body=%s", method, path, _safe_body(text, 200))
        return {"ok": False, "reason": "no_data", "detail": "Non-JSON response body"}

def _clean_args(value: Any) -> Any:
    """
    Undo the HTML-escaping the server's RequestValidator applies to every string
    """
    if isinstance(value, str):
        return html.unescape(value)
    if isinstance(value, list):
        return [_clean_args(v) for v in value]
    if isinstance(value, dict):
        return {k: _clean_args(v) for k, v in value.items()}
    return value

_FAILURE_EXPLANATIONS = {
    "no_record": (
        "This borrower has no Rate Wealth record. This is not an authentication "
        "failure: the token was accepted. Use register_household first."
    ),
    "no_data": (
        "The service responded but could not resolve this household. Check the "
        "email address; there may be no profile behind it."
    ),
    "not_found": "No such resource.",
    "error": "The request failed.",
}


def _render(outcome: Dict[str, Any], context: str) -> str:
    """Turn an outcome into the JSON string a tool returns, with the failure reasons spelled out."""
    if outcome["ok"]:
        return json.dumps({"success": True, "data": outcome["data"]}, indent=2)

    return json.dumps({
        "success": False,
        "error": f"{context} failed.",
        "reason": outcome["reason"],
        "explanation": _FAILURE_EXPLANATIONS[outcome["reason"]],
        "detail": outcome["detail"],
    }, indent=2)

_EMAIL_PROPERTY = {
    "type": "string",
    "description": "Borrower's email address.",
}

# Path parameters take self|partner only. "me" returns a 502, not a validation error.
_WHO_PROPERTY = {
    "type": "string",
    "enum": ["self", "partner"],
    "description": "Whose record to read. Defaults to self.",
}

def _who(arguments: Dict[str, Any]) -> Optional[str]:
    """Return a valid who value ("self" by default), or None if the caller sent something else.

    The server only checks required fields, not enums, so this is enforced here
    rather than letting a bad value through to a 502
    """
    who = arguments.get("who") or "self"
    return who if who in ("self", "partner") else None

def _bad_input(message: str) -> str:
    return json.dumps({"success": False, "error": message}, indent=2)

# ---------------------------------------------------------------------------
# IDR read tools
# ---------------------------------------------------------------------------

class TaxBombEstimateTool(BaseTool):
    """The forgiveness tax projection for a borrower"""

    def __init__(self):
        super().__init__(
            name="tax_bomb_estimate",
            description=(
                "The forgiveness tax projection for a borrower: what will be forgiven, when, "
                "and the tax owed on it. This is the figure the rest of the Rate product "
                "shows this person, so prefer it over any local calculation. The number "
                "shifts slightly day to day and is not a stable cached value."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY, "who": _WHO_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")

        outcome = _idr_request("GET", f"/tool/taxbombestimate?who={who}", arguments["email"])

        # A 200 with the requested person's slot null means the household exists
        # but has no federal loan — nothing to forgive, so nothing to project.
        if outcome["ok"] and isinstance(outcome["data"], dict) and outcome["data"].get(who) is None:
            return json.dumps({
                "success": False,
                "error": "tax_bomb_estimate failed.",
                "reason": "no_federal_loan",
                "explanation": (
                    "This household exists but has no federal loan on file, so there "
                    "is nothing to forgive and no projection to make. Add a federal "
                    "loan with add_federal_loan first."
                ),
            }, indent=2)

        return _render(outcome, "tax_bomb_estimate")

class GetLoanAccountsTool(BaseTool):
    """The borrower's loan accounts"""

    def __init__(self):
        super().__init__(
            name="get_loan_accounts",
            description=(
                "The borrower's loan accounts: balances, interest rates, and servicer. "
                "Federal loans have type 'fed_loan'; private loans also appear here and "
                "must not be counted toward federal totals."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        return _render(_idr_request("GET", "/account", arguments["email"]), "get_loan_accounts")


class GetProfileTool(BaseTool):
    """Repayment plan, start date, IDR option and date of birth"""

    def __init__(self):
        super().__init__(
            name="get_profile",
            description=(
                "Repayment plan, repayment start date, IDR option and date of birth. "
                "Note that income is NOT here — use get_certified_income."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY, "who": _WHO_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")
        return _render(_idr_request("GET", f"/profile/{who}", arguments["email"]), "get_profile")

class GetCertifiedIncomeTool(BaseTool):
    """The AGI the service certifies IDR payments against"""

    def __init__(self):
        super().__init__(
            name="get_certified_income",
            description=(
                "The AGI the service certifies IDR payments against. This is where income "
                "lives for this borrower."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY, "who": _WHO_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")
        # Income lives here, NOT on /profile/{who}.
        return _render(_idr_request("GET", f"/idr/certification/{who}", arguments["email"]), "get_certified_income")


class GetIdrAssumptionsTool(BaseTool):
    """Earnings growth, tax rate and savings rate behind the projection"""

    def __init__(self):
        super().__init__(
            name="get_idr_assumptions",
            description=(
                "The assumptions behind the projection: earnings growth, tax rate and "
                "savings rate. The tax rate is the multiplier applied to the forgiven "
                "balance to produce the tax bomb figure."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY, "who": _WHO_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")
        # `tax_rate` is the multiplier behind `tax_bomb`.
        return _render(_idr_request("GET", f"/idr/assumptions/{who}", arguments["email"]), "get_idr_assumptions")

class GetHouseholdTool(BaseTool):
    """State, filing status and children, plus the derived household size."""

    def __init__(self):
        super().__init__(
            name="get_household",
            description=(
                "State, filing status and children. Household size is not stored by the "
                "service; it is 1 + (1 if filing jointly) + number of children, and this "
                "tool reports the derived count alongside the raw record."
            ),
            input_schema={
                "type": "object",
                "properties": {"email": _EMAIL_PROPERTY},
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        outcome = _idr_request("GET", "/profile/household", arguments["email"])
        if outcome["ok"] and isinstance(outcome["data"], dict):
            household = outcome["data"]
            # Household size is not stored anywhere. It is derived.
            spouse = 1 if household.get("filing_jointly") == "y" else 0
            household["derived_household_size"] = 1 + spouse + len(household.get("children") or [])
        return _render(outcome, "get_household")

# ---------------------------------------------------------------------------
# Rate Wealth User API read tools
# ---------------------------------------------------------------------------

_USER_ID_PROPERTY = {
    "type": "string",
    "description": "The Rate Wealth user id.",
}


class GetUserProfileTool(BaseTool):
    """The Rate Wealth user profile document, flattened"""

    def __init__(self):
        super().__init__(
            name="get_user_profile",
            description=(
                "The Rate Wealth user profile document. Field names differ from the IDR "
                "service: zip rather than zipcode, profession for occupation. The "
                "response arrives in one of two shapes, both flattened here."
            ),
            input_schema={
                "type": "object",
                "properties": {"user_id": _USER_ID_PROPERTY},
                "required": ["user_id"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments) or not arguments.get("user_id"):
            return _bad_input("Missing required argument: user_id")
        arguments = _clean_args(arguments)
        outcome = _user_api_request("GET", "/profile/data", arguments["user_id"])

        # Returns either a wrapped document ({data: {...}, score, progress}) or,
        # with a ?fields= projection, a flat object. Both shapes occur in practice,
        # so flatten either one.
        if outcome["ok"] and isinstance(outcome["data"], dict):
            document = outcome["data"]
            inner = document.get("data")
            flattened = {**(inner if isinstance(inner, dict) else {}), **document}
            flattened.pop("data", None)
            outcome = {"ok": True, "data": flattened}

        return _render(outcome, "get_user_profile")


class GetUserAccountsTool(BaseTool):
    """Accounts from the Rate Wealth user service."""

    def __init__(self):
        super().__init__(
            name="get_user_accounts",
            description="Accounts from the Rate Wealth user service.",
            input_schema={
                "type": "object",
                "properties": {"user_id": _USER_ID_PROPERTY},
                "required": ["user_id"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments) or not arguments.get("user_id"):
            return _bad_input("Missing required argument: user_id")
        arguments = _clean_args(arguments)
        return _render(_user_api_request("GET", "/accounts", arguments["user_id"]), "get_user_accounts")

# ---------------------------------------------------------------------------
# IDR: write tools
# Is disabled unless FITBUX_WRITES_ENABLED=true is set explicitly
# ---------------------------------------------------------------------------

def _writes_disabled() -> Optional[str]:
    """Return an error response if FitBUX writes are switched off, otherwise None."""
    if os.getenv("FITBUX_WRITES_ENABLED", "false").lower() == "true":
        return None
    return json.dumps({
        "success": False,
        "error": "FitBUX write tools are disabled on this server. No changes were made.",
    }, indent=2)


def _number(arguments: Dict[str, Any], key: str, minimum: float, allow_equal: bool) -> Optional[float]:
    """Return arguments[key] if it is a real number at or above the minimum, otherwise None.

    bool is excluded explicitly because Python treats True as the number 1.
    """
    value = arguments.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if value < minimum or (value == minimum and not allow_equal):
        return None
    return value

class RegisterHouseholdTool(BaseTool):
    """Create a borrower in Rate Wealth and fill in what is known, in the required order."""

    def __init__(self):
        super().__init__(
            name="register_household",
            description=(
                "Create a borrower in Rate Wealth from known details. Until a borrower "
                "exists here, every read returns 401 and no projection can be made. "
                "Supply as much as is known; each part is written in a fixed order and the "
                "result reports which steps succeeded. Refuses if the borrower already "
                "exists — use the update tools to change an existing borrower."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                    "agi": {"type": "number", "exclusiveMinimum": 0, "description": "Annual income / AGI."},
                    "state": {"type": "string", "minLength": 2, "maxLength": 2},
                    "filing_jointly": {"type": "boolean"},
                    "children_count": {
                        "type": "integer",
                        "minimum": 0,
                        "description": "How many children. Converted to the object list the API requires.",
                    },
                    "fed_repayment_plan": {"type": "string", "enum": ["std_plan", "rap", "ibr", "new_ibr"]},
                    "fed_repayment_start": {"type": "string", "description": "YYYY-MM"},
                    "idr_option": {"type": "string", "enum": ["standard", "pslf", "payoff"]},
                    "dob": {"type": "string", "description": "YYYY-MM-DD"},
                    "loan": {
                        "type": "object",
                        "description": (
                            "The federal loan. Every field is required if supplied at all — a "
                            "partial loan is not written, because an invented accrued_interest "
                            "would change the forgiven balance and therefore the tax owed."
                        ),
                        "properties": {
                            "firm": {"type": "string", "description": "Servicer, e.g. Nelnet."},
                            "balance": {"type": "number", "exclusiveMinimum": 0},
                            "principal": {"type": "number", "exclusiveMinimum": 0},
                            "accrued_interest": {"type": "number", "minimum": 0},
                            "rate": {"type": "number", "exclusiveMinimum": 0, "description": "Annual percentage, e.g. 6.8"},
                            "payment": {"type": "number", "minimum": 0, "description": "Current monthly payment."},
                        },
                        "required": ["firm", "balance", "principal", "accrued_interest", "rate", "payment"],
                    },
                },
                "required": ["email", "first_name", "last_name"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required arguments: email, first_name, last_name")
        arguments = _clean_args(arguments)

        # Validate everything before the first write, so a bad value further down
        # cannot leave a half-created borrower behind.
        for key in ("first_name", "last_name"):
            if not isinstance(arguments.get(key), str) or not arguments[key].strip():
                return _bad_input(f"{key} must be a non-empty string")

        agi = None
        if "agi" in arguments:
            agi = _number(arguments, "agi", 0, allow_equal=False)
            if agi is None:
                return _bad_input("agi must be a number greater than 0")

        profile = {}
        if "fed_repayment_plan" in arguments:
            if arguments["fed_repayment_plan"] not in ("std_plan", "rap", "ibr", "new_ibr"):
                return _bad_input("fed_repayment_plan must be one of: std_plan, rap, ibr, new_ibr")
            profile["fed_repayment_plan"] = arguments["fed_repayment_plan"]
        if "fed_repayment_start" in arguments:
            if not _valid_date(arguments["fed_repayment_start"], "%Y-%m"):
                return _bad_input("fed_repayment_start must be YYYY-MM")
            profile["fed_repayment_start"] = arguments["fed_repayment_start"]
        if "idr_option" in arguments:
            if arguments["idr_option"] not in ("standard", "pslf", "payoff"):
                return _bad_input("idr_option must be one of: standard, pslf, payoff")
            profile["idr_option"] = arguments["idr_option"]
        if "dob" in arguments:
            if not _valid_date(arguments["dob"], "%Y-%m-%d"):
                return _bad_input("dob must be YYYY-MM-DD")
            profile["dob"] = arguments["dob"]

        household = None
        if any(key in arguments for key in ("state", "filing_jointly", "children_count")):
            state = arguments.get("state")
            filing_jointly = arguments.get("filing_jointly")
            children_count = arguments.get("children_count", 0)
            if state is not None and (not isinstance(state, str) or len(state) != 2):
                return _bad_input("state must be a two-letter code")
            if filing_jointly is not None and not isinstance(filing_jointly, bool):
                return _bad_input("filing_jointly must be true or false")
            if isinstance(children_count, bool) or not isinstance(children_count, int) or children_count < 0:
                return _bad_input("children_count must be a whole number, 0 or more")
            # The API takes objects, not a count. A bare number is a 500.
            household = {"children": [{"name": None, "dob": None} for _ in range(children_count)]}
            if state is not None:
                household["state"] = state.upper()
            # Left out when not supplied, rather than guessed: the service then
            # applies its own default.
            if filing_jointly is not None:
                household["filing_jointly"] = "y" if filing_jointly else "n"

        loan = None
        if "loan" in arguments:
            supplied = arguments["loan"]
            if not isinstance(supplied, dict):
                return _bad_input("loan must be an object")
            firm = supplied.get("firm")
            if not isinstance(firm, str) or not firm.strip():
                return _bad_input("loan.firm must be a non-empty string. A partial loan is not written.")
            numbers = {
                "balance": _number(supplied, "balance", 0, allow_equal=False),
                "principal": _number(supplied, "principal", 0, allow_equal=False),
                "accrued_interest": _number(supplied, "accrued_interest", 0, allow_equal=True),
                "rate": _number(supplied, "rate", 0, allow_equal=False),
                "payment": _number(supplied, "payment", 0, allow_equal=True),
            }
            invalid = [key for key, value in numbers.items() if value is None]
            if invalid:
                return _bad_input(f"Invalid or missing loan numbers: {', '.join(invalid)}. A partial loan is not written.")
            loan = {"type": "fed_loan", "who": "self", "firm": firm, "name": "Federal student loans", **numbers}

        email = arguments["email"]

        # Refuse if this email already has a record. Registering over an existing
        # borrower would go on to overwrite their income, profile and household and
        # add a second loan. Only a 401 ("no record") is taken as proof they are new
        existing = _idr_request("GET", "/profile/self", email)
        if existing["ok"]:
            return _failure(
                "register_household", "already_exists",
                "This email already has a Rate Wealth record. Nothing was written. Use the "
                "update tools to change an existing borrower.",
            )
        if existing["reason"] != "no_record":
            return _failure(
                "register_household", "could_not_confirm",
                "Could not confirm whether this borrower already exists, so nothing was written.",
                detail=existing["detail"],
            )

        # The order is not incidental: the identity must exist before anything can
        # attach to it, and the loan must exist before there is anything to forgive
        steps = [("POST /auth/register", "POST", "/auth/register",
                  {"first_name": arguments["first_name"], "last_name": arguments["last_name"], "email": email})]
        if agi is not None:
            steps.append(("PUT /idr/certification/self", "PUT", "/idr/certification/self", {"agi": agi}))
        if profile:
            steps.append(("PATCH /profile/self", "PATCH", "/profile/self", profile))
        if household is not None:
            steps.append(("PATCH /profile/household", "PATCH", "/profile/household", household))
        # Last: with no federal account the estimate returns {"self": null}.
        if loan is not None:
            steps.append(("POST /account", "POST", "/account", loan))

        # Stop at the first failure and report the rest as skipped, so the caller
        # sees exactly which parts landed and can finish with the update tools
        report = []
        failed = False
        for call, method, path, body in steps:
            if failed:
                report.append({"call": call, "status": "skipped"})
                continue
            outcome = _idr_request(method, path, email, body)
            if outcome["ok"]:
                report.append({"call": call, "status": "ok"})
            else:
                failed = True
                report.append({"call": call, "status": "failed", "reason": outcome["reason"], "detail": outcome["detail"]})

        return json.dumps({"success": not failed, "steps": report}, indent=2)

class SetCertifiedIncomeTool(BaseTool):
    """Set the AGI used to certify IDR payments"""

    def __init__(self):
        super().__init__(
            name="set_certified_income",
            description="Set the AGI used to certify IDR payments.",
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "agi": {"type": "number", "exclusiveMinimum": 0, "description": "Annual income / AGI."},
                    "who": _WHO_PROPERTY,
                },
                "required": ["email", "agi"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required arguments: email, agi")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")
        agi = _number(arguments, "agi", 0, allow_equal=False)
        if agi is None:
            return _bad_input("agi must be a number greater than 0")

        outcome = _idr_request("PUT", f"/idr/certification/{who}", arguments["email"], {"agi": agi})
        return _render(outcome, "set_certified_income")

class UpdateHouseholdTool(BaseTool):
    """Update state, filing status or number of children"""

    def __init__(self):
        super().__init__(
            name="update_household",
            description=(
                "Update state, filing status or children. Only the fields supplied are "
                "changed; everything else keeps its current value. Children are supplied "
                "as a count and converted to the object list the API requires."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "state": {"type": "string", "minLength": 2, "maxLength": 2, "description": "Two-letter state code, e.g. IL."},
                    "filing_jointly": {"type": "boolean"},
                    "children_count": {"type": "integer", "minimum": 0},
                },
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)

        state = arguments.get("state")
        filing_jointly = arguments.get("filing_jointly")
        children_count = arguments.get("children_count")

        if state is None and filing_jointly is None and children_count is None:
            return _bad_input("Nothing to update: supply state, filing_jointly or children_count")
        if state is not None and (not isinstance(state, str) or len(state) != 2):
            return _bad_input("state must be a two-letter code")
        if filing_jointly is not None and not isinstance(filing_jointly, bool):
            return _bad_input("filing_jointly must be true or false")
        if children_count is not None and (isinstance(children_count, bool) or not isinstance(children_count, int) or children_count < 0):
            return _bad_input("children_count must be a whole number, 0 or more")

        # Read the current household first. `children` is required on every PATCH,
        # and filing_jointly defaults to "y" when omitted, so sending only the
        # changed fields could silently erase children or flip filing status.
        # Sending the full record, with only the requested fields changed, avoids both.
        current = _idr_request("GET", "/profile/household", arguments["email"])
        if not current["ok"]:
            return _render(current, "update_household")
        if not isinstance(current["data"], dict):
            return _render({"ok": False, "reason": "no_data", "detail": "Unexpected household response"}, "update_household")

        existing_children = current["data"].get("children") or []
        if children_count is None:
            children = existing_children
        else:
            # Keep the children already on record (with any names and birth dates),
            # dropping from the end or padding with blank children to match the count.
            # The API takes objects, not a count. A bare number is a 500.
            children = existing_children[:children_count] + [
                {"name": None, "dob": None} for _ in range(max(0, children_count - len(existing_children)))
            ]

        patch = {
            "state": state.upper() if state is not None else current["data"].get("state"),
            "filing_jointly": (
                ("y" if filing_jointly else "n") if filing_jointly is not None
                else current["data"].get("filing_jointly")
            ),
            "children": children,
        }

        outcome = _idr_request("PATCH", "/profile/household", arguments["email"], patch)
        return _render(outcome, "update_household")

class AddFederalLoanTool(BaseTool):
    """Add a federal student loan to a borrower"""

    def __init__(self):
        super().__init__(
            name="add_federal_loan",
            description=(
                "Add a federal loan. Every field is required: without a complete loan the "
                "service has nothing to project, and guessing a missing part would change "
                "the forgiven balance and the tax owed. Each call adds a new loan, so do "
                "not repeat a call that may already have succeeded."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "firm": {"type": "string", "description": "Servicer, e.g. Nelnet."},
                    "balance": {"type": "number", "exclusiveMinimum": 0},
                    "principal": {"type": "number", "exclusiveMinimum": 0},
                    "accrued_interest": {"type": "number", "minimum": 0},
                    "rate": {"type": "number", "exclusiveMinimum": 0, "description": "Annual percentage, e.g. 6.8"},
                    "payment": {"type": "number", "minimum": 0, "description": "Current monthly payment."},
                    "who": {
                        "type": "string",
                        "enum": ["self", "partner", "joint"],
                        "description": "Whose loan this is. Defaults to self.",
                    },
                },
                "required": ["email", "firm", "balance", "principal", "accrued_interest", "rate", "payment"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input(
                "Missing required arguments: email, firm, balance, principal, accrued_interest, rate, payment. "
                "A partial loan is not written."
            )
        arguments = _clean_args(arguments)

        # An account's `who` also accepts "joint", unlike the path parameters.
        who = arguments.get("who") or "self"
        if who not in ("self", "partner", "joint"):
            return _bad_input("who must be 'self', 'partner' or 'joint'")

        firm = arguments.get("firm")
        if not isinstance(firm, str) or not firm.strip():
            return _bad_input("firm must be a non-empty string")

        numbers = {
            "balance": _number(arguments, "balance", 0, allow_equal=False),
            "principal": _number(arguments, "principal", 0, allow_equal=False),
            "accrued_interest": _number(arguments, "accrued_interest", 0, allow_equal=True),
            "rate": _number(arguments, "rate", 0, allow_equal=False),
            "payment": _number(arguments, "payment", 0, allow_equal=True),
        }
        invalid = [key for key, value in numbers.items() if value is None]
        if invalid:
            return _bad_input(f"Invalid or missing numbers: {', '.join(invalid)}. A partial loan is not written.")

        # Every field on NewFederalStudentLoan is required.
        loan = {"type": "fed_loan", "who": who, "firm": firm, "name": "Federal student loans", **numbers}
        outcome = _idr_request("POST", "/account", arguments["email"], loan)
        return _render(outcome, "add_federal_loan")

# leaving out server-set fields such as id, last_update and manual.
_FEDERAL_LOAN_FIELDS = ("type", "who", "firm", "name", "balance", "principal", "accrued_interest", "rate", "payment")

def _failure(context: str, reason: str, explanation: str, **extra: Any) -> str:
    return json.dumps({"success": False, "error": f"{context} failed.", "reason": reason,
                       "explanation": explanation, **extra}, indent=2)

def _find_federal_loan(email: str, loan_id: int, context: str) -> Dict[str, Any]:
    """Look up one of this borrower's accounts and confirm it is a federal loan.

    Returns {"loan": {...}} on success, or {"error": <tool response string>}.
    The check uses what FitBUX has stored, so a caller cannot reach another
    borrower's loan, or a non-federal account, by passing its id.
    """
    accounts = _idr_request("GET", "/account", email)
    if not accounts["ok"]:
        return {"error": _render(accounts, context)}
    if not isinstance(accounts["data"], list):
        return {"error": _render({"ok": False, "reason": "no_data", "detail": "Unexpected accounts response"}, context)}

    loan = next((a for a in accounts["data"] if isinstance(a, dict) and a.get("id") == loan_id), None)
    if loan is None:
        return {"error": _failure(
            context, "loan_not_found",
            f"Account {loan_id} is not one of this borrower's accounts. Use get_loan_accounts "
            "to find the right id. No changes were made.",
        )}
    if loan.get("type") != "fed_loan":
        return {"error": _failure(
            context, "not_federal_loan",
            f"Account {loan_id} is not a federal loan. Only federal loans can be changed "
            "with this tool. No changes were made.",
        )}
    return {"loan": loan}

class UpdateFederalLoanTool(BaseTool):
    """Change one or more fields on an existing federal loan"""

    def __init__(self):
        super().__init__(
            name="update_federal_loan",
            description=(
                "Change fields on one of the borrower's existing federal loans. Supply the "
                "loan_id (from get_loan_accounts) and only the fields that should change; "
                "everything else keeps its current value. Only this borrower's federal "
                "loans (type 'fed_loan') can be changed. The result shows the loan as it "
                "is stored after the change."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "loan_id": {"type": "integer", "description": "The loan's id, from get_loan_accounts."},
                    "firm": {"type": "string", "description": "Servicer, e.g. Nelnet."},
                    "balance": {"type": "number", "exclusiveMinimum": 0},
                    "principal": {"type": "number", "exclusiveMinimum": 0},
                    "accrued_interest": {"type": "number", "minimum": 0},
                    "rate": {"type": "number", "exclusiveMinimum": 0, "description": "Annual percentage, e.g. 6.8"},
                    "payment": {"type": "number", "minimum": 0, "description": "Current monthly payment."},
                    "who": {
                        "type": "string",
                        "enum": ["self", "partner", "joint"],
                        "description": "Whose loan this is.",
                    },
                },
                "required": ["email", "loan_id"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required arguments: email, loan_id")
        arguments = _clean_args(arguments)

        loan_id = arguments.get("loan_id")
        if isinstance(loan_id, bool) or not isinstance(loan_id, int):
            return _bad_input("loan_id must be a whole number")

        # Validate only the fields supplied; anything left out keeps its current value.
        changes: Dict[str, Any] = {}
        minimums = {
            "balance": (0, False), "principal": (0, False), "accrued_interest": (0, True),
            "rate": (0, False), "payment": (0, True),
        }
        for key, (minimum, allow_equal) in minimums.items():
            if key in arguments:
                value = _number(arguments, key, minimum, allow_equal)
                if value is None:
                    return _bad_input(f"{key} is not a valid number. No changes were made.")
                changes[key] = value
        if "firm" in arguments:
            if not isinstance(arguments["firm"], str) or not arguments["firm"].strip():
                return _bad_input("firm must be a non-empty string")
            changes["firm"] = arguments["firm"]
        if "who" in arguments:
            if arguments["who"] not in ("self", "partner", "joint"):
                return _bad_input("who must be 'self', 'partner' or 'joint'")
            changes["who"] = arguments["who"]
        if not changes:
            return _bad_input("Nothing to update: supply at least one field to change")

        email = arguments["email"]
        found = _find_federal_loan(email, loan_id, "update_federal_loan")
        if "error" in found:
            return found["error"]

        # Send the full record with only the requested fields changed. Whether the
        # service treats PATCH as partial, as full, or resets omitted fields to
        # defaults, this gives the same result.
        body = {key: found["loan"].get(key) for key in _FEDERAL_LOAN_FIELDS}
        body.update(changes)

        outcome = _idr_request("PATCH", f"/account/{loan_id}", email, body)
        if not outcome["ok"] and outcome["reason"] != "no_data":
            # no_data is not treated as failure here: an edit may legitimately
            # return an empty body. The read-back below decides.
            return _render(outcome, "update_federal_loan")

        # Read the loan back and confirm the change is what is stored, rather than
        # trusting the shape of the PATCH response.
        after = _find_federal_loan(email, loan_id, "update_federal_loan")
        if "error" in after:
            return _failure(
                "update_federal_loan", "unverified",
                "The change was sent but the loan could not be read back, so it is not "
                "known whether it was applied. Check with get_loan_accounts before retrying.",
            )

        stored = after["loan"]
        mismatched = [
            key for key, wanted in changes.items()
            if (abs(stored.get(key) - wanted) > 0.005 if isinstance(wanted, (int, float)) and isinstance(stored.get(key), (int, float))
                else stored.get(key) != wanted)
        ]
        if mismatched:
            return _failure(
                "update_federal_loan", "not_applied",
                f"The service did not store the requested value for: {', '.join(mismatched)}.",
                stored_loan=stored,
            )

        return json.dumps({"success": True, "data": stored}, indent=2)

def _mismatched(stored: Dict[str, Any], changes: Dict[str, Any]) -> list:
    """Return the keys in `changes` whose value is not what `stored` now holds.

    Numbers are compared to the cent, in case the service rounds.
    """
    mismatched = []
    for key, wanted in changes.items():
        have = stored.get(key)
        if isinstance(wanted, (int, float)) and not isinstance(wanted, bool) and isinstance(have, (int, float)):
            if abs(have - wanted) > 0.005:
                mismatched.append(key)
        elif have != wanted:
            mismatched.append(key)
    return mismatched


def _valid_date(value: Any, fmt: str) -> bool:
    if not isinstance(value, str):
        return False
    try:
        datetime.strptime(value, fmt)
        return True
    except ValueError:
        return False

# Fields on the IDR solo profile (/profile/{who}). All optional on PATCH
_PROFILE_FIELDS = ("fed_repayment_plan", "fed_repayment_start", "idr_option", "forbearance_months", "phone_number", "dob")


class UpdateProfileTool(BaseTool):
    """Change repayment plan, repayment start, IDR option, forbearance months, phone or date of birth."""

    def __init__(self):
        super().__init__(
            name="update_profile",
            description=(
                "Change a borrower's repayment plan, repayment start date, IDR option, "
                "forbearance months, phone number or date of birth. Supply only the fields "
                "that should change; everything else keeps its current value. Changing the "
                "repayment plan or start date changes the tax bomb projection. Income is "
                "NOT here — use set_certified_income."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "who": _WHO_PROPERTY,
                    # Two closed enums; the values are not guessable.
                    "fed_repayment_plan": {"type": "string", "enum": ["std_plan", "rap", "ibr", "new_ibr"]},
                    "fed_repayment_start": {"type": "string", "description": "YYYY-MM"},
                    "idr_option": {"type": "string", "enum": ["standard", "pslf", "payoff"]},
                    "forbearance_months": {"type": "integer", "minimum": 0},
                    "phone_number": {"type": "string"},
                    "dob": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")

        changes = {key: arguments[key] for key in _PROFILE_FIELDS if key in arguments}
        if not changes:
            return _bad_input("Nothing to update: supply at least one profile field to change")

        if "fed_repayment_plan" in changes and changes["fed_repayment_plan"] not in ("std_plan", "rap", "ibr", "new_ibr"):
            return _bad_input("fed_repayment_plan must be one of: std_plan, rap, ibr, new_ibr")
        if "idr_option" in changes and changes["idr_option"] not in ("standard", "pslf", "payoff"):
            return _bad_input("idr_option must be one of: standard, pslf, payoff")
        if "fed_repayment_start" in changes and not _valid_date(changes["fed_repayment_start"], "%Y-%m"):
            return _bad_input("fed_repayment_start must be YYYY-MM")
        if "dob" in changes and not _valid_date(changes["dob"], "%Y-%m-%d"):
            return _bad_input("dob must be YYYY-MM-DD")
        if "forbearance_months" in changes:
            months = changes["forbearance_months"]
            if isinstance(months, bool) or not isinstance(months, int) or months < 0:
                return _bad_input("forbearance_months must be a whole number, 0 or more")
        if "phone_number" in changes and not isinstance(changes["phone_number"], str):
            return _bad_input("phone_number must be a string")

        email = arguments["email"]
        current = _idr_request("GET", f"/profile/{who}", email)
        if not current["ok"]:
            return _render(current, "update_profile")
        if not isinstance(current["data"], dict):
            return _render({"ok": False, "reason": "no_data", "detail": "Unexpected profile response"}, "update_profile")

        # Send the full profile with only the requested fields changed, for the
        # same reason as update_household.
        body = {key: current["data"].get(key) for key in _PROFILE_FIELDS}
        body.update(changes)

        outcome = _idr_request("PATCH", f"/profile/{who}", email, body)
        if not outcome["ok"] and outcome["reason"] != "no_data":
            return _render(outcome, "update_profile")

        after = _idr_request("GET", f"/profile/{who}", email)
        if not after["ok"] or not isinstance(after["data"], dict):
            return _failure(
                "update_profile", "unverified",
                "The change was sent but the profile could not be read back, so it is not "
                "known whether it was applied. Check with get_profile before retrying.",
            )
        mismatched = _mismatched(after["data"], changes)
        if mismatched:
            return _failure(
                "update_profile", "not_applied",
                f"The service did not store the requested value for: {', '.join(mismatched)}.",
                stored_profile=after["data"],
            )
        return json.dumps({"success": True, "data": after["data"]}, indent=2)

# PATCH /profile/{who}/identity needs all three fields; a partial patch returns a
# 500. The tool reads the record, changes only the name parts, and sends all three
# back. It still checks the stored record has these fields before writing anything
_IDENTITY_FIELDS = ("first_name", "last_name", "email")
_NAME_FIELDS = ("first_name", "last_name")


class UpdateNameTool(BaseTool):
    """Change a borrower's first or last name"""

    def __init__(self):
        super().__init__(
            name="update_name",
            description=(
                "Change a borrower's first or last name. Supply only the parts that should "
                "change. The email address cannot be changed with this tool."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "who": _WHO_PROPERTY,
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"},
                },
                "required": ["email"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _writes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required argument: email")
        arguments = _clean_args(arguments)
        who = _who(arguments)
        if who is None:
            return _bad_input("who must be 'self' or 'partner'")

        changes = {key: arguments[key] for key in _NAME_FIELDS if key in arguments}
        if not changes:
            return _bad_input("Nothing to update: supply first_name and/or last_name")
        for key, value in changes.items():
            if not isinstance(value, str) or not value.strip():
                return _bad_input(f"{key} must be a non-empty string")

        email = arguments["email"]
        current = _idr_request("GET", f"/profile/{who}/identity", email)
        if not current["ok"]:
            return _render(current, "update_name")

        # Refuse rather than guess if the stored record does not look the way we
        # expect. Nothing is written in that case.
        if not isinstance(current["data"], dict) or not all(key in current["data"] for key in _IDENTITY_FIELDS):
            logger.error(
                "update_name: identity record has unexpected shape | keys=%s",
                sorted(current["data"].keys()) if isinstance(current["data"], dict) else type(current["data"]).__name__,
            )
            return _failure(
                "update_name", "unsupported",
                "The identity record does not have the expected name fields, so no change "
                "was attempted. No changes were made.",
            )

        body = {key: current["data"].get(key) for key in _IDENTITY_FIELDS}
        body.update(changes)

        outcome = _idr_request("PATCH", f"/profile/{who}/identity", email, body)
        if not outcome["ok"] and outcome["reason"] != "no_data":
            return _render(outcome, "update_name")

        after = _idr_request("GET", f"/profile/{who}/identity", email)
        if not after["ok"] or not isinstance(after["data"], dict):
            return _failure(
                "update_name", "unverified",
                "The change was sent but the name could not be read back, so it is not "
                "known whether it was applied. Check before retrying.",
            )
        mismatched = _mismatched(after["data"], changes)
        if mismatched:
            return _failure(
                "update_name", "not_applied",
                f"The service did not store the requested value for: {', '.join(mismatched)}.",
            )
        return json.dumps({"success": True, "data": {key: after["data"].get(key) for key in _NAME_FIELDS}}, indent=2)

# ---------------------------------------------------------------------------
# IDR: delete tools
#
# A delete cannot be undone, so deletes need their own switch on top of the
# writes switch: FITBUX_DELETES_ENABLED=true as well as FITBUX_WRITES_ENABLED=true.
# Turning writes off stops deletes too
# ---------------------------------------------------------------------------

def _deletes_disabled() -> Optional[str]:
    """Return an error response unless both writes and deletes are switched on, otherwise None"""
    disabled = _writes_disabled()
    if disabled:
        return disabled
    if os.getenv("FITBUX_DELETES_ENABLED", "false").lower() == "true":
        return None
    return json.dumps({
        "success": False,
        "error": "FitBUX delete tools are disabled on this server. No changes were made.",
    }, indent=2)


class DeleteFederalLoanTool(BaseTool):
    """Permanently remove one of the borrower's federal loans"""

    def __init__(self):
        super().__init__(
            name="delete_federal_loan",
            description=(
                "Permanently remove one of the borrower's federal loans, for example a "
                "duplicate. This cannot be undone. Supply the loan_id from get_loan_accounts. "
                "Only this borrower's federal loans (type 'fed_loan') can be removed. The "
                "result includes the removed loan's details, which add_federal_loan can use "
                "to re-create it if it was removed by mistake."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "email": _EMAIL_PROPERTY,
                    "loan_id": {"type": "integer", "description": "The loan's id, from get_loan_accounts."},
                },
                "required": ["email", "loan_id"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        disabled = _deletes_disabled()
        if disabled:
            return disabled
        if not self.validate_arguments(arguments):
            return _bad_input("Missing required arguments: email, loan_id")
        arguments = _clean_args(arguments)

        loan_id = arguments.get("loan_id")
        if isinstance(loan_id, bool) or not isinstance(loan_id, int):
            return _bad_input("loan_id must be a whole number")

        email = arguments["email"]
        found = _find_federal_loan(email, loan_id, "delete_federal_loan")
        if "error" in found:
            return found["error"]
        removed = {key: found["loan"].get(key) for key in ("id",) + _FEDERAL_LOAN_FIELDS}

        outcome = _idr_request("DELETE", f"/account/{loan_id}", email)
        if not outcome["ok"] and outcome["reason"] != "no_data":
            # no_data is not treated as failure here: a delete usually returns an
            # empty body. The read-back below decides.
            return _render(outcome, "delete_federal_loan")

        # Read the accounts back and confirm the loan is gone, rather than trusting
        # the shape of the DELETE response.
        after = _idr_request("GET", "/account", email)
        if not after["ok"] or not isinstance(after["data"], list):
            return _failure(
                "delete_federal_loan", "unverified",
                "The delete was sent but the accounts could not be read back, so it is not "
                "known whether the loan was removed. Check with get_loan_accounts before retrying.",
            )
        if any(isinstance(a, dict) and a.get("id") == loan_id for a in after["data"]):
            return _failure(
                "delete_federal_loan", "not_applied",
                f"The service did not remove account {loan_id}. It is still on record.",
            )

        return json.dumps({"success": True, "data": {"removed_loan": removed}}, indent=2)