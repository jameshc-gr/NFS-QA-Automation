#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD="/tmp/lambda-build-mcp-heloan-processor-first-review"
ZIP="/tmp/mcp-heloan-processor-first-review.zip"

rm -rf "$BUILD"
mkdir -p "$BUILD/src/tools" "$BUILD/lambdas/heloan_processor_first_review" "$BUILD/data"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

cp "$REPO_ROOT/src/lambdas/__init__.py" "$BUILD/lambdas/"
cp "$SCRIPT_DIR/__init__.py" "$BUILD/lambdas/heloan_processor_first_review/"
cp "$SCRIPT_DIR/handler.py" "$BUILD/lambdas/heloan_processor_first_review/"
cp "$SCRIPT_DIR/pdf_generator.py" "$BUILD/lambdas/heloan_processor_first_review/"
cp "$SCRIPT_DIR/verification_checks.py" "$BUILD/lambdas/heloan_processor_first_review/"

touch "$BUILD/src/__init__.py"
cp "$REPO_ROOT/src/tools/__init__.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/base.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/email_tools.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/tools/oneloan_tools.py" "$BUILD/src/tools/"
cp "$REPO_ROOT/src/internal_service_auth.py" "$BUILD/src/"
cp "$REPO_ROOT/data/encompass-loan-schema.json" "$BUILD/data/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
