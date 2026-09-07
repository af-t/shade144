# Shade144 XOS16 144Hz Unlock

> Magellan dex patch to unlock 144Hz on Transsion XOS 16. Idle stays at 60Hz, unlocked apps run at 144Hz.

Modern systemless module compatible with all current root managers. One zip, flash anywhere.

---

## Overview

XOS 16 caps many apps at `90Hz` via `Magellan` (`magellan_core.jar` + `refresh_rate_config.xml`). This module intercepts two methods:

1. `d.F` - shade intercept
2. `d.s` - transition-animating

Both are forced to return `144` instead of `90`. Idle mode (`60`) is preserved for battery saving.

Result: apps previously locked to 90Hz can run at 144Hz without a custom kernel or display overlay.

**Module ID:** `shade144` | **Name:** `Shade144 XOS16` | **Author:** `wantrelax | wantnpc`

## Features

- 144Hz unlock for hundreds of packages (whitelist in `refresh_rate_config.xml`)
- Built-in WebUI (KSU/KSUN): edit the per-app whitelist from the root manager, no manual XML editing
- Idle stays at 60Hz - no extra drain when screen is static
- Non-destructive patch: only overrides return value, no system refresh rate reconfiguration
- No custom kernel required
- Systemless - safe for OTA (disable module before OTA)

## Root Manager Compatibility

| Manager | Status | Notes |
|---------|--------|-------|
| **KernelSU (KSU)** | ✅ Compatible | Use latest KSU build for Android 16 / kernel 6.12.x |
| **KernelSU Next (KSUN)** | ✅ Compatible | Active community fork of KSU |
| **SukiSU** | ✅ Compatible | SukiSU Ultra |
| **ReSukiSU** | ✅ Compatible | SukiSU rebase |
| **Magisk** | ⚠️ Untested | Requires v30+ or Alpha for Android 16 / kernel 6.12.x; not yet verified with this module |
| **APatch** | ✅ Compatible | Requires APatch build with Android 16 / 6.12.x support |

> All managers above use the Magisk module format (`module.prop` + `system/` overlay). Any manager that supports systemless `system` mounts will work. KSU-family managers are the primary target for this device.

**Target device:** Transsion XOS 16 on Android 16, kernel 6.12.x (Infinix / Tecno / itel) with `system_ext/framework/magellan_core.jar`. Not applicable to AOSP / HyperOS / OneUI without Magellan.

## Requirements

- XOS 16 on Android 16, kernel 6.12.x
- One of the root managers above installed and active with Android 16 support
- `magellan_core.jar` present at `/system_ext/framework/`
- Panel that actually supports 144Hz (check Settings > Display)

## How It Works

```
misc/module.prop                               → module metadata (id, version, description)
scripts/action.sh                              → whitelist updater (bulk-add installed apps)
bin/<abi>/whitelist_updater                    → native updater binary
webroot/                                       → module WebUI (whitelist editor in the manager)
system/system_ext/framework/magellan_core.jar  → patched jar (dex overlay)
system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml → package whitelist + modes
misc/system.prop                               → additional system props (optional)
```

Patch logic:

```java
// before
int d.F() { return 90; }
int d.s() { return 90; }

// after (in overlaid magellan_core.jar)
int d.F() { return 144; } // shade intercept
int d.s() { return 144; } // transition-animating
```

Config XML:

```xml
<!-- auto = idle, high = active, max = peak, touch = touch boost -->
<item package="com.termux" auto="60" high="90" max="144" touch="1" />
<item package="com.shopee.sg" auto="90" high="90" max="144" touch="0" />
```

> `max="144"` is the unlock key. Every package with `max="144"` can reach 144Hz when active.

## Customization

Edit `system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml` before flashing, or via overlay:

```sh
# Add your own package
su -c "nano /data/adb/modules/shade144/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml"
# add line:
# <item package="com.example.app" auto="60" high="90" max="144" touch="1"></item>
# then reboot
```

Tips:
- `touch="1"` - boost to 144Hz on touch, best for interactive apps
- `touch="0"` + `auto="90"` - 90Hz idle, more efficient for video/music apps

## Uninstall / Disable

Via manager: **Modules → Shade144 → Remove / Disable → Reboot**.

Manual:

```sh
su -c "rm -rf /data/adb/modules/shade144"
# or just disable
su -c "touch /data/adb/modules/shade144/disable"
reboot
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still 90Hz | Verify overlay: `ls -l /system_ext/framework/magellan_core.jar`. Check FPS overlay is enabled. |
| Bootloop | Enter manager safe mode (KSU: hold volume, Magisk: safe mode) → disable module → reboot |
| Refresh rate broken after update | Reflash latest zip, XOS updates often replace the jar |
| No effect in games | Games have an internal FPS limiter, display unlock alone is not enough |

Open an issue with: `magisk --version` / `ksu version`, `getprop ro.build.version`, `dumpsys display`.

## Development

```sh
# Clone
git clone https://github.com/<user>/shade144.git
cd shade144

# Edit jar: decompile -> patch d.F/d.s -> recompile
# or directly replace system/system_ext/framework/magellan_core.jar

# Edit config
nano system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml

# Test + build WebUI (Vue/Vite, dev mock for KSU icons)
make -C src test              # C++ whitelist updater unit tests
(cd webroot && npm install && npm run test && npm run check)
(cd webroot && npm run build)

# Pack flashable zip (root contains misc + system + scripts + webroot)
./scripts/release.sh shade144-v1.1.0.zip
# or let CI do it: push tag v1.1.0 -> Actions cross-compiles binaries,
# builds webroot, and uploads shade144-v1.1.0.zip to the release
```

## License

MIT - free to modify with attribution to the original author.

## Disclaimer

- Use at your own risk. The module modifies the display framework.
- No guarantee of stable 144Hz in all apps - depends on workload and thermals.
- Always back up the original `magellan_core.jar` before modification.

---

**Need help?** Open an [Issue](../../issues) or discuss in your device Telegram / XDA thread. Include `dmesg` and `logcat` for bug reports.
