#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-underwriting-credit-inquiry-task-automation"
ZIP="/tmp/mcp-underwriting-credit-inquiry-task-automation.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
mkdir -p "$BUILD/src/tools" "$BUILD/src/security" "$BUILD/lambdas/underwriting_credit_inquiry_task_automation" "$BUILD/data"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
	--platform manylinux2014_x86_64 \
	--implementation cp \
	--python-version 3.12 \
	--only-binary=:all: \
	--upgrade

touch "$BUILD/src/__init__.py"
touch "$BUILD/src/security/__init__.py"
cp "$SRC/security/redaction.py" "$BUILD/src/security/"
cp "$SRC/tools/__init__.py" "$BUILD/src/tools/"
cp "$SRC/tools/base.py" "$BUILD/src/tools/"
cp "$SRC/tools/ecs_tools.py" "$BUILD/src/tools/"
cp "$SRC/tools/oneloan_tools.py" "$BUILD/src/tools/"
cp "$SRC/tools/borrower_entity_tools.py" "$BUILD/src/tools/"
cp "$SRC/tools/taskmaster_tools.py" "$BUILD/src/tools/"
cp "$SRC/internal_service_auth.py" "$BUILD/src/"
cp "$REPO_ROOT/data/encompass-loan-schema.json" "$BUILD/data/"

cp "$SRC/lambdas/__init__.py" "$BUILD/lambdas/"
cp "$SCRIPT_DIR/__init__.py" "$BUILD/lambdas/underwriting_credit_inquiry_task_automation/"
cp "$SCRIPT_DIR/dev_fixtures.py" "$BUILD/lambdas/underwriting_credit_inquiry_task_automation/"
cp "$SCRIPT_DIR/handler.py" "$BUILD/lambdas/underwriting_credit_inquiry_task_automation/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"