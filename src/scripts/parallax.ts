import { $$, once, prefersReducedMotion } from './dom';

/**
 * Pointer parallax for hero art.
 *
 * Writes two normalised custom properties (`--px`, `--py`, both -1..1) on each
 * marked container; the amount of movement is decided in CSS per layer via
 * `--depth`. Fine pointers only, and never for reduced-motion readers.
 */
export function initParallax(): void {
  once('parallax', () => {
    if (prefersReducedMotion()) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const scenes = $$<HTMLElement>('[data-parallax]');
    if (scenes.length === 0) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const apply = () => {
      frame = 0;
      const x = (pointerX / window.innerWidth) * 2 - 1;
      const y = (pointerY / window.innerHeight) * 2 - 1;
      for (const scene of scenes) {
        scene.style.setProperty('--px', x.toFixed(3));
        scene.style.setProperty('--py', y.toFixed(3));
      }
    };

    window.addEventListener(
      'pointermove',
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (!frame) frame = requestAnimationFrame(apply);
      },
      { passive: true }
    );
  });
}
