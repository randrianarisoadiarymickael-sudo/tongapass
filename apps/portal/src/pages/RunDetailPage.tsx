import { IconCalendar, IconChevronRight, IconExternal, IconRetry } from '@/components/icons';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { ScheduledRunActions } from '@/components/flow/ScheduledRunActions';
import { RunTimeline } from '@/components/flow/RunTimeline';
import { RunStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Panel, Skeleton } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Progress';
import { useProfiles, useRetryRun, useRun } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOrigin } from '@/hooks/useOrigin';
import { errorMessage } from '@/lib/api';
import { durationBetween, formatDateTime, formatDuration } from '@/lib/format';
import { DEPARTURE_REASONS, RUN_TYPE } from '@/lib/labels';
import type { RunDetail } from '@/lib/types';

const HEADING: Record<RunDetail['type'], string> = { ONBOARDING: 'Arrivée de', MOBILITY: 'Mobilité de', OFFBOARDING: 'Départ de' };

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium tabular">{children}</dd>
    </div>
  );
}

/** Ce que l'exécution change : profil cible pour une mobilité, motif pour un départ. */
function RunContext({ run }: { run: RunDetail }) {
  const profiles = useProfiles(true);
  const options = run.options ?? {};
  if (run.type === 'MOBILITY') {
    const target = profiles.data?.find((p) => p.id === options.targetProfileId);
    const extra = Array.isArray(options.extraRealmRoles) ? (options.extraRealmRoles as string[]) : [];
    return (
      <>
        <SummaryRow label="Profil cible">
          {target ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: target.color }} aria-hidden="true" />
              {target.name}
            </span>
          ) : (
            '—'
          )}
        </SummaryRow>
        {typeof options.jobTitle === 'string' ? <SummaryRow label="Nouveau poste">{options.jobTitle}</SummaryRow> : null}
        {typeof options.department === 'string' ? <SummaryRow label="Nouveau département">{options.department}</SummaryRow> : null}
        {extra.length ? <SummaryRow label="Droits supplémentaires">{extra.join(', ')}</SummaryRow> : null}
      </>
    );
  }
  if (run.type === 'OFFBOARDING' && typeof options.reason === 'string') {
    const label = DEPARTURE_REASONS.find((r) => r.value === options.reason)?.label ?? options.reason;
    return (
      <SummaryRow label="Motif">
        {label}
        {options.automatic ? <span className="ml-1 font-normal text-ink-3">(automatique)</span> : null}
      </SummaryRow>
    );
  }
  return null;
}

export function RunDetailPage() {
  const { id = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const { data: run, isPending, error, refetch } = useRun(id);
  const retry = useRetryRun();
  const origin = useOrigin({ path: '/executions', label: 'Exécutions' });
  useDocumentTitle(run ? `${RUN_TYPE[run.type]} de ${run.employee.firstName} ${run.employee.lastName}` : 'Exécution');

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !run) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const live = run.status === 'RUNNING' || run.status === 'QUEUED';
  const scheduled = run.status === 'SCHEDULED';
  const canManage = me.permissions.manageEmployees;
  const duration = durationBetween(run.startedAt, run.finishedAt);
  const n8nLink = me.workspace.links.n8n && run.n8nExecutionId ? `${me.workspace.links.n8n}/home/executions` : null;
  const pct = run.progress.total ? Math.round((run.progress.done / run.progress.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-1 text-[13px] text-ink-3">
        <Link to={origin.path} className="hover:text-ink">
          {origin.label}
        </Link>
        <IconChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-ink" aria-current="page">
          {RUN_TYPE[run.type]} · {run.employee.firstName} {run.employee.lastName}
        </span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold leading-7">
              {HEADING[run.type]}{' '}
              <Link to={`/employes/${run.employee.id}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                {run.employee.firstName} {run.employee.lastName}
              </Link>
            </h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-sm text-ink-3">
            Déclenchée par {run.triggeredBy} le {formatDateTime(run.createdAt)}
            {run.attempt > 1 ? ` · tentative ${run.attempt}` : ''}
            {run.reason ? ` · ${run.reason}` : ''}
          </p>
        </div>
        {canManage && ['FAILED', 'PARTIAL', 'TIMED_OUT'].includes(run.status) ? (
          <Button
            variant="primary"
            loading={retry.isPending}
            onClick={async () => {
              try {
                const next = await retry.mutateAsync(run.id);
                toast.success('Workflow relancé', { description: 'Les étapes déjà réalisées sont reconnues sans doublon.' });
                navigate(`/executions/${next.id}`);
              } catch (e) {
                toast.error('Relance impossible', { description: errorMessage(e) });
              }
            }}
            icon={<IconRetry className="size-4" aria-hidden="true" />}
          >
            Relancer le workflow
          </Button>
        ) : null}
      </div>

      {scheduled ? (
        <div className="flex flex-wrap items-center gap-3 panel rounded-[var(--radius-panel)] px-4 py-3">
          <IconCalendar className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Exécution planifiée le {formatDateTime(run.scheduledFor)}.</span>{' '}
            <span className="text-ink-3">Le planificateur la déclenchera automatiquement.</span>
          </p>
          {canManage ? <ScheduledRunActions run={run} employeeName={`${run.employee.firstName} ${run.employee.lastName}`} /> : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title="Étapes"
          description={
            live ? 'Mise à jour à chaque signal de n8n' : scheduled ? 'Aucune étape exécutée pour l’instant' : `${run.progress.done} sur ${run.progress.total} exécutée(s)`
          }
          id="steps"
          actions={
            live ? (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-info-soft px-2.5 text-xs font-semibold text-info ring-1 ring-inset ring-info/25">
                <span className="live-dot size-1.5" aria-hidden="true" /> En direct
              </span>
            ) : null
          }
        >
          {live ? (
            <div className="mb-4">
              <ProgressBar value={pct} tone="brand" label="Progression du workflow" />
            </div>
          ) : null}
          <div aria-live="polite">
            <RunTimeline steps={run.steps} />
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Résumé" id="summary" bodyClassName="px-4 py-1.5">
            <dl className="divide-y divide-line text-sm">
              <SummaryRow label="Type">{RUN_TYPE[run.type]}</SummaryRow>
              <RunContext run={run} />
              <SummaryRow label="Prévue le">{formatDateTime(run.scheduledFor)}</SummaryRow>
              <SummaryRow label="Début">{formatDateTime(run.startedAt)}</SummaryRow>
              <SummaryRow label="Fin">{formatDateTime(run.finishedAt)}</SummaryRow>
              <SummaryRow label="Durée">{formatDuration(duration)}</SummaryRow>
              <SummaryRow label="Exécution n8n">
                <span className="font-mono text-[13px]">{run.n8nExecutionId ? `#${run.n8nExecutionId}` : '—'}</span>
              </SummaryRow>
            </dl>
            {n8nLink ? (
              <a
                href={n8nLink}
                target="_blank"
                rel="noreferrer"
                className="mb-2 mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-info underline-offset-4 hover:underline"
              >
                Ouvrir les exécutions dans n8n <IconExternal className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </Panel>
          {run.error ? (
            <Panel title="Erreurs remontées" id="errors">
              <ul className="space-y-1.5 text-[13px]">
                {run.error.split(' | ').map((line) => (
                  <li key={line} className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-danger">
                    {line}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
