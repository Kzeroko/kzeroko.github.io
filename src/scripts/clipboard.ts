import { $$, once } from './dom';

/**
 * Copies a heading's permalink and confirms it in place.
 *
 * The confirmation label lives on the button as `data-copied-label` so it can
 * be localised by the rendering component instead of hard-coded here.
 */
export function initCopyLinks(): void {
  once('copy-links', () => {
    const buttons = $$<HTMLButtonElement>('[data-copy-link]');
    if (buttons.length === 0 || !navigator.clipboard) return;

    for (const button of buttons) {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        const href = button.dataset.copyLink;
        if (!href) return;

        try {
          await navigator.clipboard.writeText(new URL(href, location.href).toString());
          button.setAttribute('data-copied', '');
          setTimeout(() => button.removeAttribute('data-copied'), 1600);
        } catch {
          /* Clipboard blocked — the anchor is still a normal link. */
        }
      });
    }
  });
}
