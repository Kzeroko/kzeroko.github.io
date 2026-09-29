import { ICONS } from './icons.mjs';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Tiny element builder. `props` keys: `class`, `text`, `dataset`, `style`, `on*` handlers,
 * `attrs`; any other key is assigned as a property (value, checked, disabled…).
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false && key !== 'checked' && key !== 'disabled') continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') for (const [name, rule] of Object.entries(value)) { if (name.startsWith('--')) node.style.setProperty(name, String(rule)); else node.style[name] = rule; }
    else if (key === 'attrs') for (const [name, attr] of Object.entries(value)) { if (attr !== undefined && attr !== null && attr !== false) node.setAttribute(name, attr === true ? '' : String(attr)); }
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function icon(name, size = 16) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ds-icon');
  svg.innerHTML = ICONS[name] ?? '';
  return svg;
}

export function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

/** Icon button with a visible label; `compact` hides the label visually but keeps it for screen readers. */
export function button(label, { icon: name, action, variant, compact = false, disabled = false, onclick, attrs = {}, dataset = {} } = {}) {
  return h('button', {
    type: 'button',
    class: ['ds-btn', variant && `ds-btn--${variant}`, compact && 'ds-btn--icon'].filter(Boolean).join(' '),
    disabled,
    onclick,
    dataset: { ...dataset, ...(action ? { action } : {}) },
    attrs: { ...(compact ? { 'aria-label': label, title: label } : {}), ...attrs },
  }, name && icon(name), compact ? null : h('span', { text: label }));
}

export function clear(node) { node.replaceChildren(); return node; }

/** `replaceChildren` that skips null/false children instead of printing "null". */
export function fill(node, ...children) { node.replaceChildren(); append(node, children); return node; }

export const fmtBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : bytes < 1073741824 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1073741824).toFixed(1)} GB`;

export function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = h('a', { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const stamp = () => {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export const slug = value => String(value || 'workspace').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';

/** Restores focus and caret after a panel re-renders, keyed by `data-field`. */
export function preserveFocus(root, render) {
  const active = document.activeElement;
  const field = active && root.contains(active) ? active.dataset?.field : null;
  const range = field && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  const scroll = root.scrollTop;
  render();
  root.scrollTop = scroll;
  if (!field) return;
  const next = root.querySelector(`[data-field="${CSS.escape(field)}"]`);
  if (!next) return;
  next.focus({ preventScroll: true });
  if (range && 'setSelectionRange' in next) { try { next.setSelectionRange(...range); } catch { /* not a text input */ } }
}

export const isTyping = target => !!target?.closest?.('input, textarea, select, [contenteditable="true"]');
