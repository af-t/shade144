#!/usr/bin/env bash
# scripts/compile.sh - compile src for Android ABIs via NDK clang
# Split from release: this script only builds, scripts/release.sh only packs.
#
# Usage:
#   ./scripts/compile.sh                  # all 4 ABIs (needs NDK)
#   ./scripts/compile.sh arm64-v8a        # subset (one or more ABIs)
#   ANDROID_PLATFORM=android-35 ./scripts/compile.sh
#   BUILD_DIR=build ./scripts/compile.sh
#
# Output: $BUILD_DIR/<abi>/whitelist_updater (Release, stripped via -s)
# NDK lookup order: $ANDROID_NDK_HOME, $ANDROID_NDK_ROOT, $NDK
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALL_ABIS="armeabi-v7a arm64-v8a x86 x86_64"
ABIS="${*:-$ALL_ABIS}"
BUILD_DIR="${BUILD_DIR:-build}"
PLATFORM="${ANDROID_PLATFORM:-android-35}"

NDK_DIR="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-${NDK:-}}}"
if [[ -z "$NDK_DIR" ]]; then
  echo "error: Android NDK not found" >&2
  echo "  set one of: ANDROID_NDK_HOME, ANDROID_NDK_ROOT, NDK" >&2
  echo "  or in CI: nttld/setup-ndk (sets ANDROID_NDK_HOME automatically)" >&2
  exit 1
fi

TOOLCHAIN="$NDK_DIR/build/cmake/android.toolchain.cmake"
if [[ ! -f "$TOOLCHAIN" ]]; then
  echo "error: toolchain not found: $TOOLCHAIN" >&2
  exit 1
fi

for ABI in $ABIS; do
  case " $ALL_ABIS " in
    *" $ABI "*) ;;
    *) echo "error: unknown ABI '$ABI' (expected one of: $ALL_ABIS)" >&2; exit 1 ;;
  esac

  echo "=== $ABI ($PLATFORM) ==="
  cmake -S src -B "$BUILD_DIR/$ABI" \
    -DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN" \
    -DANDROID_ABI="$ABI" \
    -DANDROID_PLATFORM="$PLATFORM" \
    -DCMAKE_BUILD_TYPE=Release
  cmake --build "$BUILD_DIR/$ABI"
done

echo ""
echo "binaries:"
ls -l "$BUILD_DIR"/whitelist_updater 2>/dev/null || true
for ABI in $ABIS; do
  BIN="$BUILD_DIR/$ABI/whitelist_updater"
  if command -v file >/dev/null 2>&1; then
    echo "$ABI: $BIN ($(file -b "$BIN" | cut -d, -f1-2))"
  else
    echo "$ABI: $BIN"
  fi
done
