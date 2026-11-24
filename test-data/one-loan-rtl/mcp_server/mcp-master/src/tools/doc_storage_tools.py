"""
Document storage tools for MCP server
"""

import json
import os 
import logging
import requests
from .base import BaseTool, sanitized_error
from ..internal_service_auth import get_internal_service_auth_token
from typing import Any, Dict

logger = logging.getLogger(__name__)

class PrepareDocumentTool(BaseTool):
    """ Tool to prepare an incoming document for storage in the document storage service """

    def __init__(self):
        super().__init__(
            name="prepare_document",
            description="Tool to prepare a document for storage",
            input_schema={
                "type": "object",
                "properties": {
                    "encompass-loan-guid": {
                        "type": "string", 
                        "description": "The Encompass loan GUID associated with the document"
                    },
                    "name": {
                        "type": "string", 
                        "description": "The name of the document"
                    },
                    "docHolderName": {
                        "type": "string",
                        "description": "The name of the group/classification of the document (e.g. Income, Credit, Pre-Approval Letter)"
                    },
                    "grConsumerIds": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        },
                        "description": "The GR consumer IDs associated with the document holder (can be multiple if the document holder has multiple GR consumer profiles)"
                    },
                    "dba": {
                        "type": "string",
                        "description": "The DBA (doing business as) name of the document holder, if applicable."
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the document."
                    },
                },
                "required": ["encompass-loan-guid", "name", "docHolderName", "grConsumerIds", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute document preparation """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: encompass-loan-guid, name, docHolderName, grConsumerIds, company-name"}, indent=2)
        
        domain = os.getenv("DOC_STORAGE_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Document storage service domain not configured. Please set DOC_STORAGE_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/loans/{arguments.get('encompass-loan-guid')}/documents"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-on-behalf-of": "dm-mcp",
            "x-gr-originating-application": "dm-mcp",
            "x-gr-company": arguments.get("company-name"),
            "Authorization": f"Bearer {access_token}"
        }

        # Remove non payload keys 
        exclude_keys = {"encompass-loan-guid", "company-name"}
        payload = {k: v for k, v in arguments.items() if k not in exclude_keys}

        try:
            result = requests.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return json.dumps({"success": True, "data": result.json().get("documentId")}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to prepare document for storage", e, logger=logger)
        

class UploadDocumentTool(BaseTool):
    """ Tool to upload a document to doc-storage-service after it has been prepared """

    def __init__(self):
        super().__init__(
            name="upload_document",
            description="Uploads a document to the document storage service after it has been prepared",
            input_schema={
                "type": "object",
                "properties": {
                    "document-id": {
                        "type": "string",
                        "description": "The document ID returned from the prepare_document tool"
                    },
                    "encompass-loan-guid": {
                        "type": "string",
                        "description": "The Encompass loan GUID associated with the document"
                    },
                    "file": {
                        "type": "string",
                        "description": "The file content to upload (base64 encoded or binary data)",
                        "format": "binary"
                    },
                    "filename": {
                        "type": "string",
                        "description": "The original filename with extension (e.g., document.pdf, photo.jpg)"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the document"
                    }
                },
                "required": ["document-id", "encompass-loan-guid", "file", "filename", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute document upload """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: document-id, encompass-loan-guid, file, filename, company-name"}, indent=2)
        
        domain = os.getenv("DOC_STORAGE_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Document storage service domain not configured. Please set DOC_STORAGE_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/loans/{arguments.get('encompass-loan-guid')}/documents/{arguments.get('document-id')}/upload"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-on-behalf-of": "dm-mcp",
            "x-gr-originating-application": "dm-mcp",
            "x-gr-company": arguments.get("company-name"),
            "Authorization": f"Bearer {access_token}"
        }

        try:
            # Get file content from arguments
            file_content = arguments.get('file')
            
            # Handle different file content formats
            if isinstance(file_content, str):
                # Assume base64 encoded content from user's upload
                import base64
                try:
                    file_data = base64.b64decode(file_content)
                except Exception:
                    # If not valid base64, treat as raw string content
                    file_data = file_content.encode()
            elif isinstance(file_content, bytes):
                # Already in bytes format
                file_data = file_content
            else:
                # Unknown format
                return json.dumps({
                    "success": False,
                    "error": "Invalid file content format. Expected base64 string or bytes."
                }, indent=2)

            # Upload as multipart form data with part name "file"
            files = {'file': (arguments.get('filename'), file_data)}
            result = requests.put(url, files=files, headers=headers)
            result.raise_for_status()  
            return json.dumps({"success": True,"data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to upload document", e, logger=logger)
        except Exception as e:
            return sanitized_error("Unexpected error during document upload", e, logger=logger)
        

class DeleteDocumentTool(BaseTool):

    """ Tool for deleting an uploaded document in the doc-storage-service """

    def __init__(self):
        super().__init__(
            name="delete_document",
            description="Tool for deleting a document in the document storage service",
            input_schema={
                "type": "object",
                "properties": {
                    "param1": {
                        "document-id": {
                            "type": "string",
                            "description": "The document ID returned from the prepare_document tool"
                        },
                        "encompass-loan-guid": {
                            "type": "string",
                            "description": "The Encompass loan GUID associated with the document"
                        },
                        "company-name": {
                            "type": "string",
                            "description": "The name of the company the document is associated with"
                        }
                    }
                },
                "required": ["document-id", "encompass-loan-guid", "company-name"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute document deletion """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: document-id, encompass-loan-guid, company-name"}, indent=2)

        domain = os.getenv("DOC_STORAGE_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Document storage service domain not configured. Please set DOC_STORAGE_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/loans/{arguments.get('encompass-loan-guid')}/documents/{arguments.get('document-id')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-on-behalf-of": "dm-mcp",
            "x-gr-originating-application": "dm-mcp",
            "x-gr-company": arguments.get("company-name"),
            "Authorization": f"Bearer {access_token}"
        }

        try:
            result = requests.delete(url, headers=headers)
            result.raise_for_status()
            data = result.json() if result.content else None
            return json.dumps({"success": True, "data": data}, indent=2)
        
        except requests.RequestException as e:
            return sanitized_error("Failed to delete document", e, logger=logger)
        except Exception as e:
            return sanitized_error("Unexpected error during document deletion", e, logger=logger)
        

class MoveDocumentFolderTool(BaseTool):
    """ Tool for moving a document to a different folder/classification in the doc-storage-service """

    def __init__(self):
        super().__init__(
            name="move_document",
            description="Tool for moving a document to a different folder/classification in the document storage service",
            input_schema={
                "type": "object",
                "properties": {
                    "document-id": {
                        "type": "string",
                        "description": "The document ID returned from the prepare_document tool"
                    },
                    "encompass-loan-guid": {
                        "type": "string",
                        "description": "The Encompass loan GUID associated with the document"
                    },
                    "company-name": {
                        "type": "string",
                        "description": "The name of the company associated with the document"
                    },
                    "docHolderName": {
                        "type": "string",
                        "description": "The name of the group/classification to move the document to (e.g. Income, Credit, Pre-Approval Letter)"
                    },  
                },
                "required": ["document-id", "encompass-loan-guid", "company-name", "docHolderName"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute document move """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: document-id, encompass-loan-guid, company-name, docHolderName"}, indent=2)
        
        domain = os.getenv("DOC_STORAGE_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Document storage service domain not configured. Please set DOC_STORAGE_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/loans/{arguments.get('encompass-loan-guid')}/documents/{arguments.get('document-id')}"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-on-behalf-of": "dm-mcp",
            "x-gr-originating-application": "dm-mcp",
            "x-gr-company": arguments.get("company-name"),
            "Authorization": f"Bearer {access_token}"
        }
        body = {
            "docHolderName": arguments.get("docHolderName")
        }

        try:
            result = requests.patch(url, json=body, headers=headers)
            result.raise_for_status()

            return json.dumps({"success": True,"data": result.json()}, indent=2)
        except requests.RequestException as e:
            return sanitized_error("Failed to move document", e, logger=logger)


class GetDocumentsTool(BaseTool):
    """ Tool for retrieving all documents and folders for a given loan in the doc-storage-service """

    def __init__(self):
        super().__init__(
            name="get_documents",
            description="Tool for retrieving all documents and folders for a loan in the document storage service",
            input_schema={
                "type": "object",
                "properties": {
                    "encompass-loan-guid": {
                        "type": "string",
                        "description": "The Encompass loan GUID associated with the documents"
                    },
                    "company": {
                        "type": "string",
                        "description": "The name of the company associated with the documents"
                    }
                },
                "required": ["encompass-loan-guid", "company"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        """ Execute document retrieval """
        if not self.validate_arguments(arguments):
            return json.dumps({"error": "Missing required arguments: encompass-loan-guid, company"}, indent=2)

        domain = os.getenv("DOC_STORAGE_SERVICE_DOMAIN")

        if not domain:
            return json.dumps({
                "success": False,
                "error": "Document storage service domain not configured. Please set DOC_STORAGE_SERVICE_DOMAIN environment variable."
            }, indent=2)
        
        url = f"{domain}/v1/loans/{arguments.get('encompass-loan-guid')}/documents"
        access_token = get_internal_service_auth_token()
        headers = {
            "x-gr-on-behalf-of": "dm-mcp",
            "x-gr-originating-application": "dm-mcp",
            "x-gr-company": arguments.get("company"),
            "Authorization": f"Bearer {access_token}"
        }

        try:
            logger.info(f"Retrieving documents from {url}")
            result = requests.get(url, headers=headers)
            result.raise_for_status()
            logger.info(f"Successfully retrieved documents, status: {result.status_code}")
            return json.dumps({"success": True, "data": result.json()}, indent=2)
        
        except requests.RequestException as e:
            logger.error(f"Request failed: status={getattr(e.response, 'status_code', 'N/A')}, url={url}", exc_info=True)
            return sanitized_error("Failed to retrieve documents", e, logger=logger)
        except Exception as e:
            return sanitized_error("Unexpected error during document retrieval", e, logger=logger)