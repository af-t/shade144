const SOURCES = ['bridge', 'disk', 'mem', 'fetch', 'live'];

const counts = new Map(SOURCES.map((s) => [s, 0]));

export function recordIconSource(source) {
  if (!counts.has(source)) return;
  counts.set(source, counts.get(source) + 1);
}

export function snapshotIconStats() {
  return Object.fromEntries(counts);
}

export function formatIconStats() {
  return SOURCES.map((s) => `${s} ${counts.get(s)}`).join(' · ');
}

export function resetIconStats() {
  for (const s of SOURCES) counts.set(s, 0);
}
