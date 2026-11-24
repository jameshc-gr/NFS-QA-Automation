#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-underwriting-approved"
ZIP="/tmp/mcp-underwriting-approved.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
mkdir -p "$BUILD/src/tools" "$BUILD/lambdas/underwriting_approved" "$BUILD/data"

pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q

# src/ package — preserves relative imports (from ..internal_service_auth etc.)
touch "$BUILD/src/__init__.py"
cp "$SRC/tools/__init__.py"                           "$BUILD/src/tools/"
cp "$SRC/tools/base.py"                               "$BUILD/src/tools/"
cp "$SRC/tools/oneloan_tools.py"                      "$BUILD/src/tools/"
cp "$SRC/tools/taskmaster_tools.py"                   "$BUILD/src/tools/"
cp "$SRC/tools/borrower_entity_tools.py"              "$BUILD/src/tools/"
cp "$SRC/internal_service_auth.py"                    "$BUILD/src/"

# Lambda entry point
cp "$SRC/lambdas/__init__.py"                         "$BUILD/lambdas/"
cp "$SRC/lambdas/underwriting_approved/__init__.py"   "$BUILD/lambdas/underwriting_approved/"
cp "$SRC/lambdas/underwriting_approved/handler.py"    "$BUILD/lambdas/underwriting_approved/"

# Schema required by oneloan_tools._get_field_index()
cp "$REPO_ROOT/data/encompass-loan-schema.json"  "$BUILD/data/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
