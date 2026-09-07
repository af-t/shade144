import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheDir,
  flushDiskWrites,
  iconFileName,
  iconPath,
  isDiskCached,
  primeDiskCache,
  queueDiskWrite,
  readDiskIcon,
  resetDiskCacheState,
  sanitizePkg,
  syncDiskCache,
} from './diskIconCache';

const MODDIR = '/data/adb/modules/shade144';

function makeFakeFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  const calls = [];
  const execFn = async (cmd) => {
    calls.push(cmd);
    const ls = cmd.match(/^ls -1 '([^']+)'/);
    if (ls) {
      const dir = ls[1];
      const names = [...files.keys()]
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => p.slice(dir.length + 1));
      return { errno: 0, stdout: names.join('\n'), stderr: '' };
    }
    const cat = cmd.match(/^base64 '([^']+)'/);
    if (cat) {
      const b64 = files.get(cat[1]);
      if (b64 === undefined) return { errno: 1, stdout: '', stderr: 'No such file' };
      return { errno: 0, stdout: `${b64.slice(0, 8)}\n${b64.slice(8)}`, stderr: '' };
    }
    const writes = [...cmd.matchAll(/printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > '([^']+)'/g)];
    if (writes.length > 0) {
      for (const [, b64, path] of writes) files.set(path, b64);
      return { errno: 0, stdout: '', stderr: '' };
    }
    if (cmd.startsWith('rm -f ')) {
      for (const [, p] of cmd.matchAll(/'([^']+)'/g)) files.delete(p);
      return { errno: 0, stdout: '', stderr: '' };
    }
    if (cmd.startsWith('mkdir -p ')) return { errno: 0, stdout: '', stderr: '' };
    return { errno: 1, stdout: '', stderr: `unexpected: ${cmd}` };
  };
  return { files, calls, execFn };
}

beforeEach(() => {
  resetDiskCacheState();
});

describe('icon file naming', () => {
  it('includes version in the file name', () => {
    expect(iconFileName('com.example.app', 123)).toBe('com.example.app@123.png');
  });

  it('omits version when unknown', () => {
    expect(iconFileName('com.example.app', 0)).toBe('com.example.app.png');
  });

  it('sanitizes hostile package names', () => {
    expect(sanitizePkg("../../x' y")).not.toMatch(/[/' ]/);
  });

  it('never escapes the cache dir', () => {
    const p = iconPath(MODDIR, '../../evil', 1);
    expect(p.startsWith(`${cacheDir(MODDIR)}/`)).toBe(true);
    expect(p.slice(cacheDir(MODDIR).length + 1)).not.toMatch(/[/]/);
  });
});

describe('primeDiskCache', () => {
  it('lists cached files with a single ls', async () => {
    const { calls, execFn } = makeFakeFs({
      [`${MODDIR}/.cache/icons/a@1.png`]: 'QUJD',
    });
    const set = await primeDiskCache(MODDIR, execFn);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`ls -1 '${MODDIR}/.cache/icons'`);
    expect(set.has('a@1.png')).toBe(true);
    expect(isDiskCached(MODDIR, 'a', 1)).toBe(true);
    expect(isDiskCached(MODDIR, 'b', 1)).toBe(false);
  });
});

describe('readDiskIcon', () => {
  it('returns a data URL and unwraps base64 newlines', async () => {
    const { execFn } = makeFakeFs({
      [`${MODDIR}/.cache/icons/com.a@9.png`]: 'QUJDREVG',
    });
    await primeDiskCache(MODDIR, execFn);
    const url = await readDiskIcon(MODDIR, 'com.a', 9, execFn);
    expect(url).toBe('data:image/png;base64,QUJDREVG');
  });

  it('skips exec when prime proved the file is absent', async () => {
    const { calls, execFn } = makeFakeFs();
    await primeDiskCache(MODDIR, execFn);
    const before = calls.length;
    expect(await readDiskIcon(MODDIR, 'com.missing', 1, execFn)).toBeNull();
    expect(calls.length).toBe(before);
  });

  it('returns null on read failure', async () => {
    const { execFn } = makeFakeFs();
    expect(await readDiskIcon(MODDIR, 'com.missing', 1, execFn)).toBeNull();
  });

  it('rejects non-base64 garbage', async () => {
    const execFn = async () => ({ errno: 0, stdout: '*** not base64 ***', stderr: '' });
    expect(await readDiskIcon(MODDIR, 'com.a', 1, execFn)).toBeNull();
  });
});

describe('queueDiskWrite + flushDiskWrites', () => {
  it('batches writes, 7 entries in 2 shell calls', async () => {
    const { calls, execFn, files } = makeFakeFs();
    for (let i = 0; i < 7; i++) {
      queueDiskWrite(MODDIR, `com.app${i}`, 2, 'data:image/png;base64,QUJD', execFn);
    }
    const written = await flushDiskWrites();
    expect(written).toBe(7);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('mkdir -p');
    expect(calls[0]).toContain('base64 -d >');
    expect(files.size).toBe(7);
  });

  it('ignores non-png data URLs', async () => {
    const { calls, execFn } = makeFakeFs();
    queueDiskWrite(MODDIR, 'com.a', 1, 'not-a-data-url', execFn);
    expect(await flushDiskWrites()).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('marks flushed files as present', async () => {
    const { execFn } = makeFakeFs();
    queueDiskWrite(MODDIR, 'com.a', 5, 'data:image/png;base64,QUJD', execFn);
    await flushDiskWrites();
    await primeDiskCache(MODDIR, execFn);
    expect(isDiskCached(MODDIR, 'com.a', 5)).toBe(true);
  });
});

describe('syncDiskCache', () => {
  it('removes only stale version files', async () => {
    const { execFn, files } = makeFakeFs({
      [`${MODDIR}/.cache/icons/com.keep@3.png`]: 'QUJD',
      [`${MODDIR}/.cache/icons/com.old@1.png`]: 'QUJD',
      [`${MODDIR}/.cache/icons/com.old@2.png`]: 'QUJD',
    });
    const removed = await syncDiskCache(MODDIR, new Set(['com.keep@3.png']), execFn);
    expect(removed).toBe(2);
    expect([...files.keys()]).toEqual([`${MODDIR}/.cache/icons/com.keep@3.png`]);
  });

  it('drops removed files from the presence set', async () => {
    const { execFn } = makeFakeFs({
      [`${MODDIR}/.cache/icons/com.old@1.png`]: 'QUJD',
    });
    await primeDiskCache(MODDIR, execFn);
    expect(isDiskCached(MODDIR, 'com.old', 1)).toBe(true);
    await syncDiskCache(MODDIR, new Set(), execFn);
    expect(isDiskCached(MODDIR, 'com.old', 1)).toBe(false);
  });

  it('drops presence on read miss', async () => {
    const { execFn } = makeFakeFs({
      [`${MODDIR}/.cache/icons/com.ghost@7.png`]: 'QUJD',
    });
    await primeDiskCache(MODDIR, execFn);
    expect(isDiskCached(MODDIR, 'com.ghost', 7)).toBe(true);
    const failing = async () => ({ errno: 1, stdout: '', stderr: 'gone' });
    expect(await readDiskIcon(MODDIR, 'com.ghost', 7, failing)).toBeNull();
    expect(isDiskCached(MODDIR, 'com.ghost', 7)).toBe(false);
  });
});
