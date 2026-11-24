#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/src"
BUILD="/tmp/lambda-build-mcp-heloan-uw-roster-sync"
ZIP="/tmp/mcp-heloan-uw-roster-sync.zip"

echo "Building Lambda package..."
rm -rf "$BUILD"
mkdir -p "$BUILD/lambdas/heloan_uw_roster_sync"

python3 -m pip install -r "$SCRIPT_DIR/requirements-lambda.txt" -t "$BUILD" -q \
    --platform manylinux2014_x86_64 \
    --implementation cp \
    --python-version 3.12 \
    --only-binary=:all: \
    --upgrade

# Lambda entry point
cp "$SRC/lambdas/__init__.py"                       "$BUILD/lambdas/"
touch "$BUILD/lambdas/heloan_uw_roster_sync/__init__.py"
cp "$SCRIPT_DIR/handler.py"                         "$BUILD/lambdas/heloan_uw_roster_sync/"

cd "$BUILD"
zip -r "$ZIP" . -x "*.pyc" -x "*/__pycache__/*" > /dev/null

echo "Lambda package built: $ZIP"
