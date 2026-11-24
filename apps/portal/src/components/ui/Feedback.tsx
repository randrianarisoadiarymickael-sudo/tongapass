import type { ReactNode } from 'react';
import { IconAlert, IconRetry } from '@/components/icons';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-sunken text-ink-3 [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children ? <p className="max-w-sm text-[13px] text-ink-3">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn('flex items-start gap-3 rounded-[var(--radius-panel)] border border-danger/30 bg-danger-soft px-4 py-3 text-sm', className)}
    >
      <IconAlert className="mt-0.5 size-5 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-danger">Chargement impossible</p>
        <p className="text-ink-2">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry} icon={<IconRetry className="size-3.5" />}>
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}

/** Panneau : en-tête facultatif, corps, coins de 12 px. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
  icon,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** Pictogramme discret à gauche du titre. */
  icon?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn('panel overflow-hidden rounded-[var(--radius-panel)]', className)}
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span className="flex shrink-0 items-center text-ink-3 [&_svg]:size-[18px]" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 id={id ? `${id}-title` : undefined} className="text-[14.5px] font-semibold">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="text-[13px] text-ink-3">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName ?? 'p-5'}>{children}</div>
    </section>
  );
}

/** En-tête de page : surtitre facultatif, titre, description et actions. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="text-[13px] font-medium text-ink-3">{eyebrow}</p> : null}
        <h1 className="workspace-title text-[clamp(2.25rem,4vw,3.25rem)] leading-none tracking-[-0.025em]">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1 font-sans text-[11px] font-semibold text-ink-3">
      {children}
    </kbd>
  );
}

/** Initiales sur fond teinté par la couleur du profil d'accès ; le texte mêle teinte et encre pour rester lisible dans les deux thèmes. */
export function Avatar({ first, last, color, size = 'md' }: { first: string; last: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-[11px]', md: 'size-9 text-xs', lg: 'size-14 text-base' };
  const tint = color ?? 'var(--tp-brand)';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset', sizes[size])}
      style={{
        background: `color-mix(in oklab, ${tint} 16%, var(--tp-solid))`,
        color: `color-mix(in oklab, ${tint} 50%, var(--tp-ink))`,
        ['--tw-ring-color' as string]: `color-mix(in oklab, ${tint} 30%, transparent)`,
      }}
    >
      {`${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()}
    </span>
  );
}

/**
 * Ligne libellé / valeur pour les fiches. Les valeurs longues (adresse e-mail, identifiant)
 * passent à la ligne au lieu d'être tronquées : l'information reste lisible en entier.
 */
export function DescriptionItem({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn('mt-0.5 text-sm font-medium text-ink [overflow-wrap:anywhere]', mono && 'font-mono text-[13px] font-normal')} translate={mono ? 'no' : undefined}>
        {children}
      </dd>
    </div>
  );
}
