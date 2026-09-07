import { CONFIG_MARKER, DEFAULT_XML, PACKAGES, STORAGE_KEY } from './packages';

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const persist = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

const store = stored();

const disk = new Map();

export function reset() {
  for (const k of Object.keys(store)) delete store[k];
  disk.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function exec(command) {
  return new Promise((resolve) => {
    const trimmed = command.trim();
    const cat = trimmed.match(/^cat (.+)$/);
    if (cat) {
      const path = cat[1];
      if (path.includes(CONFIG_MARKER)) {
        const xml = store[path] ?? DEFAULT_XML;
        resolve({ errno: 0, stdout: xml, stderr: '' });
        return;
      }
      resolve({ errno: 1, stdout: '', stderr: `cat: ${path}: No such file or directory` });
      return;
    }
    const write = trimmed.match(/^echo '([^']+)' \| base64 -d > (.+)$/);
    if (write) {
      try {
        const xml = decodeURIComponent(escape(atob(write[1])));
        store[write[2]] = xml;
        persist(store);
        resolve({ errno: 0, stdout: '', stderr: '' });
        return;
      } catch {
        resolve({ errno: 1, stdout: '', stderr: 'base64: invalid input' });
        return;
      }
    }
    if (trimmed === 'ls /data/adb') {
      resolve({ errno: 0, stdout: 'ksu\nmodules\nbusybox\n', stderr: '' });
      return;
    }
    const ls1 = trimmed.match(/^ls -1 '([^']+)'/);
    if (ls1) {
      const dir = ls1[1];
      const names = [...disk.keys()]
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => p.slice(dir.length + 1));
      resolve({ errno: 0, stdout: names.join('\n'), stderr: '' });
      return;
    }
    const b64read = trimmed.match(/^base64 '([^']+)'/);
    if (b64read) {
      const body = disk.get(b64read[1]);
      if (body === undefined) {
        resolve({ errno: 1, stdout: '', stderr: `base64: ${b64read[1]}: No such file` });
        return;
      }
      resolve({ errno: 0, stdout: body, stderr: '' });
      return;
    }
    if (trimmed.includes("printf '%s'") && trimmed.includes('base64 -d >')) {
      for (const m of trimmed.matchAll(
        /printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > '([^']+)'/g,
      )) {
        disk.set(m[2], m[1]);
      }
      resolve({ errno: 0, stdout: '', stderr: '' });
      return;
    }
    if (trimmed.startsWith('rm -f ')) {
      for (const m of trimmed.matchAll(/'([^']+)'/g)) disk.delete(m[1]);
      resolve({ errno: 0, stdout: '', stderr: '' });
      return;
    }
    if (trimmed.startsWith('mkdir -p ')) {
      resolve({ errno: 0, stdout: '', stderr: '' });
      return;
    }
    resolve({ errno: 0, stdout: '', stderr: '' });
  });
}

export function spawn() {
  const child = {
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: () => {},
  };
  return child;
}

export function fullScreen() {}

export function enableEdgeToEdge() {}

export function moduleInfo() {
  return JSON.stringify({ moduleDir: '/data/adb/modules/shade144', id: 'shade144' });
}

export function listPackages(type) {
  const all = PACKAGES.map((p) => p.packageName);
  if (type === 'user') return PACKAGES.filter((p) => !p.isSystem).map((p) => p.packageName);
  if (type === 'system') return PACKAGES.filter((p) => p.isSystem).map((p) => p.packageName);
  return all;
}

export function getPackagesInfo(packages) {
  const wanted = typeof packages === 'string' ? JSON.parse(packages) : packages;
  const byName = new Map(PACKAGES.map((p) => [p.packageName, p]));
  return wanted.map((name) => {
    const p = byName.get(name);
    if (!p) return { packageName: name, appLabel: '', isSystem: false, uid: 0 };
    return { ...p, versionName: '10.0.0', versionCode: 10000 };
  });
}

export function cacheAllPackageIcons(_size) {}

export function getPackagesIcons(packagesJson, _size) {
  const wanted = typeof packagesJson === 'string' ? JSON.parse(packagesJson) : packagesJson;
  const byName = new Map(PACKAGES.map((p) => [p.packageName, p]));
  return JSON.stringify(
    wanted.map((name) => {
      const p = byName.get(name);
      if (!p) return { packageName: name, icon: '' };
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
        `<rect width="48" height="48" fill="#333"/>` +
        `<text x="24" y="31" font-family="sans-serif" font-size="22" ` +
        `fill="#fff" text-anchor="middle">${(p.appLabel || name)[0]}</text></svg>`;
      return { packageName: name, icon: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
    }),
  );
}

export function toast(message) {
  const body = document.body;
  if (!body) return;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText =
    'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;' +
    'max-width:80%;padding:10px 16px;border-radius:10px;background:#10131a;' +
    'color:#e6e9ef;font:600 13px system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);' +
    'border:1px solid #262b35;';
  body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function exit() {}

function avatar(pkg, label) {
  let hash = 0;
  for (const ch of pkg) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const char = (label || pkg).trim()[0] || '?';
  const safe = char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<rect width="48" height="48" fill="hsl(${hue},45%,32%)"/>` +
    `<text x="24" y="31" font-family="sans-serif" font-size="22" font-weight="600" ` +
    `fill="#fff" text-anchor="middle">${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function installIconFallback() {
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (img instanceof HTMLImageElement && img.src.startsWith('ksu://')) {
        const name = img.src.slice('ksu://icon/'.length);
        img.src = avatar(name, img.getAttribute('data-label'));
      }
    },
    true,
  );
}

if (typeof window !== 'undefined') {
  window.__ksuMock = { reset, listPackages, getPackagesInfo, disk };
  installIconFallback();
}
