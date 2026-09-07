import { describe, expect, it } from 'vitest';
import { parseConfig, serializeConfig } from './config';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<refresh_rate_config version="20260727">
    <switch>
        <input_method_switch>true</input_method_switch>
        <multi_window_refresh_rate>120</multi_window_refresh_rate>
        <screen_record>120</screen_record>
    </switch>
    <WHITELIST>
        <item package="com.android.settings" auto="90" high="90" max="144" touch="1" app_request="0"></item>
        <item package="com.tencent.mm" auto="60" high="120" max="144" touch="1" app_request="1"></item>
    </WHITELIST>
</refresh_rate_config>`;

describe('parseConfig', () => {
  it('parses items with all attributes', () => {
    const cfg = parseConfig(SAMPLE);
    expect(cfg.items).toHaveLength(2);
    expect(cfg.items[0]).toEqual({
      package: 'com.android.settings',
      auto: '90',
      high: '90',
      max: '144',
      touch: '1',
      app_request: '0',
    });
    expect(cfg.items[1].app_request).toBe('1');
  });

  it('preserves switch block verbatim', () => {
    const cfg = parseConfig(SAMPLE);
    expect(cfg.switchXml).toContain('multi_window_refresh_rate');
    expect(cfg.switchXml).toContain('screen_record');
  });

  it('returns empty items for empty xml', () => {
    const cfg = parseConfig('');
    expect(cfg.items).toHaveLength(0);
  });

  it('handles missing optional attributes with defaults', () => {
    const xml = `<refresh_rate_config><WHITELIST>
      <item package="com.x" auto="60"></item>
    </WHITELIST></refresh_rate_config>`;
    const cfg = parseConfig(xml);
    expect(cfg.items[0].high).toBe('90');
    expect(cfg.items[0].max).toBe('144');
    expect(cfg.items[0].touch).toBe('1');
    expect(cfg.items[0].app_request).toBe('0');
  });

  it('ignores malformed items', () => {
    const xml = `<refresh_rate_config><WHITELIST>
      <item package="com.ok" auto="60" high="90" max="144" touch="1" app_request="0"></item>
      <item notvalid="true"></item>
      <item package=""></item>
    </WHITELIST></refresh_rate_config>`;
    const cfg = parseConfig(xml);
    expect(cfg.items).toHaveLength(1);
    expect(cfg.items[0].package).toBe('com.ok');
  });
});

describe('serializeConfig', () => {
  it('round-trips a parsed config', () => {
    const cfg = parseConfig(SAMPLE);
    const out = serializeConfig(cfg);
    const again = parseConfig(out);
    expect(again.items).toEqual(cfg.items);
  });

  it('emits every attribute on each item', () => {
    const cfg = parseConfig(SAMPLE);
    const out = serializeConfig(cfg);
    const line = out.split('\n').find((l) => l.includes('com.tencent.mm'));
    expect(line).toContain('auto="60"');
    expect(line).toContain('high="120"');
    expect(line).toContain('max="144"');
    expect(line).toContain('touch="1"');
    expect(line).toContain('app_request="1"');
  });

  it('keeps switch block content', () => {
    const cfg = parseConfig(SAMPLE);
    const out = serializeConfig(cfg);
    expect(out).toContain('multi_window_refresh_rate');
  });
});
