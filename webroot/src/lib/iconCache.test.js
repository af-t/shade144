import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheKey,
  clearMemoryCache,
  extractDataUrl,
  fetchIconDataUrl,
  getCachedIcon,
  peekMemoryIcon,
  setCachedIcon,
} from './iconCache';

beforeEach(() => {
  clearMemoryCache();
});

describe('cacheKey', () => {
  it('pins the key to the app version', () => {
    expect(cacheKey('com.a', 10)).toBe('com.a@10');
    expect(cacheKey('com.a', 11)).not.toBe(cacheKey('com.a', 10));
  });

  it('falls back to package only without version', () => {
    expect(cacheKey('com.a', 0)).toBe('com.a');
  });
});

describe('memory tier', () => {
  it('round-trips a data URL without indexedDB', async () => {
    await setCachedIcon('com.a@1', 'data:image/png;base64,QUJD');
    expect(await getCachedIcon('com.a@1')).toBe('data:image/png;base64,QUJD');
  });

  it('misses unknown keys', async () => {
    expect(await getCachedIcon('com.unknown@1')).toBeNull();
  });

  it('ignores non-image payloads', async () => {
    await setCachedIcon('com.a@1', 'garbage');
    expect(await getCachedIcon('com.a@1')).toBeNull();
  });

  it('evicts the oldest entry past the memory cap', async () => {
    for (let i = 0; i < 220; i++) {
      await setCachedIcon(`com.evict@${i}`, 'data:image/png;base64,QUJD');
    }
    expect(await getCachedIcon('com.evict@0')).toBeNull();
    expect(await getCachedIcon('com.evict@219')).toBe('data:image/png;base64,QUJD');
  });

  it('peeks memory synchronously without touching indexedDB', async () => {
    expect(peekMemoryIcon('com.a@1')).toBeNull();
    await setCachedIcon('com.a@1', 'data:image/png;base64,QUJD');
    expect(peekMemoryIcon('com.a@1')).toBe('data:image/png;base64,QUJD');
  });
});

describe('extractDataUrl', () => {
  it('returns null when the image has no pixels yet', () => {
    expect(extractDataUrl(null)).toBeNull();
    expect(extractDataUrl({ naturalWidth: 0 })).toBeNull();
  });
});

describe('fetchIconDataUrl', () => {
  const png = () => new Blob(['fakepng'], { type: 'image/png' });
  const okFetch = (blob) => async () => ({ ok: true, blob: async () => blob });

  it('resolves icon bytes to a data URL without canvas', async () => {
    const url = await fetchIconDataUrl('ksu://icon/com.a', okFetch(png()));
    expect(url?.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('returns null when fetch rejects', async () => {
    const boom = async () => {
      throw new Error('net down');
    };
    expect(await fetchIconDataUrl('ksu://icon/com.a', boom)).toBeNull();
  });

  it('returns null on non-ok responses', async () => {
    const bad = async () => ({ ok: false, blob: async () => png() });
    expect(await fetchIconDataUrl('ksu://icon/com.a', bad)).toBeNull();
  });

  it('returns null for non-image blobs', async () => {
    const text = new Blob(['hi'], { type: 'text/plain' });
    expect(await fetchIconDataUrl('ksu://icon/com.a', okFetch(text))).toBeNull();
  });

  it('returns null for empty or oversize blobs', async () => {
    const empty = new Blob([], { type: 'image/png' });
    expect(await fetchIconDataUrl('ksu://icon/com.a', okFetch(empty))).toBeNull();
    const big = new Blob(['x'], { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 4 * 1024 * 1024 });
    expect(await fetchIconDataUrl('ksu://icon/com.a', okFetch(big))).toBeNull();
  });

  it('skips fetch when already aborted', async () => {
    const fetchFn = async () => {
      throw new Error('must not be called');
    };
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await fetchIconDataUrl('ksu://icon/com.a', fetchFn, { signal: ctrl.signal })).toBeNull();
  });

  it('times out a hanging fetch', async () => {
    const hanging = (_url, init = {}) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const t0 = Date.now();
    expect(await fetchIconDataUrl('ksu://icon/com.a', hanging, { timeoutMs: 20 })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
