import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { queueDiskWrite, resetDiskCacheState } from './lib/diskIconCache';

const mock = vi.hoisted(() => ({
  exec: vi.fn(),
  listPackages: vi.fn(),
  getPackagesInfo: vi.fn(),
  moduleInfo: vi.fn(),
  toast: vi.fn(),
  enableEdgeToEdge: vi.fn(),
}));

vi.mock('kernelsu', () => mock);

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<refresh_rate_config version="1">
    <WHITELIST>
        <item package="com.android.settings" auto="90" high="90" max="144" touch="1" app_request="0"></item>
    </WHITELIST>
</refresh_rate_config>`;

function installExec() {
  mock.exec.mockImplementation(async (cmd) => {
    if (cmd.startsWith('cat ')) return { errno: 0, stdout: XML, stderr: '' };
    if (cmd.startsWith('echo ')) return { errno: 0, stdout: '', stderr: '' };
    return { errno: 0, stdout: 'busybox\nksu\nmodules\n', stderr: '' };
  });
}

function installPackages() {
  mock.listPackages.mockReturnValue(['com.android.settings', 'com.other.app']);
  mock.getPackagesInfo.mockReturnValue([
    { packageName: 'com.android.settings', appLabel: 'Settings', isSystem: true, uid: 1000 },
    { packageName: 'com.other.app', appLabel: 'Other', isSystem: false, uid: 2000 },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  installExec();
  installPackages();
  mock.moduleInfo.mockReturnValue(
    JSON.stringify({ id: 'shade144', moduleDir: '/data/adb/modules/shade144' }),
  );
});

describe('App.vue', () => {
  it('requests edge-to-edge so system bars match the theme', async () => {
    mount(App);
    await flushPromises();
    expect(mock.enableEdgeToEdge).toHaveBeenCalledWith(true);
  });

  it('still boots when the manager lacks edge-to-edge', async () => {
    mock.enableEdgeToEdge.mockImplementation(() => {
      throw new TypeError('not implemented');
    });
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.vm.rows).toHaveLength(2);
  });

  it('loads and binds installed packages to rows', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const rows = wrapper.vm.rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].package).toBe('com.android.settings');
    expect(rows[0].enabled).toBe(true);
    expect(rows[1].enabled).toBe(false);
  });

  it('skips apps not installed', async () => {
    mock.listPackages.mockReturnValue(['com.android.settings']);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.vm.rows).toHaveLength(1);
  });

  it('marks edited row as changed', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const row = wrapper.vm.rows[0];
    wrapper.vm.setValue(row, 'auto', '120');
    expect(wrapper.vm.isChanged(row)).toBe(true);
  });

  it('serializes save payload correctly', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const row = wrapper.vm.rows[1];
    wrapper.vm.setValue(row, 'auto', '60');
    wrapper.vm.toggle(row);
    const xml = wrapper.vm.preview();
    expect(xml).toContain('com.android.settings');
    expect(xml).toContain('com.other.app');
    expect(xml).toContain('auto="60"');
  });

  it('save writes via loader and toasts', async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.vm.save();
    await flushPromises();
    expect(mock.exec).toHaveBeenCalled();
    expect(mock.toast).toHaveBeenCalled();
  });

  it('save only writes config, never the icon cache', async () => {
    const wrapper = mount(App);
    await flushPromises();
    mock.exec.mockClear();
    await wrapper.vm.save();
    await flushPromises();
    const iconWrites = mock.exec.mock.calls.filter(([cmd]) => cmd.includes('.cache/icons'));
    expect(iconWrites).toHaveLength(0);
  });

  it('flushes queued icon writes on pagehide regardless of visibility state', async () => {
    resetDiskCacheState();
    const wrapper = mount(App);
    await flushPromises();
    queueDiskWrite(
      '/data/adb/modules/shade144',
      'com.example.app',
      1,
      'data:image/png;base64,QUJD',
      mock.exec,
    );
    mock.exec.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    await flushPromises();
    const iconWrites = mock.exec.mock.calls.filter(([cmd]) => cmd.includes('.cache/icons'));
    expect(iconWrites.length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('search filters visible rows', async () => {
    const wrapper = mount(App);
    await flushPromises();
    wrapper.vm.search = 'other';
    const w = wrapper.vm;
    expect(w.filtered.length).toBe(1);
    expect(w.filtered[0].package).toBe('com.other.app');
  });

  it('search affects the rendered list, not just filtered', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.findAll('.app')).toHaveLength(2);
    wrapper.vm.search = 'other';
    await wrapper.vm.$nextTick();
    const visible = wrapper.findAll('.app');
    expect(visible).toHaveLength(1);
    expect(visible[0].text()).toContain('Other');
  });

  it('tracks pending changes live before save', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.vm.stats.changed).toBe(0);
    const row = wrapper.vm.rows[0];
    wrapper.vm.setValue(row, 'auto', '120');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.stats.changed).toBe(1);

    wrapper.vm.filter = 'changed';
    const w = wrapper.vm;
    expect(w.filtered.length).toBe(1);
    expect(w.filtered[0].package).toBe('com.android.settings');
  });

  it('row status toggle flips the live row', async () => {
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.vm.rows[0].enabled).toBe(true);
    const status = wrapper.findAll('.status')[0];
    await status.trigger('click');
    expect(wrapper.vm.rows[0].enabled).toBe(false);
    expect(wrapper.vm.stats.changed).toBe(1);
  });

  it('modal edits apply to the live row', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const row = wrapper.vm.rows[1];
    wrapper.vm.openEditor(row);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sheet').exists()).toBe(true);
    await wrapper.findAll('.seg-opt')[2].trigger('click');
    expect(row.values.auto).toBe('120');
    wrapper.vm.closeEditor();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.sheet').exists()).toBe(false);
  });

  it('clears pending count after save', async () => {
    const wrapper = mount(App);
    await flushPromises();
    const row = wrapper.vm.rows[0];
    wrapper.vm.setValue(row, 'auto', '120');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.stats.changed).toBe(1);
    await wrapper.vm.save();
    await flushPromises();
    expect(wrapper.vm.stats.changed).toBe(0);
  });

  it('save falls back to a fresh config when the file is missing', async () => {
    mock.exec.mockImplementation(async (cmd) => {
      if (cmd.startsWith('cat '))
        return { errno: 1, stdout: '', stderr: 'cat: No such file or directory' };
      if (cmd.startsWith('echo ')) return { errno: 0, stdout: '', stderr: '' };
      return { errno: 0, stdout: 'busybox\nksu\nmodules\n', stderr: '' };
    });
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.vm.rows).toHaveLength(2);
    expect(wrapper.vm.rows.every((r) => !r.enabled)).toBe(true);
    wrapper.vm.toggle(wrapper.vm.rows[0]);
    await wrapper.vm.save();
    await flushPromises();
    expect(wrapper.vm.error).toBe('');
    expect(mock.toast).toHaveBeenCalled();
    const writes = mock.exec.mock.calls.filter(([cmd]) => cmd.includes('base64 -d >'));
    expect(writes).toHaveLength(1);
  });
});
