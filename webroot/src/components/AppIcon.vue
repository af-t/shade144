<script setup>
import { exec } from 'kernelsu';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { queueDiskWrite, readDiskIcon } from '../lib/diskIconCache';
import {
  cacheKey,
  extractDataUrl,
  fetchIconDataUrl,
  getCachedIcon,
  peekMemoryIcon,
  setCachedIcon,
} from '../lib/iconCache';
import { recordIconSource } from '../lib/iconStats';
import { getBridgeIcons } from '../lib/pkgIcons';

const props = defineProps({
  pkg: { type: String, required: true },
  label: { type: String, default: '' },
  src: { type: String, required: true },
  version: { type: [String, Number], default: 0 },
  moduleDir: { type: String, default: '' },
  eager: { type: Boolean, default: false },
});

const root = ref(null);
const current = ref(null);
const failed = ref(false);
let observer = null;
let cancelled = false;
let abortCtrl = null;
let unloadTimer = null;
let retriedLive = false;

const UNLOAD_GRACE_MS = 1000;

const key = () => cacheKey(props.pkg, props.version);

function persistIcon(dataUrl) {
  setCachedIcon(key(), dataUrl);
  queueDiskWrite(props.moduleDir, props.pkg, props.version, dataUrl, exec);
}

async function loadLive() {
  if (cancelled || failed.value || current.value) return;
  try {
    const bridged = await getBridgeIcons([props.pkg], 96);
    if (cancelled || failed.value || current.value) return;
    const hit = bridged.get(props.pkg);
    if (hit) {
      current.value = hit;
      persistIcon(hit);
      recordIconSource('bridge');
      return;
    }
  } catch {}
  abortCtrl = new AbortController();
  const dataUrl = props.src.startsWith('ksu://')
    ? await fetchIconDataUrl(props.src, fetch, { signal: abortCtrl.signal })
    : null;
  abortCtrl = null;
  if (cancelled || failed.value || current.value) return;
  if (dataUrl) {
    current.value = dataUrl;
    persistIcon(dataUrl);
    recordIconSource('fetch');
  } else {
    current.value = props.src;
    recordIconSource('live');
  }
}

function cancelUnload() {
  if (unloadTimer) clearTimeout(unloadTimer);
  unloadTimer = null;
}

function doUnload() {
  unloadTimer = null;
  if (cancelled || failed.value || !current.value) return;
  try {
    abortCtrl?.abort();
  } catch {}
  abortCtrl = null;
  current.value = null;
}

function unload() {
  if (props.eager || failed.value || !current.value || unloadTimer) return;
  unloadTimer = setTimeout(doUnload, UNLOAD_GRACE_MS);
}

function enter() {
  cancelUnload();
  if (cancelled || failed.value || current.value) return;
  const peeked = peekMemoryIcon(key());
  if (peeked) {
    current.value = peeked;
    recordIconSource('mem');
    return;
  }
  void resolveIcon();
}

function showLive() {
  enter();
}

function observe() {
  if (props.eager || !root.value) {
    showLive();
    return;
  }
  if (typeof IntersectionObserver === 'undefined') {
    showLive();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) enter();
        else unload();
      }
    },
    { rootMargin: '600px' },
  );
  observer.observe(root.value);
}

function onLoad(e) {
  if (cancelled || failed.value) return;
  if (current.value !== props.src) return;
  if (!props.src.startsWith('ksu://')) return;
  const url = extractDataUrl(e.target);
  if (!url) return;
  persistIcon(url);
  recordIconSource('live');
}

function onError(e) {
  if (cancelled) return;
  if (current.value && !current.value.startsWith('ksu://')) {
    if (!retriedLive && props.src.startsWith('ksu://')) {
      retriedLive = true;
      current.value = props.src;
      return;
    }
    failed.value = true;
    return;
  }
  const el = e?.target;
  const now = el?.getAttribute?.('src') ?? el?.src ?? '';
  if (now && !String(now).startsWith('ksu://')) return;
  failed.value = true;
}

watch(
  () => [props.pkg, props.src, props.version],
  () => {
    failed.value = false;
    retriedLive = false;
    current.value = null;
    observer?.disconnect();
    observer = null;
    init();
  },
);

async function resolveCached() {
  if (cancelled || failed.value || current.value) return;
  const hit = await getCachedIcon(key());
  if (cancelled || failed.value || current.value) return;
  if (hit) {
    current.value = hit;
    recordIconSource('mem');
    return;
  }
  if (props.moduleDir) {
    const diskHit = await readDiskIcon(props.moduleDir, props.pkg, props.version, exec);
    if (cancelled || failed.value || current.value) return;
    if (diskHit) {
      current.value = diskHit;
      setCachedIcon(key(), diskHit);
      recordIconSource('disk');
    }
  }
}

async function resolveIcon() {
  await resolveCached();
  if (cancelled || failed.value || current.value) return;
  await loadLive();
}

async function init() {
  await resolveCached();
  if (!cancelled) observe();
}

onMounted(init);

onUnmounted(() => {
  cancelled = true;
  cancelUnload();
  try {
    abortCtrl?.abort();
  } catch {}
  abortCtrl = null;
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <span ref="root" class="app-icon-container">
    <img
      v-if="current && !failed"
      :src="current"
      :alt="label"
      :data-label="label"
      draggable="false"
      loading="lazy"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <span v-else-if="failed" class="app-icon-fallback visible">
      <i class="mat">android</i>
    </span>
    <span v-else class="app-icon-placeholder" aria-hidden="true" />
  </span>
</template>
