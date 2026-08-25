#!/usr/bin/env bash
set -euo pipefail

# Start an Android AVD and wait until it's ready for adb connections.
# Usage: ./scripts/start-android-emulator.sh [AVD_NAME]

ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME}/Library/Android/sdk}}
export ANDROID_SDK_ROOT
export ANDROID_HOME=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

AVD_NAME=${1:-}

if ! command -v emulator >/dev/null 2>&1; then
  echo "ERROR: emulator binary not found on PATH. Ensure Android SDK emulator is installed and PATH includes \$ANDROID_HOME/emulator"
  exit 2
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb not found on PATH. Ensure Android SDK platform-tools are installed and PATH includes \$ANDROID_HOME/platform-tools"
  exit 2
fi

if [ -z "$AVD_NAME" ]; then
  echo "No AVD name provided — listing available AVDs..."
  AVD_NAME=$(emulator -list-avds | head -n1 || true)
  if [ -z "$AVD_NAME" ]; then
    echo "No AVDs found. Create one in Android Studio AVD Manager or run 'avdmanager' to create one."
    exit 3
  fi
  echo "Using first AVD: $AVD_NAME"
fi

LOGFILE="/tmp/android-emulator-${AVD_NAME}.log"
echo "Starting emulator '$AVD_NAME' (log: $LOGFILE)"

# Start emulator in background and detach
nohup emulator -avd "$AVD_NAME" >"$LOGFILE" 2>&1 &
EMULATOR_PID=$!
sleep 2

echo "Waiting for device to appear via adb..."
adb wait-for-device

echo "Waiting for Android boot completion (sys.boot_completed)..."
SECONDS=0
TIMEOUT=300
while true; do
  BOOTED=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') || BOOTED=""
  if [ "$BOOTED" = "1" ]; then
    echo "Device boot completed."
    break
  fi
  if [ $SECONDS -gt $TIMEOUT ]; then
    echo "Timed out waiting for device to boot (>${TIMEOUT}s). Check $LOGFILE for emulator output."
    exit 4
  fi
  sleep 2
done

echo "Emulator ready: $(adb devices)"
echo "Emulator log: $LOGFILE"

exit 0
