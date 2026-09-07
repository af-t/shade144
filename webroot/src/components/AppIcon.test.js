import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppIcon from './AppIcon.vue';

const mem = vi.hoisted(() => ({
  getCachedIcon: vi.fn(),
  setCachedIcon: vi.fn(),
  extractDataUrl: vi.fn(),
  fetchIconDataUrl: vi.fn(),
  peekMemoryIcon: vi.fn(),
  cacheKey: vi.fn((pkg, version) => (version ? `${pkg}@${version}` : String(pkg))),
}));
const disk = vi.hoisted(() => ({
  readDiskIcon: vi.fn(),
  queueDiskWrite: vi.fn(),
}));
const bridge = vi.hoisted(() => ({
  getBridgeIcons: vi.fn(),
}));
const ksu = vi.hoisted(() => ({ exec: vi.fn() }));

vi.mock('../lib/iconCache', () => mem);
vi.mock('../lib/diskIconCache', () => disk);
vi.mock('../lib/pkgIcons', () => bridge);
vi.mock('kernelsu', () => ksu);

const MODDIR = '/data/adb/modules/shade144';
const CACHED = 'data:image/png;base64,Q0FDSEVE';

function mountIcon(props = {}) {
  return mount(AppIcon, {
    props: {
      pkg: 'com.example.app',
      label: 'Example',
      src: 'ksu://icon/com.example.app',
      version: 42,
      moduleDir: MODDIR,
      ...props,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mem.getCachedIcon.mockResolvedValue(null);
  mem.extractDataUrl.mockReturnValue(null);
  mem.fetchIconDataUrl.mockResolvedValue(null);
  mem.peekMemoryIcon.mockReturnValue(null);
  disk.readDiskIcon.mockResolvedValue(null);
  bridge.getBridgeIcons.mockResolvedValue(new Map());
});

describe('AppIcon', () => {
  it('shows a placeholder until the cache resolves', async () => {
    mem.getCachedIcon.mockReturnValue(new Promise(() => {}));
    const wrapper = mountIcon();
    expect(wrapper.find('.app-icon-placeholder').exists()).toBe(true);
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('serves memory cache instantly without touching disk or exec', async () => {
    mem.getCachedIcon.mockResolvedValue(CACHED);
    const wrapper = mountIcon();
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    expect(disk.readDiskIcon).not.toHaveBeenCalled();
    expect(ksu.exec).not.toHaveBeenCalled();
  });

  it('falls back to $MODDIR/.cache disk tier and repopulates memory', async () => {
    disk.readDiskIcon.mockResolvedValue(CACHED);
    const wrapper = mountIcon();
    await flushPromises();
    expect(disk.readDiskIcon).toHaveBeenCalledWith(MODDIR, 'com.example.app', 42, ksu.exec);
    expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    expect(mem.setCachedIcon).toHaveBeenCalledWith('com.example.app@42', CACHED);
  });

  it('lazy-loads the live icon only after intersection (top-app-first)', async () => {
    let observerCb = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe, disconnect };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    try {
      const wrapper = mountIcon();
      await flushPromises();
      expect(observe).toHaveBeenCalled();
      expect(wrapper.find('img').exists()).toBe(false);
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(wrapper.get('img').attributes('src')).toBe('ksu://icon/com.example.app');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('loads live immediately when IntersectionObserver is unavailable', async () => {
    const wrapper = mountIcon();
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe('ksu://icon/com.example.app');
  });

  it('persists a freshly loaded live icon to memory and disk queue', async () => {
    mem.extractDataUrl.mockReturnValue(CACHED);
    const wrapper = mountIcon({ eager: true });
    await flushPromises();
    await wrapper.get('img').trigger('load');
    expect(mem.setCachedIcon).toHaveBeenCalledWith('com.example.app@42', CACHED);
    expect(disk.queueDiskWrite).toHaveBeenCalledWith(
      MODDIR,
      'com.example.app',
      42,
      CACHED,
      ksu.exec,
    );
  });

  it('shows the fallback glyph when the live icon fails', async () => {
    const wrapper = mountIcon({ eager: true });
    await flushPromises();
    await wrapper.get('img').trigger('error');
    expect(wrapper.find('.app-icon-fallback.visible').exists()).toBe(true);
  });

  it('retries live once when cached bytes fail to decode, then falls back', async () => {
    mem.getCachedIcon.mockResolvedValue(CACHED);
    const wrapper = mountIcon({ eager: true });
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    await wrapper.get('img').trigger('error');
    expect(wrapper.get('img').attributes('src')).toBe('ksu://icon/com.example.app');
    expect(wrapper.find('.app-icon-fallback.visible').exists()).toBe(false);
    await wrapper.get('img').trigger('error');
    expect(wrapper.find('.app-icon-fallback.visible').exists()).toBe(true);
  });

  it('fetches live bytes on intersect and caches them to memory+disk', async () => {
    let observerCb = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe, disconnect };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    try {
      mem.fetchIconDataUrl.mockResolvedValue(CACHED);
      const wrapper = mountIcon();
      await flushPromises();
      expect(mem.fetchIconDataUrl).not.toHaveBeenCalled();
      expect(wrapper.find('img').exists()).toBe(false);
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(mem.fetchIconDataUrl).toHaveBeenCalledWith(
        'ksu://icon/com.example.app',
        expect.anything(),
        expect.anything(),
      );
      expect(wrapper.get('img').attributes('src')).toBe(CACHED);
      expect(mem.setCachedIcon).toHaveBeenCalledWith('com.example.app@42', CACHED);
      expect(disk.queueDiskWrite).toHaveBeenCalledWith(
        MODDIR,
        'com.example.app',
        42,
        CACHED,
        ksu.exec,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('falls back to a direct ksu img when fetch is not intercepted', async () => {
    mem.fetchIconDataUrl.mockResolvedValue(null);
    const wrapper = mountIcon({ eager: true });
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe('ksu://icon/com.example.app');
  });

  it('prefers bridge bytes over fetch and persists them to disk queue', async () => {
    bridge.getBridgeIcons.mockResolvedValue(new Map([['com.example.app', CACHED]]));
    const wrapper = mountIcon({ eager: true });
    await flushPromises();
    expect(bridge.getBridgeIcons).toHaveBeenCalledWith(['com.example.app'], 96);
    expect(mem.fetchIconDataUrl).not.toHaveBeenCalled();
    expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    expect(mem.setCachedIcon).toHaveBeenCalledWith('com.example.app@42', CACHED);
    expect(disk.queueDiskWrite).toHaveBeenCalledWith(
      MODDIR,
      'com.example.app',
      42,
      CACHED,
      ksu.exec,
    );
  });

  it('asks the bridge lazily, only after intersection', async () => {
    let observerCb = null;
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    try {
      const wrapper = mountIcon();
      await flushPromises();
      expect(bridge.getBridgeIcons).not.toHaveBeenCalled();
      expect(wrapper.find('img').exists()).toBe(false);
      bridge.getBridgeIcons.mockResolvedValue(new Map([['com.example.app', CACHED]]));
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(bridge.getBridgeIcons).toHaveBeenCalledWith(['com.example.app'], 96);
      expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('unloads the bitmap when scrolled far offscreen, reloads on re-enter', async () => {
    let observerCb = null;
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.useFakeTimers();
    try {
      bridge.getBridgeIcons.mockResolvedValue(new Map([['com.example.app', CACHED]]));
      const wrapper = mountIcon();
      await flushPromises();
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      observerCb([{ isIntersecting: false }]);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      vi.advanceTimersByTime(999);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      vi.advanceTimersByTime(1);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.find('.app-icon-placeholder').exists()).toBe(true);
      mem.getCachedIcon.mockResolvedValue(CACHED);
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(wrapper.get('img').attributes('src')).toBe(CACHED);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('quick direction reversal never unloads (no flicker)', async () => {
    let observerCb = null;
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.useFakeTimers();
    try {
      bridge.getBridgeIcons.mockResolvedValue(new Map([['com.example.app', CACHED]]));
      const wrapper = mountIcon();
      await flushPromises();
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      const memCalls = mem.getCachedIcon.mock.calls.length;
      observerCb([{ isIntersecting: false }]);
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      expect(wrapper.find('.app-icon-placeholder').exists()).toBe(false);
      expect(mem.getCachedIcon.mock.calls.length).toBe(memCalls);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('re-enters from memory synchronously, without a placeholder flash', async () => {
    let observerCb = null;
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.useFakeTimers();
    try {
      mem.getCachedIcon.mockResolvedValue(CACHED);
      const wrapper = mountIcon();
      await flushPromises();
      observerCb([{ isIntersecting: true }]);
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      observerCb([{ isIntersecting: false }]);
      vi.advanceTimersByTime(1001);
      await flushPromises();
      expect(wrapper.find('.app-icon-placeholder').exists()).toBe(true);
      const asyncCalls = mem.getCachedIcon.mock.calls.length;
      mem.peekMemoryIcon.mockReturnValue(CACHED);
      observerCb([{ isIntersecting: true }]);
      await wrapper.vm.$nextTick();
      expect(wrapper.get('img').attributes('src')).toBe(CACHED);
      expect(mem.getCachedIcon.mock.calls.length).toBe(asyncCalls);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('never unloads eager icons (editor sheet)', async () => {
    let observerCb = null;
    function FakeObserver(cb) {
      observerCb = cb;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    try {
      bridge.getBridgeIcons.mockResolvedValue(new Map([['com.example.app', CACHED]]));
      const wrapper = mountIcon({ eager: true });
      await flushPromises();
      expect(wrapper.find('img').exists()).toBe(true);
      observerCb?.([{ isIntersecting: false }]);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('img').exists()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
