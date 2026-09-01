import { $, $$, lockScroll, once, trapFocus } from './dom';

/* -------------------------------------------------------------------------- */
/* Index shape (kept terse — it ships over the wire)                            */
/* -------------------------------------------------------------------------- */

export interface SearchDoc {
  /** Title */
  t: string;
  /** Description / summary */
  d: string;
  /** URL */
  u: string;
  /** Section key: wiki | codex | blog | page */
  s: 'wiki' | 'codex' | 'blog' | 'page';
  /** Lower-cased haystack: title + description + headings + body excerpt */
  k: string;
  /** Optional context line (category, character epithet, date) */
  c?: string;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                     */
/* -------------------------------------------------------------------------- */

const CJK = /[㐀-鿿豈-﫿぀-ヿ]/;

/**
 * Splits a query into terms.
 *
 * Latin text splits on whitespace. CJK has no word boundaries, so runs of CJK
 * are additionally emitted as overlapping bigrams — "破碎空间" then matches a
 * document containing "破碎" or "空间" without needing a segmenter.
 */
function terms(query: string): string[] {
  const out = new Set<string>();
  for (const chunk of query.toLowerCase().split(/[\s,.、，。/|]+/).filter(Boolean)) {
    out.add(chunk);
    if (CJK.test(chunk) && chunk.length > 2) {
      for (let i = 0; i < chunk.length - 1; i += 1) out.add(chunk.slice(i, i + 2));
    }
  }
  return [...out];
}

function scoreDoc(doc: SearchDoc, queryTerms: string[], rawQuery: string): number {
  const title = doc.t.toLowerCase();
  let score = 0;

  if (title === rawQuery) score += 200;
  else if (title.startsWith(rawQuery)) score += 120;
  else if (title.includes(rawQuery)) score += 80;

  for (const term of queryTerms) {
    if (title.includes(term)) score += 30;
    if (doc.d.toLowerCase().includes(term)) score += 12;

    const index = doc.k.indexOf(term);
    if (index === -1) {
      // Every term must appear somewhere, otherwise the match is too loose.
      return 0;
    }
    // Earlier in the haystack means closer to the title/headings.
    score += 8 + Math.max(0, 6 - Math.floor(index / 400));
  }

  // Wiki and codex pages are the reference material people come here for.
  if (doc.s === 'wiki' || doc.s === 'codex') score += 4;

  return score;
}

export function search(docs: SearchDoc[], query: string, limit = 12): SearchDoc[] {
  const raw = query.trim().toLowerCase();
  if (raw.length === 0) return [];
  const queryTerms = terms(raw);

  return docs
    .map((doc) => ({ doc, score: scoreDoc(doc, queryTerms, raw) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.doc);
}

/* -------------------------------------------------------------------------- */
/* Dialog                                                                      */
/* -------------------------------------------------------------------------- */

interface DialogStrings {
  empty: string;
  emptyHint: string;
  idle: string;
  groups: Record<SearchDoc['s'], string>;
}

function highlight(text: string, query: string): string {
  const escaped = text.replace(/[&<>"]/g, (char) =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&quot;'
  );
  const needle = query.trim();
  if (needle.length < 1) return escaped;

  const pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(pattern, 'gi'), (match) => `<mark>${match}</mark>`);
}

export function initSearch(): void {
  once('search', () => {
    const dialog = $<HTMLDialogElement>('[data-search-dialog]');
    const input = $<HTMLInputElement>('[data-search-input]');
    const results = $<HTMLElement>('[data-search-results]');
    const status = $<HTMLElement>('[data-search-status]');
    if (!dialog || !input || !results || !status) return;

    const strings: DialogStrings = JSON.parse(dialog.dataset.strings ?? '{}');
    const endpoint = dialog.dataset.endpoint!;

    let docs: SearchDoc[] | null = null;
    let loading: Promise<SearchDoc[]> | null = null;
    let releaseFocus: (() => void) | null = null;
    let activeIndex = 0;

    const loadIndex = () => {
      if (docs) return Promise.resolve(docs);
      loading ??= fetch(endpoint)
        .then((response) => response.json() as Promise<SearchDoc[]>)
        .then((data) => {
          docs = data;
          return data;
        })
        .catch(() => {
          loading = null;
          return [];
        });
      return loading;
    };

    const renderIdle = () => {
      results.innerHTML = '';
      status.textContent = strings.idle ?? '';
      status.hidden = false;
    };

    const render = (query: string) => {
      if (!docs || query.trim().length === 0) {
        renderIdle();
        return;
      }

      const hits = search(docs, query);
      if (hits.length === 0) {
        results.innerHTML = '';
        status.innerHTML = `<strong>${strings.empty} “${highlight(query, '')}”</strong><span>${strings.emptyHint}</span>`;
        status.hidden = false;
        return;
      }

      status.hidden = true;
      activeIndex = 0;
      results.innerHTML = hits
        .map(
          (doc, index) => `
            <li role="option" aria-selected="${index === 0}" ${index === 0 ? 'data-active' : ''}>
              <a href="${doc.u}" tabindex="-1">
                <span class="search__group">${strings.groups?.[doc.s] ?? doc.s}</span>
                <span class="search__title">${highlight(doc.t, query)}</span>
                <span class="search__desc">${highlight(doc.d, query)}</span>
              </a>
            </li>`
        )
        .join('');
    };

    const move = (delta: number) => {
      const items = $$<HTMLLIElement>('li', results);
      if (items.length === 0) return;
      items[activeIndex]?.removeAttribute('data-active');
      items[activeIndex]?.setAttribute('aria-selected', 'false');
      activeIndex = (activeIndex + delta + items.length) % items.length;
      const next = items[activeIndex]!;
      next.setAttribute('data-active', '');
      next.setAttribute('aria-selected', 'true');
      next.scrollIntoView({ block: 'nearest' });
    };

    const open = () => {
      if (dialog.open) return;
      dialog.showModal();
      lockScroll(true);
      releaseFocus = trapFocus(dialog);
      renderIdle();
      void loadIndex().then(() => render(input.value));
      requestAnimationFrame(() => input.focus());
    };

    const close = () => {
      if (!dialog.open) return;
      dialog.close();
    };

    dialog.addEventListener('close', () => {
      lockScroll(false);
      releaseFocus?.();
      releaseFocus = null;
      input.value = '';
      results.innerHTML = '';
    });

    // Clicking the backdrop (the dialog element itself) dismisses.
    dialog.addEventListener('pointerdown', (event) => {
      if (event.target === dialog) close();
    });

    for (const closer of $$('[data-search-close]')) {
      closer.addEventListener('click', close);
    }

    for (const trigger of $$('[data-search-open]')) {
      trigger.addEventListener('click', open);
      // Warm the index on intent so the first keystroke has data.
      trigger.addEventListener('pointerenter', () => void loadIndex(), { once: true });
    }

    input.addEventListener('input', () => {
      void loadIndex().then(() => render(input.value));
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Enter') {
        const link = results.querySelector<HTMLAnchorElement>('li[data-active] a');
        if (link) {
          event.preventDefault();
          window.location.href = link.href;
        }
      }
    });

    document.addEventListener('keydown', (event) => {
      const isShortcut = (event.key === 'k' && (event.metaKey || event.ctrlKey)) || event.key === '/';
      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (typing && event.key === '/') return;

      event.preventDefault();
      dialog.open ? close() : open();
    });
  });
}
