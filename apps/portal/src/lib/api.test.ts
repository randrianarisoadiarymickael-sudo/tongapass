import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, buildQuery } from './api';

describe('requêtes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('transforme un délai dépassé en erreur explicite, avec possibilité de réessayer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError')));
    await expect(api.get('/me')).rejects.toMatchObject({ name: 'ApiError', status: 0, problem: { type: 'timeout', title: 'Délai dépassé' } });
  });

  it('signale un réseau indisponible sans masquer une annulation volontaire', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.get('/me')).rejects.toMatchObject({ problem: { type: 'network' } });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(api.get('/me')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('buildQuery', () => {
  it('ignore les valeurs vides et joint les tableaux', () => {
    expect(buildQuery({ search: 'rakoto', status: ['ACTIVE', 'FAILED'], empty: '', none: undefined, page: 2 })).toBe(
      '?search=rakoto&status=ACTIVE%2CFAILED&page=2',
    );
    expect(buildQuery({})).toBe('');
  });
});

describe('ApiError', () => {
  it('expose les erreurs de champ du format RFC 9457', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Requête invalide',
      status: 400,
      detail: 'Certains champs sont invalides',
      errors: [{ field: 'personalEmail', messages: ['Adresse e-mail personnelle invalide'] }],
    });
    expect(error.message).toBe('Certains champs sont invalides');
    expect(error.fieldErrors()).toEqual({ personalEmail: 'Adresse e-mail personnelle invalide' });
  });
});
