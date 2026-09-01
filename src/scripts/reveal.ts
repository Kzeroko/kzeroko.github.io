import { $$, once, prefersReducedMotion } from './dom';

/**
 * Scroll-triggered entrance animation.
 *
 * The hidden state is only applied after the observer exists, so a reader
 * without JavaScript (or a crawler) sees fully rendered content. Elements are
 * unobserved after their first reveal — nothing re-animates on scroll-back,
 * which reads as noise rather than feedback.
 */
export function initReveal(): void {
  once('reveal', () => {
    const targets = $$('[data-reveal]');
    if (targets.length === 0) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    // Assign stagger indices to children of staggered containers.
    for (const container of $$('[data-reveal-stagger]')) {
      Array.from(container.children).forEach((child, index) => {
        if (child instanceof HTMLElement && !child.style.getPropertyValue('--reveal-index')) {
          child.style.setProperty('--reveal-index', String(index));
        }
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    for (const target of targets) {
      // Anything already on screen at load reveals immediately without the
      // observer round-trip, which avoids a visible flash on fast connections.
      const rect = target.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        target.setAttribute('data-reveal-ready', '');
        requestAnimationFrame(() => target.setAttribute('data-revealed', ''));
        continue;
      }
      target.setAttribute('data-reveal-ready', '');
      observer.observe(target);
    }
  });
}
