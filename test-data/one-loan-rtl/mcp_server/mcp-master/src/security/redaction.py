"""
PII redaction utilities for safe logging.

This module is the single source of truth for stripping personally
identifiable information (PII) and secrets out of any structure before it is
written to logs, traces, or any other observability sink (e.g. Datadog).

Mortgage data is highly sensitive: SSNs, dates of birth, credit scores, full
credit reports, emails, phone numbers, and addresses must never be persisted
to logs in clear text (PCI/GLBA, OWASP A09:2021 — Security Logging Failures,
CWE-532 — Insertion of Sensitive Information into Log File).
"""

from typing import Any, Iterable

REDACTED = "[REDACTED]"

# Lower-cased substrings; any key containing one of these is fully redacted.
_SENSITIVE_KEY_SUBSTRINGS: frozenset = frozenset({
    "ssn",
    "social",
    "dob",
    "dateofbirth",
    "birthdate",
    "birthday",
    "creditscore",
    "credit_score",
    "credit",
    "fico",
    "email",
    "phone",
    "mobile",
    "firstname",
    "first_name",
    "lastname",
    "last_name",
    "fullname",
    "full_name",
    "middlename",
    "name",
    "address",
    "street",
    "city",
    "zip",
    "postal",
    "account",
    "routing",
    "iban",
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "apikey",
    "api_key",
    "x-api-key",
    "client_secret",
    "private_key",
    "borrower",
    "coborrower",
    "income",
    "salary",
    "dl_number",
    "license",
    "passport",
    "taxid",
    "tax_id",
})

# Exact key names that are sensitive but too short or too common to match as
# substrings without also hiding unrelated fields in other tools (e.g. "payment"
# would catch "nextPaymentDueDate"). Compared after the same normalisation.
_SENSITIVE_EXACT_KEYS: frozenset = frozenset({
    "agi",
    "balance",
    "principal",
    "accrued_interest",
    "payment",
    "monthly_payment",
    "monthly_contribution",
    "tax_bomb",
    "forgiven",
    "savings_target",
    "savings_projected",
    "profession",
    "married",
    "marital_status",
})

# Header names that must never be logged in clear text.
_SENSITIVE_HEADERS: frozenset = frozenset({
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "x-gr-company",
})

_MAX_DEPTH = 8
_MAX_STR = 256


def _key_is_sensitive(key: str) -> bool:
    k = key.lower().replace("-", "").replace("_", "")
    if k in {e.replace("-", "").replace("_", "") for e in _SENSITIVE_EXACT_KEYS}:
        return True
    return any(s.replace("-", "").replace("_", "") in k for s in _SENSITIVE_KEY_SUBSTRINGS)


def redact_pii(obj: Any, _depth: int = 0) -> Any:
    """Recursively redact sensitive keys from a structure for safe logging.

    - dict: keys matching a sensitive substring have their values replaced with
      ``[REDACTED]``; other values are recursed into.
    - list/tuple: each element is recursed into (capped in length).
    - str: truncated to a safe length (defense against log flooding).
    - other scalars: returned unchanged.
    """
    if _depth > _MAX_DEPTH:
        return REDACTED

    if isinstance(obj, dict):
        out = {}
        for key, value in obj.items():
            if isinstance(key, str) and _key_is_sensitive(key):
                out[key] = REDACTED
            else:
                out[key] = redact_pii(value, _depth + 1)
        return out

    if isinstance(obj, (list, tuple)):
        return [redact_pii(v, _depth + 1) for v in list(obj)[:50]]

    if isinstance(obj, str):
        return obj if len(obj) <= _MAX_STR else obj[:_MAX_STR] + "...<truncated>"

    return obj


def redact_headers(headers: Iterable) -> dict:
    """Return a dict of headers with sensitive header values redacted."""
    redacted = {}
    try:
        items = headers.items()  # type: ignore[attr-defined]
    except AttributeError:
        items = headers
    for key, value in items:
        if isinstance(key, str) and key.lower() in _SENSITIVE_HEADERS:
            redacted[key] = REDACTED
        else:
            redacted[key] = value
    return redacted
