const DB_NAME = 'shade144';
const STORE_NAME = 'icons';
const DB_VERSION = 1;

const mem = new Map();
let dbPromise = null;

const MAX_MEM_ICONS = 200;

function memSet(key, value) {
  mem.delete(key);
  mem.set(key, value);
  while (mem.size > MAX_MEM_ICONS) {
    mem.delete(mem.keys().next().value);
  }
}

export function cacheKey(pkg, version) {
  return version ? `${pkg}@${version}` : String(pkg);
}

export function clearMemoryCache() {
  mem.clear();
}

export function peekMemoryIcon(key) {
  return mem.get(key) || null;
}

function idbAvailable() {
  return typeof indexedDB !== 'undefined';
}

function openDb() {
  if (!idbAvailable()) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function getCachedIcon(key) {
  if (mem.has(key)) return mem.get(key);
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const v = req.result || null;
        if (v) memSet(key, v);
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedIcon(key, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return;
  memSet(key, dataUrl);
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, key);
  } catch {}
}

export function extractDataUrl(img, maxSize = 96) {
  try {
    if (!img?.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, maxSize, maxSize);
    ctx.drawImage(img, 0, 0, maxSize, maxSize);
    const url = canvas.toDataURL('image/png');
    return url?.startsWith('data:image') ? url : null;
  } catch {
    return null;
  }
}

const MAX_ICON_BYTES = 2 * 1024 * 1024;

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    try {
      if (typeof FileReader === 'undefined') {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}

async function downscaleBlob(blob, maxSize = 96) {
  if (typeof createImageBitmap === 'undefined') return null;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = maxSize;
    canvas.height = maxSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, maxSize, maxSize);
    const url = canvas.toDataURL('image/png');
    return url?.startsWith('data:image') ? url : null;
  } finally {
    try {
      bitmap.close?.();
    } catch {}
  }
}

export async function fetchIconDataUrl(url, fetchFn = fetch, opts = {}) {
  const { signal, timeoutMs = 10000 } = opts;
  if (signal?.aborted) return null;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (signal) {
    try {
      signal.addEventListener('abort', onAbort, { once: true });
    } catch {
      return null;
    }
  }
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          try {
            ctrl.abort();
          } catch {}
        }, timeoutMs)
      : null;
  try {
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (!res?.ok) return null;
    const blob = await res.blob();
    if (!blob?.type?.startsWith('image/')) return null;
    if (blob.size === 0 || blob.size > MAX_ICON_BYTES) return null;
    try {
      const small = await downscaleBlob(blob);
      if (small) return small;
    } catch {}
    const full = await blobToDataUrl(blob);
    return full?.startsWith('data:image') ? full : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) {
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {}
    }
  }
}
