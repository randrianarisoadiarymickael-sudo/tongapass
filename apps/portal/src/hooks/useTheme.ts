import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'tp-theme';
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applique le thème sur <html> (data-theme + meta theme-color). Appelé aussi avant le rendu. */
export function applyTheme(preference: ThemePreference = readPreference()): void {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b191e' : '#f3f7f6');
}

function setPreference(next: ThemePreference): void {
  if (next === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (readPreference() === 'system') {
      applyTheme('system');
      listener();
    }
  };
  media.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onSystemChange);
  };
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as ThemePreference);
  const resolved = resolve(preference);
  return {
    preference,
    resolved,
    set: setPreference,
    toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
  };
}
