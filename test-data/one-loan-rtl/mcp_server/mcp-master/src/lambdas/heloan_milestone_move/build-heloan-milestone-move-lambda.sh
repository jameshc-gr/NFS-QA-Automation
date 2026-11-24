#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD="/tmp/lambda-build-mcp-heloan-milestone-move"
ZIP="/tmp/mcp-heloan-milestone-move.zip"

mkdir -p "$BUILD/lambdas/heloan_milestone_move" "$BUILD/src/tools" "$BUILD/data"

# boto3 is provided by the Lambda Python runtime.
python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

touch "$BUILD/src/__init__.py"
cp "$REPO_ROOT/src/tools/__init__.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/base.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/email_tools.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/oneloan_tools.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/internal_service_auth.py" "$BUILD/src/"
cp "$REPO_ROOT/data/encompass-loan-schema.json" "$BUILD/data/"
cp "$REPO_ROOT/src/lambdas/__init__.py" "$BUILD/lambdas/"
cp "$SCRIPT_DIR/__init__.py" "$BUILD/lambdas/heloan_milestone_move/"
cp "$SCRIPT_DIR/handler.py" "$BUILD/lambdas/heloan_milestone_move/"

cd "$BUILD"
zip -r -FS "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
