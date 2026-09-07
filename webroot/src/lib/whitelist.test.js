import { describe, expect, it } from 'vitest';
import { applyDefaults, diffPackages } from './whitelist';

const APPLE = {
  package: 'com.apple',
  auto: '90',
  high: '90',
  max: '144',
  touch: '1',
  app_request: '0',
};
const BANANA = {
  package: 'com.banana',
  auto: '60',
  high: '90',
  max: '144',
  touch: '1',
  app_request: '1',
};

describe('diffPackages', () => {
  it('adds installed packages not in config', () => {
    const res = diffPackages([APPLE], ['com.newapp', 'com.apple']);
    expect(res.toAdd.map((i) => i.package)).toEqual(['com.newapp']);
  });

  it('drops config packages no longer installed', () => {
    const res = diffPackages([APPLE, BANANA], ['com.apple']);
    expect(res.toRemove.map((i) => i.package)).toEqual(['com.banana']);
  });

  it('ids both additions and removals at once', () => {
    const res = diffPackages([APPLE], ['com.newapp']);
    expect(res.toAdd.map((i) => i.package)).toEqual(['com.newapp']);
    expect(res.toRemove.map((i) => i.package)).toEqual(['com.apple']);
  });

  it('reports unchanged and installed count', () => {
    const res = diffPackages([APPLE, BANANA], ['com.apple', 'com.banana']);
    expect(res.installed).toHaveLength(0);
    expect(res.stable).toBe(2);
  });

  it('empty config adds everything installed', () => {
    const res = diffPackages([], ['com.a', 'com.b']);
    expect(res.toAdd).toHaveLength(2);
  });
});

describe('applyDefaults', () => {
  it('fills missing keys with defaults', () => {
    const item = applyDefaults({ package: 'com.x' });
    expect(item).toEqual({
      package: 'com.x',
      auto: '90',
      high: '90',
      max: '144',
      touch: '1',
      app_request: '0',
    });
  });

  it('keeps existing values', () => {
    const item = applyDefaults({ package: 'com.x', auto: '120', touch: '0' });
    expect(item.auto).toBe('120');
    expect(item.touch).toBe('0');
  });
});
