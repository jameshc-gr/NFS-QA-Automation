# 🏗️ Modular MCP Server

A **modular, extensible MCP (Model Context Protocol) server** with a clean architecture that makes it easy to add new tools and maintain the codebase.

# Base URLs

- **Development**: `https://partner-gateway-dev.dev.saas.rate.com/mcp/digital-mortgage-systems`
- **Production**: `https://partner-gateway.saas.rate.com/mcp/digital-mortgage-systems`

## 📊 **Available Tools**
### See detailed API documentation in [API_SERVICES_SUMMARY.md](API_SERVICES_SUMMARY.md).

| Tool | Description | Status |
|------|-------------|---------|
| `send_sms` | SMS messaging via Twilio | ✅ |
| `pull_credit` | Pulls credit for a given loan ID | ✅ |
| `patch_and_pull_credit` | Pulls credit for a given loan ID and simultaneously allows for borrower/coborrower field patching | ✅ |
| `bluesteel_property_valuation` | Estimates property valuation for a given address using BlueSteel | ✅ |
| `create_loan` | Creates a new loan in Encompass through leads manager | ✅ |
| `finalize_loan` | Finalized a loan in Encompass through leads manager | ✅ |
| `copy_loan` | Creates a new loan in Encompass through leads manager by copying an existing loan  | ✅ |
| `copy_loan_parts` | Copies co-borrower loan parts from one loan to another in Encompass through leads manager  | ✅ |
| `get_loan_properties` | Retrieves specified properties of a loan by its identifier from Encompass through leads manager | ✅ |
| `update_loan` | Patches specified properties of a loan by its identifier from Encompass through leads manager | ✅ |
| `create_lead` | Creates a lead for a borrower in CRAM (Velocify) | ✅ |
| `update_lead` | Updates properties of a lead by its ID in CRAM (Velocify) | ✅ |
| `prepare_document` | Prepares a document for storage using doc-storage-service | ✅ |
| `upload_document` | After a document has been prepared, uploads a document for storage using doc-storage-service | ✅ |
| `move_document` | Moves an uploaded document to a different folder/classification in doc-storage-service | ✅ |
| `delete_document` | Deletes an uploaded document from doc-storage-service | ✅ |
| `send_application_completion_email` | Tool to send an email to the borrower when their loan application is completed | ✅ |
| `send_email` | Tool to send an email | ✅ |
| `create_okta_user` | Tool to create an Okta account for a borrower | ✅ |
| `get_okta_user` | Tool to retrieve an Okta account by ID (can be either user ID, login, or login shortname) | ✅ |
| `create_borrower_entity` | Tool to create a borrower entity in borrower-entity-service | ✅ |
| `update_borrower_entity` | Tool to update an existing borrower entity in borrower-entity-service | ✅ |
| `search_borrower_entity` | Tool to search for a borrower entity in borrower-entity-service by email | ✅ |
| `tax_bomb_estimate` | Get a borrower's projected student-loan forgiveness and associated tax owed | ✅ |
| `get_loan_accounts` | Retrieve a borrower's loan accounts, balances, interest rates, and servicers | ✅ |
| `get_profile` | Retrieve a borrower's repayment plan, repayment start date, IDR option, and date of birth | ✅ |
| `get_certified_income` | Retrieve the AGI certified for a borrower's IDR payments | ✅ |
| `get_idr_assumptions` | Retrieve assumptions used for the IDR projection, including earnings growth, tax rate, and savings rate | ✅ |
| `get_household` | Retrieve household state, filing status, and children, including derived household size | ✅ |
| `get_user_profile` | Retrieve a borrower's Rate Wealth user profile | ✅ |
| `get_user_accounts` | Retrieve accounts from the Rate Wealth user service | ✅ |
| `register_household` | Create a borrower in Rate Wealth using the supplied household and borrower details | ✅ |
| `set_certified_income` | Set the AGI used to certify a borrower's IDR payments | ✅ |
| `update_household` | Update a borrower's household state, filing status, or number of children | ✅ |
| `add_federal_loan` | Add a federal student loan to a borrower's Rate Wealth profile | ✅ |
| `update_federal_loan` | Update fields on an existing federal student loan | ✅ |
| `update_profile` | Update a borrower's repayment plan, repayment dates, IDR option, forbearance, phone number, or date of birth | ✅ |
| `update_name` | Update a borrower's first or last name | ✅ |
| `delete_federal_loan` | Permanently remove a federal student loan from a borrower's profile | ✅ |
| `get_borrower_loans` | Tool to retrieve loan(s) information for a borrower by borrower entity ID | ✅ |
| `get_borrower_loans_by_email` | Tool to retrieve loan(s) information for a borrower by email address | ✅ |
| `get_mortgage_guids` | Tool to retrieve list of mortgage GUIDs for a borrower by borrower entity ID | ✅ |
| `get_mortgage_numbers` | Tool to retrieve list of mortgage numbers for a borrower by borrower entity ID | ✅ |
| `set_batch_simon_econsent` | Tool for setting batch eConsent on a loan for borrowers/coborrowers/consent types | ✅ |
| `query_loan_officer_data` | Tool for querying the Databricks LO DynamoDB table | ✅ |
| `query_credit_trigger_segment` | Tool for querying the Prajna Credit Trigger Segment DynamoDB table | ✅ |
| `get_oneloan_properties` | Tool for retrieving full set of loan properties from OneLoan | ✅ |
| `get_oneloan_properties_by_email` | Tool for retrieving the most recent OneLoan loan by a borrower's email | ✅ |
| `get_pipeline_count` | Count loans assigned to a team member across HELOAN pipeline milestones for capacity balancing | ✅ |
| `get_borrower_prior_loan_team` | Get unique Encompass user IDs from a borrower's loans funded within the last 12 months | ✅ |
| `search_loans` | Tool for retrieving loans from data platform api based on provided search parameters| ✅ |
| `create_task` | Tool for creating a task in taskmaster | ✅ |
| `create_tasks` | Tool for creating a set of tasks in taskmaster | ✅ |
| `get_task` | Tool for fetching a specific task for a loan in taskmaster | ✅ |
| `get_tasks` | Tool for fetching borrower tasks in taskmaster for a loan | ✅ |
| `get_task_templates` | Tool for retrieving the set of task templates in taskmaster | ✅ |
| `get_condition_task_templates` | Tool for retrieving task templates in taskmaster associated with the provided conditions | ✅ |
| `remove_task` | Tool for removing a specific task from a loan in taskmaster | ✅ |
| `search_oneloan` | Tool for searching for loans in OneLoan with various properties | ✅ |
| `patch_oneloan` | Tool for patching fields of a loan using OneLoan | ✅ |
| `assign_oneloan_role` | Assign a loan team role to a user in OneLoan | ✅ |
| `get_ecs_credit` | Tool for retrieving credit information for a specified loan through ECS | ✅ |
| `reissue_credit` | Tool for reissuing credit information for a specified loan through ECS | ✅ |
| `get_lo_contacts_count` | Tool for getting the counts of a specified LO email in the provided set of tables | ✅ |
| `get_lo_contacts` | Tool for getting the contacts for a specified LO email in the provided table | ✅ |
| `get_document_extraction_centralized` | Tool for getting querying centralized document extraction data | ✅ |
| `get_encompass_loan` | Tool for getting loan information directly from Encompass | ✅ |
| `get_encompass_loan_by_email` | Tool for getting loan information directly from Encompass by a borrower's email (retrieves most recent if multiple) | ✅ |


## **Authentication**

Authenicated routes require an Okta OAuth2 Bearer token. The Identity and Access Management team can provide a Client ID and Secret. The additional form parameter of scope=`api.all.digital-mortgage-systems-mcp` is required when obtaining the bearer token from Okta.


## 🚀 **Quick Start**

```bash
# Create and activate virtual environment
python3 -m venv venv-mcp
source venv-mcp/bin/activate  # On Windows: venv-mcp\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Run via **VS Code debugger** (recommended): open `fastapi_mcp_server.py` and press **F5** using the `Python Debugger: With pre-launch` configuration. This automatically refreshes AWS credentials and loads `.env.aws` before starting the server.

If your SSO session is expired, re-authenticate first:
```bash
aws-sso login
```

```
# Access interactive API docs at: http://localhost:8083/docs
# Health check: http://localhost:8083/health
# Tools list: http://localhost:8083/tools/
```

### **AWS Secrets**
All secrets and configuration variables are located in AWS Secrets Manager and can be accessed by running the pre-launch script. You may utilize the following files:
```
// .vscode/launch.json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python Debugger: With pre-launch",
            "type": "debugpy",
            "request": "launch",
            "program": "${file}",
            "console": "integratedTerminal",
            "envFile": "${workspaceFolder}/.env.aws",
            "env": {
                "AWS_REGION": "us-east-1"
            },
            "preLaunchTask": "pre-launch"
        }
    ]
}
```
```
// .vscode/tasks.json 
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "pre-launch",
            "command": "${workspaceFolder}/pre-launch.sh",
            "type": "shell",
            "args": [
                "nonprod-saas-MachineLearning",
            ]
        }
    ]
}
```
The generated .env.aws file will contain the necessary credentials to access the secrets. If you run into any issues such as "Unable to locate credentials" run the command: ``` aws-sso login ```. This setup makes it so you don't need to manually generate new credentials after they expire

## 🔧 **Adding New Tools**

```python
# src/tools/my_new_tool.py
from .base import BaseTool
from typing import Any, Dict

class MyNewTool(BaseTool):
    def __init__(self):
        super().__init__(
            name="my_new_tool",
            description="Description of what this tool does",
            input_schema={
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "Parameter description"}
                },
                "required": ["param1"]
            }
        )
    
    async def execute(self, arguments: Dict[str, Any]) -> str:
        # Your tool logic here
        param1 = arguments.get('param1', '')
        return f"Result: {param1}"
```

## 🗂️ **Postman Collection**

A Postman collection and environment are included under `postman/` for testing all endpoints interactively.

**To import:**
1. Open Postman → **Import** → drag in both files from `postman/`
2. Fill in the environment variables:
   - `mcp-url` — target server (defaults to `http://localhost:8083`)
   - `okta-token-url` — Okta token endpoint: `https://<okta-domain>/oauth2/<auth-server-id>/v1/token`
   - `okta-client-id` / `okta-client-secret` — obtain from the IAM team
3. In the collection's **Authorization** tab, click **Get New Access Token** to fetch a token via OAuth 2.0 client credentials

## 🧪 **Testing**

```bash
# Run quick smoke tests
python3 tests/quick_test.py

# Run comprehensive test suite
python3 tests/test_api_endpoints.py --token your-token
```

### **Test Files**
- **`tests/quick_test.py`** - Quick smoke tests for development
- **`tests/test_api_endpoints.py`** - Comprehensive test suite for all endpoints

## 🤝 **Contributing**

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-tool`
3. **Add your tool**: Follow the tool creation guide above
4. **Test your changes**: Run the test suite
5. **Submit a pull request**

**Built with ❤️ using Python and the MCP protocol**