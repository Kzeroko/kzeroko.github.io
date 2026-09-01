import { $$, once } from './dom';

/**
 * Fades images in once the bitmap is actually decoded.
 *
 * Images that are already complete when this runs (memory cache, eager load)
 * are marked synchronously, so nothing waits a frame for no reason.
 */
export function initMediaFade(): void {
  once('media-fade', () => {
    const mark = (image: HTMLImageElement) => image.setAttribute('data-loaded', '');

    for (const image of $$<HTMLImageElement>('img[data-fade]')) {
      if (image.complete && image.naturalWidth > 0) {
        mark(image);
        continue;
      }
      image.addEventListener('load', () => mark(image), { once: true });
      image.addEventListener('error', () => mark(image), { once: true });
    }
  });
}
