#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-heloan"
ZIP="/tmp/mcp-heloan.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
mkdir -p "$BUILD/src/tools" "$BUILD/lambdas/heloan" "$BUILD/lambdas/heloan/assets" "$BUILD/data"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

# src/ package
touch "$BUILD/src/__init__.py"
cp "$SRC/tools/__init__.py"              "$BUILD/src/tools/"
cp "$SRC/tools/base.py"                  "$BUILD/src/tools/"
cp "$SRC/tools/doc_storage_tools.py"     "$BUILD/src/tools/"
cp "$SRC/tools/ecs_tools.py"             "$BUILD/src/tools/"
cp "$SRC/tools/oneloan_tools.py"         "$BUILD/src/tools/"
cp "$SRC/tools/email_tools.py"           "$BUILD/src/tools/"
cp "$SRC/internal_service_auth.py"       "$BUILD/src/"
cp "$REPO_ROOT/data/encompass-loan-schema.json" "$BUILD/data/"

# Lambda entry point
cp "$SRC/lambdas/__init__.py"            "$BUILD/lambdas/"
cp "$SRC/lambdas/heloan/__init__.py"     "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/decision_record.py" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/decline_queue.py" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/handler.py"      "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/oneloan_patch.py" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/pdf_generator.py" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/member_decline_email.py" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/heloan-decline-simple.html" "$BUILD/lambdas/heloan/"
cp "$SRC/lambdas/heloan/assets/rate-companies-2color.png" "$BUILD/lambdas/heloan/assets/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
