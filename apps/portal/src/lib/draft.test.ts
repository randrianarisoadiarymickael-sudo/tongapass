import { afterEach, describe, expect, it } from 'vitest';
import { DRAFT_MAX_AGE_MS, clearAllDrafts, clearDraft, loadDraft, saveDraft } from './draft';

afterEach(() => window.sessionStorage.clear());

describe('brouillons de formulaire', () => {
  it('restaure l’étape et les données enregistrées', () => {
    saveDraft('arrivee', 1, { firstName: 'Hanitra' }, 1_000);
    expect(loadDraft('arrivee', 2_000)).toEqual({ savedAt: 1_000, step: 1, data: { firstName: 'Hanitra' } });
  });

  it('écarte un brouillon expiré ou illisible', () => {
    saveDraft('arrivee', 0, { firstName: 'Hanitra' }, 0);
    expect(loadDraft('arrivee', DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);

    window.sessionStorage.setItem('tongapass:brouillon:arrivee', '{pas du json');
    expect(loadDraft('arrivee')).toBeNull();
  });

  it('efface un brouillon ou tous les brouillons à la déconnexion', () => {
    saveDraft('arrivee', 0, { a: 1 });
    saveDraft('mobilite', 0, { b: 2 });
    window.sessionStorage.setItem('autre-cle', 'conservée');
    clearDraft('arrivee');
    expect(loadDraft('arrivee')).toBeNull();
    clearAllDrafts();
    expect(loadDraft('mobilite')).toBeNull();
    expect(window.sessionStorage.getItem('autre-cle')).toBe('conservée');
  });
});
