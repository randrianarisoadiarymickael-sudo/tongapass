import { IconChevronLeft, IconChevronRight, IconFlow } from '@/components/icons';
import { Link, useSearchParams } from 'react-router';
import { useMe } from '@/auth/AuthProvider';
import { StepSegments } from '@/components/flow/RunTimeline';
import { ScheduledRunActions } from '@/components/flow/ScheduledRunActions';
import { RunStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useRuns } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOriginState } from '@/hooks/useOrigin';
import { cn } from '@/lib/cn';
import { durationBetween, formatDateTime, formatDuration } from '@/lib/format';
import { RUN_TYPE } from '@/lib/labels';

const TYPES = [
  { value: '', label: 'Tout' },
  { value: 'ONBOARDING', label: 'Arrivées' },
  { value: 'MOBILITY', label: 'Mobilités' },
  { value: 'OFFBOARDING', label: 'Départs' },
] as const;

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'QUEUED,RUNNING', label: 'En cours' },
  { value: 'SCHEDULED', label: 'Planifiées' },
  { value: 'SUCCEEDED', label: 'Terminées' },
  { value: 'FAILED,PARTIAL,TIMED_OUT', label: 'À traiter' },
  { value: 'CANCELLED', label: 'Annulées' },
] as const;

export function RunsPage() {
  useDocumentTitle('Exécutions');
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const linkState = useOriginState('Exécutions');
  const type = params.get('type') ?? '';
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const { data, isPending, isFetching, error, refetch } = useRuns({
    type: type || undefined,
    status: status ? status.split(',') : undefined,
    page,
    pageSize: 20,
  });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const statusLabel = STATUSES.find((s) => s.value === status)?.label;

  return (
    <div>
      <PageHeader title="Exécutions" description="Chaque arrivée, mobilité ou départ lance un workflow n8n suivi étape par étape." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Type d’exécution" value={type} onChange={(value) => update('type', value)} options={TYPES.map((t) => ({ ...t }))} />
        <Select value={status} onChange={(e) => update('status', e.target.value)} aria-label="Statut" className="w-48">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {data ? (
          <span className="ml-auto text-[13px] tabular text-ink-3">
            {data.total} exécution{data.total > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} className="mb-4" /> : null}

      <div className={cn('overflow-hidden panel rounded-[var(--radius-panel)] transition-opacity', isFetching && !isPending && 'opacity-70')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line bg-sunken text-left text-xs font-medium text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Employé</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Étapes</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Durée</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                <th scope="col" className="w-40 px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isPending
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }, (__, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <Skeleton className="h-4 w-2/3" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-hover/60">
                      <td className="px-4 py-2.5">
                        <Link to={`/executions/${run.id}`} state={linkState} className="font-medium text-ink hover:text-info">
                          {run.employee.firstName} {run.employee.lastName}
                        </Link>
                        <span className="block text-xs text-ink-3">{run.employee.jobTitle}</span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">
                        {RUN_TYPE[run.type]}
                        {run.attempt > 1 ? <span className="text-ink-3"> · essai {run.attempt}</span> : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <StepSegments total={run.progress.total} done={run.progress.done} failed={run.failedSteps} running={run.status === 'RUNNING'} />
                          <span className="tabular text-xs text-ink-3">
                            {run.progress.done}/{run.progress.total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 tabular text-ink-2">
                        {run.status === 'SCHEDULED' ? <span className="text-xs text-ink-3">prévue le </span> : null}
                        {formatDateTime(run.scheduledFor ?? run.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 tabular text-ink-2">{formatDuration(durationBetween(run.startedAt, run.finishedAt))}</td>
                      <td className="px-4 py-2.5">
                        <RunStatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {run.status === 'SCHEDULED' && me.permissions.manageEmployees ? <ScheduledRunActions run={run} employeeName={`${run.employee.firstName} ${run.employee.lastName}`} compact /> : null}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 ? (
          <EmptyState icon={<IconFlow className="size-5" aria-hidden="true" />} title="Aucune exécution">
            {status ? `Aucune exécution dans « ${statusLabel ?? status} ».` : 'Déclarez une arrivée pour lancer le premier workflow.'}
          </EmptyState>
        ) : null}
        {data && data.totalPages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px]" aria-label="Pagination">
            <span className="text-ink-3">
              Page {data.page} sur {data.totalPages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" disabled={page <= 1} onClick={() => update('page', String(page - 1))} icon={<IconChevronLeft className="size-4" aria-hidden="true" />}>
                Précédente
              </Button>
              <Button size="sm" disabled={page >= data.totalPages} onClick={() => update('page', String(page + 1))}>
                Suivante <IconChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
