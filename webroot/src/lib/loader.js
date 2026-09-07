import { exec, getPackagesInfo, listPackages, moduleInfo } from 'kernelsu';
import { parseConfig } from './config';

export const REL_PATH = 'system/tr_product/etc/vconfig/magellan/refresh_rate_config.xml';
export const DEFAULT_MODULE_DIR = '/data/adb/modules/shade144';
export const MODULE_ID = 'shade144';

export function resolveModuleDir(raw) {
  return raw || DEFAULT_MODULE_DIR;
}

export function getModuleDir() {
  try {
    const info = JSON.parse(moduleInfo());
    return resolveModuleDir(info.moduleDir);
  } catch {
    return DEFAULT_MODULE_DIR;
  }
}

export function modulePath(moduleDir) {
  return `${moduleDir}/${REL_PATH}`;
}

export async function loadManager() {
  const { stdout } = await exec('ls /data/adb');
  const dir = stdout || '';
  return { ksu: dir.includes('ksu'), ksun: dir.includes('ksun') };
}

export async function installedPackages() {
  const names = listPackages('all') || [];
  let info = [];
  try {
    info = getPackagesInfo(names) || [];
  } catch {
    info = [];
  }
  const byName = new Map(info.map((i) => [i.packageName, i]));
  return names.map((name) => {
    const meta = byName.get(name);
    return {
      package: name,
      label: meta?.appLabel || name,
      isSystem: meta?.isSystem ?? false,
      icon: `ksu://icon/${name}`,
    };
  });
}

export async function readConfig(moduleDir) {
  const { errno, stdout, stderr } = await exec(`cat ${modulePath(moduleDir)}`);
  if (errno !== 0 && stderr) throw new Error(stderr);
  return { ...parseConfig(stdout || ''), xml: stdout, errno };
}

export async function writeConfig(moduleDir, xml) {
  const base64 = btoa(unescape(encodeURIComponent(xml)));
  const path = modulePath(moduleDir);
  const cmd = `echo '${base64}' | base64 -d > ${path}`;
  const { errno, stderr } = await exec(cmd);
  if (errno !== 0) throw new Error(stderr);
}
