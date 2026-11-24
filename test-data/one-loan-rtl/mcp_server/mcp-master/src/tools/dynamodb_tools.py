"""
DynamoDB tools for MCP server
"""

import json
import logging
import os
from decimal import Decimal
from typing import Any, Dict, List

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from .base import BaseTool

logger = logging.getLogger(__name__)

TABLE_REGION = "us-east-1"
LO_TABLE_ARN = os.getenv("DYNAMODB_LO_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/Databricks_lo_data")
PRAJNA_CREDIT_TRIGGER_TABLE_ARN = os.getenv("DYNAMODB_PRAJNA_CREDIT_TRIGGER_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/prajna_credittrigger_segment")
PRAJNA_HIGHLY_ENGAGED_TABLE_ARN = os.getenv("DYNAMODB_PRAJNA_HIGHLY_ENGAGED_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/prajna_highlyengaged_segment")
PRAJNA_HIGH_EQUITY_TABLE_ARN = os.getenv("DYNAMODB_PRAJNA_HIGH_EQUITY_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/prajna_highequity_segment")
PRAJNA_JUST_LISTED_TABLE_ARN = os.getenv("DYNAMODB_PRAJNA_JUST_LISTED_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/prajna_justlisted_segment")
PRAJNA_PREDICTIVE_TABLE_ARN = os.getenv("DYNAMODB_PRAJNA_PREDICTIVE_TABLE_ARN", "arn:aws:dynamodb:us-east-1:597067671424:table/prajna_predictive_segment")
DOC_EXTRACTION_CENTRALIZED_TABLE_ARN = os.getenv("DYNAMODB_DOC_EXTRACTION_CENTRALIZED_TABLE_ARN","arn:aws:dynamodb:us-east-1:336015931235:table/document_extraction_centralized")
PRAJNA_LO_CONTACT_TABLES = {
    "prajna_highlyengaged_segment": PRAJNA_HIGHLY_ENGAGED_TABLE_ARN,
    "prajna_credittrigger_segment": PRAJNA_CREDIT_TRIGGER_TABLE_ARN,
    "prajna_highequity_segment": PRAJNA_HIGH_EQUITY_TABLE_ARN,
    "prajna_justlisted_segment": PRAJNA_JUST_LISTED_TABLE_ARN,
    "prajna_predictive_segment": PRAJNA_PREDICTIVE_TABLE_ARN,
}

def _get_dynamodb_resource():
    """
    Return a boto3 DynamoDB resource.
    """
    session = boto3.Session(region_name=TABLE_REGION)
    return session.resource("dynamodb")


def _count_by_gsi(index_name: str, key_attr: str, key_value: str, table_arn: str) -> int:
    """Return the count of items matching a GSI partition key without fetching item data."""
    dynamodb = _get_dynamodb_resource()
    table = dynamodb.Table(table_arn)

    count = 0
    kwargs: Dict[str, Any] = {
        "IndexName": index_name,
        "KeyConditionExpression": Key(key_attr).eq(key_value),
        "Select": "COUNT",
    }

    while True:
        response = table.query(**kwargs)
        count += response.get("Count", 0)
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key

    return count


def _query_by_gsi(
    index_name: str,
    key_attr: str,
    key_value: str,
    table_arn: str,
    sort_key_condition=None,
) -> List[dict]:
    """
    Query a GSI by partition key — fast, no full-table scan.
    Paginates automatically until all matching items are returned.
    """
    dynamodb = _get_dynamodb_resource()
    table = dynamodb.Table(table_arn)

    key_condition = Key(key_attr).eq(key_value)
    if sort_key_condition is not None:
        key_condition = key_condition & sort_key_condition

    items = []
    kwargs: Dict[str, Any] = {
        "IndexName": index_name,
        "KeyConditionExpression": key_condition,
    }

    while True:
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key

    return items


class DatabricksLoanOfficerQueryTool(BaseTool):
    """Tool for querying the Databricks_lo_data DynamoDB table."""

    def __init__(self):
        super().__init__(
            name="query_loan_officer_data",
            description=(
                "Query the Databricks_lo_data table in DynamoDB for loan officer records. "
                "Search by either the loan officer's paid-LO name (paidloname) or their "
                "cell phone number (cellphonenumber). Returns all columns for every "
                "matching record."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "query_by": {
                        "type": "string",
                        "enum": ["paidloname", "cellphonenumber", "lo_workemail"],
                        "description": (
                            "The attribute to search on: "
                            "'paidloname' to search by the loan officer's paid-LO name, "
                            "'cellphonenumber' to search by their cell phone number, "
                            "'lo_workemail' to search by their work email."
                        ),
                    },
                    "query_value": {
                        "type": "string",
                        "description": "The value to search for in the chosen attribute.",
                    },
                },
                "required": ["query_by", "query_value"],
            },
        )

    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps(
                {"error": "Missing required arguments: query_by, query_value"},
                indent=2,
            )

        query_by: str = arguments["query_by"]
        query_value: str = arguments["query_value"]

        if query_by not in ("paidloname", "cellphonenumber", "lo_workemail"):
            return json.dumps(
                {"error": "query_by must be either 'paidloname', 'cellphonenumber', or 'lo_workemail'"},
                indent=2,
            )

        try:
            if query_by == "paidloname":
                # Use the GSI for an efficient query
                items = _query_by_gsi("paidloname_index", "paidloname", query_value, LO_TABLE_ARN)
            elif query_by == "cellphonenumber":
                # Use the GSI for an efficient query
                items = _query_by_gsi("cellphonenumber_index", "cellphonenumber", query_value, LO_TABLE_ARN)
            else:
                # Use the GSI for an efficient query
                items = _query_by_gsi("lo_workemail_index", "lo_workemail", query_value, LO_TABLE_ARN)

            return json.dumps(
                {
                    "success": True,
                    "items": items,
                },
                indent=2,
                default=str,  # handles Decimal and datetime objects from DynamoDB
            )

        except ValueError as e:
            logger.error("Configuration error querying DynamoDB: %s", e)
            return json.dumps({"success": False, "error": "Invalid request configuration"}, indent=2)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error("DynamoDB ClientError [%s]: %s", error_code, error_msg)
            return json.dumps(
                {"success": False, "error": "Database query failed"},
                indent=2,
            )

        except Exception:
            logger.exception("Unexpected error querying DynamoDB table %s", LO_TABLE_ARN)
            return json.dumps(
                {"success": False, "error": "Unexpected error"},
                indent=2,
            )
        

class PrajnaCreditTriggerSegmentQueryTool(BaseTool):
    """Tool for querying the prajna_credittrigger_segment DynamoDB table"""

    def __init__(self):
        super().__init__(
            name="query_credit_trigger_segment",
            description="Query the Prajna credit trigger segment in DynamoDB by LO email address",
            input_schema={
                "type": "object",
                "properties": {
                    "lo_email": {
                        "type": "string", 
                        "description": "The email address to search for in the Prajna credit trigger segment table."
                    }
                },
                "required": ["lo_email"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required argument: lo_email"}, indent=2)

        email: str = arguments["lo_email"]

        try:
            items = _query_by_gsi("lo_email_index", "lo_email", email, PRAJNA_CREDIT_TRIGGER_TABLE_ARN)

            return json.dumps(
                {
                    "success": True,
                    "items": items,
                },
                indent=2,
                default=str,
            )

        except ValueError as e:
            logger.error("Configuration error querying Prajna credit trigger DynamoDB: %s", e)
            return json.dumps({"success": False, "error": "Invalid request configuration"}, indent=2)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error("DynamoDB ClientError [%s]: %s", error_code, error_msg)
            return json.dumps(
                {"success": False, "error": "Database query failed"},
                indent=2,
            )

        except Exception:
            logger.exception("Unexpected error querying DynamoDB table %s", PRAJNA_CREDIT_TRIGGER_TABLE_ARN)
            return json.dumps(
                {"success": False, "error": "Unexpected error"},
                indent=2,
            )


class LoContactsCountTool(BaseTool):
    """ Tool for querying the counts of a specific LO email in the specified tables """

    def __init__(self):
        super().__init__(
            name="get_lo_contacts_count",
            description="Query the counts of each table provided for a specific LO email",
            input_schema={
                "type": "object",
                "properties": {
                    "lo_email": {
                        "type": "string", 
                        "description": "Email address of the LO to query by"
                    },
                    "tables": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of table names to query the counts from"
                    }
                },
                "required": ["lo_email", "tables"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: lo_email and tables"}, indent=2)

        email = arguments["lo_email"]
        tables = arguments["tables"]

        invalid = [t for t in tables if t not in PRAJNA_LO_CONTACT_TABLES]
        if invalid:
            return json.dumps({"error": f"Unknown tables: {invalid}. Valid tables: {list(PRAJNA_LO_CONTACT_TABLES)}"}, indent=2)

        try:
            counts = {
                f"{table_name}_count": _count_by_gsi("lo_email_index", "lo_email", email, PRAJNA_LO_CONTACT_TABLES[table_name])
                for table_name in tables
            }
            return json.dumps({"success": True, **counts}, indent=2)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error("DynamoDB ClientError [%s]: %s", error_code, error_msg)
            return json.dumps({"success": False, "error": "Database query failed"}, indent=2)

        except Exception:
            logger.exception("Unexpected error querying LO contact counts for %s", email)
            return json.dumps({"success": False, "error": "Unexpected error"}, indent=2)


class LoContactsTool(BaseTool):
    """ Tool for fetching contacts from a specified table for a specified LO email """

    def __init__(self):
        super().__init__(
            name="get_lo_contacts",
            description="Fetch contacts from a specified table for a specified LO email",
            input_schema={
                "type": "object",
                "properties": {
                    "lo_email": {
                        "type": "string", 
                        "description": "Email address of the LO to query by"
                    },
                    "table": {
                        "type": "string", 
                        "description": "Name of the table to fetch contacts from"
                    }
                },
                "required": ["lo_email", "table"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: lo_email and table"}, indent=2)

        email = arguments["lo_email"]
        table_name = arguments["table"]

        if table_name not in PRAJNA_LO_CONTACT_TABLES:
            return json.dumps({"error": f"Unknown table: '{table_name}'. Valid tables: {list(PRAJNA_LO_CONTACT_TABLES)}"}, indent=2)

        try:
            items = _query_by_gsi("lo_email_index", "lo_email", email, PRAJNA_LO_CONTACT_TABLES[table_name])
            return json.dumps({"success": True, "table": table_name, "items": items}, indent=2, default=str)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error("DynamoDB ClientError [%s]: %s", error_code, error_msg)
            return json.dumps({"success": False, "error": "Database query failed"}, indent=2)

        except Exception:
            logger.exception("Unexpected error querying %s for %s", table_name, email)
            return json.dumps({"success": False, "error": "Unexpected error"}, indent=2)


class DocumentExtractionCentralizedTool(BaseTool):
    """ Tool to query the document extraction centralized table in DynamoDB """

    def __init__(self):
        super().__init__(
            name="get_document_extraction_centralized",
            description="Query the document extraction centralized table in DynamoDB",
            input_schema={
                "type": "object",
                "properties": {
                    "companyDocType": {
                        "type": "string", 
                        "description": "Document type for the company to query"
                    },
                    "docId": {
                        "type": "string", 
                        "description": "Document ID to query"
                    },
                    "extractionStatus": {
                        "type": "string",
                        "description": "Extraction status to query"
                    },
                    "loanGuid": {
                        "type": "string",
                        "description": "Optional sort key for company-doctype-guid-index. Only applied when companyDocType is also provided."
                    },
                    "initialTimestamp": {
                        "type": "string",
                        "description": "Optional sort key for extraction-status-index. Only applied when extractionStatus is also provided."
                    }
                },
                "required": []
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        company_doc_type = arguments.get("companyDocType")
        doc_id = arguments.get("docId")
        extraction_status = arguments.get("extractionStatus")
        loan_guid = arguments.get("loanGuid")
        initial_timestamp = arguments.get("initialTimestamp")

        if not any([company_doc_type, doc_id, extraction_status]):
            return json.dumps(
                {"error": "At least one of companyDocType, docId, or extractionStatus must be provided"},
                indent=2,
            )

        # Select GSI in priority order; attach sort key condition when provided
        if company_doc_type:
            index_name = "company-doctype-guid-index"
            key_attr = "company_doc_type"
            key_value = company_doc_type
            sort_key_condition = Key("loan_guid").eq(loan_guid) if loan_guid else None
        elif doc_id:
            index_name = "doc-id-index"
            key_attr = "doc_id"
            key_value = doc_id
            sort_key_condition = None
        else:
            index_name = "extraction-status-index"
            key_attr = "extraction_status"
            key_value = extraction_status
            sort_key_condition = Key("initial_timestamp").eq(Decimal(initial_timestamp)) if initial_timestamp else None

        try:
            items = _query_by_gsi(index_name, key_attr, key_value, DOC_EXTRACTION_CENTRALIZED_TABLE_ARN, sort_key_condition)

            return json.dumps(
                {"success": True, "count": len(items), "items": items},
                indent=2,
                default=str,
            )

        except ValueError as e:
            logger.error("Configuration error querying document_extraction_centralized: %s", e)
            return json.dumps({"success": False, "error": "Invalid request configuration"}, indent=2)

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error("DynamoDB ClientError [%s]: %s", error_code, error_msg)
            return json.dumps({"success": False, "error": "Database query failed"}, indent=2)

        except Exception:
            logger.exception("Unexpected error querying %s", DOC_EXTRACTION_CENTRALIZED_TABLE_ARN)
            return json.dumps({"success": False, "error": "Unexpected error"}, indent=2)
        