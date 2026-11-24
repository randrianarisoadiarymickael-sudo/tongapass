/**
 * Brouillons de formulaire dans sessionStorage : propres à l'onglet, effacés à la fermeture
 * de l'onglet, à la déconnexion et après 12 heures. Ils survivent à une navigation dans le
 * portail, à un rechargement et à une reconnexion Keycloak après expiration de la session.
 */
const PREFIX = 'tongapass:brouillon:';
const VERSION = 1;
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface Draft<T> {
  savedAt: number;
  step: number;
  data: T;
}

interface StoredDraft<T> extends Draft<T> {
  v: number;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null; // stockage désactivé par le navigateur
  }
}

export function loadDraft<T>(name: string, now = Date.now()): Draft<T> | null {
  const store = storage();
  const raw = store?.getItem(PREFIX + name);
  if (!store || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (parsed.v !== VERSION || typeof parsed.savedAt !== 'number' || now - parsed.savedAt > DRAFT_MAX_AGE_MS || !parsed.data) {
      store.removeItem(PREFIX + name);
      return null;
    }
    return { savedAt: parsed.savedAt, step: Number(parsed.step) || 0, data: parsed.data };
  } catch {
    store.removeItem(PREFIX + name);
    return null;
  }
}

export function saveDraft<T>(name: string, step: number, data: T, now = Date.now()): void {
  const value: StoredDraft<T> = { v: VERSION, savedAt: now, step, data };
  try {
    storage()?.setItem(PREFIX + name, JSON.stringify(value));
  } catch {
    // quota dépassé : le brouillon est facultatif, la saisie continue
  }
}

export function clearDraft(name: string): void {
  storage()?.removeItem(PREFIX + name);
}

/** Appelé à la déconnexion : aucun brouillon ne reste dans le navigateur. */
export function clearAllDrafts(): void {
  const store = storage();
  if (!store) return;
  for (const key of Object.keys(store)) {
    if (key.startsWith(PREFIX)) store.removeItem(key);
  }
}
