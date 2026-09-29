import { h, icon } from './dom.mjs';

/**
 * Menus, the searchable picker, modal dialogs and toasts. Everything opens on click and is placed
 * inside the viewport; nothing appears on hover.
 */
export class UI {
  constructor(app) {
    this.app = app;
    this.layer = h('div', { class: 'ds-layer' });
    this.toasts = h('div', { class: 'ds-toasts', attrs: { role: 'status', 'aria-live': 'polite' } });
    this.dialogEl = h('dialog', { class: 'ds-dialog' });
    app.root.append(this.layer, this.toasts, this.dialogEl);
    this.closeMenu = null;
  }

  /** Keeps a floating element fully on screen, flipping above the anchor when there is no room below. */
  place(el, anchor) {
    const margin = 8, vw = innerWidth, vh = innerHeight;
    el.style.maxHeight = `${vh - margin * 2}px`;
    const { width, height } = el.getBoundingClientRect();
    let x, y;
    if (anchor instanceof Element) {
      const r = anchor.getBoundingClientRect();
      x = r.left; y = r.bottom + 4;
      if (x + width > vw - margin) x = r.right - width;
      if (y + height > vh - margin && r.top - height - 4 > margin) y = r.top - height - 4;
    } else { x = anchor.x; y = anchor.y; }
    x = Math.max(margin, Math.min(x, vw - width - margin));
    y = Math.max(margin, Math.min(y, vh - height - margin));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  }

  dismiss() { this.closeMenu?.(); }

  open(el, anchor, { focus } = {}) {
    this.dismiss();
    this.layer.append(el);
    this.place(el, anchor);
    const previous = document.activeElement;
    const close = (restore = true) => {
      if (this.closeMenu !== close) return;
      this.closeMenu = null;
      el.remove();
      document.removeEventListener('pointerdown', outside, true);
      removeEventListener('resize', onResize);
      if (restore && previous?.isConnected) previous.focus({ preventScroll: true });
    };
    const outside = event => { if (!el.contains(event.target) && !(anchor instanceof Element && anchor.contains(event.target))) close(false); };
    const onResize = () => close(false);
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    addEventListener('resize', onResize);
    el.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
    this.closeMenu = close;
    (focus ?? el.querySelector('button:not(:disabled), input'))?.focus({ preventScroll: true });
    return close;
  }

  /**
   * @param {Element|{x:number,y:number}} anchor
   * @param {Array<'-'|{heading:string}|{label:string, icon?:string, hint?:string, danger?:boolean, disabled?:boolean, onSelect:Function}>} items
   */
  menu(anchor, items) {
    const el = h('div', { class: 'ds-menu', attrs: { role: 'menu' } });
    let close;
    for (const item of items) {
      if (!item) continue;
      if (item === '-') { el.append(h('hr', { class: 'ds-menu__sep' })); continue; }
      if (item.heading) { el.append(h('p', { class: 'ds-menu__heading', text: item.heading })); continue; }
      el.append(h('button', {
        type: 'button', class: `ds-menu__item${item.danger ? ' is-danger' : ''}`, disabled: !!item.disabled, attrs: { role: 'menuitem' },
        onclick: () => { close(); this.app.run(item.onSelect); },
      }, h('span', { class: 'ds-menu__icon' }, item.icon ? icon(item.icon) : null), h('span', { class: 'ds-menu__label', text: item.label }), item.hint ? h('span', { class: 'ds-menu__hint', text: item.hint }) : null));
    }
    el.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...el.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    });
    close = this.open(el, anchor);
    return close;
  }

  /** Search-as-you-type list, used for the node library and quick jumps. */
  picker(anchor, items, { placeholder = '', empty = '' } = {}) {
    const input = h('input', { type: 'search', class: 'ds-input', placeholder, attrs: { 'aria-label': placeholder } });
    const list = h('div', { class: 'ds-picker__list', attrs: { role: 'listbox' } });
    const el = h('div', { class: 'ds-menu ds-picker' }, input, list);
    let active = 0, shown = [], close;
    const render = () => {
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = items.filter(item => words.every(word => `${item.label} ${item.description ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(word)));
      active = Math.min(active, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map((item, index) => h('button', {
        type: 'button', class: `ds-picker__item${index === active ? ' is-active' : ''}`, attrs: { role: 'option', 'aria-selected': String(index === active) },
        onclick: () => { close(); this.app.run(item.onSelect); },
      }, h('span', { class: `ds-picker__icon ds-tone--${item.tone ?? 'accent'}` }, icon(item.icon ?? 'plus')), h('span', { class: 'ds-picker__text' }, h('strong', { text: item.label }), item.description ? h('small', { text: item.description }) : null))));
      if (!shown.length) list.append(h('p', { class: 'ds-menu__heading', text: empty }));
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length); render(); }
      if (event.key === 'Enter' && shown[active]) { event.preventDefault(); close(); this.app.run(shown[active].onSelect); }
    });
    render();
    close = this.open(el, anchor, { focus: input });
    return close;
  }

  /**
   * Modal dialog. Resolves with the chosen action's `value`, or `null` when cancelled.
   * Pressing Enter inside a single-line input picks the primary action.
   */
  dialog({ title, description, body, actions, wide = false }) {
    this.dismiss();
    const dialog = this.dialogEl, t = this.app.t;
    dialog.classList.toggle('is-wide', wide);
    const list = actions ?? [{ label: t('Close', '关闭'), value: null }];
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true; dialog.close(); dialog.replaceChildren(); resolve(value);
      };
      const primary = list.find(action => action.variant === 'primary' || action.variant === 'danger');
      const form = h('form', { class: 'ds-dialog__form', attrs: { method: 'dialog' }, onsubmit: event => { event.preventDefault(); if (primary) finish(primary.value); } },
        h('header', { class: 'ds-dialog__head' },
          h('h2', { text: title }),
          h('button', { type: 'button', class: 'ds-btn ds-btn--icon ds-btn--ghost', attrs: { 'aria-label': t('Close', '关闭') }, onclick: () => finish(null) }, icon('close'))),
        h('div', { class: 'ds-dialog__body' }, description ? h('p', { class: 'ds-dialog__desc', text: description }) : null, body ?? null),
        h('footer', { class: 'ds-dialog__actions' }, list.map(action => h('button', {
          type: action === primary ? 'submit' : 'button',
          class: `ds-btn${action.variant ? ` ds-btn--${action.variant}` : ''}`,
          onclick: action === primary ? undefined : () => finish(action.value),
        }, action.label))));
      dialog.replaceChildren(form);
      dialog.oncancel = event => { event.preventDefault(); finish(null); };
      dialog.showModal();
      (dialog.querySelector('[autofocus], .ds-dialog__body input, .ds-dialog__body select, .ds-dialog__body textarea') ?? dialog.querySelector('footer button'))?.focus();
    });
  }

  async confirm(title, message, { ok, danger = false } = {}) {
    const t = this.app.t;
    return await this.dialog({ title, description: message, actions: [{ label: t('Cancel', '取消'), value: false }, { label: ok ?? t('Continue', '继续'), value: true, variant: danger ? 'danger' : 'primary' }] }) === true;
  }

  toast(message, { kind = 'info', timeout, action } = {}) {
    const el = h('div', { class: `ds-toast is-${kind}` },
      icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'message'),
      h('p', { text: message }),
      action ? h('button', { type: 'button', class: 'ds-btn ds-btn--ghost', onclick: () => { el.remove(); this.app.run(action.onClick); } }, action.label) : null,
      h('button', { type: 'button', class: 'ds-btn ds-btn--icon ds-btn--ghost', attrs: { 'aria-label': this.app.t('Dismiss', '关闭') }, onclick: () => el.remove() }, icon('close')));
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => el.remove(), timeout ?? (kind === 'error' ? 9000 : 4500));
  }
}
