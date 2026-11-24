import json
import logging
import os
import boto3
import openpyxl
from io import BytesIO
from urllib.parse import unquote_plus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

DAILY_COUNT_COLUMN = "Assigned Today Count"
LAST_ASSIGNED_COLUMN = "Last Assigned At"
EMPLOYEE_ID_COLUMN = "Employee ID"
EMAIL_COLUMN = "Email"


def get_secret(secret_name: str, region: str = "us-east-1") -> dict:
    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

def _extract_s3_object_info(event: dict) -> tuple[str, str] | None:
    """
    Pulls the bucket name and object key out of the S3 ObjectCreated event
    record. S3 URL-encodes the key in the event payload (e.g. spaces become
    "+"), so we decode it before returning. Returns None (rather than
    raising) if the uploaded object isn't a .xlsx file, so the caller can
    just skip non-Excel uploads instead of treating it as an error.
    """
    record = event["Records"][0]
    bucket = record["s3"]["bucket"]["name"]
    key = unquote_plus(record["s3"]["object"]["key"])

    if not key.lower().endswith(".xlsx"):
        logger.info("Ignoring non-.xlsx object: %s", key)
        return None

    return bucket, key


def _download_workbook(bucket: str, key: str) -> openpyxl.workbook.Workbook:
    """
    Downloads the .xlsx object from S3 and loads it into an openpyxl Workbook. 
    """
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=key)
    file_bytes = response["Body"].read()
    return openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)

ATTRIBUTE_KEYS = [
    "Language Preference",
    "Re-Submission",
    "Chairmans Club",
    "Presidents Club",
    "Loan Amount Over 400k",
    "Self Employed",
    "Multiple Employers",
    "Multiple Properties",
    "Investment Second Home",
    "Multi Family",
    "Condo",
    "Retail",
    "Employee Loan Access",
]

ROLE_CONFIGS = (
    {"sheet_prefix": "Underwriter", "table_env_var": "UW_ROSTER_TABLE_NAME", "name_column_key": "Underwriter Name"},
    {"sheet_prefix": "Processor", "table_env_var": "PROCESSOR_ROSTER_TABLE_NAME", "name_column_key": "Processor Name"},
    {"sheet_prefix": "CC", "table_env_var": "CC_ROSTER_TABLE_NAME", "name_column_key": "Closing Coordinator Name"},
)

def _parse_roster_rows(sheet: openpyxl.worksheet.worksheet.Worksheet) -> list[tuple]:
    """
    Reads the given roster worksheet. Skips rows until it finds
    the header row (first cell == "Individual"), then treats every row after
    that as a candidate data row. A row counts as valid roster data only if
    its first 8 cells are all non-empty, the Employee ID cell is a whole number,
    the 4th cell (Email) is not blank, the 6th cell ("New Assignments") is
    "Yes" or "No", and the 7th/8th cells (Max Pipeline Size / Max Daily
    Assignments) are both integers with the 7th >= the 8th. Anything else is skipped
    """
    header_row_num = None
    for row_num, row in enumerate(sheet.iter_rows(min_row=1, max_row=sheet.max_row, values_only=True), start=1):
        if row and row[0] == "Individual":
            header_row_num = row_num
            break

    if header_row_num is None:
        raise ValueError("Could not find header row (first cell == 'Individual') in roster sheet")

    valid_rows = []
    for row in sheet.iter_rows(min_row=header_row_num + 1, max_row=sheet.max_row, values_only=True):
        name, encompass_user_id, employee_id, email, role, new_assignments, max_pipeline, max_daily = row[:8]

        if any(v is None for v in (name, encompass_user_id, employee_id, email, role, new_assignments, max_pipeline, max_daily)):
            continue
        if not str(email).strip():
            logger.warning("Skipping roster row for %s: Email is blank.", name)
            continue
        if new_assignments not in ("Yes", "No"):
            continue
        if not isinstance(max_pipeline, int) or not isinstance(max_daily, int):
            continue
        if max_pipeline < max_daily:
            continue
        if _parse_employee_id(employee_id) is None:
            logger.warning("Skipping roster row for %s: Employee ID %r is not a whole number.", name, employee_id)
            continue

        valid_rows.append(row)

    return valid_rows

def _cell_has_value(cell) -> bool:
    if cell is None:
        return False
    if isinstance(cell, str):
        return cell.strip() != ""
    return True

def _parse_employee_id(cell) -> int | None:
    """
    Converts the Employee ID cell to an int, or None if it is blank or unusable.
    """
    if cell is None or isinstance(cell, bool):
        return None
    if isinstance(cell, int):
        return cell
    if isinstance(cell, float):
        return int(cell) if cell.is_integer() else None
    if isinstance(cell, str):
        stripped = cell.strip()
        return int(stripped) if stripped.isdigit() else None
    return None

def _row_to_item(row: tuple, name_column_key: str) -> dict:
    """
    Converts one validated roster row (from _parse_roster_rows) into a
    DynamoDB item dict. The 13 skill-flag cells (row indices 8-20) map
    positionally to ATTRIBUTE_KEYS
    """
    name, encompass_user_id, employee_id_cell, email, role, new_assignments, max_pipeline, max_daily = row[:8]
    flag_cells = row[8:21]

    item = {
        name_column_key: name,
        "Encompass User ID": str(encompass_user_id).strip(),
        EMPLOYEE_ID_COLUMN: _parse_employee_id(employee_id_cell),
        EMAIL_COLUMN: str(email).strip(),
        "Role": role,
        "New Assignments": new_assignments == "Yes",
        "Max Pipeline Size": max_pipeline,
        "Max Daily Assignments": max_daily,
    }
    item.update({key: _cell_has_value(cell) for key, cell in zip(ATTRIBUTE_KEYS, flag_cells)})
    return item

def _sync_roster_to_dynamodb(items: list[dict], table_name: str) -> None:
    """
    Writes every parsed roster item to the table in DynamoDB
    """
    table = boto3.resource("dynamodb").Table(table_name)

    new_ids = {item["Encompass User ID"] for item in items}

    existing_ids = set()
    scan_kwargs = {
        "ProjectionExpression": "#id",
        "ExpressionAttributeNames": {
            "#id": "Encompass User ID",
        },
    }

    while True:
        response = table.scan(**scan_kwargs)
        for r in response["Items"]:
            existing_ids.add(r["Encompass User ID"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
 
    for item in items:
        names = {"#daily": DAILY_COUNT_COLUMN}
        values = {":zero": 0}
        updates = ["#daily = if_not_exists(#daily, :zero)"]
        for index, (column, value) in enumerate(item.items()):
            if column == "Encompass User ID":
                continue
            name, placeholder = f"#field{index}", f":value{index}"
            names[name] = column
            values[placeholder] = value
            updates.append(f"{name} = {placeholder}")
        # Update Excel-owned fields only; preserve live counters and their timestamp.
        table.update_item(
            Key={"Encompass User ID": item["Encompass User ID"]},
            UpdateExpression="SET " + ", ".join(updates),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
 
    stale_ids = existing_ids - new_ids
    for uid in stale_ids:
        table.delete_item(Key={"Encompass User ID": uid})
 
    logger.info(
        "Roster sync complete: %d items written, %d stale items removed",
        len(items), len(stale_ids),
    )


def lambda_handler(event: dict, context) -> dict:
    try:
        secret_name = os.getenv("AWS_SECRET_NAME", "digital-mortgage-systems-mcp/digital-mortgage-systems-mcp-dev")
        secrets = get_secret(secret_name)
    except Exception:
        logger.exception("Failed to load secrets from Secrets Manager")
        return {"statusCode": 500, "body": json.dumps({"error": "Internal configuration error"})}

    # Load secrets into environment variables
    for key, value in secrets.items():
        os.environ[key] = value

    logger.info("heloan_uw_roster_sync invoked. Event: %s", json.dumps(event))

    s3_object_info = _extract_s3_object_info(event)
    if s3_object_info is None:
        return {"statusCode": 200, "body": json.dumps({"message": "Ignored non-.xlsx upload"})}
    bucket, key = s3_object_info

    try:
        workbook = _download_workbook(bucket, key)
    except Exception:
        logger.exception("Failed to download/parse .xlsx object %s from bucket %s", key, bucket)
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to download or parse uploaded roster file"})}

    sync_results = {}
    for role_config in ROLE_CONFIGS:
        sheet_prefix = role_config["sheet_prefix"]
        matching_sheet_name = next(
            (name for name in workbook.sheetnames if name.startswith(sheet_prefix)), None
        )
        if matching_sheet_name is None:
            logger.error(
                "No sheet found starting with '%s' in %s; skipping %s roster sync.",
                sheet_prefix, key, role_config["table_env_var"],
            )
            sync_results[sheet_prefix] = {"error": "Sheet not found"}
            continue

        try:
            valid_rows = _parse_roster_rows(workbook[matching_sheet_name])
            items = [_row_to_item(row, role_config["name_column_key"]) for row in valid_rows]
        except Exception:
            logger.exception("Failed to parse roster rows from sheet '%s' in %s", matching_sheet_name, key)
            sync_results[sheet_prefix] = {"error": "Failed to parse roster rows"}
            continue

        logger.info("Parsed %d roster rows from sheet '%s' in %s", len(items), matching_sheet_name, key)
        if not items:
            logger.error(
                "Sheet '%s' in %s parsed to zero valid rows; leaving %s untouched.",
                matching_sheet_name, key, role_config["table_env_var"],
            )
            sync_results[sheet_prefix] = {"error": "No valid roster rows found"}
            continue

        table_name = os.environ[role_config["table_env_var"]]
        try:
            _sync_roster_to_dynamodb(items, table_name)
        except Exception:
            logger.exception("Failed to sync roster items to DynamoDB table %s", table_name)
            sync_results[sheet_prefix] = {"error": "Failed to sync roster to DynamoDB"}
            continue

        sync_results[sheet_prefix] = {"parsed_rows": len(items)}

    if all("error" in result for result in sync_results.values()):
        return {"statusCode": 500, "body": json.dumps({"error": "Failed to sync any roster table", "results": sync_results})}

    return {"statusCode": 200, "body": json.dumps({"message": "OK", "results": sync_results})}