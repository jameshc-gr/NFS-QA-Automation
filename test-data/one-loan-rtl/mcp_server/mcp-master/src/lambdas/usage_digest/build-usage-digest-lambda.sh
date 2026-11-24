#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-usage-digest"
ZIP="/tmp/mcp-usage-digest.zip"

echo "Building Lambda package..."
rm -rf "$BUILD" "$ZIP"
mkdir -p "$BUILD/src/tools" "$BUILD/lambdas/usage_digest"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

# src/ package
touch "$BUILD/src/__init__.py"
cp "$SRC/tools/__init__.py"    "$BUILD/src/tools/"
cp "$SRC/tools/base.py"        "$BUILD/src/tools/"
cp "$SRC/tools/email_tools.py" "$BUILD/src/tools/"

# Lambda entry point
cp "$SRC/lambdas/__init__.py"  "$BUILD/lambdas/"
cp "$SCRIPT_DIR/__init__.py"   "$BUILD/lambdas/usage_digest/"
cp "$SCRIPT_DIR/handler.py"    "$BUILD/lambdas/usage_digest/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
