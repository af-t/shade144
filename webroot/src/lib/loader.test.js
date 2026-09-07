import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  exec: vi.fn(),
  listPackages: vi.fn(),
  getPackagesInfo: vi.fn(),
  moduleInfo: vi.fn(),
}));

vi.mock('kernelsu', () => mock);

const { exec, listPackages, getPackagesInfo, moduleInfo } = mock;

import {
  getModuleDir,
  installedPackages,
  loadManager,
  readConfig,
  resolveModuleDir,
  writeConfig,
} from './loader';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<refresh_rate_config version="1">
    <WHITELIST>
        <item package="com.apple" auto="90" high="90" max="144" touch="1" app_request="0"></item>
    </WHITELIST>
</refresh_rate_config>`;

const REL_PATH = 'system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveModuleDir', () => {
  it('uses given dir when present', () => {
    expect(resolveModuleDir('/data/adb/modules/shade144')).toBe('/data/adb/modules/shade144');
  });

  it('falls back to default dir when empty', () => {
    expect(resolveModuleDir('')).toBe('/data/adb/modules/shade144');
    expect(resolveModuleDir(undefined)).toBe('/data/adb/modules/shade144');
  });
});

describe('getModuleDir', () => {
  it('reads moduleDir from manager api', () => {
    moduleInfo.mockReturnValue(
      JSON.stringify({ id: 'shade144', moduleDir: '/data/adb/modules/shade144' }),
    );
    expect(getModuleDir()).toBe('/data/adb/modules/shade144');
  });

  it('falls back when moduleInfo is malformed', () => {
    moduleInfo.mockReturnValue('not json');
    expect(getModuleDir()).toBe('/data/adb/modules/shade144');
  });
});

describe('loadManager', () => {
  it('detects KernelSU directory', async () => {
    exec.mockResolvedValue({ errno: 0, stdout: 'busybox\nksu\nmodules\n', stderr: '' });
    const m = await loadManager();
    expect(m.ksu).toBe(true);
    expect(m.ksun).toBe(false);
  });

  it('detects KernelSU-Next directory', async () => {
    exec.mockResolvedValue({ errno: 0, stdout: 'busybox\nksun\nmodules\n', stderr: '' });
    const m = await loadManager();
    expect(m.ksun).toBe(true);
  });
});

describe('installedPackages', () => {
  it('returns packages with labels', async () => {
    listPackages.mockReturnValue(['com.apple', 'com.banana']);
    getPackagesInfo.mockReturnValue([
      { packageName: 'com.apple', appLabel: 'Apple', isSystem: false, uid: 1000 },
      { packageName: 'com.banana', appLabel: 'Banana', isSystem: true, uid: 2000 },
    ]);
    const pkgs = await installedPackages();
    expect(pkgs).toHaveLength(2);
    expect(pkgs[0]).toMatchObject({ package: 'com.apple', label: 'Apple', isSystem: false });
  });

  it('falls back to raw name when label missing', async () => {
    listPackages.mockReturnValue(['com.apple']);
    getPackagesInfo.mockReturnValue([]);
    const pkgs = await installedPackages();
    expect(pkgs[0].label).toBe('com.apple');
  });
});

describe('readConfig', () => {
  it('reads module xml and parses items', async () => {
    exec.mockResolvedValue({ errno: 0, stdout: XML, stderr: '' });
    const cfg = await readConfig('/data/adb/modules/shade144');
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0].package).toBe('com.apple');
    expect(exec).toHaveBeenCalledWith(`cat /data/adb/modules/shade144/${REL_PATH}`);
  });

  it('throws on failed read', async () => {
    exec.mockResolvedValue({ errno: 1, stdout: '', stderr: 'no such file' });
    await expect(readConfig('/data/adb/modules/shade144')).rejects.toThrow('no such file');
  });

  it('returns empty config when file missing but no stderr', async () => {
    exec.mockResolvedValue({ errno: 1, stdout: '', stderr: '' });
    const cfg = await readConfig('/data/adb/modules/shade144');
    expect(cfg.items).toHaveLength(0);
  });
});

describe('writeConfig', () => {
  it('writes xml to module path via shell', async () => {
    exec.mockResolvedValue({ errno: 0, stdout: '', stderr: '' });
    await writeConfig('/data/adb/modules/shade144', XML);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec.mock.calls[0][0]).toContain('base64 -d > ');
    expect(exec.mock.calls[0][0]).toContain(REL_PATH);
  });
});
