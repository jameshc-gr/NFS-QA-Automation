#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD="$(mktemp -d /tmp/flowstate-document-event-observer.XXXXXX)"
ZIP="/tmp/flowstate-document-event-observer.zip"
trap 'rm -f "$BUILD/package.zip"; rmdir "$BUILD"' EXIT

zip -j "$BUILD/package.zip" "$SCRIPT_DIR/handler.py" > /dev/null
mv "$BUILD/package.zip" "$ZIP"

echo "Lambda package built: $ZIP"
echo "Lambda handler: handler.lambda_handler"
