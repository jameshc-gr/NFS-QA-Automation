"""
Data Platform API Tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from typing import Any, Dict
from ..internal_service_auth import get_data_platform_auth_token

logger = logging.getLogger(__name__)

class SearchLoans(BaseTool):
    """ Tool for retrieving loans from data platform api based on provided search parameters """

    def __init__(self):
        super().__init__(
            name="search_loans",
            description="Retrieve loans from data platform api based on provided search parameters",
            input_schema={
                "type": "object",
                "properties": {
                    "loanNumber": {"type": "string", "description": "The loan number to search for"},
                    "borrowerPhoneNumber": {"type": "string", "description": "The borrower's phone number"},
                    "borrower2PhoneNumber": {"type": "string", "description": "The second borrower's phone number"},
                    "borrowerSsnLast4": {"type": "string", "description": "The last 4 digits of the borrower's SSN"},
                    "borrower2SsnLast4": {"type": "string", "description": "The last 4 digits of the second borrower's SSN"},
                    "borrowerFirstName": {"type": "string", "description": "The borrower's first name"},
                    "borrowerLastName": {"type": "string", "description": "The borrower's last name"},
                    "borrower2FirstName": {"type": "string", "description": "The second borrower's first name"},
                    "borrower2LastName": {"type": "string", "description": "The second borrower's last name"},
                    "borrowerSsn": {"type": "string", "description": "The borrower's SSN"},
                    "borrower2Ssn": {"type": "string", "description": "The second borrower's SSN"},
                    "borrowerEmailAddress": {"type": "string", "description": "The borrower's email address"},
                    "borrower2EmailAddress": {"type": "string", "description": "The second borrower's email address"},
                    "servicerLoanNumber": {"type": "string", "description": "The servicer's loan number"},
                    "priorServicerLoanNumber": {"type": "string", "description": "The prior servicer's loan number"},
                    "mspLoanNumber": {"type": "string", "description": "The MSP loan number"},
                    "propertyAddress": {"type": "string", "description": "The property address"},
                    "propertyCity": {"type": "string", "description": "The property city"},
                    "propertyCounty": {"type": "string", "description": "The property county"},
                    "propertyState": {"type": "string", "description": "The property state"},
                    "propertyZip": {"type": "string", "description": "The property ZIP code"}
                },
                "required": []
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute loan search """
        domain = os.getenv("DATA_PLATFORM_API_DOMAIN")
        if not domain:
            return json.dumps(
                {"error": "Data Platform API domain not configured. Please set the DATA_PLATFORM_API_DOMAIN environment variable."},
                indent=2
            )

        access_token = get_data_platform_auth_token()
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            # Step 1: Loan search
            loan_result = requests.get(
                f"{domain}/mortgage-servicing/loan-search",
                headers=headers,
                params=self._create_query_params(arguments)
            )
            loan_result.raise_for_status()
            loans = loan_result.json()

            # Step 2: Fetch all servicers once
            servicers_result = requests.get(f"{domain}/mortgage-servicing/servicer", headers=headers)
            servicers_result.raise_for_status()
            servicers_by_id = {
                s["servicerId"]: self._map_servicer(s)
                for s in servicers_result.json()
            }

            # Step 3: Fetch all scenario messages once
            messages_result = requests.get(f"{domain}/mortgage-servicing/scenariomessage", headers=headers)
            messages_result.raise_for_status()
            scenario_messages = messages_result.json()

            # Step 4: Assemble response per loan
            assembled = [
                self._assemble_loan(loan, servicers_by_id, scenario_messages)
                for loan in loans
            ]

            return json.dumps({"success": True, "data": assembled}, indent=2)
        except requests.RequestException as e:
            return sanitized_error("Failed to search loans", e, logger=logger)

    def _map_servicer(self, s: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": s.get("servicerId"),
            "name": s.get("servicerName"),
            "phone": s.get("customerServicePhone"),
            "website": s.get("website"),
            "payment_url": s.get("paymentURL"),
            "email": s.get("emailAddress"),
            "tax_payment_email": s.get("taxPaymentEmail"),
            "address": {
                "street": s.get("address"),
                "city": s.get("city"),
                "county": "",
                "state": s.get("state"),
                "postal_code": s.get("zip"),
            },
            "business_hours": None,
        }

    def _resolve_servicer(self, servicer_id, servicers_by_id: Dict[str, Any]):
        if not servicer_id:
            return None
        return servicers_by_id.get(servicer_id)

    def _assemble_loan(self, loan: Dict[str, Any], servicers_by_id: Dict[str, Any], scenario_messages: list) -> Dict[str, Any]:
        scenario_id = loan.get("scenarioId", 0)
        return {
            "company_code": loan.get("companyCode"),
            "company_key": loan.get("companyKey"),
            "servicing_loan": {
                "loan_number": loan.get("loanNumber"),
                "gr_loan_guid": loan.get("internalGUID") or None,
                "encompass_loan_guid": loan.get("encompassGUID") or None,
                "loan_amount": loan.get("loanAmount") or 0,
                "loan_purpose": loan.get("loanPurposeType"),
                "ltv": loan.get("ltv") or 0,
                "current_escrow_balance": loan.get("escrowBalanceAmount") or 0,
                "current_monthly_payment": loan.get("currentMonthlyPayment") or 0,
                "current_upb": loan.get("unpaidPrincipalBalance") or 0,
                "lien_position": loan.get("lienPosition"),
                "loan_type": loan.get("loanType"),
                "amortization_type": loan.get("amortizationType"),
                "boarding_date": loan.get("dateBoarded"),
                "investor_name": loan.get("investorName"),
                "last_known_active_serviced_date": loan.get("lastKnownServicerReportDate"),
                "last_known_active_upb": loan.get("lastKnownActiveUpb") or 0,
                "original_monthly_payment": loan.get("initialMonthlyPayment") or 0,
                "data_date": loan.get("sourceModifiedDateTime"),
                "next_due_date": loan.get("nextPaymentDueDate"),
                "paid_in_full_date": loan.get("payOffDate"),
                "purchase_advice_amount": loan.get("purchaseAdviceAmount") or 0,
                "purchased_date": loan.get("purchaseAdviceDate"),
                "first_payment_due_date": loan.get("firstPaymentDueDate"),
                "funded_date": loan.get("fundedDate"),
                "msr_investor_name": loan.get("msrInvestorName"),
                "investor": {
                    "type": loan.get("investorType"),
                    "recast_eligible": loan.get("investorRecastEligible"),
                    "recast_fee": loan.get("investorRecastFee") or 0,
                    "recast_requirements": loan.get("investorRecastRequirements"),
                    "epo_days": loan.get("investorEPODays"),
                    "epo_requirements": loan.get("investorEPORequirements"),
                    "name": "",
                },
                "investor_loan_number": loan.get("investorLoanNumber"),
                "msr_sale_date": loan.get("msrSaleDate"),
                "first_payment_due_investor": loan.get("firstPaymentDueInvestor"),
                "last_payment_received_date": loan.get("lastPaymentReceivedDate"),
                "tax_paid_at_closing": loan.get("taxPaidAtClosing"),
                "insurance_paid_at_closing": loan.get("insurancePaidAtClosing"),
                "next_ins_due_date": loan.get("nextInsDueDate"),
                "next_tax_due_date": loan.get("nextTaxDueDate"),
                "communications": loan.get("communications"),
                "transactions": loan.get("transactions"),
                "loan_status": loan.get("loanStatus"),
                "file_creation_date": loan.get("fileCreationDate"),
                "loan_officer": loan.get("loanOfficer"),
                "loan_program": loan.get("loanProgram"),
                "cc_fees_paid": loan.get("ccFeesPaid"),
                "taxes_monthly_amount": loan.get("taxesMonthlyAmount"),
                "haz_insurance_monthly_amount": loan.get("hazInsuranceMonthlyAmount"),
                "escrow_purchased": loan.get("escrowPurchased"),
                "repurchase_date": loan.get("repurchaseDate"),
                "pa_recon_date": loan.get("paReconDate"),
                "wire_recon_sent_date": loan.get("wireReconSentDate"),
                "wire_ref_number": loan.get("wireRefNumber"),
                "p_and_i_payment": loan.get("pAndIPayment"),
                "cc_active_snow_case": loan.get("ccActiveSnowCase"),
                "t_and_i_payment": loan.get("tAndIPayment"),
                "loss_draft_number": loan.get("lossDraftNumber"),
                "ybr_trade_indicator": loan.get("ybrTradeIndicator"),
                "loan_snow_sys_id": loan.get("loanSnowSysID"),
                "email_campaigns": loan.get("emailCampaigns"),
                "escrow_lines": loan.get("escrowLines"),
            },
            "servicing": {
                "loan_number": loan.get("servicerLoanNumber"),
                "gr_loan_guid": loan.get("internalGUID") or None,
                "encompass_loan_guid": loan.get("encompassGUID") or None,
                "transfer_date": loan.get("servicingTransferDate"),
                "transfer_type": None,
                "goodbye_letter_date": loan.get("goodbyeLetterDate"),
                "current_servicer_id": loan.get("currentServicerId"),
                "prior_servicer_loan_number": loan.get("priorServicerLoanNumber"),
                "los_servicer_tag": loan.get("losServicerTag"),
                "msp_loan_number": loan.get("mspLoanNumber"),
                "sub_servicer_loan_number": loan.get("subServicerLoanNumber"),
                "initial_escrow_wire_sent": loan.get("initialEscrowWireSent"),
                "prior_servicer_type": loan.get("priorServicerType"),
            },
            "interim_servicer": self._resolve_servicer(loan.get("interimServicerId"), servicers_by_id),
            "sub_servicer": self._resolve_servicer(loan.get("subServicerId"), servicers_by_id),
            "new_servicer": self._resolve_servicer(loan.get("transferServicerId"), servicers_by_id),
            "current_servicer": self._resolve_servicer(loan.get("currentServicerId"), servicers_by_id),
            "display_servicer": self._resolve_servicer(loan.get("displayServicerId"), servicers_by_id),
            "escalation": {
                "sales_division": loan.get("salesDivision"),
                "sales_region_escalation": loan.get("salesRegionEscalation"),
                "sales_poc": loan.get("salesPOC"),
                "sales_manager": loan.get("salesManager"),
            },
            "redirect_type": loan.get("redirectType"),
            "scenario": {
                "id": scenario_id,
                "description": "",
                "messages": [
                    {
                        "scenario_id": m["scenarioId"],
                        "message_type": m["messageType"],
                        "message_body": m["messageBody"],
                    }
                    for m in scenario_messages
                    if m.get("scenarioId") == scenario_id
                ],
            } if scenario_id and scenario_id > 0 else None,
        }

    def _create_query_params(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """ Create query parameters for data platform api request based on provided arguments """
        query_params = {}
        for key, value in arguments.items():
            if value:
                query_params[key] = value
        return query_params
