import { $$, once, prefersReducedMotion } from './dom';

/**
 * Pointer-tracked spotlight on cards.
 *
 * One delegated `pointermove` on the document feeds CSS custom properties;
 * per-card listeners would be dozens of handlers for a purely cosmetic effect.
 * Skipped entirely for coarse pointers and reduced-motion readers.
 */
export function initPointerEffects(): void {
  once('pointer', () => {
    if (prefersReducedMotion()) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if ($$('.card--spotlight').length === 0) return;

    let frame = 0;
    let pending: { card: HTMLElement; x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const { card, x, y } = pending;
      card.style.setProperty('--pointer-x', `${x}%`);
      card.style.setProperty('--pointer-y', `${y}%`);
      pending = null;
    };

    document.addEventListener(
      'pointermove',
      (event) => {
        const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('.card--spotlight');
        if (!card) return;

        const rect = card.getBoundingClientRect();
        pending = {
          card,
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        };
        if (!frame) frame = requestAnimationFrame(flush);
      },
      { passive: true }
    );
  });
}
