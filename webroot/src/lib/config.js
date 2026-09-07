const ITEM_RE = /<item\b[^>]*><\/item>|<item\b[^>]*\/>/g;
const SWITCH_RE = /<switch>[\s\S]*?<\/switch>/;
const ATTR_RE = (name) => new RegExp(`${name}\\s*=\\s*"([^"]*)"`);

const DEFAULTS = { auto: '90', high: '90', max: '144', touch: '1', app_request: '0' };
const ATTRS = ['package', 'auto', 'high', 'max', 'touch', 'app_request'];
const INDENT = '        ';

function attr(block, name) {
  const m = block.match(ATTR_RE(name));
  return m ? m[1] : '';
}

export function parseItems(body) {
  const items = [];
  for (const m of body.matchAll(ITEM_RE)) {
    const block = m[0];
    const pkg = attr(block, 'package');
    if (!pkg) continue;
    const item = { package: pkg };
    for (const key of ['auto', 'high', 'max', 'touch', 'app_request']) {
      const v = attr(block, key);
      item[key] = v === '' ? DEFAULTS[key] : v;
    }
    items.push(item);
  }
  return items;
}

export function parseConfig(xml) {
  const open = xml.indexOf('<WHITELIST');
  if (open === -1) return { items: [], prefix: xml, suffix: '', switchXml: '' };
  const openEnd = xml.indexOf('>', open);
  const close = xml.indexOf('</WHITELIST>', openEnd);
  if (close === -1) return { items: [], prefix: xml, suffix: '', switchXml: '' };

  const prefix = xml.slice(0, openEnd + 1);
  const suffix = xml.slice(close);
  const body = xml.slice(openEnd + 1, close);
  const switchMatch = prefix.match(SWITCH_RE);
  const switchXml = switchMatch ? switchMatch[0] : '';

  return { items: parseItems(body), prefix, suffix, switchXml };
}

export function buildItemLine(item) {
  const parts = ATTRS.map((k) => `${k}="${item[k]}"`);
  return `${INDENT}<item ${parts.join(' ')}></item>`;
}

export function serializeConfig(cfg) {
  const lines = cfg.items.map(buildItemLine).join('\n');
  const bodyStart = cfg.prefix.endsWith('\n') ? '' : '\n';
  const bodyEnd = cfg.suffix.startsWith('<') ? '\n' : '';
  return cfg.prefix + bodyStart + lines + bodyEnd + cfg.suffix;
}
