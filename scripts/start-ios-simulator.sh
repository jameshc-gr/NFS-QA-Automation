#!/usr/bin/env bash
set -euo pipefail

# Start an iOS Simulator by device name and wait until it's booted.
# Usage: ./scripts/start-ios-simulator.sh "iPhone 14" [runtime]
# runtime example: "iOS 17.4"

DEVICE_NAME=${1:-"iPhone 14"}
RUNTIME=${2:-}

if ! command -v xcrun >/dev/null 2>&1; then
  echo "ERROR: xcrun not found. Ensure Xcode command line tools are installed."
  exit 2
fi

echo "Searching for device type matching: $DEVICE_NAME"
DEVICE_UDID=$(xcrun simctl list devices available | grep -F "$DEVICE_NAME" | head -n1 | awk -F '[()]' '{print $2}' | tr -d ' ') || true

if [ -z "$DEVICE_UDID" ]; then
  # Try matching by device type string
  DEVICE_UDID=$(xcrun simctl list devices | grep "$DEVICE_NAME" | head -n1 | awk -F '[()]' '{print $2}' | tr -d ' ' ) || true
fi

if [ -z "$DEVICE_UDID" ]; then
  echo "No simulator device found for '$DEVICE_NAME'. Run 'xcrun simctl list' to see available device names."
  exit 3
fi

echo "Booting simulator $DEVICE_NAME (udid: $DEVICE_UDID)"
xcrun simctl boot "$DEVICE_UDID" || true
open -a Simulator || true

echo "Waiting for simulator to be booted..."
SECONDS=0
TIMEOUT=120
while true; do
  STATE=$(xcrun simctl list devices | grep "$DEVICE_UDID" | sed -n '1p' | sed -E 's/.*\(([^)]+)\)/\1/') || STATE=""
  if echo "$STATE" | grep -qi "Booted"; then
    echo "Simulator booted."
    break
  fi
  if [ $SECONDS -gt $TIMEOUT ]; then
    echo "Timed out waiting for simulator to boot."
    exit 4
  fi
  sleep 2
done

echo "Simulator booted: $DEVICE_NAME ($DEVICE_UDID)"
exit 0
