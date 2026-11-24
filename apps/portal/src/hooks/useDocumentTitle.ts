import { useEffect } from 'react';

/** Titre d'onglet toujours exact pour le contexte courant (lecteurs d'écran, historique). */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · TongaPass` : 'TongaPass';
  }, [title]);
}
