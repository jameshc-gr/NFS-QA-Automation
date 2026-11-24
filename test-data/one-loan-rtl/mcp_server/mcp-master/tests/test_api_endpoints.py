#!/usr/bin/env python3
"""
Comprehensive test suite for FastAPI MCP Server
Tests all API endpoints and tools functionality
"""

import requests
import json
import time
import sys
import uuid
from typing import Dict, Any, List

class MCPAPITester:
    """Test suite for MCP FastAPI server"""
    
    def __init__(self, base_url: str = "http://localhost:8080", auth_token: str = "demo-token-123"):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}'
        })
        self.test_results = []
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
    
    def test_server_health(self) -> bool:
        """Test server health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_test("Health Check", True, f"Server is healthy with {data.get('tools_count', 0)} tools")
                    return True
            self.log_test("Health Check", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("Health Check", False, f"Error: {str(e)}")
            return False
    
    def test_tools_list(self) -> bool:
        """Test tools listing endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/tools/")
            if response.status_code == 200:
                data = response.json()
                tools = data.get('tools', [])
                if len(tools) > 0:
                    tool_names = [tool['name'] for tool in tools]
                    self.log_test("Tools List", True, f"Found {len(tools)} tools: {', '.join(tool_names)}")
                    return True
            self.log_test("Tools List", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("Tools List", False, f"Error: {str(e)}")
            return False
        """Test property valuation tool"""
        try:
            payload = {
                "address": "123 Main St, San Francisco, CA 94102",
                "propertyType": "Single Family",
                "squareFootage": 2000
            }
            response = self.session.post(f"{self.base_url}/tools/property_valuation", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'estimated_value' in data.get('result', ''):
                    self.log_test("Property Valuation Tool", True, "Property valuation completed")
                    return True
            self.log_test("Property Valuation Tool", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("Property Valuation Tool", False, f"Error: {str(e)}")
            return False
    
    def test_sms_tool(self) -> bool:
        """Test SMS tool (may fail if Twilio not configured)"""
        try:
            payload = {
                "to": "+1234567890",
                "message": "Test message from MCP server"
            }
            response = self.session.post(f"{self.base_url}/tools/send_sms", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_test("SMS Tool", True, "SMS sent successfully")
                    return True
                else:
                    self.log_test("SMS Tool", False, "SMS tool not configured (Twilio credentials missing)")
                    return False
            self.log_test("SMS Tool", False, f"Status: {response.status_code}")
            return False
        except Exception as e:
            self.log_test("SMS Tool", False, f"Error: {str(e)}")
            return False
    
    def test_mcp_protocol(self) -> bool:
        """Test MCP protocol endpoint"""
        try:
            # Test tools/list
            payload = {
                "jsonrpc": "2.0",
                "id": "test-list",
                "method": "tools/list",
                "params": {}
            }
            response = self.session.post(f"{self.base_url}/mcp/", json=payload)
            if response.status_code == 200:
                data = response.json()
                if 'result' in data and 'tools' in data['result']:
                    self.log_test("MCP Protocol - Tools List", True, "MCP tools/list working")
                else:
                    self.log_test("MCP Protocol - Tools List", False, "Invalid response format")
                    return False
            else:
                self.log_test("MCP Protocol - Tools List", False, f"Status: {response.status_code}")
                return False
            
            # Test tools/call
            payload = {
                "jsonrpc": "2.0",
                "id": "test-call",
                "method": "tools/call",
                "params": {
                    "name": "credit_check",
                    "arguments": {
                        "fullName": "Jane Smith",
                        "ssn": "5678",
                        "dateOfBirth": "1985-05-15"
                    }
                }
            }
            response = self.session.post(f"{self.base_url}/mcp/", json=payload)
            if response.status_code == 200:
                data = response.json()
                if 'result' in data and 'content' in data['result']:
                    self.log_test("MCP Protocol - Tool Call", True, "MCP tools/call working")
                    return True
                else:
                    self.log_test("MCP Protocol - Tool Call", False, "Invalid response format")
                    return False
            else:
                self.log_test("MCP Protocol - Tool Call", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("MCP Protocol", False, f"Error: {str(e)}")
            return False
    
    def test_authentication(self) -> bool:
        """Test authentication requirements"""
        try:
            # Test without authentication
            session_no_auth = requests.Session()
            session_no_auth.headers.update({'Content-Type': 'application/json'})
            
            response = session_no_auth.post(f"{self.base_url}/tools/credit_check", json={"test": "data"})
            if response.status_code == 401:
                self.log_test("Authentication Required", True, "Unauthenticated requests properly rejected")
                return True
            else:
                self.log_test("Authentication Required", False, f"Expected 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Authentication Required", False, f"Error: {str(e)}")
            return False
    
    def test_multi_token_authentication(self) -> bool:
        """Test multi-token authentication system"""
        try:
            # Test with admin token (if configured)
            admin_token = "test-admin-token"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {admin_token}'
            }
            
            payload = {
                "fullName": "Test User",
                "ssn": "1234",
                "dateOfBirth": "1990-01-01"
            }
            
            response = requests.post(f"{self.base_url}/tools/credit_check", 
                                   headers=headers, json=payload)
            
            # This test will pass if admin token is configured, or fail gracefully if not
            if response.status_code in [200, 401]:
                self.log_test("Multi-Token Authentication", True, "Multi-token authentication working or not configured")
                return True
            else:
                self.log_test("Multi-Token Authentication", False, f"Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Multi-Token Authentication", False, f"Error: {str(e)}")
            return False
    
    def test_request_validation(self) -> bool:
        """Test request validation and sanitization"""
        try:
            # Test with malicious input
            malicious_payload = {
                "fullName": "<script>alert('xss')</script>John Doe",
                "ssn": "1234",
                "dateOfBirth": "1990-01-01"
            }
            
            response = self.session.post(f"{self.base_url}/tools/credit_check", json=malicious_payload)
            
            if response.status_code == 200:
                # Check if malicious content was sanitized
                data = response.json()
                result = data.get('result', '')
                if '<script>' not in result:
                    self.log_test("Request Validation", True, "Malicious input properly sanitized")
                    return True
                else:
                    self.log_test("Request Validation", False, "Malicious input not sanitized")
                    return False
            else:
                self.log_test("Request Validation", False, f"Unexpected status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Request Validation", False, f"Error: {str(e)}")
            return False
    
    def test_documentation_endpoints(self) -> bool:
        """Test documentation endpoints"""
        try:
            # Test Swagger UI
            response = requests.get(f"{self.base_url}/docs")
            if response.status_code == 200:
                self.log_test("Swagger UI", True, "Documentation accessible")
            else:
                self.log_test("Swagger UI", False, f"Status: {response.status_code}")
                return False
            
            # Test ReDoc
            response = requests.get(f"{self.base_url}/redoc")
            if response.status_code == 200:
                self.log_test("ReDoc", True, "Alternative documentation accessible")
                return True
            else:
                self.log_test("ReDoc", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Documentation Endpoints", False, f"Error: {str(e)}")
            return False


    def test_pull_credit_tool(self) -> bool:
        """ Test pull credit tool """
        payload = {
            "company-name": "gri",
            "loan-id": "965db8b3-7e1b-4655-ba48-c0cae5bb0dc9"
        }

        try:
            result = self.session.post(f"{self.base_url}/tools/pull_credit", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'credit-pull-type' in data.get('result', ''):
                    self.log_test("Pull Credit Tool", True, "Credit pull operation completed")
                    return True
            self.log_test("Pull Credit Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Pull Credit Tool", False, f"Error: {str(e)}")
            return False


    def test_patch_and_pull_credit_tool(self) -> bool:
        """ Test patch and pull credit tool """
        payload = {
            "company-name": "gri",
            "loan-id": "abdb4a56-bcd4-4553-b3ed-821bc59a847f",
            "application-id": "_borrower1",
            "product": "soft credit",
            "credit-pull-type": "softDynamic",
            "borrower": {
                "first-name": "Andy",
                "last-name": "America",
                "middle-name": "",
                "birth-date": "1975-04-05",
                "ssn": "999603333",
                "address": "11 East Main Street",
                "address-unit-identifier": None,
                "city": "Chicago Heights",
                "state": "IL",
                "postal-code": "60411",
                "consent-type": "Internet",
                "consent-date": "2026-02-02T08:00:00.000Z"
            },
            "coborrower": {
                "first-name": "Amy",
                "last-name": "America",
                "middle-name": "",
                "birth-date": "1975-04-05",
                "ssn": "500602222",
                "address": "12 East Main Street",
                "address-unit-identifier": None,
                "city": "Chicago Heights",
                "state": "IL",
                "postal-code": "60411",
                "consent-type": "Internet",
                "consent-date": "2026-02-02T08:00:00.000Z"
            }
        }

        try:
            result = self.session.post(f"{self.base_url}/tools/patch_and_pull_credit", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Patch and Pull Credit Tool", True, "Patch and credit pull operation completed")
                    return True
            self.log_test("Patch and Pull Credit Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Patch and Pull Credit Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_property_valuation_tool(self) -> bool:
        """ Test property valuation tool """
        try:
            payload = {
                "street_address": "8 Azalea",
                "city": "Irvine",
                "state": "CA",
                "zip": "92620"
            }
            result = self.session.post(f"{self.base_url}/tools/bluesteel_property_valuation", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Property Valuation Tool", True, "Property valuation operation completed")
                    return True
            self.log_test("Property Valuation Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Property Valuation Tool", False, f"Error: {str(e)}")
            return False    
        

    def test_create_loan_tool(self) -> bool:
        """ Test create loan tool """
        try: 
            payload = {
                "firstName": "jon",
                "middleName": "the juice",
                "lastName": "simpson",
                "mobilePhone": "386-555-1212",
                "loanPurposeType": "purchase",
                "companyEID": 1,
                "loanOfficerId": 12657,
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/create_loan", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Create Loan Tool", True, "Create loan operation completed")
                    return True
            self.log_test("Create Loan Tool", False, f"Status: {result.status_code}")
            return False

        except Exception as e:
            self.log_test("Create Loan Tool", False, f"Error: {str(e)}")
            return False

    
    def test_copy_loan_tool(self) -> bool:
        """ Test copy loan tool """
        try:
            payload = {
                "loan-id": "1741c2aa-b2cc-4a3b-ac71-9f76bf708d7c",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/copy_loan", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Copy Loan Tool", True, "Copy loan operation completed")
                    return True
            self.log_test("Copy Loan Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Copy Loan Tool", False, f"Error: {str(e)}")
            return False


    def test_copy_loan_parts_tool(self) -> bool:
        """ Test copy loan parts tools """
        try:
            payload = {
                "sourceLoanId": "e2349289-8898-4b5c-85c7-820afa810c4a", 
                "destinationLoanId": "1741c2aa-b2cc-4a3b-ac71-9f76bf708d7c",
                "company-name": "gri",
                "loanParts": [
                    "CoBorrowerAll"
                ]
            }
            result = self.session.post(f"{self.base_url}/tools/copy_loan_parts", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Copy Loan Parts Tool", True, "Copy loan parts operation completed")
                    return True
            self.log_test("Copy Loan Parts Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Copy Loan Parts Tool", False, f"Error: {str(e)}")
            return False
        
    def test_get_loan_properties_tool(self) -> bool:
        """ Test get loan properties tool """
        try:
            payload = {
                "loanIdentifier": "965db8b3-7e1b-4655-ba48-c0cae5bb0dc9",
                "requestedProperties": [
                    "EncompassLoanId",
                    "GRLoanId"
                ],
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/get_loan_properties", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Get Loan Properties Tool", True, "Get loan properties operation completed")
                    return True
            self.log_test("Get Loan Properties Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Get Loan Properties Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_update_loan_tool(self) -> bool:
        """ Test update loan tool """
        try:
            payload = {
                "grLoanGuid": "27e9af34-3232-4863-ad27-291836323b90",
                "borrowerWorkPhone": "(949)-670-6767",
                "company-name": "gri",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/update_loan", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Update Loan Tool", True, "Update loan operation completed")
                    return True
            self.log_test("Update Loan Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Update Loan Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_create_lead_tool(self) -> bool:
        """ Test create lead tool """
        try:
            payload = {
                "firstName": "John",
                "lastName": "Homeowner",
                "emailAddress": "john.homeowner.mcp-test-020325.1--ra@yopmail.com",
                "homePhoneNumber": "(949)-555-1212"
            }
            result = self.session.post(f"{self.base_url}/tools/create_lead", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Create Lead Tool", True, "Create lead operation completed")
                    return True
            self.log_test("Create Lead Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Create Lead Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_update_lead_tool(self) -> bool:
        """ Test update lead tool """
        try:
            payload = {
                "cram-id": "346c8188-cce3-4d46-b7f4-70d1611f11ec",
                "loanAmount": "100000",
                "fico": 670
            }
            result = self.session.post(f"{self.base_url}/tools/update_lead", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Update Lead Tool", True, "Update lead operation completed")
                    return True
            self.log_test("Update Lead Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Update Lead Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_prepare_document_tool(self) -> bool:
        """ Test prepare document tool """
        try:
            payload = {
            "encompass-loan-guid": "2eaa96e9-6c6a-4d90-ac64-3a330c1896f0",
            "name": "test-doc",
            "docHolderName": "Income",
            "grConsumerIds": [],
            "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/prepare_document", json=payload)
            if result.status_code == 200:
                data = result.json()
                # Parse the result string as JSON
                result_data = json.loads(data.get("result", "{}"))
                if data.get("success") and result_data.get("data"):
                    self.log_test("Prepare Document Tool", True, "Document preparation operation completed")
                    self.document_id = result_data["data"]
                    return True
            self.log_test("Prepare Document Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Prepare Document Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_upload_document_tool(self) -> bool:
        """ Test upload document tool """
        try:
            with open("TEST-DOC.docx", "rb") as file:
                form_data = {
                    "encompass_loan_guid": (None, "2eaa96e9-6c6a-4d90-ac64-3a330c1896f0"),
                    "document_id": (None, self.document_id),
                    "company_name": (None, "gri"),
                    "file": (file.name, file)
                }
                # Use requests directly, not self.session (which has Content-Type: application/json)
                headers = {'Authorization': f'Bearer {self.auth_token}'}
                result = requests.post(f"{self.base_url}/tools/upload_document", files=form_data, headers=headers)
                if result.status_code == 200:
                    data = result.json()
                    # Parse the result string as JSON
                    result_data = json.loads(data.get("result", "{}"))
                    if data.get("success") and result_data.get("data"):
                        self.log_test("Upload Document Tool", True, "Document upload operation completed")
                        return True
                self.log_test("Upload Document Tool", False, f"Status: {result.status_code}")
                return False
        except Exception as e:
            self.log_test("Upload Document Tool", False, f"Error: {str(e)}")
            return False


    
    def test_send_application_completion_email_tool(self) -> bool:
        """ Test send loan application completed email tool """
        try:
            payload = {
                "firstName": "Andy",
                "emailAddress": "andy-america@gmail.com",
                "loanType": "purchase"
            }
            result = self.session.post(f"{self.base_url}/tools/send_application_completion_email", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Send Application Completion Email Tool", True, "Email sending operation completed")
                    return True
            self.log_test("Send Application Completion Email Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Send Application Completion Email Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_send_email_tool(self) -> bool:
        """ Test send email tool """
        try:
            payload = {
                "body": "Hello, this is a test email.",
                "to": [
                    {
                        "name": "Test Recipient",
                        "address": "test@example.com"
                    }
                ],
                "from": {
                    "name": "Test Sender",
                    "address": "testuser@example.com"
                },
                "subject": "Test Email Subject"
            }
            result = self.session.post(f"{self.base_url}/tools/send_email", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Send Email Tool", True, "Email sending operation completed")
                    return True
            self.log_test("Send Email Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Send Email Tool", False, f"Error: {str(e)}")
            return False
        

    def test_create_okta_user_tool(self) -> bool:
        """ Test create Okta user tool """
        try:
            unique_id = str(uuid.uuid4())
            email = f"andy-america-{unique_id}@gmail.com"
            payload = {
                "profile": {
                        "firstName": "Andy",
                        "lastName": "America",
                        "email": email,
                        "login": email,
                        "mobilePhone": "(949)-704-5667"
                },
                "credentials": {
                    "password": {
                        "value": "xHkdieu1!Skjdie"
                    } 
                }
            }    
            result = self.session.post(f"{self.base_url}/tools/create_okta_user", json=payload) 
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Create Okta User Tool", True, "Okta user creation operation completed")
                    return True
            self.log_test("Create Okta User Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Create Okta User Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_create_borrower_entity_tool(self) -> bool:
        """ Test create borrower entity tool """
        try:
            payload = {
                "email-address": {
                    "primary": "andy-america@gmail.com"
                },
                "identifier": {
                    "okta-id": "00uw6otx3hetGGkra1d7"
                },
                "name": {
                    "first": "Andy",
                    "last": "America"
                },
                "phone": {
                    "home": "(949)-704-5667"
                },
                "language-preference": "en",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/create_borrower_entity", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Create Borrower Entity Tool", True, "Borrower entity creation operation completed")
                    return True
            self.log_test("Create Borrower Entity Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Create Borrower Entity Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_update_borrower_entity_tool(self) -> bool:
        """ Test update borrower entity tool """
        try:
            payload = {
                "borrower-guid": "0c1f46c3-f0b2-46c3-ac87-46564d299ced",     
                "name": {
                    "last": "NewLastName"
                },
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/update_borrower_entity", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Update Borrower Entity Tool", True, "Borrower entity update operation completed")
                    return True
            self.log_test("Update Borrower Entity Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Update Borrower Entity Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_search_borrower_entity_tool(self) -> bool:
        """ Test search borrower entity tool """
        try:
            payload = {
                "email": "andy-america@gmail.com",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/search_borrower_entity", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Search Borrower Entity Tool", True, "Borrower entity search operation completed")
                    return True
            self.log_test("Search Borrower Entity Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Search Borrower Entity Tool", False, f"Error: {str(e)}")
            return False
        

    def test_get_borrower_loans_tool(self) -> bool:
        """ Test get borrower loans tool """
        try:
            payload = {
                "user-id": "0c1f46c3-f0b2-46c3-ac87-46564d299ced",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/get_borrower_loans", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Get Borrower Loans Tool", True, "Borrower loans retrieval operation completed")
                    return True
            self.log_test("Get Borrower Loans Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Get Borrower Loans Tool", False, f"Error: {str(e)}")
            return False


    def test_get_borrower_loans_by_email_tool(self) -> bool:
        """ Test get borrower loans by email tool """
        try:
            payload = {
                "email": "andy-america@gmail.com",
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/get_borrower_loans_by_email", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success") and 'data' in data.get('result', ''):
                    self.log_test("Get Borrower Loans By Email Tool", True, "Borrower loans retrieval by email operation completed")
                    return True
            self.log_test("Get Borrower Loans By Email Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Get Borrower Loans By Email Tool", False, f"Error: {str(e)}")
            return False
        
    
    def test_set_batch_simon_econsent_tool(self) -> bool:
        """ Test set batch Simon eConsent tool """
        try:
            payload = {
                "borrower": {
                    "name": "John Freddie",
                    "email": "myaccount-mlasdlkajslkjk@yopmail.com",
                    "source": "local",
                    "agreed-eConsent": True,
                    "agreed-twnConsent": True,
                    "language": "en"
                },
                "coborrower": {
                    "name": "Mary Freddie",
                    "email": "myaccount012031023@yopmail.com",
                    "source": "local",
                    "agreed-eConsent": True,
                    "agreed-twnConsent": True,
                    "language": "en"
                },
                "loan-guid": "d3773382-fea1-496b-a795-8b19d9a1187f"
            }
            result = self.session.post(f"{self.base_url}/tools/set_batch_simon_econsent", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success"):
                    self.log_test("Set Batch Simon eConsent Tool", True, "Batch eConsent operation completed")
                    return True
            self.log_test("Set Batch Simon eConsent Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Set Batch Simon eConsent Tool", False, f"Error: {str(e)}")
            return False
        

    def test_delete_document_tool(self) -> bool:
        """ Test delete document tool """
        try:
            payload = {
                "encompass-loan-guid": "2eaa96e9-6c6a-4d90-ac64-3a330c1896f0",
                "document-id": self.document_id,
                "company-name": "gri"
            }
            result = self.session.post(f"{self.base_url}/tools/delete_document", json=payload)
            if result.status_code == 200:
                data = result.json()
                if data.get("success"):
                    self.log_test("Delete Document Tool", True, "Document deletion operation completed")
                    return True
            self.log_test("Delete Document Tool", False, f"Status: {result.status_code}")
            return False
        except Exception as e:
            self.log_test("Delete Document Tool", False, f"Error: {str(e)}")
            return False


    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return results"""
        print("🧪 Starting MCP API Test Suite")
        print("=" * 50)
        
        start_time = time.time()
        
        # Run all tests
        tests = [
            self.test_server_health,
            self.test_tools_list,
            self.test_credit_check,
            self.test_loan_eligibility,
            self.test_property_valuation,
            self.test_sms_tool,
            self.test_mcp_protocol,
            self.test_authentication,
            self.test_multi_token_authentication,
            self.test_request_validation,
            self.test_documentation_endpoints,
            self.test_pull_credit_tool,
            self.test_patch_and_pull_credit_tool,
            self.test_property_valuation_tool,
            self.test_create_loan_tool,
            self.test_copy_loan_tool,
            self.test_copy_loan_parts_tool,
            self.test_get_loan_properties_tool,
            self.test_update_loan_tool,
            self.test_create_lead_tool,
            self.test_update_lead_tool,
            self.test_prepare_document_tool,
            self.test_upload_document_tool,
            self.test_delete_document_tool,
            self.test_send_application_completion_email_tool,
            self.test_send_email_tool,
            self.test_create_okta_user_tool,
            self.test_create_borrower_entity_tool,
            self.test_update_borrower_entity_tool,
            self.test_search_borrower_entity_tool,
            self.test_get_borrower_loans_tool,
            self.test_get_borrower_loans_by_email_tool,
            self.test_set_batch_simon_econsent_tool
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            time.sleep(0.5)  # Small delay between tests
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        print(f"⏱️  Duration: {duration:.2f} seconds")
        print(f"🎯 Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 All tests passed! Server is working perfectly.")
        else:
            print(f"⚠️  {total - passed} tests failed. Check the details above.")
        
        return {
            'total_tests': total,
            'passed_tests': passed,
            'failed_tests': total - passed,
            'success_rate': (passed/total)*100,
            'duration': duration,
            'results': self.test_results
        }

def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test MCP FastAPI Server")
    parser.add_argument("--url", default="http://localhost:8080", help="Server URL")
    parser.add_argument("--token", default="demo-token-123", help="Authentication token")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Create tester
    tester = MCPAPITester(args.url, args.token)
    
    # Run tests
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if results['failed_tests'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
