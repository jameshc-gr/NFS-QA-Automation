"""
OneLoan tools for MCP server
"""

import asyncio
import json
import os
import re
import logging
import requests
from pathlib import Path
from datetime import datetime, timezone
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_oneloan_auth_token, get_internal_service_auth_token
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_LO_EMAIL_DOMAIN_TO_COMPANY = {
    "owning.com": "owning",
    "rate.com": "gri",
    "citywidehm.com": "cwhm",
    "onqhomeloans.com": "qhl",
    "grarate.com": "gra",
    "certaintyhomelending.com": "certainty",
    "kbhshomeloans.com": "kbhs",
    "originpoint.com": "op",
}


def _company_from_lo_email(lo_email: str) -> Optional[str]:
    """Map a loan officer email domain to its company alias."""
    _, _, domain = (lo_email or "").strip().lower().rpartition("@")
    return _LO_EMAIL_DOMAIN_TO_COMPANY.get(domain)


def _latest_started_borrower_loan(response_data: Any) -> Optional[Dict[str, Any]]:
    """Return the borrower's loan with the newest valid startedDate."""
    loans = response_data.get("data", []) if isinstance(response_data, dict) else response_data
    if not isinstance(loans, list):
        return None

    def started_at(loan: Dict[str, Any]) -> datetime:
        value = loan.get("startedDate")
        if not isinstance(value, str) or not value:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    return max((loan for loan in loans if isinstance(loan, dict)), key=started_at, default=None)

_MILESTONE_LOG_SELECTOR_RE = re.compile(r"^Log\.MS\.(Date|DateTime)\.(.+)$", re.IGNORECASE)

# Module-level caches — built once on first use from data/encompass-loan-schema.json
_FIELD_INDEX: Optional[Dict[str, List]] = None
# Maps pattern prefix (FL/BR/DD/...) -> {suffix -> propCamel}
_PATTERN_SUFFIX_MAPS: Optional[Dict[str, Dict[str, str]]] = None
# Maps pattern prefix -> representative schema context string (for navigation)
_PATTERN_CONTEXTS: Optional[Dict[str, str]] = None
# Maps camelCase/PascalCase property names -> [(entity_type, prop_camel, context)]
_PROP_NAME_INDEX: Optional[Dict[str, List]] = None
# Maps entity type name -> loan path tuple, e.g. ("property",) or ("applications", 0, "borrower")
_ENTITY_PATHS: Optional[Dict[str, tuple]] = None

# Fields commonly used to discriminate collection items in schema contexts
_TYPE_FIELDS = (
    "feeType",
    "contactType",
    "assetType",
    "liabilityType",
    "gfe2010FeeParentType",
    "gfe2010FeeType",
    "closingEntityType",
    "section",
    "lineNumber",
    "feeAccountType",
    "feeIndex",
    "gfe2010FeeIndex",
    "owner",
    "applicantType",
    "person",
    "residencyType",
    "residencyBasisType",
    "paidByType",
    "type",
    "category",
    "name",
    "altId",
    "id",
    "state",
    "licenseType",
)


def _pascal_to_camel(name: str) -> str:
    """Convert PascalCase to camelCase, including leading acronyms (ATRQMCommon -> atrqmCommon)."""
    if not name:
        return name
    i = 0
    while i < len(name) and name[i].isupper():
        i += 1
    if i == 0:
        return name
    if i == len(name):
        return name.lower()
    # HTMLParser-style: keep last capital as start of next word when followed by lowercase
    if i > 1 and name[i].islower():
        i -= 1
    return name[:i].lower() + name[i:]


def _elliemae_camel(name: str) -> str:
    """EllieMae/Encompass JSON style: lower only the first character (URLA2020... -> uRLA2020...)."""
    return name[0].lower() + name[1:] if name else name


def _elliemae_key_variant(prop_camel: str) -> Optional[str]:
    """
    If prop_camel is acronym-lowered (urla2020StreetAddress), return the EllieMae
    first-letter-lower form (uRLA2020StreetAddress). Otherwise None.
    """
    m = re.match(r"^([a-z]{2,})([A-Z0-9].*)$", prop_camel or "")
    if not m:
        return None
    leading, rest = m.group(1), m.group(2)
    return leading[0] + leading[1:].upper() + rest


def _get_obj_prop(obj: Optional[Dict], prop_camel: str) -> Any:
    """
    Read a loan object property, accepting both acronym-aware camelCase and
    EllieMae first-letter-lower keys (e.g. urla2020StreetAddress / uRLA2020StreetAddress).
    """
    if not isinstance(obj, dict) or not prop_camel:
        return None
    if prop_camel in obj:
        return obj.get(prop_camel)
    alt = _elliemae_key_variant(prop_camel)
    if alt and alt in obj:
        return obj.get(alt)
    return None


def _norm_applicant(value: Optional[str]) -> str:
    """Normalize Borrower/CoBorrower/Coborrower variants for comparison."""
    if not value:
        return ""
    v = value.replace(" ", "").lower()
    if v in ("coborrower", "co-borrower"):
        return "coborrower"
    return v


def _split_pattern_key(pattern_key: str) -> Optional[tuple]:
    """
    Split a schema field_patterns key into (prefix, suffix).
    Examples:
      FLNN02     -> (FL, 02)
      IRNNA006   -> (IR, A006)
      TANNRA     -> (TA, RA)
      NBOCNB01   -> (NBOC, NB01)   # NN implied between NBOC and NB
    """
    if "NN" in pattern_key:
        prefix, _, suffix = pattern_key.partition("NN")
        if prefix:
            return prefix, suffix
    # NonBorrowingOwner: NBOCNB{dd} means NBOC + NN + NB{dd}
    m = re.match(r"^NBOCNB(\d+)$", pattern_key)
    if m:
        return "NBOC", f"NB{m.group(1)}"
    return None


def _get_by_path(root: Any, path: tuple) -> Any:
    cur = root
    for key in path:
        if cur is None:
            return None
        if isinstance(key, int):
            if not isinstance(cur, list) or key >= len(cur):
                return None
            cur = cur[key]
        elif isinstance(cur, dict):
            cur = cur.get(key)
        else:
            return None
    return cur


def _get_field_index() -> Dict[str, List]:
    """
    Build and cache schema indexes:
      - field_id / field_instances -> (entity, prop, context)
      - field_patterns -> suffix maps + representative contexts
      - entity type -> loan object path
      - property name -> entity entries
    """
    global _FIELD_INDEX, _PATTERN_SUFFIX_MAPS, _PATTERN_CONTEXTS, _PROP_NAME_INDEX, _ENTITY_PATHS
    if _FIELD_INDEX is not None:
        return _FIELD_INDEX

    schema_path = Path(__file__).resolve().parent.parent.parent / "data" / "encompass-loan-schema.json"
    if not schema_path.exists():
        _FIELD_INDEX = {}
        _PATTERN_SUFFIX_MAPS = {}
        _PATTERN_CONTEXTS = {}
        _PROP_NAME_INDEX = {}
        _ENTITY_PATHS = {}
        return _FIELD_INDEX

    with open(schema_path) as f:
        schema = json.load(f)

    index: Dict[str, List] = {}
    pattern_suffix_maps: Dict[str, Dict[str, str]] = {}
    pattern_contexts: Dict[str, str] = {}
    prop_name_index: Dict[str, List] = {}
    entity_paths: Dict[str, tuple] = {
        "Loan": (),
        "Application": ("applications", 0),
        "Borrower": ("applications", 0, "borrower"),
        "Coborrower": ("applications", 0, "coborrower"),
        "CoBorrower": ("applications", 0, "coborrower"),
        "Property": ("property",),
        "Hmda": ("hmda",),
    }

    entity_types = schema.get("entity_types", {})

    # Derive entity paths from Loan / Application child entity properties
    for parent, path_prefix in (
        ("Loan", ()),
        ("Application", ("applications", 0)),
    ):
        parent_def = entity_types.get(parent, {})
        for prop_pascal, prop_def in parent_def.get("properties", {}).items():
            if not isinstance(prop_def, dict):
                continue
            prop_camel = _pascal_to_camel(prop_pascal)
            child_entity = prop_def.get("entity_type")
            if child_entity and prop_def.get("type") == "entity":
                entity_paths.setdefault(child_entity, path_prefix + (prop_camel,))
            # Lists/sets of entities still live at this path (collection)
            if prop_def.get("type") in ("list", "set") and child_entity:
                entity_paths.setdefault(child_entity, path_prefix + (prop_camel,))

    # Nested singleton roots that appear as context prefixes
    for root_name in (
        "ClosingDocument", "ClosingCost", "ClosingDisclosure1", "ClosingDisclosure2",
        "ClosingDisclosure3", "ClosingDisclosure4", "ClosingDisclosure5",
        "Correspondent", "RegulationZ", "Gfe", "Gfe2010", "Gfe2010Page",
        "Shipping", "Hud1Es", "VaLoanData", "Prequalification", "LoanProductData",
        "Usda", "FhaVaLoan", "LoanSubmission", "StateDisclosure", "HudLoanData",
        "TQL", "ProfitManagement", "TrustAccount", "RateLock", "ATRQMCommon",
        "Uldd", "Funding", "InterimServicing", "FreddieMac", "FannieMae",
        "UnderwriterSummary", "Miscellaneous", "TPO", "Aiq", "EClose",
        "CommitmentTerms", "PrivacyPolicy", "ServicingDisclosure", "Section32",
        "StatementCreditDenial", "DisclosureNotices", "EnergyEfficientMortgage",
        "SelectedHomeCounselingProvider", "ConstructionManagement", "NetTangibleBenefit",
        "ElliLOCompensation", "FeeVarianceOther", "CollateralTracking", "Mcaw",
        "EmDocument", "EmDocumentLender", "EmDocumentInvestor", "AdditionalRequests",
        "DownPayment", "Tsum", "LoanEstimate1", "LoanEstimate2", "LoanEstimate3",
    ):
        entity_paths.setdefault(root_name, (_pascal_to_camel(root_name),))

    for entity_name, entity_def in entity_types.items():
        for prop_pascal, prop_def in entity_def.get("properties", {}).items():
            if not isinstance(prop_def, dict):
                continue
            prop_camel = _pascal_to_camel(prop_pascal)

            prop_name_index.setdefault(prop_camel, []).append((entity_name, prop_camel, None))
            if prop_pascal != prop_camel:
                prop_name_index.setdefault(prop_pascal, []).append((entity_name, prop_camel, None))
            # Also index EllieMae first-letter-lower keys (uRLA2020StreetAddress)
            elliemae = _elliemae_camel(prop_pascal)
            if elliemae != prop_camel:
                prop_name_index.setdefault(elliemae, []).append((entity_name, prop_camel, None))

            if "field_instances" in prop_def:
                for fid, contexts in prop_def["field_instances"].items():
                    for ctx in (contexts or []):
                        index.setdefault(str(fid), []).append((entity_name, prop_camel, ctx))

            if "field_id" in prop_def:
                fid = str(prop_def["field_id"])
                index.setdefault(fid, []).append((entity_name, prop_camel, None))

            if "field_patterns" in prop_def:
                for pattern_key, contexts in prop_def["field_patterns"].items():
                    parsed = _split_pattern_key(pattern_key)
                    if not parsed:
                        continue
                    prefix, suffix = parsed
                    pattern_suffix_maps.setdefault(prefix, {})[suffix] = prop_camel
                    if prefix not in pattern_contexts and contexts:
                        pattern_contexts[prefix] = contexts[0]

    _FIELD_INDEX = index
    _PATTERN_SUFFIX_MAPS = pattern_suffix_maps
    _PATTERN_CONTEXTS = pattern_contexts
    _PROP_NAME_INDEX = prop_name_index
    _ENTITY_PATHS = entity_paths
    return _FIELD_INDEX


def _get_context_root(loan: Dict, root_name: str) -> Any:
    """Resolve a schema context root name to a loan sub-object."""
    paths = _ENTITY_PATHS or {}
    if root_name in paths:
        obj = _get_by_path(loan, paths[root_name])
        if obj is not None:
            return obj
    # Fallback: top-level camelCase key on the loan
    return loan.get(_pascal_to_camel(root_name))


def _match_residences(residences: List[Dict], context: str) -> List[Dict]:
    m = re.match(
        r"^Application_Residences_(Borrower|CoBorrower)_(true|false)"
        r"(?:_(Current|Prior))?(?:_NN(?::(\d+))?)?$",
        context,
    )
    if not m:
        return []

    applicant, mailing_s, residency_type, index_s = m.groups()
    mailing = mailing_s == "true"
    index = int(index_s) if index_s else None

    matched = []
    for res in residences:
        if _norm_applicant(res.get("applicantType")) != _norm_applicant(applicant):
            continue
        if bool(res.get("mailingAddressIndicator")) != mailing:
            continue
        if residency_type and res.get("residencyType") != residency_type:
            continue
        matched.append(res)

    if index is not None:
        return [matched[index - 1]] if 0 < index <= len(matched) else []
    return matched


def _match_employments(employments: List[Dict], context: str) -> List[Dict]:
    m = re.match(
        r"^Application_Employment_(Borrower|CoBorrower)"
        r"(?:_(true|false))?(?:_NN(?::(\d+))?)?$",
        context,
    )
    if not m:
        return []

    owner, current_s, index_s = m.groups()
    index = int(index_s) if index_s else None

    matched = []
    for emp in employments:
        if _norm_applicant(emp.get("owner")) != _norm_applicant(owner):
            continue
        if current_s is not None:
            if bool(emp.get("currentEmploymentIndicator")) != (current_s == "true"):
                continue
        matched.append(emp)

    if index is not None:
        return [matched[index - 1]] if 0 < index <= len(matched) else []
    return matched


def _item_matches_filters(item: Dict, filters: List[str], all_items: Optional[List[Dict]] = None) -> bool:
    """Return True if a collection item satisfies schema context filter tokens."""
    if not filters:
        return True

    # Context strings use underscores both as path separators and within some
    # discriminator values (for example, ContactType=BUYERS_AGENT).
    if len(filters) > 1:
        combined_filter = "_".join(filters)
        for candidate in all_items or [item]:
            for field in _TYPE_FIELDS:
                value = candidate.get(field)
                if value is not None and str(value) == combined_filter:
                    filters = [combined_filter]
                    break
            if len(filters) == 1:
                break

    # Drop annotation tokens that never appear as a type-field value on any item
    # (e.g. Loan_NonBorrowingOwners_NB — "NB" is a path label, not an item discriminator)
    effective = []
    for tok in filters:
        if tok in ("true", "false") or tok in ("Borrower", "CoBorrower", "Coborrower"):
            effective.append(tok)
            continue
        if all_items is not None:
            appears = False
            for other in all_items:
                for field in _TYPE_FIELDS:
                    val = other.get(field)
                    if val is None:
                        continue
                    if str(val) == tok or _norm_applicant(str(val)) == _norm_applicant(tok):
                        appears = True
                        break
                if appears:
                    break
            if not appears:
                continue
        effective.append(tok)

    tokens = list(effective)

    # Applicant / owner discriminator
    if tokens and tokens[0] in ("Borrower", "CoBorrower", "Coborrower"):
        tok = tokens.pop(0)
        if not any(
            _norm_applicant(str(item.get(f) or "")) == _norm_applicant(tok)
            for f in ("owner", "applicantType", "person", "borrowerType")
        ):
            return False

    bool_fields = (
        "mailingAddressIndicator",
        "currentEmploymentIndicator",
        "tax4506TIndicator",
        "historyIndicator",
        "irs4506C",
    )

    for tok in tokens:
        if tok in ("true", "false"):
            want = tok == "true"
            matched_bool = False
            for bf in bool_fields:
                if bf in item and item[bf] is not None:
                    if bool(item[bf]) == want:
                        matched_bool = True
                        break
                    return False
            if matched_bool:
                continue
            continue

        matched = False
        for field in _TYPE_FIELDS:
            val = item.get(field)
            if val is None:
                continue
            if isinstance(val, bool):
                continue
            if str(val) == tok or _norm_applicant(str(val)) == _norm_applicant(tok):
                matched = True
                break
            if isinstance(val, int) and tok.isdigit() and val == int(tok):
                matched = True
                break
        if not matched:
            for k, v in item.items():
                if not isinstance(v, str):
                    continue
                kl = k.lower()
                if kl.endswith("type") or kl in ("section", "id", "altid", "name", "state"):
                    if v == tok or _norm_applicant(v) == _norm_applicant(tok):
                        matched = True
                        break
        if not matched:
            return False
    return True


def _navigate_by_context(loan: Dict, context: str) -> List[Dict]:
    """
    Navigate a loan object using an Encompass schema context string.

    Examples:
      Application_Residences_Borrower_false_Current_NN:1
      Loan_Fees_PropertyTaxes
      Gfe2010_Gfe2010Fees_Section800_Line818_0
      Application_GiftsGrants_NN
      Borrower
      ClosingDocument_ClosingEntities_Trustee_NN
    """
    if not context:
        return []

    # Bare borrower/coborrower contexts
    if context in ("Borrower", "Coborrower", "CoBorrower"):
        app = (loan.get("applications") or [{}])[0]
        key = "borrower" if context == "Borrower" else "coborrower"
        obj = app.get(key)
        return [obj] if isinstance(obj, dict) else []

    # Specialized application collection matchers
    if context.startswith("Application_Residences_"):
        app = (loan.get("applications") or [{}])[0]
        return _match_residences(app.get("residences") or [], context)

    if context.startswith("Application_Employment_"):
        app = (loan.get("applications") or [{}])[0]
        return _match_employments(app.get("employment") or [], context)

    if context.startswith("Application_Income_"):
        app = (loan.get("applications") or [{}])[0]
        income_id = context[len("Application_Income_"):]
        return [
            inc for inc in (app.get("income") or [])
            if isinstance(inc, dict) and inc.get("id") == income_id
        ]

    parts = context.split("_")
    if not parts:
        return []

    root_name = parts[0]
    rest = parts[1:]
    container = _get_context_root(loan, root_name)
    if container is None:
        return []

    # Root-only context pointing at a dict entity
    if not rest:
        return [container] if isinstance(container, dict) else []

    # Peel trailing index: NN, NN:N, or bare digits (incl. 0-based GFE indexes)
    index: Optional[int] = None
    zero_based = False
    if rest:
        last = rest[-1]
        if last == "NN":
            rest = rest[:-1]
        elif last.startswith("NN:"):
            try:
                index = int(last.split(":", 1)[1])
            except ValueError:
                pass
            rest = rest[:-1]
        elif last.isdigit():
            index = int(last)
            # Bare numeric suffixes in GFE/UCD contexts are typically 0-based indexes
            zero_based = True
            rest = rest[:-1]

    if not rest:
        if isinstance(container, list):
            items = [x for x in container if isinstance(x, dict)]
        elif isinstance(container, dict):
            return [container]
        else:
            return []
        if index is not None:
            adj = index if zero_based else index - 1
            return [items[adj]] if 0 <= adj < len(items) else []
        return items

    collection_pascal = rest[0]
    filters = rest[1:]
    collection_key = _pascal_to_camel(collection_pascal)

    if not isinstance(container, dict):
        return []

    raw = container.get(collection_key)
    # Some OneLoan payloads use slightly different casings — try a few alternates
    if raw is None:
        for k, v in container.items():
            if k.lower() == collection_key.lower():
                raw = v
                break

    if isinstance(raw, list):
        items = [x for x in raw if isinstance(x, dict)]
    elif isinstance(raw, dict):
        items = [raw]
    else:
        return []

    matched = [item for item in items if _item_matches_filters(item, filters, items)]

    if index is not None:
        adj = index if zero_based else index - 1
        # Prefer 1-based when zero_based is False; also accept 0-based if adj was already 0
        if zero_based:
            return [matched[index]] if 0 <= index < len(matched) else []
        # 1-based NN:N
        if 0 < index <= len(matched):
            return [matched[index - 1]]
        # Some contexts use 0-based bare indexes even outside GFE
        if 0 <= index < len(matched):
            return [matched[index]]
        return []

    return matched


def _resolve_entity_object(loan: Dict, entity_type: str) -> Any:
    """Resolve a singleton/collection entity object for field_id (no context) lookups."""
    paths = _ENTITY_PATHS or {}
    if entity_type in paths:
        return _get_by_path(loan, paths[entity_type])
    return loan.get(_pascal_to_camel(entity_type))


def _resolve_field_value(loan: Dict, entity_type: str, prop_camel: str, context: Optional[str]) -> Any:
    """Navigate the loan response object to retrieve a single field's value."""
    if context:
        matched = _navigate_by_context(loan, context)
        if not matched:
            return None
        return _get_obj_prop(matched[0], prop_camel)

    obj = _resolve_entity_object(loan, entity_type)
    if isinstance(obj, dict):
        return _get_obj_prop(obj, prop_camel)
    if isinstance(obj, list):
        # Unscoped collection field_id — return first item's property if present
        for item in obj:
            if not isinstance(item, dict):
                continue
            alt = _elliemae_key_variant(prop_camel)
            if prop_camel in item or (alt and alt in item):
                return _get_obj_prop(item, prop_camel)
        return None

    # Final fallback: top-level loan property
    if entity_type == "Loan":
        return _get_obj_prop(loan, prop_camel)
    return None


def _parse_pattern_field_id(fid: str) -> Optional[tuple]:
    """
    Parse collection pattern field IDs using schema prefixes/suffixes.
    Supports numeric and alphanumeric suffixes:
      FL0102, IR01A006, TA01RA, NBOC01NB01, URLARGG0101
    Returns (prefix, index, suffix) or None.
    """
    maps = _PATTERN_SUFFIX_MAPS or {}
    if not maps:
        return None

    best = None  # (score, prefix, index, suffix)
    for prefix in maps:
        if not fid.startswith(prefix):
            continue
        rest = fid[len(prefix):]
        for suffix, _prop in maps[prefix].items():
            if suffix:
                if not rest.endswith(suffix):
                    continue
                mid = rest[: -len(suffix)]
            else:
                mid = rest
            if re.fullmatch(r"\d{2}", mid):
                score = len(prefix) + len(suffix)
                if best is None or score > best[0]:
                    best = (score, prefix, mid, suffix)
    if best:
        return best[1], best[2], best[3]
    return None


def _resolve_collection_pattern_field(fid: str, loan: Dict) -> Optional[Any]:
    """
    Resolve any schema field_patterns PREFIX{NN}{suffix} ID to a list of values.
    Returns None only when the ID is not a recognised pattern field.
    """
    parsed = _parse_pattern_field_id(fid)
    if not parsed:
        return None
    prefix, _index, suffix = parsed

    maps = _PATTERN_SUFFIX_MAPS or {}
    prop_camel = maps.get(prefix, {}).get(suffix)
    if not prop_camel:
        return None

    context = (_PATTERN_CONTEXTS or {}).get(prefix)
    if context:
        matched = _navigate_by_context(loan, context)
    else:
        matched = []

    values = [_get_obj_prop(item, prop_camel) for item in matched]

    # Liability account numbers: only return last 4 digits
    if prefix == "FL" and suffix == "10":
        values = [v[-4:] if isinstance(v, str) and len(v) >= 4 else v for v in values]

    return values


def _normalize_selector_token(value: Any) -> str:
    """Normalize Encompass selector tokens for role comparisons."""
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _role_tokens(value: Any) -> set[str]:
    """Return equivalent normalized tokens for a loan-team role."""
    token = _normalize_selector_token(value)
    aliases = {
        "loanofficer": {"loanofficer"},
        "processmanager": {"processmanager", "processingmanager", "processor", "mortgageconsultant"},
        "processingmanager": {"processmanager", "processingmanager", "processor", "mortgageconsultant"},
        "processor": {"processmanager", "processingmanager", "processor", "mortgageconsultant"},
    }
    return aliases.get(token, {token})


def _get_case_insensitive(obj: Any, key: str) -> Any:
    if not isinstance(obj, dict):
        return None
    if key in obj:
        return obj[key]
    key_lower = key.lower()
    for candidate, value in obj.items():
        if str(candidate).lower() == key_lower:
            return value
    return None

def _match_role(member: Dict, requested_roles: set[str]) -> bool:
    """Checks if the given dict holds one of the requested roles."""
    role_fields = ("loanTeamMemberType", "roleName", "role", "type")
    return any(
        _role_tokens(_get_case_insensitive(member, field)) & requested_roles
        for field in role_fields
    )

def _member_identity(member: Dict) -> Optional[str]:
    """Identify a team-member/loanAssociate dict by user id"""
    return _get_case_insensitive(member, "idString") or _get_case_insensitive(member, "id")

def _dedupe_members_by_identity(members: List[Dict]) -> List[Dict]:
    seen_ids: set[str] = set()
    deduped: List[Dict] = []
    for member in members:
        identity = _member_identity(member)
        if identity is not None:
            if identity in seen_ids:
                continue
            seen_ids.add(identity)
        deduped.append(member)
    return deduped

def _get_team_members_raw(data: Dict) -> Any:
    """Locate the live team-members list."""
    for key in ("team-members", "team-member", "loanTeamMembers", "loanTeamMember"):
        value = _get_case_insensitive(data, key)
        if isinstance(value, list):
            return value
    return None

def _milestone_log_entries(loan: Dict) -> List[Dict]:
    """All milestone-log-shaped entries (milestoneLogs + milestoneFreeRoleLogs),
    in list order"""
    entries: List[Dict] = []
    for log_key in ("milestoneLogs", "milestoneFreeRoleLogs"):
        for milestone in (_get_case_insensitive(loan, log_key) or []):
            if isinstance(milestone, dict):
                entries.append(milestone)
    return entries

def _first_unfinished_milestone_associate(loan: Dict, requested_roles: set[str]) -> Any:
    """Disambiguate between multiple current team-members candidates for the
    same role (can happen for a role tied to more than one milestone, e.g.
    Underwriter, if it was reassigned on only one of them) by taking
    whichever person is attached to the first not-yet-done milestone that
    requires this role."""
    for milestone in _milestone_log_entries(loan):
        associate = _get_case_insensitive(milestone, "loanAssociate")
        if not isinstance(associate, dict):
            continue
        if not _match_role(associate, requested_roles):
            continue
        if _member_identity(associate) is None:
            continue
        if _get_case_insensitive(milestone, "doneIndicator"):
            continue
        return associate
    return None

def _rebuild_candidates_from_logs(loan: Dict, requested_roles: set[str]) -> List[Dict]:
    """Fallback source when team-members is missing entirely from the
    response: rebuild the candidate list from every milestone-log
    loanAssociate for this role, in list order."""
    return [
        assoc for assoc in (
            _get_case_insensitive(m, "loanAssociate") for m in _milestone_log_entries(loan)
        )
        if isinstance(assoc, dict) and _match_role(assoc, requested_roles) and _member_identity(assoc) is not None
    ]


def _resolve_loan_team_member_selector(selector: str, data: Dict) -> tuple[bool, Any]:
    """Resolve selectors such as LoanTeamMember.Email.Loan_Officer."""
    parts = selector.split(".")
    if len(parts) != 3 or parts[0].lower() != "loanteammember":
        return False, None

    property_name = _pascal_to_camel(parts[1])
    requested_roles = _role_tokens(parts[2])
    loan = data.get("loan", data)

    team_members = _get_team_members_raw(data)

    if team_members is not None:
        matching = [m for m in team_members if isinstance(m, dict) and _match_role(m, requested_roles)]
        candidates = _dedupe_members_by_identity(matching)
        if len(candidates) > 1:
            disambiguated = _first_unfinished_milestone_associate(loan, requested_roles)
            candidates = [disambiguated] if disambiguated is not None else candidates[-1:]
        member = candidates[0] if candidates else None
    else:
        rebuilt = _rebuild_candidates_from_logs(loan, requested_roles)
        member = rebuilt[-1] if rebuilt else None

    if member is None:
        return True, None

    value = _get_case_insensitive(member, property_name)
    if value is None and property_name == "userId":
        value = _get_case_insensitive(member, "idString")
        if value is None:
            value = _get_case_insensitive(member, "id")
    return True, value
    


def _resolve_milestone_log_selector(selector: str, loan: Dict) -> tuple[bool, Any]:
    """Resolve virtual milestone dates against the loan's milestone logs."""
    match = _MILESTONE_LOG_SELECTOR_RE.match(selector)
    if not match:
        return False, None
    field, name = match.groups()
    target = name.replace("_", " ").strip().lower()
    for entry in loan.get("milestoneLogs", []) or []:
        if (entry.get("stage") or "").strip().lower() == target:
            value = entry.get("dateUtc")
            if field.lower() == "date" and value:
                value = value.split("T")[0]
            return True, value
    return True, None


def _resolve_unresolved_fields(loan: Dict, unresolved_ids: List[str]) -> tuple[Dict[str, Any], List[str]]:
    """Resolve milestone and virtual selectors shared by OneLoan and Encompass.

    A schema-known suffix identifies a valid virtual selector, but its value must
    come from the exact virtualFields key, not the underlying live loan property.
    """
    virtual_fields = loan.get("virtualFields", {}) or {}
    resolved: Dict[str, Any] = {}
    still_unresolved: List[str] = []
    for fid in unresolved_ids:
        matched, value = _resolve_milestone_log_selector(fid, loan)
        if matched:
            resolved[fid] = value
            continue
        if fid in virtual_fields:
            resolved[fid] = virtual_fields[fid]
            continue
        if "." in fid:
            field_id = fid.rsplit(".", 1)[-1]
            field_result = _extract_requested_fields(loan, [field_id])
            if field_id not in (field_result.get("unresolved_field_ids") or []):
                resolved[fid] = None
                continue
        still_unresolved.append(fid)
    return resolved, still_unresolved


def _extract_requested_fields(api_response: Dict, requested_field_ids: List[str]) -> Dict:
    """
    Given a raw OneLoan API response and a list of Encompass field IDs,
    return only the values for the requested fields.
    """
    index = _get_field_index()

    # Navigate: api_response -> data -> loan
    data = api_response.get("data", api_response)
    loan = data.get("loan", data)

    # Build a lookup map for custom fields: fieldName -> stringValue
    custom_field_map = {
        cf["fieldName"]: cf.get("stringValue")
        for cf in loan.get("customFields", [])
        if "fieldName" in cf
    }

    result = {}
    unresolved = []

    for fid in requested_field_ids:
        fid = str(fid)

        selector_resolved, selector_value = _resolve_loan_team_member_selector(fid, data)
        if selector_resolved:
            result[fid] = selector_value
            continue

        # CX.* fields live in the customFields array, not the schema
        if fid.startswith("CX."):
            result[fid] = custom_field_map.get(fid)
            continue

        # Collection pattern fields: any PREFIX{NN}{suffix} known to the schema
        pattern_values = _resolve_collection_pattern_field(fid, loan)
        if pattern_values is not None:
            result[fid] = pattern_values
            continue

        entries = index.get(fid)
        if entries:
            entity_type, prop_camel, context = entries[0]
            result[fid] = _resolve_field_value(loan, entity_type, prop_camel, context)
            continue

        # Not a recognised field ID — treat as a direct property name (PascalCase or camelCase)
        prop_entries = (_PROP_NAME_INDEX or {}).get(fid)
        if prop_entries:
            entity_type, prop_camel, context = prop_entries[0]
            result[fid] = _resolve_field_value(loan, entity_type, prop_camel, context)
        elif fid in loan:
            result[fid] = loan[fid]
        elif fid in data:
            result[fid] = data[fid]
        else:
            unresolved.append(fid)

    if unresolved:
        resolved, still_unresolved = _resolve_unresolved_fields(loan, unresolved)
        result.update(resolved)
        if still_unresolved:
            result["unresolved_field_ids"] = still_unresolved

    return result


# ---------------------------------------------------------------------------
# Patch body builder
# ---------------------------------------------------------------------------

# Descriptor tuple format:
#   ("loan",            prop)
#   ("property",        prop)
#   ("application",     prop)
#   ("borrower",        prop)                             -> applications[0].borrower
#   ("coborrower",      prop)                             -> applications[0].coborrower
#   ("residence",       applicant, residency, prop)       residency: "Current" | "Prior" | "Mailing"
#   ("employment",      owner, is_current: bool, prop)
#   ("vaLoanData",      prop)
#   ("loanProductData", prop)
#   ("closingCost",     prop)
#   ("fee",             fee_type, prop)
#   CX.* custom fields are handled inline — no registry entry needed

_PATCH_FIELD_REGISTRY: Dict[str, tuple] = {
    # --- Loan level ---
    "745":       ("loan", "originationDate"),
    "136":       ("loan", "purchasePriceAmount"),
    "356":       ("loan", "propertyAppraisedValueAmount"),
    "230":       ("loan", "proposedHazardInsuranceAmount"),
    "URLA.X165": ("loan", "refinanceCashOutDeterminationType"),
    "URLA.X166": ("loan", "governmentRefinanceType"),

    # --- Property ---
    "URLA.X73": ("property", "addressLineText"),
    "12":       ("property", "city"),
    "13":       ("property", "county"),
    "14":       ("property", "state"),
    "15":       ("property", "postalCode"),
    "16":       ("property", "financedNumberOfUnits"),
    "19":       ("property", "loanPurposeType"),
    "24":       ("property", "refinancePropertyAcquiredYear"),
    "25":       ("property", "refinancePropertyOriginalCostAmount"),

    # --- LoanProductData ---
    "1041": ("loanProductData", "gsePropertyType"),

    # --- VaLoanData ---
    "954": ("vaLoanData", "militaryBranchOfService"),

    # --- Closing, disclosure, and underwriting dates ---
    "748":  ("fhaVaLoan", "closingDate"),
    "3197": ("regulationZ", "borrowerIntendToContinueDate"),
    "3624": ("regulationZ", "initialGFEAppraisalProvidedDate"),
    "2298": ("underwriterSummary", "submittedDate"),
    "2301": ("underwriterSummary", "approvedDate"),
    "2305": ("underwriterSummary", "clearToCloseDate"),

    # --- Closing cost ---
    "411": ("closingCost", "titleCompanyName"),

    # --- Fee ---
    "231": ("fee", "PropertyTaxes", "monthlyPayment"),

    # --- Application ---
    "119":  ("application", "rentAmount"),
    "120":  ("application", "firstMortgagePrincipalAndInterestAmount"),
    "122":  ("application", "hazardInsuranceAmount"),
    "123":  ("application", "realEstateTaxAmount"),
    "125":  ("application", "homeownersAssociationDuesAndCondoFeesAmount"),
    "1811": ("application", "propertyUsageType"),

    # --- Borrower personal info ---
    "4000":      ("borrower", "firstName"),
    "4002":      ("borrower", "lastName"),
    "65":        ("borrower", "taxIdentificationIdentifier"),
    "1402":      ("borrower", "birthDate"),
    "66":        ("borrower", "homePhoneNumber"),
    "1490":      ("borrower", "mobilePhone"),
    "1240":      ("borrower", "emailAddressText"),
    "52":        ("borrower", "maritalStatusType"),
    "53":        ("borrower", "dependentCount"),
    "54":        ("borrower", "dependentsAgesDescription"),
    "URLA.X1":   ("borrower", "urla2020CitizenshipResidencyType"),
    "URLA.X263": ("borrower", "urla2020CountryOfCitizenship"),
    "URLA.X13":  ("borrower", "selfDeclaredMilitaryServiceIndicator"),
    "URLA.X123": ("borrower", "activeDuty"),
    "URLA.X124": ("borrower", "veteran"),
    "URLA.X125": ("borrower", "reserveNationalGuardReserveActivated"),
    "URLA.X19":  ("borrower", "spousalVABenefitsEligibilityIndicator"),
    "URLA.X199": ("borrower", "currentEmploymentDoesNotApply"),

    # --- Borrower declarations ---
    "169":       ("borrower", "outstandingJudgementsIndicator"),
    "265":       ("borrower", "bankruptcyIndicator"),
    "403":       ("borrower", "homeownerPastThreeYearsIndicator"),
    "418":       ("borrower", "intentToOccupyIndicator"),
    "981":       ("borrower", "priorPropertyUsageType"),
    "1069":      ("borrower", "priorPropertyTitleType"),
    "URLA.X84":  ("borrower", "specialBorrowerSellerRelationshipIndicator"),
    "URLA.X86":  ("borrower", "undisclosedBorrowedFundsIndicator"),
    "URLA.X88":  ("borrower", "undisclosedBorrowedFundsAmount"),
    "URLA.X90":  ("borrower", "undisclosedMortgageApplicationIndicator"),
    "URLA.X92":  ("borrower", "undisclosedCreditApplicationIndicator"),
    "URLA.X94":  ("borrower", "propertyProposedCleanEnergyLienIndicator"),
    "URLA.X96":  ("borrower", "undisclosedComakerOfNoteIndicator"),
    "URLA.X98":  ("borrower", "presentlyDelinquentIndicatorURLA"),
    "URLA.X100": ("borrower", "partyToLawsuitIndicatorURLA"),
    "URLA.X102": ("borrower", "priorPropertyDeedInLieuConveyedIndicator"),
    "URLA.X104": ("borrower", "priorPropertyShortSaleCompletedIndicator"),
    "URLA.X106": ("borrower", "priorPropertyForeclosureCompletedIndicator"),
    "URLA.X174": ("borrower", "bankruptcyIndicatorChapterSeven"),
    "URLA.X175": ("borrower", "bankruptcyIndicatorChapterEleven"),
    "URLA.X176": ("borrower", "bankruptcyIndicatorChapterTwelve"),
    "URLA.X177": ("borrower", "bankruptcyIndicatorChapterThirteen"),

    # --- CoBorrower personal info ---
    "4004":      ("coborrower", "firstName"),
    "4006":      ("coborrower", "lastName"),
    "97":        ("coborrower", "taxIdentificationIdentifier"),
    "1403":      ("coborrower", "birthDate"),
    "98":        ("coborrower", "homePhoneNumber"),
    "1480":      ("coborrower", "mobilePhone"),
    "84":        ("coborrower", "maritalStatusType"),
    "85":        ("coborrower", "dependentCount"),
    "86":        ("coborrower", "dependentsAgesDescription"),
    "URLA.X2":   ("coborrower", "urla2020CitizenshipResidencyType"),
    "URLA.X14":  ("coborrower", "selfDeclaredMilitaryServiceIndicator"),
    "URLA.X126": ("coborrower", "activeDuty"),
    "URLA.X127": ("coborrower", "veteran"),
    "URLA.X128": ("coborrower", "reserveNationalGuardReserveActivated"),
    "URLA.X20":  ("coborrower", "spousalVABenefitsEligibilityIndicator"),
    "URLA.X200": ("coborrower", "currentEmploymentDoesNotApply"),

    # --- CoBorrower declarations ---
    "175":       ("coborrower", "outstandingJudgementsIndicator"),
    "266":       ("coborrower", "bankruptcyIndicator"),
    "1015":      ("coborrower", "priorPropertyUsageType"),
    "1070":      ("coborrower", "priorPropertyTitleType"),
    "1108":      ("coborrower", "homeownerPastThreeYearsIndicator"),
    "1343":      ("coborrower", "intentToOccupyIndicator"),
    "URLA.X85":  ("coborrower", "specialBorrowerSellerRelationshipIndicator"),
    "URLA.X87":  ("coborrower", "undisclosedBorrowedFundsIndicator"),
    "URLA.X89":  ("coborrower", "undisclosedBorrowedFundsAmount"),
    "URLA.X91":  ("coborrower", "undisclosedMortgageApplicationIndicator"),
    "URLA.X93":  ("coborrower", "undisclosedCreditApplicationIndicator"),
    "URLA.X95":  ("coborrower", "propertyProposedCleanEnergyLienIndicator"),
    "URLA.X97":  ("coborrower", "undisclosedComakerOfNoteIndicator"),
    "URLA.X99":  ("coborrower", "presentlyDelinquentIndicatorURLA"),
    "URLA.X101": ("coborrower", "partyToLawsuitIndicatorURLA"),
    "URLA.X103": ("coborrower", "priorPropertyDeedInLieuConveyedIndicator"),
    "URLA.X105": ("coborrower", "priorPropertyShortSaleCompletedIndicator"),
    "URLA.X107": ("coborrower", "priorPropertyForeclosureCompletedIndicator"),
    "URLA.X178": ("coborrower", "bankruptcyIndicatorChapterSeven"),
    "URLA.X179": ("coborrower", "bankruptcyIndicatorChapterEleven"),
    "URLA.X180": ("coborrower", "bankruptcyIndicatorChapterTwelve"),
    "URLA.X181": ("coborrower", "bankruptcyIndicatorChapterThirteen"),

    # --- Borrower current residence ---
    "FR0106": ("residence", "Borrower", "Current", "addressCity"),
    "FR0107": ("residence", "Borrower", "Current", "addressState"),
    "FR0108": ("residence", "Borrower", "Current", "addressPostalCode"),
    "FR0112": ("residence", "Borrower", "Current", "durationTermYears"),
    "FR0124": ("residence", "Borrower", "Current", "durationTermMonths"),
    "FR0115": ("residence", "Borrower", "Current", "residencyBasisType"),
    "FR0126": ("residence", "Borrower", "Current", "urla2020StreetAddress"),

    # --- Borrower previous residence ---
    "BR0206": ("residence", "Borrower", "Prior", "addressCity"),
    "BR0207": ("residence", "Borrower", "Prior", "addressState"),
    "BR0208": ("residence", "Borrower", "Prior", "addressPostalCode"),
    "BR0212": ("residence", "Borrower", "Prior", "durationTermYears"),
    "BR0224": ("residence", "Borrower", "Prior", "durationTermMonths"),
    "BR0215": ("residence", "Borrower", "Prior", "residencyBasisType"),
    "BR0226": ("residence", "Borrower", "Prior", "urla2020StreetAddress"),

    # --- Borrower mailing address ---
    "URLA.X197": ("residence", "Borrower", "Mailing", "urla2020StreetAddress"),
    "1417":      ("residence", "Borrower", "Mailing", "addressCity"),
    "1418":      ("residence", "Borrower", "Mailing", "addressState"),
    "1419":      ("residence", "Borrower", "Mailing", "addressPostalCode"),

    # --- CoBorrower current residence ---
    "FR0206": ("residence", "CoBorrower", "Current", "addressCity"),
    "FR0207": ("residence", "CoBorrower", "Current", "addressState"),
    "FR0208": ("residence", "CoBorrower", "Current", "addressPostalCode"),
    "FR0212": ("residence", "CoBorrower", "Current", "durationTermYears"),
    "FR0224": ("residence", "CoBorrower", "Current", "durationTermMonths"),
    "FR0215": ("residence", "CoBorrower", "Current", "residencyBasisType"),
    "FR0226": ("residence", "CoBorrower", "Current", "urla2020StreetAddress"),

    # --- CoBorrower previous residence ---
    "CR0206": ("residence", "CoBorrower", "Prior", "addressCity"),
    "CR0207": ("residence", "CoBorrower", "Prior", "addressState"),
    "CR0208": ("residence", "CoBorrower", "Prior", "addressPostalCode"),
    "CR0212": ("residence", "CoBorrower", "Prior", "durationTermYears"),
    "CR0224": ("residence", "CoBorrower", "Prior", "durationTermMonths"),
    "CR0215": ("residence", "CoBorrower", "Prior", "residencyBasisType"),
    "CR0226": ("residence", "CoBorrower", "Prior", "urla2020StreetAddress"),

    # --- CoBorrower mailing address ---
    "URLA.X198": ("residence", "CoBorrower", "Mailing", "urla2020StreetAddress"),
    "1520":      ("residence", "CoBorrower", "Mailing", "addressCity"),
    "1521":      ("residence", "CoBorrower", "Mailing", "addressState"),
    "1522":      ("residence", "CoBorrower", "Mailing", "addressPostalCode"),

    # --- Borrower current employment ---
    "FE0102": ("employment", "Borrower", True, "employerName"),
    "FE0105": ("employment", "Borrower", True, "addressCity"),
    "FE0106": ("employment", "Borrower", True, "addressState"),
    "FE0107": ("employment", "Borrower", True, "addressPostalCode"),
    "FE0110": ("employment", "Borrower", True, "positionDescription"),
    "FE0113": ("employment", "Borrower", True, "timeOnJobTermYears"),
    "FE0133": ("employment", "Borrower", True, "timeOnJobTermMonths"),
    "FE0115": ("employment", "Borrower", True, "selfEmployedIndicator"),
    "FE0116": ("employment", "Borrower", True, "timeInLineOfWorkYears"),
    "FE0117": ("employment", "Borrower", True, "phoneNumber"),
    "FE0119": ("employment", "Borrower", True, "basePayAmount"),
    "FE0120": ("employment", "Borrower", True, "overtimeAmount"),
    "FE0121": ("employment", "Borrower", True, "bonusAmount"),
    "FE0122": ("employment", "Borrower", True, "commissionsAmount"),
    "FE0123": ("employment", "Borrower", True, "otherAmount"),
    "FE0151": ("employment", "Borrower", True, "employmentStartDate"),
    "FE0155": ("employment", "Borrower", True, "ownershipInterestType"),
    "FE0160": ("employment", "Borrower", True, "urla2020StreetAddress"),

    # --- Borrower previous employment ---
    "BE0202": ("employment", "Borrower", False, "employerName"),
    "BE0205": ("employment", "Borrower", False, "addressCity"),
    "BE0206": ("employment", "Borrower", False, "addressState"),
    "BE0207": ("employment", "Borrower", False, "addressPostalCode"),
    "BE0210": ("employment", "Borrower", False, "positionDescription"),
    "BE0212": ("employment", "Borrower", False, "timeOnJobTermYears"),
    "BE0214": ("employment", "Borrower", False, "endDate"),
    "BE0216": ("employment", "Borrower", False, "timeInLineOfWorkYears"),
    "BE0251": ("employment", "Borrower", False, "employmentStartDate"),
    "BE0260": ("employment", "Borrower", False, "urla2020StreetAddress"),

    # --- CoBorrower current employment ---
    "FE0202": ("employment", "CoBorrower", True, "employerName"),
    "FE0205": ("employment", "CoBorrower", True, "addressCity"),
    "FE0206": ("employment", "CoBorrower", True, "addressState"),
    "FE0207": ("employment", "CoBorrower", True, "addressPostalCode"),
    "FE0210": ("employment", "CoBorrower", True, "positionDescription"),
    "FE0213": ("employment", "CoBorrower", True, "timeOnJobTermYears"),
    "FE0233": ("employment", "CoBorrower", True, "timeOnJobTermMonths"),
    "FE0215": ("employment", "CoBorrower", True, "selfEmployedIndicator"),
    "FE0216": ("employment", "CoBorrower", True, "timeInLineOfWorkYears"),
    "FE0217": ("employment", "CoBorrower", True, "phoneNumber"),
    "FE0219": ("employment", "CoBorrower", True, "basePayAmount"),
    "FE0220": ("employment", "CoBorrower", True, "overtimeAmount"),
    "FE0221": ("employment", "CoBorrower", True, "bonusAmount"),
    "FE0222": ("employment", "CoBorrower", True, "commissionsAmount"),
    "FE0223": ("employment", "CoBorrower", True, "otherAmount"),
    "FE0251": ("employment", "CoBorrower", True, "employmentStartDate"),
    "FE0255": ("employment", "CoBorrower", True, "ownershipInterestType"),
    "FE0260": ("employment", "CoBorrower", True, "urla2020StreetAddress"),

    # --- CoBorrower previous employment ---
    "CE0202": ("employment", "CoBorrower", False, "employerName"),
    "CE0205": ("employment", "CoBorrower", False, "addressCity"),
    "CE0206": ("employment", "CoBorrower", False, "addressState"),
    "CE0207": ("employment", "CoBorrower", False, "addressPostalCode"),
    "CE0210": ("employment", "CoBorrower", False, "positionDescription"),
    "CE0213": ("employment", "CoBorrower", False, "timeOnJobTermYears"),
    "CE0214": ("employment", "CoBorrower", False, "endDate"),
    "CE0216": ("employment", "CoBorrower", False, "timeInLineOfWorkYears"),
    "CE0251": ("employment", "CoBorrower", False, "employmentStartDate"),
    "CE0260": ("employment", "CoBorrower", False, "urla2020StreetAddress"),

    # --- Contact (role assignment IDs) ---
    "UWID": ("contact", "LOAN_UNDERWRITER", "loginId"),
    "LPID": ("contact", "LOAN_PROCESSOR", "loginId"),
}


def _get_or_create_application(loan: Dict, application_id: str) -> Dict:
    if "applications" not in loan:
        loan["applications"] = [{"id": application_id}]
    return loan["applications"][0]


def _find_or_create_residence(residences: List[Dict], applicant: str, residency: str) -> Dict:
    for item in residences:
        if item.get("applicantType") != applicant:
            continue
        if residency == "Mailing":
            if item.get("mailingAddressIndicator"):
                return item
        elif not item.get("mailingAddressIndicator") and item.get("residencyType") == residency:
            return item
    new: Dict = {"applicantType": applicant}
    if residency == "Mailing":
        new["mailingAddressIndicator"] = True
    else:
        new["residencyType"] = residency
        new["mailingAddressIndicator"] = False
    residences.append(new)
    return new


def _find_or_create_employment(employment: List[Dict], owner: str, is_current: bool) -> Dict:
    for item in employment:
        if item.get("owner") == owner and bool(item.get("currentEmploymentIndicator")) == is_current:
            return item
    new: Dict = {"owner": owner, "currentEmploymentIndicator": is_current}
    employment.append(new)
    return new


def _find_or_create_fee(fees: List[Dict], fee_type: str) -> Dict:
    for item in fees:
        if item.get("feeType") == fee_type:
            return item
    new: Dict = {"feeType": fee_type}
    fees.append(new)
    return new

def _find_or_create_contact(contacts: List[Dict], contact_type: str) -> Dict:
    for item in contacts:
        if item.get("contactType") == contact_type:
            return item
    new: Dict = {"contactType": contact_type}
    contacts.append(new)
    return new


def _find_existing_residence_id(
    existing_loan: Dict, application_id: str, applicant: str, residency: str
) -> Optional[str]:
    apps = existing_loan.get("applications", [])
    app = next((a for a in apps if a.get("id") == application_id), apps[0] if apps else None)
    if not app:
        return None
    for r in app.get("residences", []):
        if r.get("applicantType") != applicant:
            continue
        if residency == "Mailing":
            if r.get("mailingAddressIndicator"):
                return r.get("id")
        elif not r.get("mailingAddressIndicator") and r.get("residencyType") == residency:
            return r.get("id")
    return None


def _find_existing_employment_id(
    existing_loan: Dict, application_id: str, owner: str, is_current: bool
) -> Optional[str]:
    apps = existing_loan.get("applications", [])
    app = next((a for a in apps if a.get("id") == application_id), apps[0] if apps else None)
    if not app:
        return None
    for e in app.get("employment", []):
        if e.get("owner") == owner and bool(e.get("currentEmploymentIndicator")) == is_current:
            return e.get("id")
    return None

def _find_existing_contact_id(existing_loan: Dict, contact_type: str) -> Optional[str]:
    # Contacts live at loan level, same as fees — not per-application like residence/employment
    for c in existing_loan.get("contacts", []):
        if c.get("contactType") == contact_type:
            return c.get("id")
    return None


def _build_patch_body(
    application_id: str,
    fields: Dict[str, Any],
    existing_loan: Optional[Dict] = None,
) -> list:
    """Convert a flat {fieldId: value} dict into a OneLoan patch-loan payload."""
    loan: Dict = {}
    unmapped: List[str] = []

    for field_id, value in fields.items():
        fid = str(field_id)

        if fid.startswith("CX."):
            loan.setdefault("customFields", []).append({"fieldName": fid, "stringValue": value})
            continue

        if fid in ("3153", "3977"):
            raise ValueError(f"Field {fid} is marked read-only in the Encompass loan schema; a supported disclosure write operation is required.")

        if fid in ("LOCKRATE.2149", "LOCKRATE.2151"):
            # Experimental upstream write support: preserve the literal virtual
            # selector rather than substituting the live rateLock property.
            loan.setdefault("virtualFields", {})[fid] = value
            continue

        if fid == "Log.MS.DateTime.Conditions_Submitted_to_UW":
            milestones = (existing_loan or {}).get("milestoneLogs") or []
            matches = [
                item for item in milestones
                if isinstance(item, dict)
                and (item.get("stage") or "").strip().casefold() == "conditions submitted to uw"
            ]
            if len(matches) != 1 or not matches[0].get("id"):
                raise ValueError(f"Cannot patch {fid}: expected one existing milestone with an id.")
            milestone = matches[0]
            loan.setdefault("milestoneLogs", []).append({
                "id": milestone["id"], "stage": milestone["stage"], "dateUtc": value,
            })
            continue

        desc = _PATCH_FIELD_REGISTRY.get(fid)
        if desc is None:
            unmapped.append(fid)
            continue

        kind = desc[0]

        if kind == "loan":
            loan[desc[1]] = value
        elif kind == "property":
            loan.setdefault("property", {})[desc[1]] = value
        elif kind == "application":
            _get_or_create_application(loan, application_id)[desc[1]] = value
        elif kind == "borrower":
            _get_or_create_application(loan, application_id).setdefault("borrower", {})[desc[1]] = value
        elif kind == "coborrower":
            _get_or_create_application(loan, application_id).setdefault("coborrower", {})[desc[1]] = value
        elif kind == "residence":
            _, applicant, residency, prop = desc
            app = _get_or_create_application(loan, application_id)
            item = _find_or_create_residence(app.setdefault("residences", []), applicant, residency)
            if "id" not in item and existing_loan is not None:
                eid = _find_existing_residence_id(existing_loan, application_id, applicant, residency)
                if eid:
                    item["id"] = eid
            item[prop] = value
        elif kind == "employment":
            _, owner, is_current, prop = desc
            app = _get_or_create_application(loan, application_id)
            item = _find_or_create_employment(app.setdefault("employment", []), owner, is_current)
            if "id" not in item and existing_loan is not None:
                eid = _find_existing_employment_id(existing_loan, application_id, owner, is_current)
                if eid:
                    item["id"] = eid
            item[prop] = value
        elif kind == "vaLoanData":
            loan.setdefault("vaLoanData", {})[desc[1]] = value
        elif kind == "loanProductData":
            loan.setdefault("loanProductData", {})[desc[1]] = value
        elif kind in ("closingCost", "fhaVaLoan", "regulationZ", "underwriterSummary"):
            loan.setdefault(kind, {})[desc[1]] = value
        elif kind == "fee":
            _, fee_type, prop = desc
            item = _find_or_create_fee(loan.setdefault("fees", []), fee_type)
            item[prop] = value
        elif kind == "contact":
            _, contact_type, prop = desc
            item = _find_or_create_contact(loan.setdefault("contacts", []), contact_type)
            
            item[prop] = value

    if unmapped:
        raise ValueError(f"Unmapped field IDs for patch: {unmapped}")

    return [["patch-loan", loan]]


class GetLoanTool(BaseTool):
    """Tool for fetching specific loan field values from the OneLoan real-time read API"""

    def __init__(self):
        super().__init__(
            name="get_oneloan_properties",
            description="Retrieve loan data from OneLoan. Optionally filter to specific Encompass field IDs; omit requestedProperties to return the full loan object.",
            input_schema={
                "type": "object",
                "properties": {
                    "loan_identifier": {
                        "type": "string",
                        "description": "The unique identifier (GUID) of the loan to retrieve"
                    },
                    "company": {
                        "type": "string",
                        "description": "The company associated with the loan"
                    },
                    "requestedProperties": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of Encompass field IDs or property names to retrieve (e.g. ['4000', '1389', '231', 'FL0102', 'FR0112', 'URLARGG0101', 'UnderwritingConditionLogs']). Accepts numeric/IRS/NEWHUD field IDs, CX.* custom fields, collection patterns (FL/BR/BE/DD/FM/...), and PascalCase/camelCase property names. If omitted, the full loan object is returned."
                    }
                },
                "required": ["loan_identifier", "company"]
            }
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        """Fetch and filter loan properties from OneLoan"""
        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required arguments: loan_identifier, company"},
                indent=2
            )

        domain = os.getenv("ONELOAN_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/real-time-read/v1/loan/{arguments['loan_identifier']}"
        company = arguments["company"].lower()
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"
        access_token = get_oneloan_auth_token(company)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-GR-Company": company
        }

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            api_response = response.json()
            requested = arguments.get("requestedProperties")
            if requested is not None:
                data = _extract_requested_fields(api_response, requested)
                return json.dumps({"success": True, "data": data}, indent=2)
            else:
                return json.dumps({"success": True, "data": api_response}, indent=2)

        except requests.RequestException as e:
            response = getattr(e, "response", None)
            if response is not None and response.status_code == 404:
                try:
                    error_body = response.json()
                except (ValueError, TypeError):
                    error_body = None
                if (
                    isinstance(error_body, dict)
                    and str(error_body.get("message") or "").strip().casefold() == "loan not found"
                ):
                    logger.warning("OneLoan loan lookup returned not found")
                    return json.dumps({
                        "success": False,
                        "error": "Failed to fetch loan from OneLoan",
                        "error_code": "loan_not_found",
                    }, indent=2)
            return sanitized_error("Failed to fetch loan from OneLoan", e, logger=logger)


class GetOneLoanPropertiesByEmailTool(BaseTool):
    """Retrieve the borrower's most recently started loan from OneLoan by email."""

    def __init__(self):
        super().__init__(
            name="get_oneloan_properties_by_email",
            description="Retrieves the borrower's most recent loan from OneLoan by email, optionally filtered to requested properties.",
            input_schema={
                "type": "object",
                "properties": {
                    "borrowerEmail": {
                        "type": "string",
                        "description": "The borrower's email address"
                    },
                    "loEmail": {
                        "type": "string",
                        "description": "The email of the loan officer (used to deduce the company of the borrower)"
                    },
                    "requestedProperties": {
                        "type": "array",
                        "description": "Optional field IDs or property selectors to return, including VEND.* contact fields, CX.* custom fields, LOCKRATE.* virtual fields, milestone selectors, and numeric Encompass IDs. Omit to return the full OneLoan response.",
                        "items": {"type": "string"}
                    }
                },
                "required": ["borrowerEmail", "loEmail"]
            }
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({
                "success": False,
                "error": "Missing required arguments: borrowerEmail, loEmail",
            }, indent=2)

        borrower_domain = os.getenv("BORROWER_ENTITY_SERVICE_DOMAIN")
        myaccount_domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")
        oneloan_domain = os.getenv("ONELOAN_DOMAIN")
        if not borrower_domain:
            return json.dumps({"success": False, "error": "Borrower Entity Service domain is not configured"}, indent=2)
        if not myaccount_domain:
            return json.dumps({"success": False, "error": "MyAccount Service domain is not configured"}, indent=2)
        if not oneloan_domain:
            return json.dumps({"success": False, "error": "OneLoan domain is not configured"}, indent=2)

        company = _company_from_lo_email(arguments["loEmail"])
        if not company:
            return json.dumps({"success": False, "error": "Unable to determine company from loEmail domain"}, indent=2)
        # Keep company routing consistent with the supported OneLoan token tenants.
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"

        try:
            borrower_response = requests.post(
                f"{borrower_domain}/borrower/search",
                json={"email": arguments["borrowerEmail"], "company-name": company},
                headers={
                    "Authorization": f"Bearer {get_internal_service_auth_token()}",
                    "company": company,
                },
                timeout=30,
            )
            borrower_response.raise_for_status()
            borrower_entity_id = borrower_response.json().get("borrower-guid")
            if not borrower_entity_id:
                return json.dumps({
                    "success": False,
                    "error": "Borrower entity was not found for the supplied email",
                }, indent=2)
        except requests.RequestException as exc:
            return sanitized_error("Failed to search borrower entity", exc, logger=logger)
        except (ValueError, AttributeError) as exc:
            return sanitized_error("Invalid borrower entity response", exc, logger=logger)
        except RuntimeError as exc:
            return sanitized_error("Failed to authenticate with borrower entity service", exc, logger=logger)

        try:
            myaccount_response = requests.get(
                f"{myaccount_domain}/api/v2/mortgage/loans",
                params={"user-id": borrower_entity_id},
                headers={
                    "Authorization": f"Bearer {get_internal_service_auth_token()}",
                    "company": company,
                    "originating-application": "dm-mcp",
                },
                timeout=30,
            )
            myaccount_response.raise_for_status()
            myaccount_data = myaccount_response.json()
        except requests.RequestException as exc:
            return sanitized_error("Failed to retrieve borrower loans", exc, logger=logger)
        except ValueError as exc:
            return sanitized_error("Invalid MyAccount loans response", exc, logger=logger)
        except RuntimeError as exc:
            return sanitized_error("Failed to authenticate with MyAccount service", exc, logger=logger)

        latest_loan = _latest_started_borrower_loan(myaccount_data)
        if latest_loan is None:
            return json.dumps({"success": False, "error": "No loans found for borrower"}, indent=2)
        loan_guid = latest_loan.get("loanGuid")
        if not loan_guid:
            return json.dumps({
                "success": False,
                "error": "The most recent borrower loan has no OneLoan loan ID",
            }, indent=2)

        try:
            oneloan_response = requests.get(
                f"{oneloan_domain}/real-time-read/v1/loan/{loan_guid}",
                headers={
                    "Authorization": f"Bearer {get_oneloan_auth_token(company)}",
                    "X-GR-Company": company,
                },
                timeout=30,
            )
            oneloan_response.raise_for_status()
            api_response = oneloan_response.json()
            requested = arguments.get("requestedProperties")
            data = _extract_requested_fields(api_response, requested) if requested is not None else api_response
            return json.dumps({"success": True, "data": data}, indent=2)
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            return sanitized_error("Failed to fetch loan from OneLoan", exc, logger=logger)
        
        
class SearchOneLoanTool(BaseTool):
    """ Tool for searching for loans in OneLoan based on provided criteria. """

    SEARCH_PAGE_SIZE = 10

    def __init__(self):
        super().__init__(
            name="search_oneloan",
            description="Search OneLoan for the newest matching loan by default. Set returnAllLoans=true to retrieve all matches, newest first.",
            input_schema={
                "type": "object",
                "properties": {
                    "propertyState": {
                        "type": "string", 
                        "description": "The state where the property is located (e.g. 'CA')"
                    },
                    "propertyCity": {
                        "type": "string", 
                        "description": "The city where the property is located (e.g. 'San Francisco')"
                    },
                    "propertyStreetAddress": {
                        "type": "string", 
                        "description": "The street address of the property (e.g. '123 Main St')"
                    },
                    "propertyPostalCode": {
                        "type": "string", 
                        "description": "The postal code of the property (e.g. '94105')"
                    },
                    "borrowerBirthDate": {
                        "type": "string", 
                        "description": "The birth date of the borrower in YYYY-MM-DDT00:00:00Z format (e.g. '1980-01-01T00:00:00Z')"
                    },
                    "borrowerHomePhone": {
                        "type": "string", 
                        "description": "The home phone number of the borrower (e.g. '415-555-1234')"
                    },
                    "borrowerMobilePhone": {
                        "type": "string", 
                        "description": "The mobile phone number of the borrower (e.g. '415-555-5678')"
                    },
                    "borrowerLast4SSN": {
                        "type": "string",
                        "description": "The last 4 digits of the borrower's SSN (e.g. '1234')"
                    },
                    "coborrowerBirthDate": {
                        "type": "string", 
                        "description": "The birth date of the coborrower in YYYY-MM-DDT00:00:00Z format (e.g. '1985-05-15T00:00:00Z')"
                    },
                    "coborrowerHomePhone": {
                        "type": "string", 
                        "description": "The home phone number of the coborrower (e.g. '415-555-4321')"
                    },
                    "coborrowerMobilePhone": {
                        "type": "string", 
                        "description": "The mobile phone number of the coborrower (e.g. '415-555-8765')"
                    },
                    "coborrowerLast4SSN": {
                        "type": "string",
                        "description": "The last 4 digits of the coborrower's SSN (e.g. '4321')"
                    },
                    "loanNumber": {
                        "type": "string",
                        "description": "The loan number (e.g. 'LN123456')"
                    },
                    "returnAllLoans": {
                        "type": "boolean",
                        "default": False,
                        "description": "If true, page through all matching loans and return data as a list, with loanId on each entry. Per-loan failures are reported in errors with success=false. Defaults to false, preserving the single newest-loan response."
                    },
                    "company": {
                        "type": "string",
                        "description": "The company to scope the search to (e.g. 'gri', 'gra', 'prate', 'op', 'kbhs', 'premia')"
                    }
                },
                "required": ["company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute search query against OneLoan
        return_all = arguments.get("returnAllLoans", False)
        if not isinstance(return_all, bool):
            return json.dumps({"success": False, "error": "returnAllLoans must be a boolean."}, indent=2)

        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required argument: company"},
                indent=2
            )

        domain = os.getenv("ONELOAN_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."},
                indent=2
            )
        
        company = arguments["company"].lower()
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"
        url = f"{domain}/search/v1/loan?company={company}"

        access_token = get_oneloan_auth_token(company)
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-GR-Company": company
        }

        def _normalize_date(date: str) -> str:
            """Ensure date is in YYYY-MM-DDTHH:MM:SSZ format; append T00:00:00Z if only YYYY-MM-DD."""
            if re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                return f"{date}T00:00:00Z"
            return date

        def _normalize_phone(phone: str) -> str:
            """Normalize a phone number to NXX-NXX-XXXX format."""
            digits = re.sub(r"\D", "", phone)
            if len(digits) == 11 and digits[0] == "1":
                digits = digits[1:]
            if len(digits) == 10:
                return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
            return phone  # return as-is if unrecognised format

        # Validation rules:
        # 1) loanNumber alone is a valid search path.
        # 2) Address-based searches are allowed without phone identity checks.
        # 3) For non-loan, non-address searches, on-file phone requires at least 2 of:
        #    last 4 SSN, ZIP, DOB. Apply same logic for borrower and coborrower phone usage.
        has_loan_number = bool(arguments.get("loanNumber"))
        has_address_criteria = any(
            [
                bool(arguments.get("propertyState")),
                bool(arguments.get("propertyCity")),
                bool(arguments.get("propertyStreetAddress")),
                bool(arguments.get("propertyPostalCode")),
            ]
        )
        borrower_phone_provided = bool(arguments.get("borrowerHomePhone") or arguments.get("borrowerMobilePhone"))
        coborrower_phone_provided = bool(arguments.get("coborrowerHomePhone") or arguments.get("coborrowerMobilePhone"))

        if not has_loan_number and not has_address_criteria:
            if not (borrower_phone_provided or coborrower_phone_provided):
                return json.dumps(
                    {
                        "success": False,
                        "error": "Search requires loanNumber, address criteria, or an on-file borrower/coborrower phone number plus 2 of: last 4 SSN, ZIP, Date of Birth."
                    },
                    indent=2,
                )

            zip_provided = bool(arguments.get("propertyPostalCode"))
            missing_groups = []

            if borrower_phone_provided:
                borrower_count = sum(
                    [
                        bool(arguments.get("borrowerLast4SSN")),
                        zip_provided,
                        bool(arguments.get("borrowerBirthDate")),
                    ]
                )
                if borrower_count < 2:
                    missing_groups.append("borrower")

            if coborrower_phone_provided:
                coborrower_count = sum(
                    [
                        bool(arguments.get("coborrowerLast4SSN")),
                        zip_provided,
                        bool(arguments.get("coborrowerBirthDate")),
                    ]
                )
                if coborrower_count < 2:
                    missing_groups.append("coborrower")

            if missing_groups:
                subjects = " and ".join(missing_groups)
                return json.dumps(
                    {
                        "success": False,
                        "error": f"{subjects.capitalize()} phone search requires 2 of the following: last 4 SSN, ZIP, Date of Birth."
                    },
                    indent=2,
                )

        # Build Elasticsearch query based on provided search criteria
        term_criteria = []
        if arguments.get("propertyState"):
            term_criteria.append({"term": {"PropertyState": arguments["propertyState"]}})
        if arguments.get("propertyPostalCode"):
            term_criteria.append({"term": {"PropertyPostalCode": arguments["propertyPostalCode"]}})
        if arguments.get("borrowerBirthDate"):
            term_criteria.append({"term": {"BorrowerBirthDate": _normalize_date(arguments["borrowerBirthDate"])}})
        if arguments.get("borrowerHomePhone"):
            term_criteria.append({"term": {"BorrowerHomePhone": _normalize_phone(arguments["borrowerHomePhone"])}})
        if arguments.get("borrowerMobilePhone"):
            term_criteria.append({"term": {"BorrowerMobilePhone": _normalize_phone(arguments["borrowerMobilePhone"])}})
        if arguments.get("coborrowerBirthDate"):
            term_criteria.append({"term": {"CoborrowerBirthDate": _normalize_date(arguments["coborrowerBirthDate"])}})
        if arguments.get("coborrowerHomePhone"):
            term_criteria.append({"term": {"CoborrowerHomePhone": _normalize_phone(arguments["coborrowerHomePhone"])}})
        if arguments.get("coborrowerMobilePhone"):
            term_criteria.append({"term": {"CoborrowerMobilePhone": _normalize_phone(arguments["coborrowerMobilePhone"])}})
        if arguments.get("loanNumber"):
            term_criteria.append({"term": {"LoanNumber": arguments["loanNumber"]}})

        match_criteria = []
        if arguments.get("propertyCity"):
            match_criteria.append({"match": {"PropertyCity": arguments["propertyCity"]}})
        if arguments.get("propertyStreetAddress"):
            match_criteria.append({"match": {"PropertyStreetAddress": arguments["propertyStreetAddress"]}})

        if arguments.get("borrowerLast4SSN"):
            # Strip any non-digits so wildcard metacharacters (*, ?) cannot be
            # injected into the search query to broaden the match.
            _b_last4 = re.sub(r"\D", "", str(arguments["borrowerLast4SSN"]))
            if len(_b_last4) == 4:
                term_criteria.append({"wildcard": {"BorrowerSSN": f"*-{_b_last4}"}})
        if arguments.get("coborrowerLast4SSN"):
            _c_last4 = re.sub(r"\D", "", str(arguments["coborrowerLast4SSN"]))
            if len(_c_last4) == 4:
                term_criteria.append({"wildcard": {"CoborrowerSSN": f"*-{_c_last4}"}})

        payload = {
            "_source": ["EncompassId"],
            "sort": [{"LoanCreatedDateUtc": "desc"}],
            "size": self.SEARCH_PAGE_SIZE if return_all else 1,
            "query": {
                "bool": {
                    "must": term_criteria + match_criteria,
                }
            },
        } 

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch loan from OneLoan", e, logger=logger)
        
        # Extract EncompassId from search results
        search_data = response.json()
        if not search_data:
            return json.dumps({"success": False, "error": "No loans found matching the provided criteria."}, indent=2)

        if return_all:
            return await self._all_search_results(url, headers, payload, search_data, company)

        # Ensure data is in expected format and contains required fields
        loan_id = search_data[0].get("EncompassId")
        if not loan_id:
            return json.dumps({"success": False, "error": "EncompassId not present in search results."}, indent=2)

        return await self._get_search_loan_details(loan_id, company)

    async def _all_search_results(
        self, url: str, headers: Dict, payload: Dict, first_page: List[Dict], company: str
    ) -> str:
        """Collect every search page before enriching; never silently truncate results."""
        loan_ids: List[str] = []
        seen: set[str] = set()
        page = first_page
        offset = 0
        while True:
            if not isinstance(page, list):
                return json.dumps({"success": False, "error": "Unexpected OneLoan search response."}, indent=2)
            for item in page:
                loan_id = item.get("EncompassId") if isinstance(item, dict) else None
                if not isinstance(loan_id, str) or not loan_id:
                    return json.dumps({"success": False, "error": "EncompassId not present in search results."}, indent=2)
                if loan_id in seen:
                    return json.dumps({
                        "success": False,
                        "error": "OneLoan search returned overlapping pages; unable to confirm all matching loans. Retry the search.",
                    }, indent=2)
                seen.add(loan_id)
                loan_ids.append(loan_id)
            if len(page) < payload["size"]:
                break
            offset += len(page)
            try:
                response = requests.post(url, headers=headers, json={**payload, "from": offset}, timeout=30)
                response.raise_for_status()
                page = response.json()
            except (requests.RequestException, ValueError) as exc:
                return sanitized_error("Failed to fetch all matching loans from OneLoan", exc, logger=logger)

        loans: List[Dict] = []
        errors: List[Dict] = []
        for loan_id in loan_ids:
            try:
                result = json.loads(await self._get_search_loan_details(loan_id, company))
            except Exception as exc:
                result = json.loads(sanitized_error("Failed to fetch loan details", exc, logger=logger))
            if result.get("success"):
                loans.append({"loanId": loan_id, **result["data"]})
            else:
                errors.append({"loanId": loan_id, "error": result.get("error", "Failed to fetch loan details")})

        result = {"success": not errors, "data": loans}
        if errors:
            result["errors"] = errors
        return json.dumps(result, indent=2)

    async def _get_search_loan_details(self, loan_id: str, company: str) -> str:
        """Preserve the existing real-time, borrower, and MyAccount enrichment path."""
        # BorrowerEmail is not indexed in the search index — fetch it from the real-time loan API
        oneloan_domain = os.getenv("ONELOAN_DOMAIN")
        if not oneloan_domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."},
                indent=2
            )
        loan_url = f"{oneloan_domain}/real-time-read/v1/loan/{loan_id}"
        loan_token = get_oneloan_auth_token(company)
        loan_headers = {
            "Authorization": f"Bearer {loan_token}",
            "X-GR-Company": company
        }
        try:
            loan_response = requests.get(loan_url, headers=loan_headers, timeout=30)
            loan_response.raise_for_status()
            loan_data = loan_response.json()

        except requests.RequestException as e:
            return sanitized_error("Failed to fetch loan details from OneLoan", e, logger=logger)

        # Navigate: loan_data -> data -> loan -> applications[0] -> borrower -> emailAddressText
        _loan_obj = loan_data.get("data", loan_data)
        if isinstance(_loan_obj, dict):
            _loan_obj = _loan_obj.get("loan", _loan_obj)
        _apps = _loan_obj.get("applications", []) if isinstance(_loan_obj, dict) else []
        borrower_email = (_apps[0].get("borrower", {}).get("emailAddressText") if _apps else None)
        if not borrower_email:
            return json.dumps({"success": False, "error": "BorrowerEmail not present on loan."}, indent=2)
        
        # Fetch borrower entity id using the borrower's email on the loan
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
            "company": company
        }

        try:
            result = requests.post(url, json={"email": borrower_email}, headers=headers)
            result.raise_for_status()
            borrower_entity_id = result.json()["borrower-guid"]
        
        except requests.RequestException as e:
            return sanitized_error("Failed to search borrower entity", e, logger=logger)

        # Retrieve the loan information from the search results
        domain = os.getenv("MYACCOUNT_SERVICE_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "MyAccount service domain not configured. Please set MYACCOUNT_SERVICE_DOMAIN environment variable."},
                indent=2
            )
        
        url = f"{domain}/api/v2/mortgage/loans/{loan_id}?user-id={borrower_entity_id}"
        access_token = get_internal_service_auth_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "company": company,
            "originating-application": "dm-mcp"
        }

        def _extract_loan_status_fields(loan: Dict) -> Dict:
            """Extract comprehensive loan status fields for borrower communications."""
            def get_custom_field(field_name: str) -> Optional[Any]:
                for cf in loan.get("customFields", []):
                    if cf.get("fieldName") == field_name:
                        return cf.get("stringValue")
                return None

            def get_nested(obj: Any, path: str) -> Any:
                for key in path.split("."):
                    if isinstance(obj, dict):
                        obj = obj.get(key)
                    else:
                        return None
                return obj

            def get_borrower_info() -> Dict[str, Optional[str]]:
                apps = loan.get("applications", [])
                borrower = apps[0].get("borrower", {}) if apps else {}
                first_name = borrower.get("firstName")
                last_name = borrower.get("lastName")
                full_name = borrower.get("name") or " ".join(
                    part for part in [first_name, last_name] if part
                ).strip()
                if not full_name:
                    full_name = None
                return {
                    "borrowerName": full_name,
                    "borrowerEmail": borrower.get("emailAddressText") or borrower.get("email"),
                }

            def get_loan_officer_info() -> Dict[str, Optional[str]]:
                for milestone in loan.get("milestoneLogs", []):
                    associate = milestone.get("loanAssociate") or {}
                    if associate.get("roleName") == "Loan Officer":
                        return {
                            "loanOfficerName": associate.get("name"),
                            "loanOfficerEmail": associate.get("email"),
                            "loanOfficerPhone": associate.get("phone"),
                        }
                return {
                    "loanOfficerName": None,
                    "loanOfficerEmail": None,
                    "loanOfficerPhone": None,
                }

            borrower_info = get_borrower_info()
            loan_officer_info = get_loan_officer_info()

            return {
                **borrower_info,
                **loan_officer_info,
                "basic_loan_status": {
                    "loanNumber": loan.get("loanNumber"),
                    "milestoneCurrentName": loan.get("milestoneCurrentName"),
                    "milestoneStage": loan.get("milestoneStage"),
                    "milestoneCurrentDateUtc": loan.get("milestoneCurrentDateUtc"),
                    "milestoneNextName": loan.get("milestoneNextName"),
                    "milestoneLogs": [
                        {
                            "stage": m.get("stage"),
                            "doneIndicator": m.get("doneIndicator"),
                            "dateUtc": m.get("dateUtc"),
                            "loanAssociate": m.get("loanAssociate"),
                        }
                        for m in loan.get("milestoneLogs", [])
                    ],
                },
                "expected_dates": {
                    "submitted": loan.get("milestoneSubmittedDueDate"),
                    "approved": loan.get("milestoneApprovedDueDate"),
                    "doc_signed": loan.get("milestoneDocSignedDueDate"),
                    "funded": loan.get("milestoneFundedDueDate"),
                    "completed": loan.get("milestoneCompletedDueDate"),
                },
                "underwriting_approval_status": {
                    "processing": get_custom_field("CX.STATUS.PROCESSING"),
                    "app_fee_collected": get_custom_field("CX.STATUS.APPFEECOLLECTED"),
                    "assigned_uw": get_custom_field("CX.STATUS.ASSIGNED.UW"),
                    "submittal": get_custom_field("CX.STATUS.SUBMITTAL"),
                    "uw_decision_expected": get_custom_field("CX.LOGUWDECEXP"),
                    "conditions_uw": get_custom_field("CX.STATUS.CONDITIONS.UW"),
                    "uw_app_status": get_custom_field("CX.UWAPPSTAT"),
                    "aus_status": get_custom_field("CX.AUS.STATUS"),
                },
                "condition_summary": {
                    "open_count": get_nested(loan, "virtualFields.UWC.OPENCOUNT"),
                    "open_external_count": get_nested(loan, "virtualFields.UWC.OPENEXTERNALCOUNT"),
                    "received_count": get_nested(loan, "virtualFields.UWC.RECEIVEDCOUNT"),
                    "reviewed_count": get_nested(loan, "virtualFields.UWC.REVIEWEDCOUNT"),
                    "cleared_count": get_nested(loan, "virtualFields.UWC.CLEAREDCOUNT"),
                    "waived_count": get_nested(loan, "virtualFields.UWC.WAIVEDCOUNT"),
                    "rejected_count": get_nested(loan, "virtualFields.UWC.REJECTEDCOUNT"),
                    "prior_to_doc_count": get_nested(loan, "virtualFields.UWC.PTDCOUNT"),
                    "prior_to_purchase_count": get_nested(loan, "virtualFields.UWC.PTPCOUNT"),
                    "prior_to_approval_count": get_nested(loan, "virtualFields.UWC.PTACOUNT"),
                },
                "conditions": [
                    {
                        "id": c.get("id"),
                        "title": c.get("title"),
                        "description": c.get("description"),
                        "status": c.get("status"),
                        "statusText": c.get("statusText") or c.get("statusDescription"),
                        "priorTo": c.get("priorTo"),
                        "owner": c.get("owner"),
                        "borrowerFacing": c.get("borrowerFacing"),
                        "requestedFrom": c.get("requestedFrom"),
                        "requestedDate": c.get("requestedDate"),
                        "dueDate": c.get("dueDate"),
                        "receivedDate": c.get("receivedDate"),
                        "reviewedDate": c.get("reviewedDate"),
                        "clearedDate": c.get("clearedDate"),
                        "waivedDate": c.get("waivedDate"),
                        "rejectedDate": c.get("rejectedDate"),
                        "rejectedReason": c.get("rejectedReason"),
                        "commentsBorrowerSafe": c.get("commentsBorrowerSafe"),
                    }
                    for c in loan.get("underwritingConditionLogs", [])
                ],
                "documents": [
                    {
                        "id": d.get("id"),
                        "name": d.get("name"),
                        "type": d.get("type"),
                        "status": d.get("status"),
                        "requestedFrom": d.get("requestedFrom"),
                        "requestedDate": d.get("requestedDate"),
                        "dueDate": d.get("dueDate"),
                        "receivedDate": d.get("receivedDate"),
                        "acceptedDate": d.get("acceptedDate"),
                        "rejectedDate": d.get("rejectedDate"),
                        "rejectedReason": d.get("rejectedReason"),
                        "borrowerFacing": d.get("borrowerFacing"),
                    }
                    for d in loan.get("documents", [])
                ],
            }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            loan_result = response.json().get("data")
            status_fields = _extract_loan_status_fields(_loan_obj)
            return json.dumps(
                {
                    "success": True,
                    "data": {
                        "loanMilestone": loan_result.get("loanMilestone"),
                        "loanNumber": loan_result.get("loanNumber"),
                        "loanStatus": status_fields,
                    },
                },
                indent=2,
            )
        
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch loan details from MyAccount service", e, logger=logger)

class GetTeamMemberPipelineCountTool(BaseTool):
    """Tool for counting loans currently in a team member's active pipeline, via the OneLoan pipeline service."""

    PIPELINE_MILESTONES = (
        "Processing",
        "App Fee Collected",
        "Assigned to UW",
        "Submittal",
        "UW Decision Expected",
        "Conditions Submitted to UW",
    )

    def __init__(self):
        super().__init__(
            name="get_pipeline_count",
            description="Count loans currently assigned to a given team member across the HELOAN pipeline milestones used for capacity balancing, via the OneLoan pipeline service.",
            input_schema={
                "type": "object",
                "properties": {
                    "encompass_id": {
                        "type": "string",
                        "description": "The team member's Encompass user ID"
                    },
                    "milestones": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Milestones to include. Defaults to the HELOAN capacity pipeline milestones."
                    }
                },
                "required": ["encompass_id"]
            }
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required argument: encompass_id"},
                indent=2
            )

        domain = os.getenv("ONELOAN_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."},
                indent=2
            )

        url = f"{domain}/pipeline/v1/execute-pipeline/assigned-loan-count"
        milestones = arguments.get("milestones") or list(self.PIPELINE_MILESTONES)
        try:
            access_token = get_oneloan_auth_token("gri")
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=utf-8",
                "X-GR-Company": "gri",
            }
            response = requests.post(
                url,
                headers=headers,
                json={"user-id": arguments["encompass_id"], "milestones": milestones},
                timeout=30,
            )
            response.raise_for_status()
            service_response = response.json()
        except Exception as e:
            return sanitized_error(
                "Failed to fetch pipeline count from OneLoan pipeline service",
                e,
                logger=logger,
            )

        metadata = service_response.get("metadata") if isinstance(service_response, dict) else None
        total = metadata.get("total") if isinstance(metadata, dict) else None
        if not isinstance(total, int) or isinstance(total, bool):
            return json.dumps(
                {
                    "success": False,
                    "error": "Pipeline service response did not contain an integer metadata.total count.",
                    "data": {"encompass_id": arguments["encompass_id"], "service_response": service_response},
                },
                indent=2,
            )

        return json.dumps(
            {
                "success": True,
                "data": {
                    "encompass_id": arguments["encompass_id"],
                    "current_pipeline_count": total,
                },
            },
            indent=2,
        )


class GetBorrowerPriorLoanTeamTool(BaseTool):
    """Look up unique team members from borrower loans funded in the last 12 months."""

    def __init__(self):
        super().__init__(
            name="get_borrower_prior_loan_team",
            description=(
                "Get unique Encompass user IDs from prior loans for the supplied borrower SSNs. "
                "The OneLoan pipeline service filters loans by funding date within the last "
                "12 months. IDs retain first-seen order, not assignment priority."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "ssns": {
                        "type": "array",
                        "items": {"type": "string", "minLength": 1},
                        "minItems": 1,
                        "description": "Borrower SSNs to look up in the OneLoan pipeline service.",
                    },
                },
                "required": ["ssns"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        ssns = arguments.get("ssns")
        if not isinstance(ssns, list) or not ssns or any(
            not isinstance(ssn, str) or not ssn.strip() for ssn in ssns
        ):
            return sanitized_error("ssns must be a non-empty list of non-empty strings.", logger=logger)

        domain = os.getenv("ONELOAN_DOMAIN")
        if not domain:
            return sanitized_error(
                "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable.",
                logger=logger,
            )

        try:
            access_token = get_oneloan_auth_token("gri")
            response = requests.post(
                f"{domain}/pipeline/v1/execute-pipeline/borrower-prior-loan-team",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=utf-8",
                    "X-GR-Company": "gri",
                },
                json={"ssns": ssns},
                timeout=30,
            )
            response.raise_for_status()
            service_response = response.json()
        except (requests.RequestException, RuntimeError, ValueError):
            # Downstream exceptions and response bodies may contain borrower SSNs.
            return sanitized_error(
                "Failed to fetch borrower prior loan team from OneLoan pipeline service.",
                logger=logger,
            )

        results = service_response.get("results") if isinstance(service_response, dict) else None
        if not isinstance(results, list):
            return sanitized_error(
                "Pipeline service response did not contain a results list.", logger=logger,
            )

        prior_team_member_ids: List[str] = []
        seen: set[str] = set()
        for result in results:
            members = result.get("TeamMembersEncompassIds") if isinstance(result, dict) else None
            if not isinstance(members, list) or any(
                not isinstance(member, str) or not member.strip() for member in members
            ):
                return sanitized_error(
                    "Pipeline service result did not contain a TeamMembersEncompassIds list "
                    "of non-empty strings.",
                    logger=logger,
                )
            for member in members:
                if member not in seen:
                    seen.add(member)
                    prior_team_member_ids.append(member)

        return json.dumps(
            {"success": True, "data": {"prior_team_member_ids": prior_team_member_ids}},
            indent=2,
        )


class MoveOneLoanMilestoneTool(BaseTool):
    """Move a loan forward by one supported milestone and verify the resulting status."""

    _MILESTONE_CONFIG = {
        "App Fee Collected": {
            "current_statuses": ("Sent to processing", "Processing"),
            "command": "app-fee-collected",
        },
        "Assigned to UW": {
            "current_statuses": ("App Fee Collected",),
            "command": "assign-to-uw",
        },
    }

    def __init__(self):
        super().__init__(
            name="move_oneloan_milestone",
            description=(
                "Move a OneLoan loan forward by exactly one milestone. Supported targets are "
                "'App Fee Collected' from 'Sent to processing' or 'Processing', and 'Assigned to UW' from "
                "'App Fee Collected'. The Underwriting Coordinator must be assigned for "
                "'Assigned to UW'. The result is verified with up to six loan reads, "
                "10 seconds apart."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "loan_guid": {
                        "type": "string",
                        "description": "GR loan GUID of the loan to move",
                    },
                    "company": {
                        "type": "string",
                        "description": "Company associated with the loan (e.g. 'gri')",
                    },
                    "target_milestone": {
                        "type": "string",
                        "enum": list(self._MILESTONE_CONFIG),
                        "description": "The exact OneLoan MS.STATUS value to move the loan to",
                    },
                },
                "required": ["loan_guid", "company", "target_milestone"],
            },
        )

    @staticmethod
    def _failure(reason: str) -> str:
        return json.dumps({"success": False, "failure_reason": reason}, indent=2)

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return self._failure("Required arguments are missing.")

        loan_guid = arguments["loan_guid"]
        company_arg = arguments["company"]
        target_milestone = arguments["target_milestone"]
        if not isinstance(loan_guid, str) or not loan_guid.strip():
            return self._failure("A nonempty loan GUID is required.")
        if not isinstance(company_arg, str) or not company_arg.strip():
            return self._failure("A nonempty company is required.")
        if not isinstance(target_milestone, str):
            return self._failure(
                "The target milestone is not supported. Choose App Fee Collected or Assigned to UW."
            )

        loan_guid = loan_guid.strip()
        company = company_arg.strip().lower()
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"

        config = self._MILESTONE_CONFIG.get(target_milestone)
        if config is None:
            return self._failure(
                "The target milestone is not supported."
            )

        requested_properties = ["MS.STATUS"]
        if target_milestone == "Assigned to UW":
            requested_properties.append("LoanTeamMember.UserId.Underwriting_Coord")

        try:
            initial_result = json.loads(await GetLoanTool().execute({
                "loan_identifier": loan_guid,
                "company": company,
                "requestedProperties": requested_properties,
            }))
        except (ValueError, RuntimeError, requests.RequestException):
            logger.exception("Failed to read loan prerequisites before milestone move")
            return self._failure("The initial loan read failed.")

        if not isinstance(initial_result, dict) or not initial_result.get("success"):
            return self._failure("The initial loan read failed.")
        initial_fields = initial_result.get("data")
        if not isinstance(initial_fields, dict):
            return self._failure("The initial loan read did not return the required loan fields.")
        unresolved_fields = initial_fields.get("unresolved_field_ids", [])
        if "MS.STATUS" in unresolved_fields or not isinstance(initial_fields.get("MS.STATUS"), str):
            return self._failure("The initial loan read did not return the current milestone status.")

        current_status = initial_fields["MS.STATUS"]
        if current_status not in config["current_statuses"]:
            return self._failure(
                f"The loan is currently at '{current_status}', but must be at "
                f"one of {', '.join(config['current_statuses'])} to move to '{target_milestone}'."
            )
        if (
            target_milestone == "Assigned to UW"
            and not initial_fields.get("LoanTeamMember.UserId.Underwriting_Coord")
        ):
            return self._failure(
                "The Underwriting Coordinator must be assigned before moving to Assigned to UW."
            )

        oneloan_domain = os.getenv("ONELOAN_DOMAIN")
        if not oneloan_domain:
            return self._failure("The OneLoan domain is not configured.")

        try:
            access_token = get_oneloan_auth_token(company)
        except (RuntimeError, ValueError):
            logger.exception("Failed to retrieve OneLoan authentication token")
            return self._failure("OneLoan authentication failed.")

        auth_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-GR-Company": company,
        }
        try:
            session_response = requests.post(
                f"{oneloan_domain}/write/v1/session",
                headers=auth_headers,
                json={"loan-id": loan_guid},
                timeout=30,
            )
            session_response.raise_for_status()
            session_id = session_response.json().get("session-id")
        except requests.RequestException:
            logger.exception("Failed to create OneLoan write session")
            return self._failure("The OneLoan write session request failed.")
        except (ValueError, AttributeError, TypeError):
            logger.exception("Invalid OneLoan write session response")
            return self._failure("The OneLoan write session response was invalid.")

        if not isinstance(session_id, str) or not session_id:
            return self._failure("The OneLoan write session response did not contain a session ID.")

        patch_response = None
        try:
            patch_response = requests.patch(
                f"{oneloan_domain}/real-time-write/v1/loan/persist/{loan_guid}",
                headers={
                    **auth_headers,
                    "X-Encompass-Token": session_id,
                },
                json=[["complete-milestone", config["command"]]],
                timeout=60,
                stream=True,
            )
            patch_response.raise_for_status()
        except requests.RequestException:
            logger.exception("OneLoan milestone write request failed")
            return self._failure("The OneLoan milestone write request failed.")
        finally:
            if patch_response is not None:
                patch_response.close()

        for _ in range(6):
            await asyncio.sleep(10)
            try:
                verification_result = json.loads(await GetLoanTool().execute({
                    "loan_identifier": loan_guid,
                    "company": company,
                    "requestedProperties": ["MS.STATUS"],
                }))
            except (ValueError, RuntimeError, requests.RequestException):
                logger.exception("Failed to verify OneLoan milestone move")
                return self._failure("The verification loan read failed.")

            if not isinstance(verification_result, dict) or not verification_result.get("success"):
                return self._failure("The verification loan read failed.")
            verification_fields = verification_result.get("data")
            if not isinstance(verification_fields, dict):
                return self._failure("The verification loan read did not return the milestone status.")
            observed_status = verification_fields.get("MS.STATUS")
            if observed_status is None:
                return self._failure("The verification loan read did not return the milestone status.")
            if observed_status == target_milestone:
                return json.dumps(
                    {"success": True, "data": {"milestone": target_milestone}},
                    indent=2,
                )

        return self._failure(
            f"The write request succeeded, but the loan is still at '{observed_status}' "
            f"instead of '{target_milestone}'."
        )


class PatchOneLoanTool(BaseTool):
    """Tool for patching loan fields in OneLoan using Encompass field IDs."""

    def __init__(self):
        super().__init__(
            name="patch_oneloan",
            description=(
                "Patch specific loan fields in OneLoan using Encompass field IDs. "
                "Supports borrower/coborrower personal info, addresses, employment, property, "
                "application-level fields, the title company name (field 411), closing/underwriting dates, "
                "the existing Conditions Submitted to UW milestone date, and CX.* custom fields. "
                "LOCKRATE.2149 and LOCKRATE.2151 are sent as literal virtualFields keys (experimental; upstream write support is unverified). "
                "Read-only disclosure fields 3153/3977 are not supported. "
                "If application_id is omitted it will be fetched automatically."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "loan_guid": {
                        "type": "string",
                        "description": "GR loan GUID of the loan to patch"
                    },
                    "company": {
                        "type": "string",
                        "description": "Company associated with the loan (e.g. 'gri', 'gra', 'prate')"
                    },
                    "application_id": {
                        "type": "string",
                        "description": "applications[0].id from the loan. Fetched automatically when omitted."
                    },
                    "fields": {
                        "type": "array",
                        "description": (
                            "Encompass field IDs and values to patch. "
                            "Supports numeric IDs (e.g. '4000'), pattern IDs (e.g. 'FR0126', 'FE0102'), "
                            "URLA fields (e.g. 'URLA.X1'), and CX.* custom fields."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "fieldId": {
                                    "type": "string",
                                    "description": "Encompass field ID"
                                },
                                "value": {
                                    "description": "Value to set for the field"
                                }
                            },
                            "required": ["fieldId", "value"]
                        }
                    }
                },
                "required": ["loan_guid", "company", "fields"]
            }
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Execute loan patching
        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required arguments: loan_guid, company, fields"},
                indent=2
            )

        oneloan_domain = os.getenv("ONELOAN_DOMAIN")
        if not oneloan_domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."},
                indent=2
            )

        company = arguments["company"].lower()
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"

        loan_guid = arguments["loan_guid"]
        access_token = get_oneloan_auth_token(company)
        auth_headers = {
            "Authorization": f"Bearer {access_token}",
            "X-GR-Company": company,
        }

        # Fetch the loan to resolve application_id and seed existing collection item IDs
        try:
            read_resp = requests.get(
                f"{oneloan_domain}/real-time-read/v1/loan/{loan_guid}",
                headers=auth_headers,
                timeout=30,
            )
            read_resp.raise_for_status()
            _raw = read_resp.json()
            _loan_obj: Dict = _raw.get("data", _raw)
            if isinstance(_loan_obj, dict):
                _loan_obj = _loan_obj.get("loan", _loan_obj)
        except requests.RequestException as e:
            return sanitized_error("Failed to fetch loan", e, logger=logger)

        application_id = arguments.get("application_id")
        if not application_id:
            _apps = _loan_obj.get("applications", []) if isinstance(_loan_obj, dict) else []
            application_id = _apps[0].get("id") if _apps else None
            if not application_id:
                return json.dumps(
                    {"success": False, "error": "Could not resolve application_id from loan."},
                    indent=2
                )

        # Build fields dict and convert to patch body
        fields_dict: Dict[str, Any] = {
            item["fieldId"]: item["value"]
            for item in arguments.get("fields", [])
        }
        try:
            body = _build_patch_body(application_id, fields_dict, existing_loan=_loan_obj)
            logger.info(f"Constructed OneLoan patch body for loan {loan_guid}: {json.dumps(body)}")
        except ValueError as e:
            return json.dumps({"success": False, "error": str(e)}, indent=2)

        # Create OneLoan write session
        try:
            session_resp = requests.post(
                f"{oneloan_domain}/write/v1/session?company={company}",
                headers=auth_headers,
            )
            session_resp.raise_for_status()
        except requests.RequestException as e:
            return sanitized_error("Failed to create OneLoan session", e, logger=logger)

        session_id = session_resp.json().get("session-id")
        if not session_id:
            return json.dumps(
                {"success": False, "error": "Unable to deserialize OneLoan session response."},
                indent=2
            )

        # Patch the loan
        try:
            patch_resp = requests.patch(
                f"{oneloan_domain}/real-time-write/v1/loan/persist/{loan_guid}?company={company}",
                headers={"X-Encompass-Token": session_id, "Authorization": f"Bearer {access_token}"},
                json=body,
            )
            patch_resp.raise_for_status()
        except requests.RequestException as e:
            return sanitized_error("Failed to patch OneLoan loan", e, logger=logger)

        return json.dumps({"success": True}, indent=2)

# More roles can probably be added to _ASSIGNABLE_ROLE_SLUGS as needed
_ASSIGNABLE_ROLE_SLUGS = {"underwriter", "mortgage-consultant", "loan-coordinator", "ops-assist-cc", "underwriting-coord"}

class AssignOneLoanRoleTool(BaseTool):
    """Tool for assigning loan team roles (e.g. underwriter) in OneLoan via the assign-role command."""

    def __init__(self):
        super().__init__(
            name="assign_oneloan_role",
            description=(
                "Assign loan team roles in OneLoan by sending assign-role commands, the same "
                "mechanism the underwriter pipeline UI uses. Each assignment is a role slug "
                "(e.g. 'underwriter', 'mortgage-consultant') and the user's ID."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "loan_guid": {"type": "string", "description": "GR loan GUID of the loan to assign roles on"},
                    "company": {"type": "string", "description": "Company associated with the loan (e.g. 'gri', 'gra', 'prate')"},
                    "assignments": {
                        "type": "array",
                        "description": "Roles to assign, sent in order as assign-role commands.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {"type": "string", "description": "Role slug, e.g. 'underwriter' or 'mortgage-consultant'"},
                                "user_id": {
                                    "type": ["string", "integer"],
                                    "description": "User ID of the person to assign to the role"
                                }
                            },
                            "required": ["role", "user_id"]
                        }
                    }
                },
                "required": ["loan_guid", "company", "assignments"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan_guid, company, assignments"}, indent=2)

        assignments = arguments["assignments"]
        if not assignments or not all(a.get("role") and a.get("user_id") not in (None, "") for a in assignments):
            return json.dumps(
                {"success": False, "error": "Each assignment needs a non-empty role and user_id."},
                indent=2
            )

        normalized = []
        for a in assignments:
            if a["role"] not in _ASSIGNABLE_ROLE_SLUGS:
                return json.dumps(
                    {"success": False, "error": f"Unsupported role '{a['role']}'. Allowed: {sorted(_ASSIGNABLE_ROLE_SLUGS)}"},
                    indent=2
                )
            
            raw_id = a["user_id"]
            if (
                isinstance(raw_id, bool)
                or not isinstance(raw_id, (int, str))
                or (isinstance(raw_id, str) and not raw_id.strip())
            ):
                return json.dumps(
                    {"success": False, "error": f"user_id must be a non-empty string or integer, got {raw_id!r}."},
                    indent=2
                )
            user_id = int(raw_id) if isinstance(raw_id, str) and raw_id.strip().isdigit() else raw_id
            normalized.append({"role": a["role"], "user_id": user_id})

        oneloan_domain = os.getenv("ONELOAN_DOMAIN")
        if not oneloan_domain:
            return json.dumps(
                {"error": "OneLoan domain not configured. Please set ONELOAN_DOMAIN environment variable."}, indent=2
            )

        company = arguments["company"].lower()
        if company not in ("gri", "gra", "prate", "op", "kbhs", "premia"):
            company = "gri"

        loan_guid = arguments["loan_guid"]
        access_token = get_oneloan_auth_token(company)
        auth_headers = {"Authorization": f"Bearer {access_token}", "X-GR-Company": company}

        body = [["assign-role", a["user_id"], a["role"]] for a in normalized]
        logger.info(f"Constructed OneLoan assign-role body for loan {loan_guid}: {json.dumps(body)}")

        # Create OneLoan write session
        try:
            session_resp = requests.post(
                f"{oneloan_domain}/write/v1/session?company={company}",
                headers=auth_headers,
                timeout=30,
            )
            session_resp.raise_for_status()
        except requests.RequestException as e:
            resp = getattr(e, "response", None)
            status = resp.status_code if resp is not None else None
            logger.error(f"OneLoan session creation failed for loan {loan_guid} (status {status})")
            return json.dumps(
                {"success": False, "error": "Failed to create OneLoan session", "stage": "session", "status": status},
                indent=2,
            )

        session_id = session_resp.json().get("session-id")
        if not session_id:
            return json.dumps({"success": False, "error": "Unable to deserialize OneLoan session response."}, indent=2)

        try:
            persist_resp = requests.patch(
                f"{oneloan_domain}/real-time-write/v1/loan/persist/{loan_guid}?company={company}",
                headers={"X-Encompass-Token": session_id, "Authorization": f"Bearer {access_token}"},
                json=body,
                timeout=30,
            )
            persist_resp.raise_for_status()
        except requests.RequestException as e:
            resp = getattr(e, "response", None)
            status = resp.status_code if resp is not None else None
            server_text = resp.text if resp is not None else str(e)
            logger.error(f"OneLoan assign-role failed for loan {loan_guid} (status {status}): {server_text}")

            return json.dumps(
                {"success": False, "error": "Failed to assign OneLoan roles", "stage": "persist", "status": status},
                indent=2,
            )

        return json.dumps({"success": True, "assigned": normalized}, indent=2)