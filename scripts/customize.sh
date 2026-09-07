#!/system/bin/sh
# shade144 customize.sh - sourced by the module installer after unzip.
# Fixes exec permission on bin/ (reset to 0644 by set_default_perm)
# and prunes unused ABI dirs. Runs on fresh install AND update.
# NOTE: do NOT use `exit` here, use `abort` on fatal errors.

ui_print "- Shade144: fixing binary permissions..."

if [ -d "$MODPATH/bin" ]; then
  set_perm_recursive "$MODPATH/bin" 0 0 0755 0755
fi

# Map installer $ARCH to our bin/<abi> layout, prune the rest.
CUR_ABI=""
case "$ARCH" in
  arm64) CUR_ABI="arm64-v8a" ;;
  arm) CUR_ABI="armeabi-v7a" ;;
  x64) CUR_ABI="x86_64" ;;
  x86) CUR_ABI="x86" ;;
esac

if [ -n "$CUR_ABI" ]; then
  for d in "$MODPATH/bin/"*/; do
    [ -d "$d" ] || continue
    case "$d" in
      *"$CUR_ABI"*) ;;
      *)
        rm -rf "$d"
        ui_print "- removed unused ABI: $d"
        ;;
    esac
  done
fi

if [ -n "$CUR_ABI" ] && [ -f "$MODPATH/bin/$CUR_ABI/whitelist_updater" ]; then
  ui_print "- binary: bin/$CUR_ABI/whitelist_updater"
elif [ -f "$MODPATH/bin/whitelist_updater" ]; then
  ui_print "- binary: bin/whitelist_updater (legacy layout)"
else
  abort "! whitelist_updater not found for ARCH=$ARCH ($CUR_ABI)"
fi

ui_print "- Shade144 installed, reboot required"
