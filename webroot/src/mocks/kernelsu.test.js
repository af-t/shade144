import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheAllPackageIcons,
  enableEdgeToEdge,
  exec,
  exit,
  fullScreen,
  getPackagesIcons,
  getPackagesInfo,
  listPackages,
  moduleInfo,
  reset,
  spawn,
  toast,
} from './kernelsu';
import { DEFAULT_XML, PACKAGES } from './packages';

const MODULE_PATH =
  '/data/adb/modules/shade144/system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml';

beforeEach(() => {
  reset();
});

describe('mock kernelsu API surface', () => {
  it('exposes every function the real package does', () => {
    expect(typeof exec).toBe('function');
    expect(typeof spawn).toBe('function');
    expect(typeof fullScreen).toBe('function');
    expect(typeof enableEdgeToEdge).toBe('function');
    expect(typeof moduleInfo).toBe('function');
    expect(typeof listPackages).toBe('function');
    expect(typeof getPackagesInfo).toBe('function');
    expect(typeof toast).toBe('function');
    expect(typeof exit).toBe('function');
  });
});

describe('exec', () => {
  it('returns the default config for cat', async () => {
    const res = await exec(`cat ${MODULE_PATH}`);
    expect(res.errno).toBe(0);
    expect(res.stdout).toContain('com.android.settings');
    expect(res.stdout).toContain('com.tencent.mm');
  });

  it('cries on unknown cat targets', async () => {
    const res = await exec('cat /no/such/file');
    expect(res.errno).toBe(1);
    expect(res.stderr).toContain('No such file');
  });

  it('persists base64 writes and reflects them on next read', async () => {
    const patched = DEFAULT_XML.replace(
      '<item package="com.tencent.mm"',
      '<item package="com.tencent.mm" auto="120" high="120" max="144" touch="1" app_request="1"',
    );
    const b64 = btoa(unescape(encodeURIComponent(patched)));
    const w = await exec(`echo '${b64}' | base64 -d > ${MODULE_PATH}`);
    expect(w.errno).toBe(0);
    const r = await exec(`cat ${MODULE_PATH}`);
    expect(r.stdout).toBe(patched);
  });

  it('detects KernelSU home dir', async () => {
    const res = await exec('ls /data/adb');
    expect(res.stdout).toContain('ksu');
  });

  it('round-trips icon files under the module disk cache', async () => {
    const dir = '/data/adb/modules/shade144/.cache/icons';
    const w = await exec(
      `mkdir -p '${dir}' && printf '%s' 'QUJD' | base64 -d > '${dir}/com.a@1.png'`,
    );
    expect(w.errno).toBe(0);
    const ls = await exec(`ls -1 '${dir}' 2>/dev/null`);
    expect(ls.stdout).toContain('com.a@1.png');
    const r = await exec(`base64 '${dir}/com.a@1.png' 2>/dev/null | tr -d '\\n'`);
    expect(r.errno).toBe(0);
    expect(r.stdout).toBe('QUJD');
    const rm = await exec(`rm -f '${dir}/com.a@1.png'`);
    expect(rm.errno).toBe(0);
    const miss = await exec(`base64 '${dir}/com.a@1.png' 2>/dev/null | tr -d '\\n'`);
    expect(miss.errno).toBe(1);
  });
});

describe('listPackages', () => {
  it('returns all package names as strings', () => {
    const all = listPackages('all');
    expect(all).toHaveLength(PACKAGES.length);
    expect(all.every((n) => typeof n === 'string')).toBe(true);
  });

  it('filters user and system', () => {
    expect(listPackages('user').length).toBeLessThan(listPackages('all').length);
    expect(listPackages('system').length).toBeLessThan(listPackages('all').length);
  });
});

describe('getPackagesInfo', () => {
  it('returns labels and flags for known packages', () => {
    const info = getPackagesInfo(['com.tencent.mm', 'com.android.settings']);
    expect(info[0].appLabel).toBe('WeChat');
    expect(info[0].isSystem).toBe(false);
    expect(info[1].appLabel).toBe('Settings');
    expect(info[1].isSystem).toBe(true);
  });

  it('degrades gracefully for unknown packages', () => {
    const info = getPackagesInfo(['com.unknown.pkg']);
    expect(info[0].packageName).toBe('com.unknown.pkg');
    expect(info[0].appLabel).toBe('');
  });
});

describe('getPackagesIcons', () => {
  it('returns data urls for known packages, empty for unknown', () => {
    expect(typeof cacheAllPackageIcons(96)).toBe('undefined');
    const arr = JSON.parse(
      getPackagesIcons(JSON.stringify(['com.tencent.mm', 'com.unknown.pkg']), 96),
    );
    expect(arr[0].packageName).toBe('com.tencent.mm');
    expect(arr[0].icon.startsWith('data:image')).toBe(true);
    expect(arr[1].icon).toBe('');
  });
});

describe('icon fallback', () => {
  it('replaces failed ksu://icon images with an svg data uri', () => {
    const img = document.createElement('img');
    img.setAttribute('data-label', 'WeChat');
    img.src = 'ksu://icon/com.tencent.mm';
    document.body.appendChild(img);
    img.dispatchEvent(new Event('error'));
    img.remove();
    expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
  });
});

describe('window shim', () => {
  it('registers a debug handle', () => {
    expect(window.__ksuMock).toBeDefined();
    expect(typeof window.__ksuMock.reset).toBe('function');
  });
});
