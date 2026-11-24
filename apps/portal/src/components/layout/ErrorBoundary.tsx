import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconRetry } from '@/components/icons';
import { Button } from '../ui/Button';

interface State {
  error: Error | null;
}

/** Évite l'écran blanc : une erreur de rendu affiche un message et une action de reprise. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Erreur d’affichage', error, info.componentStack);
  }

  componentDidUpdate(previous: { resetKey?: string }): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold">Cette page n’a pas pu s’afficher</h1>
        <p className="mt-2 text-sm text-ink-3">
          Une erreur inattendue s’est produite. Vos données ne sont pas affectées. Rechargez la page ou revenez au tableau de bord.
        </p>
        <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-ink-3">{this.state.error.message}</p>
        <Button className="mt-5" variant="primary" onClick={() => window.location.reload()} icon={<IconRetry className="size-4" />}>
          Recharger
        </Button>
      </div>
    );
  }
}
