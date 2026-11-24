"""
Patches the CX.* custom fields on a HELOAN loan in Encompass (via OneLoan's patch_oneloan
API) after a decline, routing the loan into second-level review.
"""

import json
import logging

from src.tools.oneloan_tools import PatchOneLoanTool

logger = logging.getLogger()


async def patch_decline_fields(encompass_guid: str, company_code: str, decline_reason: str) -> None:
    """Patch the loan's second-level-review fields in Encompass after a HELOAN decline.

    Raises on failure so the caller can log/handle it; this is best-effort and should
    not block the primary lambda flow from returning a success response.
    """
    try:
        patch_response_raw = await PatchOneLoanTool().execute({
            "loan_guid": encompass_guid,
            "company": company_code,
            "fields": [
                {"fieldId": "CX.UW.LOAN.CURRENTSTATUS", "value": "2nd Level Review"},
                {"fieldId": "CX.UW.DECLINE", "value": "Y"},
                {"fieldId": "CX.2ND.LEVEL.COMMENTS", "value": decline_reason},
            ],
        })
        patch_response = json.loads(patch_response_raw)
    except Exception:
        logger.exception("Failed to patch OneLoan decline fields for loan guid %s", encompass_guid)
        raise

    if not patch_response.get("success"):
        logger.error("PatchOneLoanTool call failed for loan guid %s: %s", encompass_guid, patch_response)
        raise RuntimeError(f"PatchOneLoanTool call failed: {patch_response}")

    logger.info("Patched HELOAN decline fields for loan guid %s", encompass_guid)