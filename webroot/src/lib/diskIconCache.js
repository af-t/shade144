export const ICON_CACHE_SUBDIR = '.cache/icons';
const WRITE_BATCH_SIZE = 6;

export function sanitizePkg(pkg) {
  return String(pkg || '').replace(/[^A-Za-z0-9_.]/g, '_');
}

export function iconFileName(pkg, version) {
  const safe = sanitizePkg(pkg) || 'unknown';
  const v = Number(version) || 0;
  return v > 0 ? `${safe}@${v}.png` : `${safe}.png`;
}

export function cacheDir(moduleDir) {
  return `${moduleDir}/${ICON_CACHE_SUBDIR}`;
}

export function iconPath(moduleDir, pkg, version) {
  return `${cacheDir(moduleDir)}/${iconFileName(pkg, version)}`;
}

function sq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

const B64_RE = /^[A-Za-z0-9+/=]+$/;

let primedDir = null;
let present = new Set();

export function resetDiskCacheState() {
  primedDir = null;
  present = new Set();
  pending.clear();
}

export async function primeDiskCache(moduleDir, execFn) {
  const dir = cacheDir(moduleDir);
  present = new Set();
  primedDir = moduleDir;
  try {
    const { errno, stdout } = await execFn(`ls -1 ${sq(dir)} 2>/dev/null`);
    if (errno !== 0 || !stdout) return present;
    for (const line of stdout.split('\n')) {
      const name = line.trim();
      if (name && !name.includes('/')) present.add(name);
    }
  } catch {}
  return present;
}

export function isDiskCached(moduleDir, pkg, version) {
  if (primedDir !== moduleDir) return undefined;
  return present.has(iconFileName(pkg, version));
}

export async function readDiskIcon(moduleDir, pkg, version, execFn) {
  if (isDiskCached(moduleDir, pkg, version) === false) return null;
  const dropPresence = () => {
    if (primedDir === moduleDir) present.delete(iconFileName(pkg, version));
  };
  try {
    const { errno, stdout } = await execFn(
      `base64 ${sq(iconPath(moduleDir, pkg, version))} 2>/dev/null | tr -d '\\n'`,
    );
    if (errno !== 0 || !stdout) {
      dropPresence();
      return null;
    }
    const b64 = stdout.replace(/\s+/g, '');
    if (!b64 || !B64_RE.test(b64)) {
      dropPresence();
      return null;
    }
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

const pending = new Map();

export function queueDiskWrite(moduleDir, pkg, version, dataUrl, execFn) {
  if (!moduleDir || typeof execFn !== 'function') return;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return;
  const b64 = dataUrl.slice('data:image/png;base64,'.length).replace(/\s+/g, '');
  if (!b64 || !B64_RE.test(b64)) return;
  const path = iconPath(moduleDir, pkg, version);
  pending.set(path, { moduleDir, b64, path, execFn });
}

export async function flushDiskWrites() {
  let written = 0;
  const items = [...pending.values()];
  pending.clear();
  for (let i = 0; i < items.length; i += WRITE_BATCH_SIZE) {
    const batch = items.slice(i, i + WRITE_BATCH_SIZE);
    const dir = cacheDir(batch[0].moduleDir);
    const parts = [`mkdir -p ${sq(dir)}`];
    for (const item of batch) {
      parts.push(`printf '%s' ${sq(item.b64)} | base64 -d > ${sq(item.path)}`);
    }
    try {
      const { errno } = await batch[0].execFn(parts.join(' && '));
      if (errno !== 0) {
        for (const item of batch) pending.set(item.path, item);
        break;
      }
      written += batch.length;
      for (const item of batch) {
        if (primedDir === item.moduleDir) present.add(item.path.slice(dir.length + 1));
      }
    } catch {
      for (const item of batch) pending.set(item.path, item);
      break;
    }
  }
  return written;
}

export async function syncDiskCache(moduleDir, keepFileNames, execFn) {
  try {
    const dir = cacheDir(moduleDir);
    const { errno, stdout } = await execFn(`ls -1 ${sq(dir)} 2>/dev/null`);
    if (errno !== 0 || !stdout) return 0;
    const stale = [];
    for (const line of stdout.split('\n')) {
      const name = line.trim();
      if (!name || name.includes('/') || keepFileNames.has(name)) continue;
      stale.push(`${dir}/${name}`);
    }
    let removed = 0;
    for (let i = 0; i < stale.length; i += WRITE_BATCH_SIZE * 4) {
      const batch = stale.slice(i, i + WRITE_BATCH_SIZE * 4);
      const { errno: rmErrno } = await execFn(`rm -f ${batch.map(sq).join(' ')}`);
      if (rmErrno !== 0) break;
      removed += batch.length;
      if (primedDir === moduleDir) {
        for (const p of batch) present.delete(p.slice(dir.length + 1));
      }
    }
    return removed;
  } catch {
    return 0;
  }
}
