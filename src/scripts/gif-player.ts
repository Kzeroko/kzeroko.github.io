import { $$, once } from './dom';

/**
 * Swaps a build-time poster for the real animation on demand.
 *
 * The GIF is preloaded off-DOM so the swap happens on a decoded image and the
 * frame never flashes empty.
 */
export function initGifPlayers(): void {
  once('gif-player', () => {
    for (const frame of $$<HTMLButtonElement>('[data-gif-src]')) {
      frame.addEventListener(
        'click',
        () => {
          const src = frame.dataset.gifSrc;
          const poster = frame.querySelector('img');
          if (!src || !poster) return;

          frame.setAttribute('data-loading', '');
          const animation = new Image();
          animation.decoding = 'async';

          animation.addEventListener('load', () => {
            poster.src = src;
            poster.removeAttribute('srcset');
            frame.removeAttribute('data-loading');
            frame.setAttribute('data-playing', '');
            frame.disabled = true;
          });

          animation.addEventListener('error', () => {
            frame.removeAttribute('data-loading');
          });

          animation.src = src;
        },
        { once: true }
      );
    }
  });
}
