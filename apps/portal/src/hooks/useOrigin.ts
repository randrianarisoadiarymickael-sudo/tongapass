import { useLocation } from 'react-router';

/** Page d'où l'on vient, avec ses filtres : sert de cible au fil d'Ariane de la page de détail. */
export interface Origin {
  path: string;
  label: string;
}

/** État de navigation à passer aux liens vers une page de détail (`<Link state={…}>`). */
export function useOriginState(label: string): { from: Origin } {
  const location = useLocation();
  return { from: { path: `${location.pathname}${location.search}`, label } };
}

/**
 * Origine transmise par la page précédente, sinon la liste par défaut. Seuls les chemins
 * internes au portail sont acceptés (pas d'URL absolue ni de « //hôte »).
 */
export function useOrigin(fallback: Origin): Origin {
  const location = useLocation();
  const from = (location.state as { from?: Partial<Origin> } | null)?.from;
  if (from && typeof from.path === 'string' && typeof from.label === 'string' && /^\/(?!\/)/.test(from.path)) {
    return { path: from.path, label: from.label };
  }
  return fallback;
}
