#!/system/bin/sh
# Shade144 - whitelist updater (binary-only)
# Task: add installed apps missing from Magellan config to WHITELIST
# Defaults: auto=90 high=90 max=144 touch=1 app_request=0

MODDIR="${0%/*}"
if [ ! -f "$MODDIR/module.prop" ] && [ ! -f "$MODDIR/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml" ]; then
  for c in /data/adb/modules/shade144 /data/adb/modules_update/shade144 /data/adb/ksu/modules/shade144 /data/adb/ap/modules/shade144; do
    if [ -d "$c" ]; then MODDIR="$c"; break; fi
  done
fi
if [ ! -d "$MODDIR/system" ] && [ -d "$MODDIR/../system" ]; then
  MODDIR="$(cd "$MODDIR/.." 2>/dev/null && pwd)"
fi

LOG="/data/local/tmp/shade144_action.log"
CONFIG_CANDIDATES="
$MODDIR/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml
/data/adb/modules/shade144/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml
/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml
/product/etc/vconfig/magellan/refresh_rate_config.xml
/system_ext/etc/vconfig/magellan/refresh_rate_config.xml
"

CONFIG=""
for c in $CONFIG_CANDIDATES; do
  [ -z "$c" ] && continue
  if [ -f "$c" ]; then CONFIG="$c"; break; fi
done

if [ -z "$CONFIG" ]; then
  echo "[shade144] config not found" | tee -a "$LOG"
  echo "Tried: $CONFIG_CANDIDATES"
  exit 1
fi

echo "[shade144] using config: $CONFIG" | tee -a "$LOG"
echo "[shade144] moddir: $MODDIR" | tee -a "$LOG"

DEF_AUTO="90"
DEF_HIGH="90"
DEF_MAX="144"
DEF_TOUCH="1"
DEF_REQ="0"

# Pick binary by device ABI (multi-arch layout), fall back to legacy single binary.
ABI="$(getprop ro.product.cpu.abi 2>/dev/null)"
BIN=""
if [ -n "$ABI" ] && [ -x "$MODDIR/bin/$ABI/whitelist_updater" ]; then
  BIN="$MODDIR/bin/$ABI/whitelist_updater"
elif [ -x "$MODDIR/bin/whitelist_updater" ]; then
  BIN="$MODDIR/bin/whitelist_updater"
fi
if [ -z "$BIN" ]; then
  echo "[shade144] binary not found for ABI '${ABI:-unknown}'" | tee -a "$LOG"
  echo "Expected: \$MODDIR/bin/<abi>/whitelist_updater or \$MODDIR/bin/whitelist_updater" | tee -a "$LOG"
  echo "Reason: binary not built or not packed into module.zip" | tee -a "$LOG"
  echo "Fix: build separately then re-pack:" | tee -a "$LOG"
  echo "  ./scripts/compile.sh  # needs NDK (all ABIs)" | tee -a "$LOG"
  echo "  ./scripts/release.sh" | tee -a "$LOG"
  echo "  reflash zip" | tee -a "$LOG"
  exit 2
fi

PKGS_FILE="/data/local/tmp/shade144_pkgs.txt"
pm list packages 2>/dev/null | cut -d: -f2 | sort -u > "$PKGS_FILE"
if [ ! -s "$PKGS_FILE" ]; then
  cmd package list packages 2>/dev/null | cut -d: -f2 | sort -u > "$PKGS_FILE"
fi
if [ ! -s "$PKGS_FILE" ]; then
  echo "[shade144] failed to enumerate packages" | tee -a "$LOG"
  exit 3
fi
echo "[shade144] installed packages: $(wc -l < "$PKGS_FILE")" | tee -a "$LOG"
echo "[shade144] using binary: $BIN" | tee -a "$LOG"

cp -a "$CONFIG" "$CONFIG.bak" 2>/dev/null
"$BIN" --input "$CONFIG" --file "$PKGS_FILE" --auto "$DEF_AUTO" --high "$DEF_HIGH" --max "$DEF_MAX" --touch "$DEF_TOUCH" --app_request "$DEF_REQ" 2>&1 | tee -a "$LOG"
RC=$?
if [ $RC -eq 0 ]; then
  echo "[shade144] whitelist updated. Reboot to apply." | tee -a "$LOG"
  echo "Done. Reboot required."
  exit 0
else
  echo "[shade144] binary failed (rc=$RC)" | tee -a "$LOG"
  exit $RC
fi
