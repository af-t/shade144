<script setup>
import { toast } from 'kernelsu';
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { serializeConfig } from './lib/config';
import {
  DEFAULT_MODULE_DIR,
  getModuleDir,
  installedPackages,
  loadManager,
  MODULE_ID,
  readConfig,
  writeConfig,
} from './lib/loader';
import { applyDefaults, diffPackages } from './lib/whitelist';

const RATE_VALUES = ['60', '90', '120', '144'];
const MOCK_MODE = import.meta.env.DEV;

const rows = ref([]);
const original = ref([]);
const manager = ref(null);
const dir = ref(DEFAULT_MODULE_DIR);
const search = ref('');
const filter = ref('all');
const loading = ref(true);
const saving = ref(false);
const error = ref('');

const searchOpen = ref(false);
const menuOpen = ref(false);
const editing = ref(null);
const searchInput = ref(null);
const scrolled = ref(false);
const fabHidden = ref(false);
const lastY = { y: 0 };

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (filter.value === 'enabled' && !r.enabled) return false;
    if (filter.value === 'disabled' && r.enabled) return false;
    if (filter.value === 'changed' && !isChanged(r)) return false;
    if (!q) return true;
    return r.package.toLowerCase().includes(q) || r.label.toLowerCase().includes(q);
  });
});

const stats = computed(() => {
  const total = rows.value.length;
  const enabled = rows.value.filter((r) => r.enabled).length;
  const changed = rows.value.filter((r) => isChanged(r)).length;
  return { total, enabled, changed };
});

const FILTERS = computed(() => [
  { id: 'all', label: `All (${stats.value.total})` },
  { id: 'enabled', label: `Enabled (${stats.value.enabled})` },
  { id: 'disabled', label: `Disabled (${stats.value.total - stats.value.enabled})` },
  { id: 'changed', label: `Changed (${stats.value.changed})` },
]);

const managerLabel = computed(() => {
  if (!manager.value) return 'detecting…';
  return manager.value.ksun ? 'KSUN' : 'KSU';
});

async function bootstrap() {
  loading.value = true;
  error.value = '';
  try {
    manager.value = await loadManager();
    dir.value = getModuleDir();
    const installed = await installedPackages();
    let cfg;
    try {
      cfg = await readConfig(dir.value);
    } catch (e) {
      error.value = e.message;
      cfg = { items: [], prefix: '', suffix: '' };
    }
    original.value = cfg.items;
    const byPkg = new Map(cfg.items.map((i) => [i.package, i]));
    rows.value = installed.map((p) => {
      const existing = byPkg.get(p.package);
      return {
        package: p.package,
        label: p.label,
        isSystem: p.isSystem,
        icon: p.icon,
        iconError: false,
        enabled: !!existing,
        values: applyDefaults(existing ? { ...existing } : { package: p.package }),
      };
    });
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function setValue(row, key, value) {
  row.values[key] = value;
}

function isChanged(row) {
  const orig = original.value.find((i) => i.package === row.package);
  if (!orig) return row.enabled;
  if (!row.enabled) return true;
  return Object.keys(row.values).some((k) => String(row.values[k]) !== String(orig[k] || ''));
}

function toggle(row) {
  row.enabled = !row.enabled;
}

function onIconError(e, row) {
  if (!e.currentTarget.src.startsWith('ksu://')) return;
  row.iconError = true;
}

function openEditor(row) {
  editing.value = row;
  document.body.classList.add('locked');
}

function closeEditor() {
  editing.value = null;
  document.body.classList.remove('locked');
}

async function openSearch() {
  searchOpen.value = true;
  await nextTick();
  searchInput.value?.focus();
}

function closeSearch() {
  searchOpen.value = false;
  search.value = '';
}

function setFilter(v) {
  filter.value = v;
  menuOpen.value = false;
}

function onScroll() {
  const y = window.scrollY;
  fabHidden.value = y > lastY.y && y > 48;
  scrolled.value = y > 10;
  lastY.y = y;
  menuOpen.value = false;
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const items = rows.value
      .filter((r) => r.enabled)
      .map((r) => applyDefaults({ ...r.values, package: r.package }));
    const diff = diffPackages(
      original.value,
      items.map((i) => i.package),
    );
    if (items.length === 0) {
      toast('Nothing enabled. Enable at least one app to keep the whitelist.');
      saving.value = false;
      return;
    }
    const cfg = { items };
    let xml = '';
    try {
      const existing = await readConfig(dir.value);
      xml = serializeConfig({ ...existing, ...cfg });
    } catch {
      xml = serializeConfig({ items, prefix: '', suffix: '' });
    }
    await writeConfig(dir.value, xml);
    original.value = items;
    toast(`Saved ${stats.value.enabled} apps${diff.toAdd.length ? `, +${diff.toAdd.length}` : ''}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function preview() {
  const items = rows.value
    .filter((r) => r.enabled)
    .map((r) => applyDefaults({ ...r.values, package: r.package }));
  return serializeConfig({ items, prefix: '', suffix: '' });
}

onMounted(() => {
  bootstrap();
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});

defineExpose({
  rows,
  filtered,
  stats,
  toggle,
  setValue,
  save,
  preview,
  bootstrap,
  isChanged,
  editing,
  openEditor,
  closeEditor,
  menuOpen,
  searchOpen,
  setFilter,
});
</script>

<template>
  <header class="header" :class="{ scroll: scrolled }">
    <div id="title" class="search-hide" :class="{ hide: searchOpen }">Shade144</div>
    <div class="spacer"></div>
    <div class="search-bar" :class="{ hide: !searchOpen }">
      <input
        ref="searchInput"
        v-model="search"
        class="field-input"
        type="text"
        placeholder="Search apps…"
      />
      <button class="btn-icon" aria-label="Close search" @click="closeSearch()">
        <i class="mat">close</i>
      </button>
    </div>
    <button
      class="btn-icon search-hide"
      :class="{ hide: searchOpen }"
      aria-label="Search"
      @click="openSearch()"
    >
      <i class="mat">search</i>
    </button>
    <button class="btn-icon" aria-label="Menu" @click="menuOpen = !menuOpen">
      <i class="mat">more_vert</i>
    </button>
  </header>

  <main class="body-content">
    <div v-if="MOCK_MODE" class="banner mock">Mock mode — KSU API di-emulasi oleh browser shim</div>
    <div v-if="error" class="banner error">{{ error }}</div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>
    <div v-else-if="filtered.length === 0" class="hint">No apps match.</div>

    <ul v-else class="list">
      <li
        v-for="row in filtered"
        :key="row.package"
        class="app"
        :class="{ selected: row.enabled, off: !row.enabled, iso: row.isSystem }"
      >
        <div class="content">
          <button class="card-main" @click="toggle(row)" @contextmenu.prevent="openEditor(row)">
            <span class="app-icon-container">
              <img
                v-if="row.icon && !row.iconError"
                :src="row.icon"
                :alt="row.label"
                draggable="false"
                @error="onIconError($event, row)"
              />
              <span v-if="row.iconError" class="app-icon-fallback visible">
                <i class="mat">android</i>
              </span>
            </span>
            <span class="app-info">
              <span class="app-name">{{ row.label }}</span>
              <span class="package-name">{{ row.package }}</span>
            </span>
          </button>
          <button
            class="status"
            :class="{ on: row.enabled }"
            :aria-label="`${row.enabled ? 'Enabled' : 'Disabled'} — ${row.label}`"
            :aria-pressed="row.enabled"
            @click.stop="toggle(row)"
          >
            <i class="mat">{{ row.enabled ? 'check_box' : 'check_box_outline_blank' }}</i>
          </button>
        </div>
      </li>
    </ul>

    <div class="bottom-safe-inset"></div>
  </main>

  <section class="floating-content" :class="{ 'fab-hide': fabHidden }">
    <div class="fab-container">
      <button class="fab" :disabled="saving || loading" @click="save">
        <i class="mat">edit_note</i>
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </section>

  <div v-if="menuOpen" class="menu-scrim" @click="menuOpen = false"></div>
  <div v-if="menuOpen" class="menu">
    <p class="menu-head">{{ MODULE_ID }} · {{ managerLabel }}</p>
    <button
      v-for="f in FILTERS"
      :key="f.id"
      class="menu-item"
      :class="{ sel: filter === f.id }"
      @click="setFilter(f.id)"
    >
      <i class="mat">check</i>
      <span class="menu-label">{{ f.label }}</span>
    </button>
  </div>

  <div v-if="editing" class="scrim" @click="closeEditor()"></div>
  <div v-if="editing" class="sheet" role="dialog" aria-modal="true" aria-label="App settings">
    <header class="sheet-head">
      <span class="app-icon-container">
        <img v-if="editing.icon" :src="editing.icon" :alt="editing.label" class="sicon-img" />
      </span>
      <div class="smet">
        <strong>{{ editing.label }}</strong>
        <span class="package-name">{{ editing.package }}</span>
      </div>
      <button class="btn-icon" aria-label="Close" @click="closeEditor()">
        <i class="mat">close</i>
      </button>
    </header>

    <div class="drow">
      <div class="dmeta">
        <strong>Enabled</strong>
        <div class="dim">Included in the 144&nbsp;Hz whitelist</div>
      </div>
      <button
        class="sw"
        :class="{ on: editing.enabled }"
        role="switch"
        :aria-checked="editing.enabled"
        @click="toggle(editing)"
      >
        <span class="knob" />
      </button>
    </div>

    <div class="divider"></div>

    <label v-for="k in ['auto', 'high', 'max']" :key="k" class="rate-row">
      <span class="rate-label">{{ k }}</span>
      <span class="seg">
        <button
          v-for="v in RATE_VALUES"
          :key="v"
          class="seg-opt"
          :class="{ on: editing.values[k] === v }"
          :aria-pressed="editing.values[k] === v"
          @click="setValue(editing, k, v)"
        >
          {{ v }}
        </button>
      </span>
    </label>

    <div class="divider"></div>

    <div class="drow">
      <div class="dmeta">
        <strong>Touch boost</strong>
        <div class="dim">Keep peak rate while touching</div>
      </div>
      <button
        class="sw"
        :class="{ on: editing.values.touch === '1' }"
        role="switch"
        :aria-checked="editing.values.touch === '1'"
        @click="setValue(editing, 'touch', editing.values.touch === '1' ? '0' : '1')"
      >
        <span class="knob" />
      </button>
    </div>

    <div class="drow">
      <div class="dmeta">
        <strong>App request</strong>
        <div class="dim">Honor per-app rate requests</div>
      </div>
      <button
        class="sw"
        :class="{ on: editing.values.app_request === '1' }"
        role="switch"
        :aria-checked="editing.values.app_request === '1'"
        @click="
          setValue(editing, 'app_request', editing.values.app_request === '1' ? '0' : '1')
        "
      >
        <span class="knob" />
      </button>
    </div>

    <button class="done" @click="closeEditor()">Done</button>
  </div>
</template>