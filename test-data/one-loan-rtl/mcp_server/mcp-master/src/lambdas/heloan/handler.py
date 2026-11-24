import asyncio
import json
import logging
import os
import re
import boto3
import requests

from .decision_record import claim_loan, extract_credit_reference_identifier, record_decision, filter_ecs_to_latest_report
from .decline_queue import queue_decline_for_digest, queue_pass_for_digest
from .pdf_generator import generate_decision_pdf
from .oneloan_patch import patch_decline_fields
from .member_decline_email import send_member_decline_email
from src.tools.doc_storage_tools import PrepareDocumentTool, UploadDocumentTool
from src.tools.ecs_tools import GetECSCreditTool, ReissueCreditTool
from src.tools.oneloan_tools import GetLoanTool

PIPELINE_ASSIGNMENT_LAMBDA_NAME_ENV = "PIPELINE_ASSIGNMENT_LAMBDA_NAME"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

def get_decline_reason(prajna_result: dict) -> str:
    """Best-effort extraction of the primary decline reason for quick reference."""
    for rule in prajna_result.get("rules", []):
        if (rule.get("decision") or "").upper() == "DECLINE" and rule.get("proposed_decline_reason"):
            return rule["proposed_decline_reason"]
    return ""


async def _invoke_pipeline_assignment_lambda(payload: dict) -> None:
    function_name = os.getenv(PIPELINE_ASSIGNMENT_LAMBDA_NAME_ENV)
    if not function_name:
        raise RuntimeError(f"{PIPELINE_ASSIGNMENT_LAMBDA_NAME_ENV} environment variable is not set")

    response = await asyncio.to_thread(
        boto3.client("lambda").invoke,
        FunctionName=function_name,
        InvocationType="Event",
        Payload=json.dumps(payload).encode("utf-8"),
    )
    if response.get("StatusCode") != 202:
        raise RuntimeError(f"Pipeline-assignment Lambda invocation was not accepted: {response.get('StatusCode')}")

    logger.info(
        "Pipeline-assignment Lambda accepted loan %s with Prajna decision %s",
        payload.get("detail", {}).get("identity", {}).get("loanNumber"),
        payload.get("decision"),
    )


def lambda_handler(event: dict, context) -> dict:
    return asyncio.run(_handler(event, context))


async def _handler(event: dict, context) -> dict:
    # Disable in dev to avoid consuming resources when not in active development
    logger.info("Raw event: %s", json.dumps(event))
    if os.getenv("ENVIRONMENT") == "dev":
        logger.info("Handler is disabled in the dev environment.")
        return {"statusCode": 200, "body": json.dumps({"message": "Handler disabled in dev environment"})}
    
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    # Load secrets into environment variables
    for key, value in secrets.items():
        os.environ[key] = value

    # Extract loan number and company code from the event payload
    loan_number = event.get("detail", {}).get("identity", {}).get("loanNumber")
    encompass_guid = event.get("detail", {}).get("identity", {}).get("encompassGUID")
    company_code = event.get("detail", {}).get("company", {}).get("code")
    if not loan_number:
        logger.error("Loan number not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Loan number is required in the event payload."})}
    if not company_code:
        logger.error("Company code not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Company code is required in the event payload."})}
    if not encompass_guid:
        logger.error("Encompass GUID not found in the event payload.")
        return {"statusCode": 400, "body": json.dumps({"error": "Encompass GUID is required in the event payload."})}
    logger.info("Received milestone-changed(heloan) event for loan number: %s w/ company code: %s", loan_number, company_code)

    loan_program = None
    milestone = None
    credit_order_ref_num = None
    try:
        loan_program_raw = await GetLoanTool().execute({
            "loan_identifier": encompass_guid,
            "company": company_code,
            "requestedProperties": ["1401", "MS.STATUS", "300"],
        })
        loan_program_response = json.loads(loan_program_raw)
        if not loan_program_response.get("success"):
            raise RuntimeError(f"GetLoanTool call failed: {loan_program_response}")
        loan_program = loan_program_response.get("data", {}).get("1401")
        milestone = loan_program_response.get("data", {}).get("MS.STATUS")
        credit_order_ref_num = loan_program_response.get("data", {}).get("300")
        logger.info("Loan program (field 1401) for loan %s: %s", loan_number, loan_program)
        logger.info("Current Milestone (field MS.STATUS) for loan %s: %s", loan_number, milestone)
        logger.info("Credit Order Ref Num (field 300) for loan %s: %s", loan_number, credit_order_ref_num)
    except Exception:
        logger.exception("Failed to fetch loan properties for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to fetch loan properties"})}

    # Eligibility filters are production-only; all environments fetch the payload fields.
    if os.getenv("ENVIRONMENT") == "prod":
        is_supported_program = (
            re.search(r"\b(?:CES|HELOAN)\b", loan_program or "", re.IGNORECASE)
            and "brokered" not in (loan_program or "").casefold()
        )

        if not is_supported_program:
            logger.info("Skipping event for loan %s with unsupported loan program: %s", loan_number, loan_program)
            return {"statusCode": 200, "body": json.dumps({"message": "Unsupported product; event ignored"})}
        if milestone != "Sent to processing":
            logger.info("Skipping event for loan %s with milestone: %s", loan_number, milestone)
            return {"statusCode": 200, "body": json.dumps({"message": "Milestone not yet reached; event ignored"})}
        if not credit_order_ref_num:
            logger.info("Skipping event for loan %s with no credit pulled", loan_number)
            return {"statusCode": 200, "body": json.dumps({"message": "Credit has not been pulled; event ignored"})}

    # Call ECS to reissue credit to ensure we have the latest data
    try:
        await ReissueCreditTool().execute({
            "loanId": loan_number,
            "company": company_code
        })
        
    except Exception as e:
        logger.error("Failed to reissue ECS credit: %s", e)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to reissue ECS credit"})}

    # Call ECS to retrieve credit
    try:
        ecs_response = await GetECSCreditTool().execute({
            "loan_number": loan_number
        })
        ecs_response = json.loads(ecs_response)
        if not ecs_response.get("success"):
            logger.error("Failed to retrieve ECS credit information for loan %s", loan_number)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to retrieve ECS credit information"})}

    except Exception as e:
        logger.error("Failed to retrieve ECS credit information: %s", e)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to retrieve ECS credit information"})}

    # Fetch the current Loan Officer / Process Manager emails for the decision record.
    try:
        team_email_raw = await GetLoanTool().execute({
            "loan_identifier": encompass_guid,
            "company": company_code,
            "requestedProperties": [
                "LoanTeamMember.Email.Loan_Officer",
                "LoanTeamMember.Email.ProcessManager",
            ],
        })
        team_email_response = json.loads(team_email_raw)
        if not team_email_response.get("success"):
            raise RuntimeError(f"GetLoanTool call failed: {team_email_response}")
        lo_email = team_email_response.get("data", {}).get("LoanTeamMember.Email.Loan_Officer")
        pm_email = team_email_response.get("data", {}).get("LoanTeamMember.Email.ProcessManager")
    except Exception:
        logger.exception("Failed to fetch LO/PM emails for loan %s; proceeding without them", loan_number)
        lo_email = None
        pm_email = None
    
    # Claim the loan before any downstream side effects so a duplicate event for the
    # same loan and credit pull (reissues included) exits here.
    credit_reference_identifier = extract_credit_reference_identifier(ecs_response)
    if not credit_reference_identifier:
        logger.error("No successful ECS credit report found for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "No successful ECS credit report found"})}
    if not claim_loan(loan_number, encompass_guid, company_code, credit_reference_identifier, loan_program, lo_email, pm_email):
        logger.info("Duplicate event for loan %s with credit reference %s; already processed", loan_number, credit_reference_identifier)
        return {"statusCode": 200, "body": json.dumps({"message": "Duplicate event for loan; already processed", "loan_number": loan_number})}
    
    # Call Prajna HELOAN API to retrieve credit decision
    domain = os.getenv("PRAJNA_HELOAN_DOMAIN")
    if not domain:
        logger.error("PRAJNA_HELOAN_DOMAIN environment variable is not set.")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}
    headers = {
        "x-api-key": os.getenv("PRAJNA_ACCESS_TOKEN")
    }
    
    # Filter ECS data to only include the latest credit report
    ecs_data_latest = filter_ecs_to_latest_report(ecs_response.get("data", {}))
    
    body = {
        "loan_number": loan_number,
        "company": company_code,
        "ecs_data": ecs_data_latest
    }

    try:
        # 30s connect / 60s read — Prajna typically responds within a few seconds; a
        # missing timeout would let a hung upstream stall this lambda until its own
        # timeout, triggering the duration alarm and consuming concurrency.
        response = requests.post(url=domain, headers=headers, json=body, timeout=(30, 60))
        response.raise_for_status()
        # NOTE: do NOT log the response body — it contains borrower credit / liability
        # detail (PII). Only log that the call succeeded.
        logger.info("Prajna HELOAN API call succeeded for loan %s", loan_number)

    except requests.RequestException as e:
        logger.error("Failed to call Prajna API: %s", e)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to call Prajna API"})}

    prajna_result = response.json()
    prajna_decision = (prajna_result.get("overall_decision") or "").upper()
    rules_count = prajna_result.get("rules_count") or len(prajna_result.get("rules") or [])
    try:
        record_decision(loan_number, credit_reference_identifier, prajna_decision, rules_count)
    except Exception:
        logger.exception("Failed to record HELOAN decision for loan %s", loan_number)

    try:
        pdf_bytes = generate_decision_pdf(prajna_result)
    except Exception:
        logger.exception("Failed to generate decision PDF for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to generate decision PDF"})}

    
    if prajna_decision == "DECLINE":
        logger.info("Loan Declined - Encompass GUID for loan %s: %s", loan_number, encompass_guid)
        # Obtain the primary decline reason for loan field patching and email purposes.
        decline_reason = get_decline_reason(prajna_result)

        # Accumulate declines for the daily digest email rather than notifying per-loan.
        try:
            queue_decline_for_digest(prajna_result, pdf_bytes, encompass_guid, decline_reason)
        except Exception:
            logger.exception("Failed to queue HELOAN decline for daily digest, loan %s", loan_number)

        # Patch the decline fields in the encompass JSON.
        try:
            await patch_decline_fields(encompass_guid, company_code, decline_reason)
            logger.info("Patching decline fields is temporarily disabled")
        except Exception:
            logger.exception("Failed to patch OneLoan decline fields, loan %s", loan_number)

        # Send a real-time decline notification email to the loan's responsible Loan Officer and Process Manager.
        try:
            await send_member_decline_email(loan_number, encompass_guid, company_code, decline_reason)
            logger.info("Sending emails to LO is temporarily disabled")
        except Exception:
            logger.exception("Failed to send HELOAN member decline email, loan %s", loan_number)

    elif prajna_decision in ("PASS", "NEEDS REVIEW"):
        # Accumulate passes and needs-review decisions for the daily digest email
        # rather than notifying per-loan.
        try:
            queue_pass_for_digest(prajna_result, pdf_bytes, encompass_guid, prajna_decision)
        except Exception:
            logger.exception("Failed to queue HELOAN pass for daily digest, loan %s", loan_number)


    # Normalize company header for Taskmaster create_tasks call.
    taskmaster_company = (company_code or "").lower()
    if taskmaster_company not in ("gra", "gri", "prate", "op", "citywide"):
        logger.info(
            "Company code '%s' is not supported for Taskmaster header, defaulting to 'gri'",
            company_code,
        )
        taskmaster_company = "gri"

    # Upload the generated pdf to doc storage service
    try:
        prepare_response_raw = await PrepareDocumentTool().execute({
            "encompass-loan-guid": encompass_guid,
            "name": "HELOAN Credit Decision Report",
            "docHolderName": "Underwriting Guidelines",
            "grConsumerIds": [],
            "company-name": taskmaster_company
        })
        prepare_response = json.loads(prepare_response_raw)
        if not prepare_response.get("success"):
            logger.error("PrepareDocumentTool call failed for loan %s: %s", loan_number, prepare_response)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to prepare document storage"})}
        document_id = prepare_response.get("data")
        logger.info("Prepared document storage for loan %s, document ID: %s", loan_number, document_id)

    except Exception:
        logger.exception("Failed to prepare document storage for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to prepare document storage"})}

    try:
        upload_response_raw = await UploadDocumentTool().execute({
            "document-id": document_id,
            "encompass-loan-guid": encompass_guid,
            "file": pdf_bytes,
            "filename": "HELOAN Credit Decision Report.pdf",
            "company-name": taskmaster_company
        })
        upload_response = json.loads(upload_response_raw)
        if not upload_response.get("success"):
            logger.error("UploadDocumentTool call failed for loan %s, document ID %s", loan_number, document_id)
            return {"statusCode": 500, "body": json.dumps({"error": "Failed to upload decision PDF", "document_id": document_id})}
        # Only log identifiers, not the full upload response body (may echo
        # internal document metadata / URLs).
        logger.info("Uploaded decision PDF for loan %s, document ID %s", loan_number, document_id)

    except Exception:
        logger.exception("Failed to upload decision PDF for loan %s", loan_number)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to upload decision PDF"})}

    await _invoke_pipeline_assignment_lambda({
        "detail": event.get("detail", {}),
        "decision": prajna_decision,
    })

    return {"statusCode": 200, "body": json.dumps({"loan_number": loan_number, "document_id": document_id})}
