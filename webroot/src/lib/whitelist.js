export function diffPackages(items, installed) {
  const installedSet = new Set(installed);
  const byPkg = new Map(items.map((i) => [i.package, i]));

  const toAdd = installed
    .filter((pkg) => !byPkg.has(pkg))
    .map((pkg) => applyDefaults({ package: pkg }));

  const toRemove = items.filter((i) => !installedSet.has(i.package));

  const stable = items.filter((i) => installedSet.has(i.package)).length;

  return { toAdd, toRemove, stable, installed: toRemove };
}

export function applyDefaults(item) {
  return {
    auto: '90',
    high: '90',
    max: '144',
    touch: '1',
    app_request: '0',
    ...item,
  };
}
