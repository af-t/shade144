import { beforeEach, describe, expect, it } from 'vitest';
import { formatIconStats, recordIconSource, resetIconStats, snapshotIconStats } from './iconStats';

beforeEach(() => {
  resetIconStats();
});

describe('iconStats', () => {
  it('counts hits per source tier', () => {
    recordIconSource('bridge');
    recordIconSource('bridge');
    recordIconSource('disk');
    expect(snapshotIconStats()).toMatchObject({ bridge: 2, disk: 1, mem: 0, fetch: 0, live: 0 });
  });

  it('ignores unknown sources', () => {
    recordIconSource('nope');
    expect(snapshotIconStats()).toMatchObject({ bridge: 0, live: 0 });
  });

  it('formats a one-line summary', () => {
    recordIconSource('mem');
    recordIconSource('live');
    expect(formatIconStats()).toContain('mem 1');
    expect(formatIconStats()).toContain('live 1');
  });
});
