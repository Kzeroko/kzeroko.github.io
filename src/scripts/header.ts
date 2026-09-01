import { $, lockScroll, once, trapFocus } from './dom';

/**
 * Header behaviour: a condensed state once the page scrolls, plus the mobile
 * navigation drawer.
 *
 * Scroll state is read in a rAF-throttled listener rather than per-event, and
 * the class only toggles on a threshold crossing so we never touch the DOM on
 * a scroll that changes nothing.
 */
export function initHeader(): void {
  once('header', () => {
    const header = $<HTMLElement>('[data-site-header]');
    if (!header) return;

    let condensed = false;
    let ticking = false;

    const update = () => {
      ticking = false;
      const next = window.scrollY > 12;
      if (next === condensed) return;
      condensed = next;
      header.toggleAttribute('data-condensed', condensed);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ---------------------------------------------------------- drawer -- */

    const drawer = $<HTMLElement>('[data-mobile-nav]');
    const toggle = $<HTMLButtonElement>('[data-mobile-nav-toggle]');
    if (!drawer || !toggle) return;

    let releaseFocus: (() => void) | null = null;

    const setOpen = (open: boolean) => {
      drawer.toggleAttribute('data-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      lockScroll(open);

      if (open) {
        releaseFocus = trapFocus(drawer);
        drawer.querySelector<HTMLElement>('a, button')?.focus();
      } else {
        releaseFocus?.();
        releaseFocus = null;
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => setOpen(!drawer.hasAttribute('data-open')));

    drawer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('a') || target.hasAttribute('data-mobile-nav-close')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && drawer.hasAttribute('data-open')) setOpen(false);
    });

    // Closing on resize keeps the drawer from being stranded open behind the
    // desktop layout, which would leave scroll locked.
    matchMedia('(min-width: 60rem)').addEventListener('change', (event) => {
      if (event.matches && drawer.hasAttribute('data-open')) setOpen(false);
    });
  });
}
