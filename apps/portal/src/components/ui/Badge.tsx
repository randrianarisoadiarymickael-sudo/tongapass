import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { COMPLIANCE_STATUS, EMPLOYEE_STATUS, RUN_STATUS, STEP_STATUS, TONE_CLASSES, TONE_DOT, TONE_TEXT, type Tone } from '@/lib/labels';
import type { ComplianceStatus, EmployeeStatus, RunStatus, StepStatus } from '@/lib/types';

export function Badge({
  tone = 'neutral',
  children,
  dot = true,
  live = false,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? (
        live ? (
          // Point « en direct » : une onde s'élargit autour (désactivée si animations réduites)
          <span className={cn('live-dot size-1.5', TONE_TEXT[tone])} aria-hidden="true" />
        ) : (
          <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden="true" />
        )
      ) : null}
      {children}
    </span>
  );
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const meta = EMPLOYEE_STATUS[status];
  return (
    <Badge tone={meta.tone} live={status === 'PROVISIONING' || status === 'OFFBOARDING'}>
      {meta.label}
    </Badge>
  );
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = RUN_STATUS[status];
  return (
    <Badge tone={meta.tone} live={status === 'RUNNING' || status === 'QUEUED'}>
      {meta.label}
    </Badge>
  );
}

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const meta = STEP_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const meta = COMPLIANCE_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Étiquette compacte pour un droit (rôle, groupe, équipe, canal), avec variante d'écart. */
export function AccessChip({
  children,
  sensitive = false,
  prefix,
  change,
}: {
  children: ReactNode;
  sensitive?: boolean;
  prefix?: string;
  change?: 'added' | 'removed';
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-lg border px-2 font-mono text-[12px]',
        change === 'added' && 'border-success/30 bg-success-soft text-success',
        change === 'removed' && 'border-danger/30 bg-danger-soft text-danger line-through decoration-danger/50',
        !change && (sensitive ? 'border-warning/35 bg-warning-soft text-warning' : 'border-line bg-surface text-ink-2'),
      )}
      title={sensitive ? 'Droit sensible : justification requise' : undefined}
    >
      {change === 'added' ? <span aria-hidden="true">+</span> : null}
      {change === 'removed' ? <span aria-hidden="true">−</span> : null}
      <span translate="no">
        {prefix ? (
          <span className="text-ink-3" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        {children}
      </span>
      {sensitive ? <span className="sr-only">(droit sensible)</span> : null}
      {change ? <span className="sr-only">{change === 'added' ? '(ajouté)' : '(retiré)'}</span> : null}
    </span>
  );
}
