"""
Leads manager tools for MCP server
"""

import json
import os
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_internal_service_auth_token
from typing import Any, Dict

logger = logging.getLogger(__name__)

COMPANY_EID_TO_ALIAS = {
    1: "gri",
    2: "gra",
    3: "prate",
    4: "strn",
    5: "owning",
    6: "gatelessinc",
    7: "sofi",
    8: "op",
    9: "grins",
    10: "grrav",
    11: "tdl",
    12: "bkco",
    13: "cer",
    14: "citywide",
    15: "chl",
    16: "gib",
    17: "hma",
    18: "kbhs",
    19: "premia",
    20: "resu",
    21: "shold",
    22: "fpf",
    23: "sventu",
    24: "gp",
    25: "pma",
    26: "wl",
    27: "atg",
    28: "certainty",
    30: "cwhm",
    31: "qhl",
}


class CreateLoanTool(BaseTool):
    """ Tool for creating a new loan in Encompass through leads manager """

    def __init__(self):
        super().__init__(
            name="create_loan",
            description="Tool to create a new loan in Encompass through leads manager",
            input_schema={
                "type": "object",
                "properties": {
                    "firstName": {
                        "type": "string", 
                        "description": "The first name of the loan applicant"
                    },
                    "middleName": {
                        "type": "string", 
                        "description": "The middle name of the loan applicant"
                    },
                    "lastName": {
                        "type": "string", 
                        "description": "The last name of the loan applicant"
                    },
                    "mobilePhone": {
                        "type": "string", 
                        "description": "The mobile phone number of the loan applicant"
                    },
                    "loanPurposeType": {
                        "type": "string", 
                        "description": "The purpose of the loan (e.g., Purchase, Refinance)"
                    },
                    "companyEID": {
                        "type": "integer",
                        "description": "The Encompass Company EID associated with the loan"
                    },
                    "loanOfficerId": {
                        "type": "integer",
                        "description": "The Encompass Loan Officer ID associated with the loan"
                    },
                    "company-name": {
                        "type": "string", 
                        "description": "The name of the company the loan is associated with"
                    }, 
                    "originatingApp": {
                        "type": "string",
                        "description": "The originating application of the created loan"
                    },
                    "dmFlow": {
                        "type": "string",
                        "description": "The DM flow associated with the created loan"
                    },
                },
                "required": ["firstName", "lastName", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute loan creation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: firstName, lastName, company-name"}, indent=2)
        
        domain = os.getenv("LEADS_MANAGER_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Leads manager service domain not configured. Please set LEADS_MANAGER_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/mcp/create"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non-payload keys 
        exclude_keys = {"company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": {"loanId": result.json().get("loanId")}}, indent=2)

        except requests.RequestException as e:
            return sanitized_error("Failed to create loan", e, logger=logger)

  
class UpdateLoanTool(BaseTool):
    """ Tool for updating a loan by its ID in Encompass through leads manager """

    def __init__(self):
        super().__init__(
            name="update_loan",
            description="Tool for updating properties of a given loan in Encompass through leads manager",
            input_schema={
                "type": "object",
                "properties": {
                    "grLoanGuid": {"type": "string", "description": "GUID of the loan to update"},
                    "loanPurpose": {"type": "string", "description": "The purpose of the loan (e.g., Purchase, Refinance)"},
                    "loanAmount": {"type": "number", "description": "The amount of the loan"},
                    "loanOfficerId": {"type": "integer", "description": "The Encompass Loan Officer ID associated with the loan"},
                    "companyEID": {"type": "integer", "description": "The Encompass Company EID associated with the loan"},
                    "borrower": {"type": "object", "description": "Borrower information to update",
                        "properties": {
                            "firstName": {"type": "string", "description": "The first name of the borrower"},
                            "middleName": {"type": "string", "description": "The middle name of the borrower"},
                            "lastName": {"type": "string", "description": "The last name of the borrower"},
                            "suffixToName": {"type": "string", "description": "Suffix to be added to the borrower's name"},
                            "nickname": {"type": "string", "description": "The nickname of the borrower"},
                            "mobilePhone": {"type": "string", "description": "The mobile phone number of the borrower"},
                            "emailAddressText": {"type": "string", "description": "The email address of the borrower"},
                            "birthDate": {"type": "string", "description": "The birth date of the borrower in YYYY-MM-DD format"},
                            "taxIdentificationIdentifier": {"type": "string", "description": "The tax identification number of the borrower"},
                            "middleFicoScore": {"type": "integer", "description": "The middle FICO score of the borrower"},
                            "maritalStatusType": {"type": "string", "description": "The marital status of the borrower"},
                            "languagePreference": {"type": "string", "description": "The language preference of the borrower"},
                            "languageCodeOtherDescription": {"type": "string", "description": "The description of the borrower's language preference if it's set to Other"},
                            "selfDeclaredMilitaryServiceIndicator": {"type": "boolean", "description": "Indicates whether the borrower has self-declared military service"},
                            "activeDuty": {"type": "boolean", "description": "Indicates whether the borrower is currently on active duty military service"},
                            "reserveNationalGuardReserveActivated": {"type": "boolean", "description": "Indicates whether the borrower has been activated for reserve or national guard service"},
                            "spousalVABenefitsEligibilityIndicator": {"type": "boolean", "description": "Indicates whether the borrower is eligible for spousal VA benefits"},
                            "veteran": {"type": "boolean", "description": "Indicates whether the borrower is a veteran"},
                            "militaryBranchOfService": {"type": "string", "description": "The branch of military service the borrower is or was associated with"},
                            "dependentCount": {"type": "integer", "description": "The number of dependents the borrower has"},
                            "dependentsAgesDescription": {"type": "string", "description": "The description of the ages of the borrower's dependents (comma separated if more than one)"},
                            "authorizedCreditReportIndicator": {"type": "boolean", "description": "Indicates whether the borrower has authorized credit report"},
                            "creditReportAuthorizationMethod": {"type": "string", "description": "The method by which the borrower authorized credit report"},
                            "dateAuthorizedCreditReport": {"type": "string", "description": "The date when the borrower authorized credit report in YYYY-MM-DD:time format"}
                        }
                    },
                    "coborrower": {"type": "object", "description": "Coborrower information to update",
                        "properties": {
                            "firstName": {"type": "string", "description": "The first name of the coborrower"},
                            "middleName": {"type": "string", "description": "The middle name of the coborrower"},
                            "lastName": {"type": "string", "description": "The last name of the coborrower"},
                            "suffixToName": {"type": "string", "description": "Suffix to be added to the coborrower's name"},
                            "nickname": {"type": "string", "description": "The nickname of the coborrower"},
                            "mobilePhone": {"type": "string", "description": "The mobile phone number of the coborrower"},
                            "emailAddressText": {"type": "string", "description": "The email address of the coborrower"},
                            "birthDate": {"type": "string", "description": "The birth date of the coborrower in YYYY-MM-DD format"},
                            "taxIdentificationIdentifier": {"type": "string", "description": "The tax identification number of the coborrower"},
                            "middleFicoScore": {"type": "integer", "description": "The middle FICO score of the coborrower"},
                            "maritalStatusType": {"type": "string", "description": "The marital status of the coborrower"},
                            "languagePreference": {"type": "string", "description": "The language preference of the coborrower"},
                            "languageCodeOtherDescription": {"type": "string", "description": "The description of the coborrower's language preference if it's set to Other"},
                            "selfDeclaredMilitaryServiceIndicator": {"type": "boolean", "description": "Indicates whether the coborrower has self-declared military service"},
                            "activeDuty": {"type": "boolean", "description": "Indicates whether the coborrower is currently on active duty military service"},
                            "reserveNationalGuardReserveActivated": {"type": "boolean", "description": "Indicates whether the coborrower has been activated for reserve or national guard service"},
                            "spousalVABenefitsEligibilityIndicator": {"type": "boolean", "description": "Indicates whether the coborrower is eligible for spousal VA benefits"},
                            "veteran": {"type": "boolean", "description": "Indicates whether the coborrower is a veteran"},
                            "militaryBranchOfService": {"type": "string", "description": "The branch of military service the coborrower is or was associated with"},
                            "dependentCount": {"type": "integer", "description": "The number of dependents the coborrower has"},
                            "dependentsAgesDescription": {"type": "string", "description": "The description of the ages of the coborrower's dependents (comma separated if more than one)"},
                            "authorizedCreditReportIndicator": {"type": "boolean", "description": "Indicates whether the coborrower has authorized credit report"},
                            "creditReportAuthorizationMethod": {"type": "string", "description": "The method by which the coborrower authorized credit report"},
                            "dateAuthorizedCreditReport": {"type": "string", "description": "The date when the coborrower authorized credit report in YYYY-MM-DD:time format"}
                        }
                    },
                    "subjectProperty": {"type": "object", "description": "Subject property information to update",
                        "properties": {
                            "streetAddress": {"type": "string", "description": "The street address of the subject property"},
                            "city": {"type": "string", "description": "The city of the subject property"},
                            "state": {"type": "string", "description": "The state of the subject property (2 letter code)"},
                            "zipCode": {"type": "string", "description": "The zip code of the subject property"},
                            "county": {"type": "string", "description": "The county of the subject property"},
                            "unitType": {"type": "string", "description": "The unit type of the subject property"},
                            "propertyType": {"type": "string", "description": "The property type of the subject property"},
                            "occupancyType": {"type": "string", "description": "The occupancy type of the subject property"},
                            "addressUnitIdentifier": {"type": "string", "description": "The address unit identifier of the subject property"},
                            "refinancePurposeType": {"type": "string", "description": "The refinance purpose type of the subject property"}
                        }
                    },
                    "employment": {"type": "array", "description": "List of employment records to update for the borrower and coborrower",
                        "items": {
                            "type": "object",
                            "properties": {
                                "sourceOfIncomeDataType": {"type": "string", "description": "The source of income data type for the employment record"},
                                "addressState": {"type": "string", "description": "The state of the employment address (2 letter code)"},
                                "addressCity": {"type": "string", "description": "The city of the employment address"},
                                "currentEmploymentIndicator": {"type": "boolean", "description": "Indicates whether this is the current employment of the borrower/coborrower"},
                                "employmentStartDate": {"type": "string", "description": "The start date of the employment in YYYY-MM-DD format"},
                                "endDate": {"type": "string", "description": "The end date of the employment in YYYY-MM-DD format"},
                                "selfEmployedIndicator": {"type": "boolean", "description": "Indicates whether the borrower/coborrower is self-employed in this employment"},
                                "employerName": {"type": "string", "description": "The name of the employer for this employment record"},
                                "basePayAmount": {"type": "number", "description": "The base pay amount from this employment record"},
                                "commissionsAmount": {"type": "number", "description": "The amount of commissions included in the monthly income for this employment record"},
                                "bonusAmount": {"type": "number", "description": "The amount of bonus included in the monthly income for this employment record"},
                                "overtimeAmount": {"type": "number", "description": "The amount of overtime included in the monthly income for this employment record"},
                                "militaryEmployer": {"type": "boolean", "description": "Indicates whether the employer is a military employer for this employment record"},
                                "positionDescription": {"type": "string", "description": "The description of the position for this employment record"},
                                "phoneNumber": {"type": "string", "description": "The phone number of the employer for this employment record"},
                                "owner": {"type": "string", "description": "Indicates whether this employment record belongs to the borrower or the coborrower (values: borrower, coborrower)"}
                            }
                        }
                    },
                    "assets": {"type": "array", "description": "List of assets to update for the borrower and coborrower", 
                        "items": {
                            "type": "object",
                            "properties": {
                                "assetType": {"type": "string", "description": "The type of the asset"},
                                "holderName": {"type": "string", "description": "The name of the financial institution holding the asset"},
                                "owner": {"type": "string", "description": "Indicates whether this asset belongs to the borrower or the coborrower (values: Borrower, CoBorrower, Both)"},
                                "total": {"type": "number", "description": "The total amount of the asset"}
                            }
                        }
                    },
                    "otherIncomeSources": {"type": "array", "description": "List of other income sources to update for the borrower and coborrower",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string", "description": "The type of the other income source (ex: ChildSupport)"},
                                "otherDescription": {"type": "string", "description": "The description of the other income source if the type is set to Other"},
                                "monthlyAmount": {"type": "number", "description": "The monthly amount of the other income source"},
                                "owner": {"type": "string", "description": "Indicates whether this other income source belongs to the borrower or the coborrower (values: Borrower, CoBorrower)"}
                            }
                        }
                    },
                    "borrowerMonthlyExpenses": {"type": "object", "description": "The monthly expenses of the borrower to update",
                        "properties": {
                            "rentAmount": {"type": "number", "description": "The monthly rent amount to update for the borrower"},
                            "realEstateTaxAmount": {"type": "number", "description": "The monthly real estate tax amount to update for the borrower"},
                            "mortgageInsuranceAmount": {"type": "number", "description": "The monthly mortgage insurance amount to update for the borrower"},
                            "homeownersAssociationDuesAndCondoFeesAmount": {"type": "number", "description": "The monthly homeowners association dues and condo fees amount to update for the borrower"}
                        }
                    },
                    "coborrowerMonthlyExpenses": {"type": "object", "description": "The monthly expenses of the coborrower to update",
                        "properties": {
                            "rentAmount": {"type": "number", "description": "The monthly rent amount to update for the coborrower"},
                            "realEstateTaxAmount": {"type": "number", "description": "The monthly real estate tax amount to update for the coborrower"},
                            "mortgageInsuranceAmount": {"type": "number", "description": "The monthly mortgage insurance amount to update for the coborrower"},
                            "homeownersAssociationDuesAndCondoFeesAmount": {"type": "number", "description": "The monthly homeowners association dues and condo fees amount to update for the coborrower"}
                        }
                    },
                    "closingProtectionLetterDate": {"type": "string", "description": "Date of the closing protection letter (CX.CPL.DATE)"},
                    "titleCommitmentReceivedDate": {"type": "string", "description": "Date the title commitment was received (CX.TITLE.COM)"},
                    "titleFeesReceivedDate": {"type": "string", "description": "Date the title fees were received (CX.TITLE.INVOICE)"},
                    "wireInstructionsReceivedDate": {"type": "string", "description": "Date the wire instructions were received (CX.WIRE.IN)"},
                    "company-name": {"type": "string", "description": "The name of the company the loan is associated with"}
                },
                "required": ["grLoanGuid", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute loan patching """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: grLoanGuid, company-name"}, indent=2)
        
        domain = os.getenv("LEADS_MANAGER_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Leads manager service domain not configured. Please set LEADS_MANAGER_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/mcp/update/{arguments.get('grLoanGuid')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non-payload keys 
        exclude_keys = {"company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.patch(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to update loan", e, logger=logger)

        

class CopyLoanTool(BaseTool):
    """ Tool for copying a loan in Encompass through leads manager """

    def __init__(self):
        super().__init__(
            name="copy_loan",
            description="Tool to copy a loan in Encompass through leads manager",
            input_schema={
                "type": "object",
                "properties": {
                    "loan-id": {
                        "type": "string", 
                        "description": "The GUID of the loan to copy"
                    },
                    "loanParts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of loan parts to copy"
                    },
                    "overrides": {
                        "type": "object",
                        "properties": {
                            "borrower": {
                                "type": "object",
                                "properties": {
                                    "birthDate": {"type": "string", "description": "The birth date of the borrower in YYYY-MM-DD format"},
                                    "taxIdentificationIdentifier": {"type": "string", "description": "The tax identification number of the borrower"}
                                }
                            },
                            "loanFolder": {
                                "type": "string", 
                                "description": "The folder where the copied loan will be placed"
                            },
                            "loanPurpose": {
                                "type": "string", 
                                "description": "The purpose of the new loan (e.g., Purchase, Refinance)"
                            }
                        }
                    },
                    "company-name": {
                        "type": "string", 
                        "description": "The name of the company the loan is associated with"
                    }
                },
                "required": ["loan-id", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute loan copy """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loan-id, company-name"}, indent=2)
        
        domain = os.getenv("LEADS_MANAGER_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Leads manager service domain not configured. Please set LEADS_MANAGER_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v2/loans/copy/{arguments.get('loan-id')}/loan"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }
        
        # Remove non-payload fields
        exclude_keys = {"company-name", "loan-id"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to copy loan", e, logger=logger)
        

class CopyLoanPartsTool(BaseTool):
    """ Tool for copying co-borrower loan parts in Encompass through leads manager """

    def __init__(self):
        super().__init__(
            name="copy_loan_parts",
            description="Tool to copy co-borrower loan parts to another existing loan in Encompass through leads manager",
            input_schema={
                "type": "object",
                "properties": {
                    "loanParts": {
                        "type": "array", 
                        "items": {"type": "string"},
                        "description": "List of loan parts to copy"
                    },
                    "sourceLoanId": {
                        "type": "string", 
                        "description": "The GUID of the source loan"
                    },
                    "destinationLoanId": {
                        "type": "string", 
                        "description": "The GUID of the target loan"
                    },
                    "overrides": {
                        "type": "object",
                        "properties": {
                            "coborrower": {
                                "type": "object",
                                "properties": {
                                    "birthDate": {"type": "string", "description": "The birth date of the co-borrower in YYYY-MM-DD format"},
                                    "taxIdentificationIdentifier": {"type": "string", "description": "The tax identification number of the co-borrower"}
                                }
                            }
                        }
                    },
                    "company-name": {
                        "type": "string", 
                        "description": "The name of the company the loan is associated with"
                    }
                },
                "required": ["sourceLoanId", "destinationLoanId", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute loan parts copy """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: sourceLoanId, destinationLoanId, company-name"}, indent=2)
        
        domain = os.getenv("LEADS_MANAGER_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Leads manager service domain not configured. Please set LEADS_MANAGER_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v2/loans/copy/loanparts"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": arguments.get("company-name"),
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non-payload keys 
        exclude_keys = {"company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to copy loan parts", e, logger=logger)
        

class GetLoanPropertiesTool(BaseTool):
    """ Tool for getting loan properties from Encompass through leads manager """

    def __init__(self):
        super().__init__(
            name="get_loan_properties",
            description="Retrieves specified properties of a loan by its identifier from Encompass through leads manager",
            input_schema={
                "type": "object",
                "properties": {
                    "loanIdentifier": {
                        "type": "string", 
                        "description": "Identifier of the loan to retrieve properties for"
                    },
                    "requestedProperties": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": [
                                "EncompassLoanId",
                                "GRLoanId",
                                "ApplicationId",
                                "BottomRatioPercent",
                                "LoanNumber",
                                "LoanPurpose",
                                "PropertyAddress",
                                "PropertyCity",
                                "PropertyCounty",
                                "PropertyState",
                                "PropertyZipCode",
                                "LoanCreditScoreToUse",
                                "BorrowerMiddleCreditScore",
                                "BorrowerMiddleFicoScore",
                                "BorrowerEquifaxScore",
                                "BorrowerExperianScore",
                                "BorrowerTransUnionScore",
                                "CoBorrowerMiddleCreditScore",
                                "CoBorrowerMiddleFicoScore",
                                "CoBorrowerEquifaxScore",
                                "CoBorrowerExperianScore",
                                "CoBorrowerTransUnionScore",
                                "RefinancePropertyAcquiredYear",
                                "RefinancePropertyOriginalCostAmount",
                                "PurchasePriceAmount",
                                "LoanProgramName",
                                "LoanPurposeOfRefinanceType",
                                "LoanAmortizationType",
                                "DownPaymentType",
                                "AttachmentType",
                                "PropertyEstimatedValueAmount",
                                "PropertyAppraisedValueAmount",
                                "BorrowerRequestedLoanAmount",
                                "LoanScheduledClosingDate",
                                "ImpoundWaived",
                                "RequestImpoundType",
                                "LoanProgramName",
                                "CustomFieldInvestorManualLocks",
                                "CustomFieldMortgageInsuranceCertificate",
                                "CustomFieldMortgageInsurance",
                                "PropertyAddress",
                                "AddressUnitDesignatorType",
                                "AddressUnitIdentifier",
                                "PropertyCity",
                                "PropertyState",
                                "PropertyZipCode",
                                "CustomFieldNewConstruction",
                                "BorrowerFirstName",
                                "BorrowerMiddleName",
                                "BorrowerLastName",
                                "BorrowerSuffix",
                                "BorrowerTaxIdentificationIdentifier",
                                "BorrowerBirthDate",
                                "BorrowerHomePhone",
                                "BorrowerMobilePhone",
                                "BorrowerEmailAddress",
                                "BorrowerMaritalStatus",
                                "BorrowerLegalOtherThanSpouse",
                                "BorrowerDependentCount",
                                "BorrowerUrla2020CitizenshipResidencyType",
                                "CurrentResidencesAddressStreetLine1",
                                "CurrentResidencesAddressCity",
                                "CurrentResidencesAddressState",
                                "CurrentResidencesAddressPostalCode",
                                "CurrentResidencesDurationTermYears",
                                "CurrentResidencesDurationTermMonths",
                                "BorrowerSelfDeclaredMilitaryServiceIndicator",
                                "HomeCounselingProvidedDate",
                                "CustomFieldAppPackageCompletedDate",
                                "RefinanceCashOutDeterminationType",
                                "LoanPurposeOfRefinanceType",
                                "PurchasePriceAmount",
                                "MortgageType",
                                "LienPriorityType",
                                "PropertyUsageType",
                                "GSEPropertyType",
                                "RequestedInterestRatePercent",
                                "LoanAmortizationTermMonths",
                                "FinancedNumberOfUnits",
                                "BorrowerSpecialBorrowerSellerRelationshipIndicator",
                                "FirstMortgagePrincipalAndInterestAmount",
                                "HazardInsuranceAmount",
                                "BalloonLoanMaturityTermMonthsCount"
                            ]
                        }
                    },
                    "company-name": {
                        "type": "string", 
                        "description": "The name of the company the loan is associated with"
                    },
                    "companyEID": {
                        "type": "number",
                        "description": "The EID of the company the loan is associated with"
                    }
                },
                "required": ["loanIdentifier", "requestedProperties"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute get loan properties """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: loanIdentifier, requestedProperties"}, indent=2)
        if not arguments.get("company-name") and not arguments.get("companyEID"):
            return json.dumps({"error": "Missing required arguments: must provide either company-name or companyEID"}, indent=2)

        company_name = arguments.get("company-name")
        if not company_name:
            company_alias = COMPANY_EID_TO_ALIAS.get(int(arguments.get("companyEID")))
            if not company_alias:
                return json.dumps({"error": f"Unknown companyEID: {arguments.get('companyEID')}"}, indent=2)
            company_name = company_alias
        
        domain = os.getenv("LEADS_MANAGER_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Leads manager service domain not configured. Please set LEADS_MANAGER_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/mcp/properties/{arguments.get('loanIdentifier')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-company": company_name,
            "x-gr-on-behalf-of": "dm-mcp",
            "Authorization": f"Bearer {access_token}"
        }

        try:
            result = requests.post(url, json=arguments.get("requestedProperties"), headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to get loan properties", e, logger=logger)