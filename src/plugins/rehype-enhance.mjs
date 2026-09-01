/**
 * Post-processing for rendered Markdown/MDX.
 *
 * Written as a local plugin instead of pulling in `rehype-slug` +
 * `rehype-autolink-headings` + `rehype-wrap`: Astro already assigns heading
 * ids, and the remaining work is a single tree walk.
 *
 * Does three things:
 *  1. Wraps every table in a horizontally scrollable container, so wide data
 *     tables never force the page body to scroll sideways.
 *  2. Adds a permalink anchor to h2–h4.
 *  3. Marks external links with `rel="noopener noreferrer"` and `target`.
 */

const HEADINGS = new Set(['h2', 'h3', 'h4']);

/** @returns {(tree: any) => void} */
export function rehypeEnhance() {
  return (tree) => {
    walk(tree, null, -1);
  };

  function walk(node, parent, index) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'element') {
      if (node.tagName === 'table' && parent && parent.tagName !== 'div') {
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['table-scroll'], tabIndex: 0, role: 'region' },
          children: [node],
        };
        parent.children[index] = wrapper;
        // Continue into the original table below; the wrapper adds no children.
      }

      if (HEADINGS.has(node.tagName) && node.properties?.id) {
        const id = String(node.properties.id);
        node.children.push({
          type: 'element',
          tagName: 'a',
          properties: {
            className: ['heading-anchor'],
            href: `#${id}`,
            'aria-hidden': 'true',
            tabIndex: -1,
          },
          children: [{ type: 'text', value: '#' }],
        });
      }

      if (node.tagName === 'a') {
        const href = node.properties?.href;
        if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = 'noopener noreferrer';
        }
      }
    }

    const children = node.children;
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; i += 1) {
      walk(children[i], node, i);
    }
  }
}

export default rehypeEnhance;
