/** Small DOM helpers shared by the client modules. */

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document) {
  return root.querySelector<T>(selector);
}

export function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll<T>(selector));
}

/**
 * Runs `fn` once the document is parsed.
 *
 * Astro hoists component `<script>` tags into a deferred module bundle, so the
 * DOM is normally ready already; the readyState check covers the edge case
 * where a module is imported early.
 */
export function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

/**
 * Guards a bootstrap function so repeated imports (one component rendered many
 * times on a page) only wire up listeners once.
 */
export function once(key: string, fn: () => void): void {
  const flag = `__ktm2_${key}`;
  const store = window as unknown as Record<string, boolean>;
  if (store[flag]) return;
  store[flag] = true;
  onReady(fn);
}

/** Locks body scroll while a dialog or menu owns the viewport. */
let scrollLocks = 0;
export function lockScroll(lock: boolean): void {
  scrollLocks = Math.max(0, scrollLocks + (lock ? 1 : -1));
  document.body.toggleAttribute('data-scroll-locked', scrollLocks > 0);
}

/** Traps Tab within `container` until the returned function is called. */
export function trapFocus(container: HTMLElement): () => void {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const focusable = $$<HTMLElement>(selector, container).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}
