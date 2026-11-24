# MCP Server API Endpoints

### Public Endpoints (No Authentication Required)

#### `GET /`
**Root endpoint** - Server information and usage guide
- Returns server metadata, authentication info, and available endpoints
- **Response**: Server info, version, authentication status, endpoint list

#### `GET /health`
**Health check endpoint**
- Returns server health status
- **Response**: 
  ```json
  {
    "status": "healthy",
    "tools_count": <number>,
    "server": "FastAPI MCP Server v2.0.0"
  }
  ```

#### `GET /docs`
**Interactive API documentation** (Swagger UI)
- Auto-generated API documentation
- Test endpoints directly from browser

#### `GET /redoc`
**Alternative API documentation** (ReDoc)
- Alternative documentation interface

#### `GET /mcp/`
**MCP server information**
- Returns MCP protocol server info
- **Response**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "server-info",
    "result": {
      "name": "fastapi_mcp_server",
      "version": "2.0.0",
      "tools_count": <number>
    }
  }
  ```

---

### Protected Endpoints (Authentication Required)

**Authentication**: Bearer Token in `Authorization` header
- Format: `Authorization: Bearer <your-token>`

#### `GET /mcp/tools`
**List all available tools** (MCP format)
- Returns all tools with their schemas in MCP format
- **Response**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "tools-list",
    "result": {
      "tools": [<tool_schemas>]
    }
  }
  ```

#### `POST /mcp/`
**MCP protocol endpoint** - Handle MCP protocol requests
- Supports MCP protocol methods:
  - `initialize` - Initialize MCP connection
  - `tools/list` - List available tools
  - `tools/call` - Execute a tool
- **Request Format**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": "<request-id>",
    "method": "<method-name>",
    "params": {<parameters>}
  }
  ```

#### `GET /tools/`
**List all available tools** (REST format)
- Returns all tools with their information
- **Response**:
  ```json
  {
    "tools": [
      {
        "name": "<tool-name>",
        "description": "<description>",
        "schema": {<tool_schema>}
      }
    ],
    "count": <number>
  }
  ```

#### `GET /tools/{tool_name}`
**Get tool information**
- Returns detailed information about a specific tool
- **Path Parameter**: `tool_name` - Name of the tool
- **Response**:
  ```json
  {
    "name": "<tool-name>",
    "description": "<description>",
    "schema": {<tool_schema>}
  }
  ```

---

## Available Tools

### Bluesteel Tools

#### 1. Get Property Valuation

```http
POST /tools/bluesteel_property_valuation
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required

```json
{
  "street_address": "string",
  "city": "string",
  "state": "string",
  "zip": "string"
}
```

### Loan Credit Tools

#### 1. Pull Credit

```http
POST /tools/pull_credit
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loan-id and company-name are required. All other fields are optional

```json
{
  "company-name": "string", 
  "application-id": "string",
  "loan-id": "string",
  "product": "string",
  "credit-pull-type": "string",
  "timeout-secs": "integer"
}
```

#### 2. Patch and Pull Credit

```http
POST /tools/patch_and_pull_credit
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loan-id, company-name, and borrower are required. All other fields are optional.

```json
{
  "company-name": "string",
  "application-id": "string",
  "loan-id": "string",
  "product": "string",
  "credit-pull-type": "string",
  "borrower": {
    "ssn": "string",
    "first-name": "string",
    "last-name": "string",
    "birth-date": "string",
    "address": "string",
    "address-unit-designator-type": "string (optional)",
    "address-unit-identifier": "string (optional)",
    "city": "string",
    "state": "string",
    "postal-code": "string",
    "consent-date": "string",
    "consent-type": "string"
  },
  "coborrower": {
    "ssn": "string",
    ...
  }
}
```


### Leads Manager Tools

#### 1. Create Loan

```http
POST /tools/create_loan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
firstName, lastName, loanOfficerId, and company-name are required. All other fields are optional.

```json
{
  "firstName": "string",
  "middleName": "string",
  "lastName": "string",
  "mobilePhone": "string",
  "loanPurposeType": "string",
  "companyEID": "integer",
  "loanOfficerId": "integer",
  "company-name": "string",
  "originatingApp": "string",
  "dmFlow": "string"
}
```


#### 2. Update Loan

```http
POST /tools/update_loan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
grLoanGuid and company-name are required. All other fields are optional.

```json
{
  "grLoanGuid": "string",
  "loanPurpose": "string",
  "loanAmount": "number", 
  "loanOfficerId": "integer",
  "companyEID": "integer",
  "borrower": {
      "firstName": "string", 
      "middleName": "string",
      "lastName": "string", 
      "suffixToName": "string",
      "nickname": "string",
      "mobilePhone": "string",
      "emailAddressText": "string",
      "birthDate": "string",
      "taxIdentificationIdentifier": "string",
      "middleFicoScore": "integer", 
      "maritalStatusType": "string",
      "languagePreference": "string",
      "languageCodeOtherDescription": "string",
      "selfDeclaredMilitaryServiceIndicator": "boolean",
      "activeDuty": "boolean",
      "reserveNationalGuardReserveActivated": "boolean",
      "spousalVABenefitsEligibilityIndicator": "boolean",
      "veteran": "boolean",
      "militaryBranchOfService": "string",
      "dependentCount": "integer",
      "dependentsAgesDescription": "string",
      "authorizedCreditReportIndicator": "boolean", 
      "creditReportAuthorizationMethod": "string",
      "dateAuthorizedCreditReport": "string"
  },
  "coborrower": {
      "firstName": "string", 
      "middleName": "string",
      "lastName": "string", 
      "suffixToName": "string",
      "nickname": "string",
      "mobilePhone": "string",
      "emailAddressText": "string",
      "birthDate": "string",
      "taxIdentificationIdentifier": "string",
      "middleFicoScore": "integer", 
      "maritalStatusType": "string",
      "languagePreference": "string",
      "languageCodeOtherDescription": "string",
      "selfDeclaredMilitaryServiceIndicator": "boolean",
      "activeDuty": "boolean",
      "reserveNationalGuardReserveActivated": "boolean",
      "spousalVABenefitsEligibilityIndicator": "boolean",
      "veteran": "boolean",
      "militaryBranchOfService": "string",
      "dependentCount": "integer",
      "dependentsAgesDescription": "string",
      "authorizedCreditReportIndicator": "boolean", 
      "creditReportAuthorizationMethod": "string",
      "dateAuthorizedCreditReport": "string"
  },
  "subjectProperty": {
    "streetAddress": "string",
    "city": "string",
    "state": "string", 
    "zipCode": "string",
    "county": "string",
    "unitType": "string",
    "propertyType": "string", 
    "occupancyType": "string", 
    "addressUnitIdentifier": "string",
    "refinancePurposeType": "string"
  },
  "employment": [
    {
      "sourceOfIncomeDataType": "string",
      "addressState": "string",
      "addressCity": "string", 
      "currentEmploymentIndicator": "boolean",
      "employmentStartDate": "string",
      "endDate": "string", 
      "selfEmployedIndicator": "boolean",
      "employerName": "string",
      "basePayAmount": "number",
      "commissionsAmount": "number", 
      "bonusAmount": "number",
      "overtimeAmount": "number",
      "militaryEmployer": "boolean", 
      "positionDescription": "string",
      "phoneNumber": "string",
      "owner": "string"
    }
  ],
  "assets": [
    {
      "assetType": "string",
      "holderName": "string",
      "owner": "string",
      "total": "number"
    }
  ],
  "otherIncomeSources": [
    {
      "description": "string",
      "otherDescription": "string",
      "monthlyAmount": "number",
      "owner": "string"
    }
  ],
  "borrowerMonthlyExpenses": {
      "rentAmount": "number",
      "realEstateTaxAmount": "number",
      "mortgageInsuranceAmount": "number",
      "homeownersAssociationDuesAndCondoFeesAmount": "number"
  },
  "coborrowerMonthlyExpenses": {
      "rentAmount": "number",
      "realEstateTaxAmount": "number",
      "mortgageInsuranceAmount": "number",
      "homeownersAssociationDuesAndCondoFeesAmount": "number"
  },
  "closingProtectionLetterDate": "string", (CX.CPL.DATE)
  "titleFeesReceivedDate": "string", (CX.TITLE.INVOICE)
  "wireInstructionsReceivedDate": "string", (CX.WIRE.IN)
  "titleCommitmentReceivedDate": "string", (CX.TITLE.COM)
  "company-name": "string"
}
```

#### 3. Copy Loan

```http
POST /tools/copy_loan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loan-id and company-name are required. All other fields are optional.

```json
{
  "loan-id": "string",
  "loanParts": ["string"],
  "overrides": {
  "borrower": {
    "birthDate": "string",
    "taxIdentificationIdentifier": "string"
  },
  "loanFolder": "string",
  "loanPurpose": "string"
  },
  "company-name": "string"
}
```


#### 4. Copy Loan Parts

```http
POST /tools/copy_loan_parts
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
sourceLoanId, destinationLoanId, and company-name are required. All other fields are optional.

```json
{
  "loanParts": ["string"],
  "sourceLoanId": "string",
  "destinationLoanId": "string",
  "overrides": {
  "coborrower": {
    "birthDate": "string",
    "taxIdentificationIdentifier": "string"
  }
  },
  "company-name": "string"
}
```


#### 5. Get Loan Properties

```http
POST /tools/get_loan_properties
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loanIdentifier and requestedProperties are required. One of either company-name or companyEID is also required.

```json
{
  "loanIdentifier": "string",
  "requestedProperties": ["string"],
  "company-name": "string",
  "companyEID": "integer"
}
```


### CRAM (Velocify) Tools

#### 1. Create Lead

```http
POST /tools/create_lead
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
firstName, lastName, emailAddress, and homePhoneNumber are required. All other fields are optional.

```json
{
  "firstName": "string",
  "lastName": "string",
  "emailAddress": "string",
  "homePhoneNumber": "string",
  "loanAmount": "string",
  "mortgageType": "string",
  "encompassLoanNumber": "string",
  "propertyCity": "string",
  "propertyLocation": "string",
  "fico": "string"
}
```


#### 2. Update Lead

```http
POST /tools/update_lead
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
cram-id is required. All other fields are optional.

```json
{
  "cram-id": "string",
  "firstName": "string",
  "lastName": "string",
  "emailAddress": "string",
  "homePhoneNumber": "string",
  "loanAmount": "string",
  "mortgageType": "string",
  "encompassLoanNumber": "string",
  "propertyCity": "string",
  "propertyLocation": "string",
  "fico": "string"
}
```


### Email Tools

#### 1. Send Application Completion Email

```http
POST /tools/send_application_completion_email
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
firstName and emailAddress are required. language is optional, and defaults to "en" if not specified.

```json
{
  "firstName": "string",
  "emailAddress": "string",
  "language": "es" | "en"
}
```


#### 2. Send Email

```http
POST /tools/send_email
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
cc and attachments are optional. All other fields are required.

```json
{
  "body": "string",
  "to": [
  {
    "name": "string",
    "address": "string"
  }
  ],
  "from": {
  "name": "string",
  "address": "string"
  },
  "cc": [
  {
    "name": "string",
    "address": "string"
  }
  ],
  "subject": "string",
  "attachments": [
    {
      "content": "string",
      "encoding": "string",
      "contentType": "string",
      "filename": "string"
    }
  ]
}
```


### Document Storage Tools

#### 1. Prepare Document

```http
POST /tools/prepare_document
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
dba is optional. All other fields are required.

```json
{
  "encompass-loan-guid": "string",
  "name": "string",
  "docHolderName": "string",
  "grConsumerIds": ["string"],
  "dba": "string",
  "company-name": "string"
}
```


#### 2. Upload Document

```http
POST /tools/upload_document
```

**Request Headers**:
- `Authorization`: Bearer token (required)
- `Content-Type`: `multipart/form-data`

**Request Body**:
All fields are required

```http
document-id: string
encompass-loan-guid: string
file: binary
filename: string
company-name: string
```


#### 3. Delete Document

```http
POST /tools/delete_document
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "encompass-loan-guid": "string",
  "document-id": "string",
  "company-name": "string"
}
```

#### 4. Move Document

```http
POST /tools/move_document
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "encompass-loan-guid": "string",
  "document-id": "string",
  "docHolderName": "string",
  "company-name": "string"
}
```


### Okta Tools

#### 1. Create User

```http
POST /tools/create_okta_user
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "profile": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "login": "string",
    "mobilePhone": "string",
  },
  "credentials": {
    "password": {
      "value": "string"
    }
  }
}
```

#### 2. Get User

```http
POST /tools/get_okta_user
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "id": "string"
}
```


### Borrower Entity Tools

#### 1. Create Borrower Entity

```http
POST /tools/create_borrower_entity
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "email-address": {
    "primary": "string"
  },
  "identifier": {
    "okta-id": "string"
  },
  "name": {
    "first": "string",
    "last": "string"
  },
  "phone": {
    "home": "string"
  },
  "language-preference": "string",
  "company-name": "string"
}
```


#### 2. Update Borrower Entity

```http
POST /tools/update_borrower_entity
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
borrower-guid and company-name are required. All other fields are optional.

```json
{
  "borrower-guid": "string",
  "email-address": {
    "primary": "string"
  },
  "identifier": {
    "okta-id": "string"
  },
  "name": {
    "first": "string",
    "last": "string"
  },
  "phone": {
    "home": "string"
  },
  "language-preference": "string",
  "company-name": "string"
}
```


#### 3. Search Borrower Entity

```http
POST /tools/search_borrower_entity
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "email": "string",
  "company-name": "string"
}
```



### MyAccount Tools

#### 1. Get Borrower Loan(s)

```http
POST /tools/get_borrower_loans
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "user-id": "string",
  "company-name": "string"
}
```

#### 2. Get Borrower Loan(s) By Email

```http
POST /tools/get_borrower_loans_by_email
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "email": "string",
  "company-name": "string"
}
```

#### 3. Get Mortgage GUIDs

```http
POST /tools/get_mortgage_guids
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "user-id": "string",
  "company-name": "string"
}
```

#### 3. Get Mortgage numbers

```http
POST /tools/get_mortgage_numbers
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "user-id": "string",
  "company-name": "string"
}
```


### Simon eConsent Tools

#### 1. Batch Consent

```http
POST /tools/set_batch_simon_econsent
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
borrower (all fields) and loan-guid are required. coborrower is optional.

```json
{
  "borrower": {
    "name": "string",
    "email": "string",
    "source": "string",
    "agreed-eConsent": "boolean",
    "agreed-twnConsent": "boolean",
    "language": "string"
  },
  "coborrower": {
    "name": "string",
    "email": "string",
    "source": "string",
    "agreed-eConsent": "boolean",
    "agreed-twnConsent": "boolean",
    "language": "string"
  },
  "loan-guid": "string"
}
```


### DynamoDB Tools

#### 1. Query DatabricksLO Table

```http
POST /tools/query_loan_officer_data
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "query_by": "paidloname" | "cellphonenumber",
  "query_value": "string"
}
```


#### 2. Prajna Credit Trigger Segmnemt Table

```http
POST /tools/query_credit_trigger_segment
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "lo_email": "string"
}
```


#### 3. Get LO Contacts Count

```http
POST /tools/get_lo_contacts_count
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "lo_email": "string",
  "tables": ["string"]
}
```


#### 3. Get LO Contacts

```http
POST /tools/get_lo_contacts
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "lo_email": "string"
}
```


#### 4. Query Centralized Document Extraction Table

```http
POST /tools/get_document_extraction_centralized
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
You may query in three different ways using this tool
1. companyDocType and optionally loanGuid
2. docId
3. extractionStatus and optionally initialTimestampe

```json
{
  "companyDocType": "string",
  "loanGuid": "string",
  "docId": "string",
  "extractionStatus": "string",
  "initialTimestamp": "string"
}
```


### DMX Tools

#### 1. Finalize Loan

```http
POST /tools/finalize_loan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All field are required.

```json
{
  "gr-loan-guid": "string"
}
```


### OneLoan Tools

#### 1. Get Loan Properties

```http
POST /tools/get_oneloan_properties
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loan_identifier and company are required. requestedProperties is optional.

```json
{
    "loan_identifier": "string",
    "requestedProperties": ["string"],
    "company": "string"
}
```

#### Retrieve Loan Properties By Borrower Email

```http
POST /tools/get_oneloan_properties_by_email
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
`borrowerEmail` and `loEmail` are required. The company is deduced from the loan officer email domain, the borrower's most recently started loan is selected, and loan data is fetched from OneLoan. `requestedProperties` is optional.

```json
{
  "borrowerEmail": "string",
  "loEmail": "string",
  "requestedProperties": ["string"]
}
```


#### 2. Search OneLoan Loans

```http
POST /tools/search_oneloan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
company is required. All other properties are technically optional, but you must provide at least one for the search to occur.

```json
{
    "propertyState": "string",
    "propertyCity": "string",
    "propertyStreetAddress": "string",
    "propertyPostalCode": "string",
    "borrowerBirthDate": "string",
    "borrowerHomePhone": "string",
    "borrowerMobilePhone": "string",
    "borrowerLast4SSN": "string",
    "coborrowerBirthDate": "string",
    "coborrowerHomePhone": "string",
    "coborrowerMobilePhone": "string",
    "coborrowerLast4SSN": "string",
    "loanNumber": "string",
    "company": "string",
    "returnAllLoans": boolean (default is false)
}
```

#### 3. Patch Loan Properties

```http
POST /tools/patch_oneloan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields except application_id are required.

```json
{
    "loan_guid": "string",
    "application_id": "string",
    "company": "string",
    "fields" : [
      {
        "fieldId": "string",
        "value": ""
      },
      ...
    ]
}
```

#### 4. Get Team Member Pipeline Count

```http
POST /tools/get_pipeline_count
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
`encompass_id` is required. `milestones` is optional; if omitted or empty, the tool uses its default HELOAN pipeline milestone set. The count comes from the OneLoan pipeline service (`/pipeline/v1/execute-pipeline/assigned-loan-count`, `metadata.total`).

```json
{
    "encompass_id": "string",
    "milestones": ["string"]
}
```

#### 5. Get Borrower Prior Loan Team

```http
POST /tools/get_borrower_prior_loan_team
```

**Request Headers**:
- `Authorization`: ****** (required)

**Request Body**:
`ssns` is required and must be a non-empty array of non-empty strings.

```json
{
    "ssns": ["999-40-5000"]
}
```

Uses `ONELOAN_DOMAIN` and the same `gri` authentication/company header as the
pipeline-count tool to call `/pipeline/v1/execute-pipeline/borrower-prior-loan-team`.
The pipeline service owns the 12-month funding-date filter.

**Response**:

```json
{
    "success": true,
    "data": {
        "prior_team_member_ids": ["testlo", "testmc", "testuw"]
    }
}
```

IDs are deduplicated across all returned loans in first-seen order, preserving
their exact values without role or eligibility filtering. Order does not imply
recency or assignment priority. An empty results list returns a successful empty
ID list; malformed responses and lookup failures return `success: false` with an
`error`, not partial results. The tool does not log or echo SSNs or downstream
error details. The tool itself only performs a lookup; the assignment Lambda
applies the policy below.

**HELOAN pipeline assignment integration**:
The assignment Lambda requests borrower SSN field `65` without including it in
field logs, then performs one prior-team lookup per processed loan. Missing SSNs
and lookup failures produce an audit warning and use normal assignment.
Existing processor/CC assignments retain their previous handling.

For each role, candidates must accept `New Assignments`. Normal candidates must
match the loan's attribute requirements; prior-team candidates must appear in
borrower history and have `Re-Submission` enabled on their roster row. The Lambda
fetches each unique candidate's pipeline count once and shares it between both
selection paths. Prior candidates below their total pipeline cap receive
preference, bypassing attribute requirements and daily-cap exclusion. Multiple
prior candidates use the normal utilization/daily-count/last-assigned ranking.
If none qualify, normal candidates use the existing daily-cap and fallback
rules without another count lookup. Assignments from the resubmission pool use
the successful reason code `ASSIGNED_FROM_RESUBMISSION_POOL`, which is recognized by Flowstate
invocation, first review, assignment PDFs, and the daily digest. Normal assignments
retain their existing reason codes. There is no loan-level resubmission attribute:
every loan can use borrower history, while the roster's `Re-Submission` column
controls staff participation in the resubmission pool.

#### 6. Assign OneLoan Roles

```http
POST /tools/assign_oneloan_role
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
`loan_guid`, `company`, and `assignments` are required. Each assignment requires a supported role slug and a numeric `user_id`. Supported roles are `underwriter`, `mortgage-consultant`, `loan-coordinator`, and `ops-assist-cc`.

```json
{
    "loan_guid": "string",
    "company": "gri",
    "assignments": [
        {
            "role": "underwriter",
            "user_id": 12345
        }
    ]
}
```


### Data Platform API Tools

#### 1. Search Loans

```http
POST /tools/search_loans
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are optional.

```json
{
    "loanNumber": "string",
    "borrowerPhoneNumber": "string",
    "borrower2PhoneNumber": "string",
    "borrowerSsnLast4": "string",
    "borrower2SsnLast4": "string",
    "borrowerFirstName": "string",
    "borrowerLastName": "string",
    "borrower2FirstName": "string",
    "borrower2LastName": "string",
    "borrowerSsn": "string",
    "borrower2Ssn": "string",
    "borrowerEmailAddress": "string",
    "borrower2EmailAddress": "string",
    "servicerLoanNumber": "string",
    "priorServicerLoanNumber": "string",
    "mspLoanNumber": "string",
    "propertyAddress": "string",
    "propertyCity": "string",
    "propertyCounty": "string",
    "propertyState": "string",
    "propertyZip": "string"
}
```

### Taskmaster Tools

#### 1. Create Task

```http
POST /tools/create_task
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loan_id, task-template-id, and company are required. All other fields are optional.

```json
{
    "loan-id": "string",
    "task-template-id": "string",
    "task-title": "string",
    "task-description": "string",
    "task-type": "string",
    "company": "string"
}
```

#### 2. Create Tasks

```http
POST /tools/create_tasks
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
`loan-id`, `company`, and `tasks` are required. `taskGroups` is optional. Within each task object, `task-template-id` is required; all other task fields are optional. Within each task group, `name`, `linkTasks`, and `tasks` are required.

```json
{
  "loan-id": "string",
  "company": "string",
  "tasks": [
    {
      "task-template-id": "string",
      "task-title": "string",
      "task-description": "string",
      "task-type": "string"
    }
  ],
  "taskGroups": [
    {
      "name": "underwriting-conditions",
      "linkTasks": true,
      "tasks": [
        {
          "task-template-id": "string",
          "task-title": "string",
          "task-description": "string",
          "task-type": "string"
        }
      ]
    }
  ]
}
```


#### 3. Get Task Templates

```http
POST /tools/get_task_templates
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
None


#### 4. Get Task

```http
POST /tools/get_task
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "loan-id": "string",
  "task-id": "string",
  "company": "string"
}
```


#### 5. Get Tasks

```http
POST /tools/get_tasks
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "loan-id": "string",
  "company": "string"
}
```

#### 5. Remove Task

```http
POST /tools/remove_task
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "loan-id": "string",
  "task-id": "string",
  "company": "string"
}
```

#### 6. Get Condition Task Templates

```http
POST /tools/get_condition_task_templates
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields are required.

```json
{
  "conditionKeys": ["string"]
}
```


### ECS Tools

#### 1. Get Credit Information

```http
POST /tools/get_ecs_credit
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields required.

```json
{
    "loan_number": "string"
}
```


#### 2. Reissue Credit Information

```http
POST /tools/reissue_credit
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
All fields required.

```json
{
    "loanId": "string",
    "company": "string"
}
```


### Encompass Tools

#### 1. Retrieve Loan Information

```http
POST /tools/get_encompass_loan
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
loanId is required, requestedProperties is optional.

```json
{
    "loanId": "string",
    "requestedProperties": [...]
}
```


#### 2. Retrieve Loan Information By Borrower Email

```http
POST /tools/get_encompass_loan_by_email
```

**Request Headers**:
- `Authorization`: Bearer token (required)

**Request Body**:
borrowerEmail and loEmail are required, requestedProperties is optional. The company is deduced from the loEmail domain:

| loEmail domain | Company |
|---|---|
| `@rate.com` | `gri` |
| `@grarate.com` | `gra` |
| `@owning.com` | `owning` |
| `@citywidehm.com` | `cwhm` |
| `@onqhomeloans.com` | `qhl` |
| `@certaintyhomelending.com` | `certainty` |
| `@kbhshomeloans.com` | `kbhs` |
| `@originpoint.com` | `op` |

An unrecognized domain returns `{"success": false, "error": "Unable to determine company from loEmail domain"}`.

```json
{
    "borrowerEmail": "string",
    "loEmail": "string",
    "requestedProperties": [...]
}
```