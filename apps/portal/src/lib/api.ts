import { config } from './config';
import { getAccessToken } from './keycloak';
import type { ProblemDetails } from './types';

/** Erreur d'API au format RFC 9457, enrichie pour l'affichage. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.problem.errors ?? []).map((e) => [e.field, e.messages.join(' · ')]));
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Au-delà, la requête est abandonnée et l'écran propose de réessayer au lieu d'attendre indéfiniment. */
export const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout(signal?: AbortSignal): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') return signal;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}${buildQuery(options.query)}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: withTimeout(options.signal),
    });
  } catch (error) {
    if ((error as Error).name === 'TimeoutError') {
      throw new ApiError({
        type: 'timeout',
        title: 'Délai dépassé',
        status: 0,
        detail: `L’API TongaPass n’a pas répondu en ${REQUEST_TIMEOUT_MS / 1000} secondes. Réessayez dans un instant.`,
      });
    }
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError({
      type: 'network',
      title: 'Réseau indisponible',
      status: 0,
      detail: 'Impossible de joindre l’API TongaPass. Vérifiez votre connexion puis réessayez.',
    });
  }

  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  const payload: unknown = type.includes('json') ? await response.json().catch(() => null) : await response.text();
  if (!response.ok) {
    const problem = (payload && typeof payload === 'object' ? payload : {}) as Partial<ProblemDetails>;
    throw new ApiError({
      type: problem.type ?? 'about:blank',
      title: problem.title ?? 'Erreur',
      status: response.status,
      detail: problem.detail ?? `La requête a échoué (HTTP ${response.status}).`,
      errors: problem.errors,
      requestId: problem.requestId,
    });
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>('POST', path, { body: body ?? {}, headers }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** Téléchargement authentifié (ex. export CSV) sans exposer le jeton dans une URL. */
  async download(path: string, query: Query | undefined, filename: string): Promise<void> {
    const token = await getAccessToken();
    const response = await fetch(`${config.apiUrl}${path}${buildQuery(query)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError({ type: 'download', title: 'Export impossible', status: response.status, detail: 'Le fichier n’a pas pu être généré.' });
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Une erreur inattendue est survenue.';
}
