/**
 * Icon path registry.
 *
 * Lives in a .ts module (not the .astro component) so the `IconName` union can
 * be imported by data modules and other components for type-safe icon keys.
 *
 * Outline icons are drawn on a 24x24 grid and inherit stroke from `.icon`.
 * Brand marks are filled paths and render with `.icon--filled`.
 */

export const OUTLINE = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.6V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.6"/>',
  scales:
    '<path d="M12 3v18"/><path d="M7 21h10"/><path d="m5 7 7-2 7 2"/><path d="M5 7 2 14h6L5 7Z"/><path d="M19 7l-3 7h6l-3-7Z"/>',
  sparkles:
    '<path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z"/><path d="M18.5 15.5 19.3 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2.5Z"/><path d="M5.5 2.5 6.2 4.7 8.5 5.5 6.2 6.2 5.5 8.5 4.8 6.2 2.5 5.5 4.8 4.7 5.5 2.5Z"/>',
  users:
    '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.4"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.9"/><path d="M16.5 3.7a4 4 0 0 1 0 7.1"/>',
  cube: '<path d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z"/><path d="m3.5 7 8.5 4.6L20.5 7"/><path d="M12 21.4v-9.8"/>',
  sword:
    '<path d="M20.5 3.5 12 12l-1.2 3.6L14.4 14l8.1-8.1V3.5h-2Z" transform="translate(-1 0)"/><path d="m9.4 12.9-6 6"/><path d="m6.7 14.9 2.4 2.4"/><path d="M4.6 17.1 2 19.7l2.3 2.3 2.6-2.6"/>',
  wrench:
    '<path d="M15.6 3.5a5 5 0 0 0-5.7 6.6L3.3 16.7a2 2 0 0 0 0 2.8l1.2 1.2a2 2 0 0 0 2.8 0l6.6-6.6a5 5 0 0 0 6.6-5.7l-3 3-2.8-.7-.7-2.8 3-3Z"/>',
  castle:
    '<path d="M3 21V9l2-2v2h3V6l2-2 2 2v3h3V7l2 2v12"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/><path d="M3 13h18"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-9 9 9 9 0 0 1-9-9Z"/><path d="M8.5 7.5c0-1.5 1.5-1.8 1.5-3.2"/><path d="M12.5 7.5c0-1.5 1.5-1.8 1.5-3.2"/>',
  music:
    '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3.2 9h17.6M3.2 15h17.6"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  menu: '<path d="M3.5 7h17M3.5 12h17M3.5 17h17"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  arrowLeft: '<path d="M20 12H5"/><path d="m11 18-6-6 6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
  link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v4H6.5A2.5 2.5 0 0 1 4 19.5Z"/>',
  map: '<path d="m9 4 6 2 5.4-1.8a.5.5 0 0 1 .6.5v13.6l-6 2-6-2-5.4 1.8a.5.5 0 0 1-.6-.5V6.2L9 4Z"/><path d="M9 4v14M15 6v14"/>',
  hammer:
    '<path d="m14.5 6.5 3 3L20 7a2.5 2.5 0 0 0-3.5-3.5L14.5 6.5Z"/><path d="m13.5 7.5-9 9a2 2 0 0 0 2.8 2.8l9-9"/><path d="m3 10 4-4 3 3"/>',
  flame:
    '<path d="M12 22c3.9 0 6.5-2.5 6.5-6 0-4.5-4-6-4.5-11-2 1.5-3.2 3.5-3.2 5.5 0 1.6.7 2.5.7 3.4 0 .9-.7 1.6-1.5 1.6-1 0-1.7-.9-1.8-2.4C6.6 14.6 5.5 16.3 5.5 18c0 2.6 2.6 4 6.5 4Z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tag: '<path d="M11 3H4a1 1 0 0 0-1 1v7l9.5 9.5a1.5 1.5 0 0 0 2.1 0l6.9-6.9a1.5 1.5 0 0 0 0-2.1L12 3Z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5.2" cy="18.8" r="1.6" fill="currentColor" stroke="none"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  play: '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>',
  heart:
    '<path d="M12 20.5S3.5 15.2 3.5 9.4a4.9 4.9 0 0 1 8.5-3.3 4.9 4.9 0 0 1 8.5 3.3c0 5.8-8.5 11.1-8.5 11.1Z"/>',
  spark: '<path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  shield: '<path d="M12 2.8 20 6v6c0 4.6-3.3 8-8 9.2C7.3 20 4 16.6 4 12V6l8-3.2Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z"/>',
  gem: '<path d="M7 3h10l4 6-9 12L3 9l4-6Z"/><path d="M3 9h18M9.5 3 7 9l5 12M14.5 3 17 9l-5 12"/>',
  scroll:
    '<path d="M6 3h11a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6"/><path d="M4 6a2 2 0 0 1 2-2"/><path d="M8 8h7M8 12h7M8 16h4"/>',
} as const;

export const BRAND = {
  github:
    '<path d="M12 .8a11.2 11.2 0 0 0-3.5 21.8c.55.1.76-.24.76-.53v-2.1c-3.12.68-3.78-1.3-3.78-1.3-.5-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.28.94.1-.73.4-1.23.72-1.51-2.49-.28-5.1-1.25-5.1-5.56 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.44.1-3 0 0 .95-.3 3.1 1.15a10.7 10.7 0 0 1 5.65 0c2.15-1.46 3.1-1.16 3.1-1.16.6 1.57.22 2.72.11 3.01a4.36 4.36 0 0 1 1.15 3.02c0 4.32-2.62 5.28-5.12 5.55.4.35.76 1.04.76 2.1v3.11c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/>',
  discord:
    '<path d="M19.62 5.6A17.4 17.4 0 0 0 15.3 4.2l-.22.42a16 16 0 0 0-6.16 0L8.7 4.2a17.3 17.3 0 0 0-4.33 1.4C1.63 9.71.9 13.7 1.27 17.65a17.5 17.5 0 0 0 5.3 2.7l.87-1.45c-.7-.26-1.36-.58-1.98-.96l.49-.38a12.4 12.4 0 0 0 10.6 0l.5.38c-.63.38-1.29.7-1.99.96l.87 1.45a17.4 17.4 0 0 0 5.3-2.7c.44-4.58-.73-8.53-2.61-12.05ZM8.55 15.2c-1.04 0-1.9-.96-1.9-2.14 0-1.18.84-2.14 1.9-2.14 1.07 0 1.93.97 1.91 2.14 0 1.18-.85 2.14-1.91 2.14Zm6.9 0c-1.04 0-1.9-.96-1.9-2.14 0-1.18.84-2.14 1.9-2.14 1.07 0 1.92.97 1.9 2.14 0 1.18-.83 2.14-1.9 2.14Z"/>',
  bilibili:
    '<path d="M17.8 2.4a1.3 1.3 0 0 1 0 1.85l-1.4 1.4h1.35A4.25 4.25 0 0 1 22 9.9v7.35a4.25 4.25 0 0 1-4.25 4.25H6.25A4.25 4.25 0 0 1 2 17.25V9.9a4.25 4.25 0 0 1 4.25-4.25H7.6L6.2 4.25A1.31 1.31 0 0 1 8.05 2.4l2.34 2.34c.25.25.4.57.44.9h2.34c.04-.33.19-.65.44-.9l2.34-2.34a1.3 1.3 0 0 1 1.85 0ZM17.75 8.2H6.25c-.9 0-1.63.7-1.7 1.57v7.48c0 .9.7 1.63 1.57 1.7h11.63c.9 0 1.63-.7 1.7-1.57V9.9c0-.94-.76-1.7-1.7-1.7ZM8.38 11.17c.7 0 1.27.57 1.27 1.27v1.28a1.27 1.27 0 1 1-2.55 0v-1.28c0-.7.57-1.27 1.28-1.27Zm7.24 0c.7 0 1.28.57 1.28 1.27v1.28a1.27 1.27 0 1 1-2.55 0v-1.28c0-.7.57-1.27 1.27-1.27Z"/>',
  kook: '<path d="M4.4 2.6h3.4v7.02l6.03-7.02h4.32l-6.3 7.2 6.62 11.6h-4.02l-4.9-8.74-1.75 1.98v6.76H4.4V2.6Z"/><circle cx="19.2" cy="6.1" r="2.1"/>',
} as const;

export type OutlineIconName = keyof typeof OUTLINE;
export type BrandIconName = keyof typeof BRAND;
export type IconName = OutlineIconName | BrandIconName;

export function isBrandIcon(name: IconName): name is BrandIconName {
  return name in BRAND;
}

export function iconPath(name: IconName): string {
  return isBrandIcon(name) ? BRAND[name] : OUTLINE[name as OutlineIconName];
}
