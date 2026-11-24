#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-heloan-pipeline-assignment"
ZIP="/tmp/mcp-heloan-pipeline-assignment.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
mkdir -p "$BUILD/src/tools" "$BUILD/lambdas/heloan_pipeline_assignment" "$BUILD/data"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

# src/ package
touch "$BUILD/src/__init__.py"
cp "$SRC/tools/__init__.py"          "$BUILD/src/tools/"
cp "$SRC/tools/base.py"              "$BUILD/src/tools/"
cp "$SRC/tools/email_tools.py"       "$BUILD/src/tools/"
cp "$SRC/tools/oneloan_tools.py"     "$BUILD/src/tools/"
cp "$SRC/internal_service_auth.py"   "$BUILD/src/"

# Lambda entry point
cp "$SRC/lambdas/__init__.py"                              "$BUILD/lambdas/"
touch "$BUILD/lambdas/heloan_pipeline_assignment/__init__.py"
cp "$SCRIPT_DIR/handler.py"                                "$BUILD/lambdas/heloan_pipeline_assignment/"
cp "$SCRIPT_DIR/loan_attributes.py"                        "$BUILD/lambdas/heloan_pipeline_assignment/"
cp "$SCRIPT_DIR/pdf_generator.py"                          "$BUILD/lambdas/heloan_pipeline_assignment/"

# Schema required by oneloan_tools._get_field_index()
cp "$REPO_ROOT/data/encompass-loan-schema.json" "$BUILD/data/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"