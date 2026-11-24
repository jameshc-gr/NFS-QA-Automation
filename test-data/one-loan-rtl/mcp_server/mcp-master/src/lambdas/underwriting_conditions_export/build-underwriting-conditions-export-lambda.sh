#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="$(mktemp -d)"
trap 'find "$BUILD" -depth -delete' EXIT

mkdir -p "$BUILD/lambdas/underwriting_conditions_export"
cp "$SCRIPT_DIR/__init__.py" "$SCRIPT_DIR/handler.py" "$SCRIPT_DIR/parquet_export.py" "$BUILD/lambdas/underwriting_conditions_export/"
python3 -m pip install -r "$SCRIPT_DIR/requirements.txt" --target "$BUILD" \
    --platform manylinux_2_28_x86_64 --implementation cp --python-version 3.12 \
    --only-binary=:all: --no-compile
(cd "$BUILD" && zip -q -X -r package.zip .)
mv "$BUILD/package.zip" /tmp/mcp-underwriting-conditions-export.zip
