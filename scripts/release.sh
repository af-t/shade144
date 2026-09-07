#!/usr/bin/env bash
# scripts/release.sh - pack module.zip ready to flash (packaging only, no compile)
# Build/compile separately: make -C src  or  cmake -S src -B build && cmake --build build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODULE_PROP="misc/module.prop"
if [[ ! -f "$MODULE_PROP" ]]; then
  echo "error: $MODULE_PROP not found" >&2
  exit 1
fi

# Parse version fields
get_prop() { grep -E "^$1=" "$MODULE_PROP" | cut -d= -f2- | tr -d '\r'; }
MOD_ID="$(get_prop id)"
MOD_VERSION="$(get_prop version)"
MOD_VERSIONCODE="$(get_prop versionCode)"
[[ -z "$MOD_ID" ]] && MOD_ID="shade144"
[[ -z "$MOD_VERSION" ]] && MOD_VERSION="v0.0.0"

OUT_NAME="${1:-${MOD_ID}-${MOD_VERSION}.zip}"
OUT_DIR="dist"
mkdir -p "$OUT_DIR"
OUT_PATH="$OUT_DIR/$OUT_NAME"

# Resolve absolute output
if [[ "$OUT_PATH" != /* ]]; then
  OUT_PATH="$ROOT/$OUT_PATH"
fi

# Binaries: prefer multi-arch output from scripts/compile.sh, else legacy single binary.
#   Multi-arch: $BUILD_DIR/<abi>/whitelist_updater (abi = armeabi-v7a, arm64-v8a, x86, x86_64)
#               or env per ABI: BIN_ARMEABI_V7A, BIN_ARM64_V8A, BIN_X86, BIN_X86_64
#   Legacy:     $BIN_PATH, src/whitelist_updater, build/whitelist_updater -> bin/whitelist_updater
BUILD_DIR="${BUILD_DIR:-build}"
ARCH_ABIS="armeabi-v7a arm64-v8a x86 x86_64"

bin_for_abi() {
  local abi="$1" p=""
  case "$abi" in
    armeabi-v7a) p="${BIN_ARMEABI_V7A:-}" ;;
    arm64-v8a)   p="${BIN_ARM64_V8A:-}" ;;
    x86)         p="${BIN_X86:-}" ;;
    x86_64)      p="${BIN_X86_64:-}" ;;
  esac
  if [[ -n "$p" && -f "$p" ]]; then echo "$p"; return 0; fi
  if [[ -f "$BUILD_DIR/$abi/whitelist_updater" ]]; then echo "$BUILD_DIR/$abi/whitelist_updater"; return 0; fi
  return 1
}

ARCH_FOUND=""
for ABI in $ARCH_ABIS; do
  if B="$(bin_for_abi "$ABI")"; then
    ARCH_FOUND="$ARCH_FOUND $ABI:$B"
  fi
done

BIN_FOUND=""
if [[ -z "$ARCH_FOUND" ]]; then
  BIN_HOST="src/whitelist_updater"
  # Prefer prebuilt arch-specific if provided via env, else host binary
  if [[ -n "${BIN_PATH:-}" && -f "$BIN_PATH" ]]; then
    BIN_FOUND="$BIN_PATH"
  elif [[ -f "$BIN_HOST" ]]; then
    BIN_FOUND="$BIN_HOST"
  elif [[ -f "build/whitelist_updater" ]]; then
    BIN_FOUND="build/whitelist_updater"
  fi

  if [[ -z "$BIN_FOUND" ]]; then
    echo "error: binary not found - build separately first" >&2
    echo "  ./scripts/compile.sh          # Android ABIs via NDK (needs ANDROID_NDK_HOME)" >&2
    echo "  make -C src                   # host binary (dev/test only)" >&2
    echo "  or: cmake -S src -B build && cmake --build build" >&2
    echo "  then: BIN_PATH=build/whitelist_updater $0" >&2
    exit 2
  fi
fi

# Use file to warn if host arch vs android
if command -v file >/dev/null 2>&1; then
  for entry in ${ARCH_FOUND:-"host:$BIN_FOUND"}; do
    B="${entry#*:}"
    echo "binary: $B ($(file -b "$B" | cut -d, -f1))"
    if file -b "$B" | grep -qi "x86-64"; then
      echo "warn: host binary x86-64 detected - device needs arm64 (run ./scripts/compile.sh with NDK)" >&2
    fi
  done
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "staging -> $STAGE"
echo "module: $MOD_ID $MOD_VERSION ($MOD_VERSIONCODE)"

# Module root files
cp -a misc/module.prop "$STAGE/module.prop"
if [[ -f misc/system.prop ]]; then
  cp -a misc/system.prop "$STAGE/system.prop"
fi
if [[ -f scripts/action.sh ]]; then
  cp -a scripts/action.sh "$STAGE/action.sh"
  chmod 644 "$STAGE/action.sh"
else
  echo "error: scripts/action.sh not found" >&2
  exit 1
fi
if [[ -f scripts/customize.sh ]]; then
  cp -a scripts/customize.sh "$STAGE/customize.sh"
  chmod 644 "$STAGE/customize.sh"
else
  echo "error: scripts/customize.sh not found" >&2
  exit 1
fi

# Optional META-INF (if exists in repo, keep; else skip - not required on modern KSU/Magisk)
if [[ -d META-INF ]]; then
  cp -a META-INF "$STAGE/META-INF"
fi



# System overlay
if [[ -d system ]]; then
  cp -a system "$STAGE/system"
fi

# Binaries: multi-arch (bin/<abi>/) or legacy single copy (bin/whitelist_updater)
mkdir -p "$STAGE/bin"
if [[ -n "$ARCH_FOUND" ]]; then
  for entry in $ARCH_FOUND; do
    ABI="${entry%%:*}"
    B="${entry#*:}"
    mkdir -p "$STAGE/bin/$ABI"
    cp -a "$B" "$STAGE/bin/$ABI/whitelist_updater"
    chmod 755 "$STAGE/bin/$ABI/whitelist_updater"
  done
else
  cp -a "$BIN_FOUND" "$STAGE/bin/whitelist_updater"
  chmod 755 "$STAGE/bin/whitelist_updater"
fi

# Sanity checks
echo "--- stage contents ---"
(cd "$STAGE" && find . -type f | sort)

if [[ ! -f "$STAGE/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml" ]]; then
  echo "warn: refresh_rate_config.xml missing in stage" >&2
fi
if [[ ! -f "$STAGE/system/system_ext/framework/magellan_core.jar" ]]; then
  echo "warn: magellan_core.jar missing in stage" >&2
fi

# Pack zip (root is stage) - zip -> 7z -> python fallback
rm -f "$OUT_PATH"
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -r -9 "$OUT_PATH" .)
elif command -v 7z >/dev/null 2>&1; then
  (cd "$STAGE" && 7z a -tzip -mx=9 "$OUT_PATH" . >/dev/null)
else
  python3 -c "
import zipfile, pathlib
stage = pathlib.Path('$STAGE')
out = pathlib.Path('$OUT_PATH')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in stage.rglob('*'):
        if p.is_file():
            z.write(p, p.relative_to(stage))
"
fi

echo ""
echo "release: $OUT_PATH"
ls -lh "$OUT_PATH"
if command -v unzip >/dev/null 2>&1; then
  echo "--- zip list ---"
  unzip -l "$OUT_PATH" | sed -n '1,200p'
elif command -v 7z >/dev/null 2>&1; then
  echo "--- zip list ---"
  7z l "$OUT_PATH" | sed -n '1,200p'
else
  python3 -c "import zipfile; z=zipfile.ZipFile('$OUT_PATH'); print('\n'.join(z.namelist()))"
fi
echo "done - flash via KernelSU/Magisk/APatch"
