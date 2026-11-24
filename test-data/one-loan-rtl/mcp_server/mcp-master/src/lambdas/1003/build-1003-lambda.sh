#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-1003"
ZIP="/tmp/mcp-1003.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
# 1003 is not a valid Python identifier; map it to loan_1003 inside the zip
mkdir -p "$BUILD/lambdas/loan_1003" "$BUILD/src/tools"

pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q

# src/ package
touch "$BUILD/src/__init__.py"
cp "$SRC/tools/__init__.py"          "$BUILD/src/tools/"
cp "$SRC/tools/base.py"              "$BUILD/src/tools/"
cp "$SRC/tools/ecs_tools.py"         "$BUILD/src/tools/"
cp "$SRC/tools/oneloan_tools.py"     "$BUILD/src/tools/"
cp "$SRC/internal_service_auth.py"   "$BUILD/src/"

# Lambda entry point
cp "$SRC/lambdas/__init__.py"       "$BUILD/lambdas/"
cp "$SRC/lambdas/1003/__init__.py"  "$BUILD/lambdas/loan_1003/"
cp "$SRC/lambdas/1003/handler.py"   "$BUILD/lambdas/loan_1003/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
