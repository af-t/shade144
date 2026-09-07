import { beforeEach, describe, expect, it } from 'vitest';
import { getBridgeIcons, hasBridgeIcons, normalizeBridgeIcon } from './pkgIcons';

const B64 = 'QUJDREVG';

beforeEach(() => {
  delete globalThis.ksu;
});

describe('normalizeBridgeIcon', () => {
  it('prefixes raw base64 as png data URL', () => {
    expect(normalizeBridgeIcon(B64)).toBe(`data:image/png;base64,${B64}`);
  });

  it('passes through full data URLs untouched', () => {
    const url = `data:image/png;base64,${B64}`;
    expect(normalizeBridgeIcon(url)).toBe(url);
  });

  it('rejects empty and non-base64 payloads', () => {
    expect(normalizeBridgeIcon('')).toBeNull();
    expect(normalizeBridgeIcon(null)).toBeNull();
    expect(normalizeBridgeIcon('***nope***')).toBeNull();
  });
});

describe('hasBridgeIcons', () => {
  it('detects the KSUN bridge function', () => {
    expect(hasBridgeIcons()).toBe(false);
    globalThis.ksu = { getPackagesIcons: () => '[]' };
    expect(hasBridgeIcons()).toBe(true);
  });
});

describe('getBridgeIcons', () => {
  it('maps package names to data URLs', async () => {
    const bridgeFn = async (namesJson, size) => {
      expect(JSON.parse(namesJson)).toEqual(['com.a']);
      expect(size).toBe(96);
      return JSON.stringify([{ packageName: 'com.a', icon: B64 }]);
    };
    const map = await getBridgeIcons(['com.a'], 96, bridgeFn);
    expect(map.get('com.a')).toBe(`data:image/png;base64,${B64}`);
  });

  it('skips packages without icon bytes', async () => {
    const bridgeFn = async () => JSON.stringify([{ packageName: 'com.a', icon: '' }]);
    const map = await getBridgeIcons(['com.a'], 96, bridgeFn);
    expect(map.has('com.a')).toBe(false);
  });

  it('returns an empty map when the bridge throws or lies', async () => {
    const boom = async () => {
      throw new Error('no bridge');
    };
    expect((await getBridgeIcons(['com.a'], 96, boom)).size).toBe(0);
    const garbage = async () => 'not json{{{';
    expect((await getBridgeIcons(['com.a'], 96, garbage)).size).toBe(0);
  });

  it('uses the global ksu bridge by default, empty when absent', async () => {
    expect((await getBridgeIcons(['com.a'], 96)).size).toBe(0);
    globalThis.ksu = {
      getPackagesIcons: (_namesJson, size) => {
        expect(size).toBe(96);
        return JSON.stringify([{ packageName: 'com.a', icon: B64 }]);
      },
    };
    const map = await getBridgeIcons(['com.a'], 96);
    expect(map.get('com.a')).toBe(`data:image/png;base64,${B64}`);
  });
});
