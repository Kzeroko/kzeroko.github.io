import { $$, once } from './dom';

/**
 * Highlights the table-of-contents entry for the section currently being read.
 *
 * Uses one IntersectionObserver over the headings with a band near the top of
 * the viewport, rather than measuring offsets on scroll. When no heading is in
 * the band (long sections), the last one that passed upward stays active.
 */
export function initTableOfContents(): void {
  once('toc', () => {
    const links = $$<HTMLAnchorElement>('[data-toc] a[href^="#"]');
    if (links.length === 0) return;

    const byId = new Map<string, HTMLAnchorElement>();
    for (const link of links) {
      const id = decodeURIComponent(link.hash.slice(1));
      if (id) byId.set(id, link);
    }

    const headings = [...byId.keys()]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    let activeId = '';
    const setActive = (id: string) => {
      if (id === activeId) return;
      byId.get(activeId)?.removeAttribute('data-active');
      activeId = id;
      const link = byId.get(id);
      if (!link) return;
      link.setAttribute('data-active', '');
      link.parentElement?.scrollIntoView?.({ block: 'nearest' });
    };

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }

        if (visible.size > 0) {
          // Topmost visible heading wins.
          const first = headings.find((heading) => visible.has(heading.id));
          if (first) setActive(first.id);
          return;
        }

        // Nothing in the band: fall back to the last heading above it.
        const scrolled = window.scrollY + window.innerHeight * 0.2;
        let candidate = headings[0];
        for (const heading of headings) {
          if (heading.offsetTop <= scrolled) candidate = heading;
        }
        if (candidate) setActive(candidate.id);
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 }
    );

    for (const heading of headings) observer.observe(heading);
  });
}
