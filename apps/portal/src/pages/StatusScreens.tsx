import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { IconExit, IconOffline, IconRetry, IconShieldAlert } from '@/components/icons';
import { Button, ButtonLink } from '@/components/ui/Button';

function Centered({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <div className="panel w-full max-w-md rounded-xl p-7">{children}</div>
    </main>
  );
}

/** Pictogramme d'un écran d'état, sur un fond teinté selon la gravité. */
function StatusIcon({ children, tone }: { children: ReactNode; tone: 'danger' | 'warning' | 'neutral' }) {
  const tones = { danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning', neutral: 'bg-hover text-ink-3' };
  return <span className={`flex size-11 items-center justify-center rounded-full ${tones[tone]} [&_svg]:size-5`}>{children}</span>;
}

export function LoadingScreen() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-5" aria-busy="true">
      <LogoMark className="size-12" />
      <p className="text-sm text-ink-3">Connexion…</p>
    </main>
  );
}

export function ForbiddenScreen({ username }: { username: string }) {
  const { logout } = useAuth();
  return (
    <Centered>
      <StatusIcon tone="danger">
        <IconShieldAlert />
      </StatusIcon>
      <h1 className="mt-4 text-lg font-semibold">Accès au portail refusé</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Le compte <span className="font-mono text-[13px]">{username}</span> est authentifié mais ne dispose d’aucun rôle TongaPass
        (ressources humaines, audit ou administration). Demandez l’accès à votre administrateur IAM.
      </p>
      <Button className="mt-6" onClick={() => void logout()} icon={<IconExit className="size-4" />}>
        Changer de compte
      </Button>
    </Centered>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <Centered>
      <StatusIcon tone="warning">
        <IconOffline />
      </StatusIcon>
      <h1 className="mt-4 text-lg font-semibold">Service indisponible</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{message}</p>
      <Button className="mt-6" variant="primary" onClick={() => window.location.reload()} icon={<IconRetry className="size-4" />}>
        Réessayer
      </Button>
    </Centered>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-medium text-ink-3">Erreur 404</p>
      <h1 className="mt-2 text-xl font-semibold">Cette page n’existe pas</h1>
      <p className="mt-1.5 text-sm text-ink-3">Le lien est peut-être ancien ou mal saisi.</p>
      <ButtonLink to="/" variant="primary" className="mt-6">
        Retour à la vue d’ensemble
      </ButtonLink>
    </div>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto flex w-fit">
        <StatusIcon tone="neutral">
          <IconShieldAlert />
        </StatusIcon>
      </span>
      <h1 className="mt-4 text-lg font-semibold">Accès réservé</h1>
      <p className="mt-1.5 text-sm text-ink-3">{what}</p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-info hover:underline">
        Retour à la vue d’ensemble
      </Link>
    </div>
  );
}
