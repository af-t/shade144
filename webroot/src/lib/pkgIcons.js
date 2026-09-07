const B64_RE = /^[A-Za-z0-9+/=]+$/;
const PNG_PREFIX = 'data:image/png;base64,';

export function normalizeBridgeIcon(icon) {
  if (typeof icon !== 'string' || !icon) return null;
  if (icon.startsWith('data:image')) return icon;
  const b64 = icon.replace(/\s+/g, '');
  if (!b64 || !B64_RE.test(b64)) return null;
  return `${PNG_PREFIX}${b64}`;
}

export function hasBridgeIcons() {
  try {
    return typeof globalThis.ksu?.getPackagesIcons === 'function';
  } catch {
    return false;
  }
}

function defaultBridge(namesJson, size) {
  return globalThis.ksu.getPackagesIcons(namesJson, size);
}

export async function getBridgeIcons(packages, size, bridgeFn = defaultBridge) {
  const out = new Map();
  try {
    if (!hasBridgeIcons() && bridgeFn === defaultBridge) return out;
    const raw = await bridgeFn(JSON.stringify(packages), size);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return out;
    for (const item of arr) {
      if (!item || typeof item.packageName !== 'string') continue;
      const url = normalizeBridgeIcon(item.icon);
      if (url) out.set(item.packageName, url);
    }
  } catch {}
  return out;
}
