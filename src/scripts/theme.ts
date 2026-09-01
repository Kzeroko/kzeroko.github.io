import { $$, once } from './dom';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'ktm2:theme';

function readStored(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    // Private windows and blocked site data throw on access.
    return 'system';
  }
}

function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
  root.dataset.themeChoice = choice;

  // Keep the browser UI colour in step with the rendered surface.
  const dark =
    choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#070b12' : '#f5f2ec');
}

export function setTheme(choice: ThemeChoice): void {
  applyChoice(choice);
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* Storage unavailable — the choice still applies for this page view. */
  }
  syncControls(choice);
}

function syncControls(choice: ThemeChoice): void {
  for (const button of $$<HTMLButtonElement>('[data-theme-option]')) {
    button.setAttribute('aria-checked', String(button.dataset.themeOption === choice));
  }
}

export function initThemeControls(): void {
  once('theme-controls', () => {
    const choice = readStored();
    applyChoice(choice);
    syncControls(choice);

    for (const button of $$<HTMLButtonElement>('[data-theme-option]')) {
      button.addEventListener('click', () => {
        setTheme((button.dataset.themeOption ?? 'system') as ThemeChoice);
      });
    }

    // A system-preference flip must repaint immediately while "system" is active.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (readStored() === 'system') applyChoice('system');
    });
  });
}
