#!/usr/bin/env bash
# Build the Rs Calculator debug APK locally and copy it next to the project root.
#
#   ./scripts/build-apk.sh            # -> app/build/outputs/apk/debug/app-debug.apk
#   ./scripts/build-apk.sh --install   # build + adb install on the connected phone
#
# Needs: JDK 17 and an Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT set).
# The fastest way to get both is to install Android Studio, then run this script.
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-}"

if ! command -v java >/dev/null 2>&1; then
  echo "✗ java not found — install JDK 17 (or open this project in Android Studio once)." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  echo "! ANDROID_HOME is not set. If the SDK is in the default location, using \$HOME/Android/Sdk" >&2
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi

echo "▶ ./gradlew assembleDebug"
./gradlew --no-daemon testDebugUnitTest assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
OUT="out"
mkdir -p "$OUT"
cp "$APK" "$OUT/Rs-Calculator-debug.apk"

echo
echo "✓ APK ready: $OUT/Rs-Calculator-debug.apk"
ls -lh "$OUT/Rs-Calculator-debug.apk" | awk '{print "  size: " $5}'
sha256sum "$OUT/Rs-Calculator-debug.apk" | cut -c1-64 | sed 's/^/  sha256: /'

if [[ "$MODE" == "--install" ]]; then
  echo "▶ adb install -r"
  "${ANDROID_HOME}/platform-tools/adb" install -r "$OUT/Rs-Calculator-debug.apk"
fi
