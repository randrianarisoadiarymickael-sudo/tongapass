import { IconAutomation, IconChain, IconChevronLeft, IconChevronRight, IconClock, IconClose, IconDownload, IconPerson, IconSearch, IconShieldAlert, IconShieldCheck } from '@/components/icons';
import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { useAudit, useIntegrity } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateLong, formatNumber, formatTime } from '@/lib/format';
import { AUDIT_ACTION_LABEL, TONE_DOT, type Tone } from '@/lib/labels';
import type { AuditLog } from '@/lib/types';
import { NoAccess } from './StatusScreens';

const ACTOR_ICON = { USER: IconPerson, AUTOMATION: IconAutomation, SYSTEM: IconClock } as const;
const ACTOR_LABEL = { USER: 'Utilisateur', AUTOMATION: 'n8n', SYSTEM: 'Planificateur' } as const;

const ACTIONS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'onboarding.', label: 'Arrivées' },
  { value: 'mobility.', label: 'Mobilités' },
  { value: 'offboarding.', label: 'Départs' },
  { value: 'access.granted', label: 'Accès accordés' },
  { value: 'access.revoked', label: 'Accès révoqués' },
  { value: 'compliance.', label: 'Conformité' },
  { value: 'automation.', label: 'Incidents d’automatisation' },
  { value: 'profile.', label: 'Profils d’accès' },
  { value: 'audit.', label: 'Contrôles d’audit' },
];

function actionTone(action: string): Tone {
  if (action.startsWith('access.revoked') || action.endsWith('failed') || action.endsWith('timed_out') || action === 'compliance.drift') return 'danger';
  if (action.startsWith('access.granted') || action.endsWith('completed')) return 'success';
  if (action.endsWith('partial') || action.endsWith('cancelled')) return 'warning';
  if (action.startsWith('mobility') || action.endsWith('scheduled')) return 'info';
  return 'neutral';
}

/** Jour civil local (AAAA-MM-JJ) pour grouper les entrées comme elles sont affichées. */
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('fr-CA');

function AuditRow({ log }: { log: AuditLog }) {
  const Icon = ACTOR_ICON[log.actorType];
  const target = log.targetType === 'employee' && log.targetId ? `/employes/${log.targetId}` : log.targetType === 'workflow_run' && log.targetId ? `/executions/${log.targetId}` : null;
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[4rem_minmax(0,1fr)_auto]">
      <time dateTime={log.occurredAt} className="pt-px text-xs tabular text-ink-3">
        <span className="sr-only">{formatDateLong(log.occurredAt)}, </span>
        {formatTime(log.occurredAt)}
      </time>
      <div className="min-w-0">
        <p>
          <span className="mr-2 inline-flex items-center gap-1.5 font-medium">
            <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[actionTone(log.action)])} aria-hidden="true" />
            {AUDIT_ACTION_LABEL[log.action] ?? log.action}
          </span>
          {target ? (
            <Link to={target} className="text-ink-2 hover:text-info hover:underline">
              {log.summary}
            </Link>
          ) : (
            <span className="text-ink-2">{log.summary}</span>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
          <Icon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{ACTOR_LABEL[log.actorType]} :</span>
          {log.actorName}
          {log.ip ? <span className="font-mono">· {log.ip}</span> : null}
        </p>
      </div>
      <p className="font-mono text-xs text-ink-3 md:pt-px md:text-right" title={`Empreinte ${log.hash}\nPrécédente ${log.prevHash}`} translate="no">
        #{log.id} · {log.hash.slice(0, 8)}
      </p>
    </li>
  );
}

export function AuditPage() {
  useDocumentTitle('Journal d’audit');
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const action = params.get('action') ?? '';
  const actorType = params.get('acteur') ?? '';
  const from = params.get('du') ?? '';
  const to = params.get('au') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const [draft, setDraft] = useState(search);
  const integrity = useIntegrity();
  const [exporting, setExporting] = useState(false);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => draft.trim() !== search && update('q', draft.trim()), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const filters = {
    search: search || undefined,
    action: action || undefined,
    actorType: actorType || undefined,
    from: from ? new Date(`${from}T00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    page,
    pageSize: 30,
  };
  const { data, isPending, isFetching, error, refetch } = useAudit(filters, me.permissions.viewAudit);
  const filtered = Boolean(search || action || actorType || from || to);

  if (!me.permissions.viewAudit) return <NoAccess what="Le journal d’audit est réservé aux rôles audit et administrateur." />;

  const report = integrity.data;

  return (
    <div>
      <PageHeader
        title="Journal d’audit"
        description="Chaque action humaine ou automatique, en ajout seul. Chaque entrée est chaînée à la précédente par SHA-256."
        actions={
          <>
            <Button
              loading={exporting}
              icon={<IconDownload className="size-4" aria-hidden="true" />}
              onClick={async () => {
                setExporting(true);
                try {
                  const { search: q, action: a, actorType: actor, from: since, to: until } = filters;
                  await api.download('/audit-logs/export', { search: q, action: a, actorType: actor, from: since, to: until }, 'tongapass-audit.csv');
                } catch (e) {
                  toast.error('Export impossible', { description: errorMessage(e) });
                } finally {
                  setExporting(false);
                }
              }}
            >
              Exporter
            </Button>
            <Button variant="primary" loading={integrity.isPending} onClick={() => integrity.mutate()} icon={<IconChain className="size-4" aria-hidden="true" />}>
              Vérifier l’intégrité
            </Button>
          </>
        }
      />

      {report ? (
        <div
          role="status"
          key={report.verifiedAt}
          className={cn(
            'mb-5 flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm',
            report.valid ? 'border-success/30' : 'border-danger/40 bg-danger-soft',
          )}
        >
          {report.valid ? (
            <IconShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <IconShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className={cn('font-medium', report.valid ? 'text-ink' : 'text-danger')}>
              {report.valid
                ? `Chaîne intègre : ${formatNumber(report.checked)} entrées vérifiées`
                : `Rupture de la chaîne détectée à l’entrée #${report.brokenAtId}`}
            </p>
            <p className="text-[13px] text-ink-3">
              {report.valid ? 'Aucune entrée n’a été modifiée ni supprimée.' : 'Une entrée a été altérée : déclenchez la procédure d’incident.'}{' '}
              {report.lastHash ? (
                <span className="font-mono text-xs" translate="no">
                  Dernière empreinte {report.lastHash.slice(0, 16)}…
                </span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}
      {integrity.error ? <ErrorState error={integrity.error} className="mb-5" /> : null}

      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Employé, acteur, action…"
            aria-label="Rechercher dans le journal"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Select value={action} onChange={(e) => update('action', e.target.value)} aria-label="Type d’action" className="w-52">
            {ACTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={actorType} onChange={(e) => update('acteur', e.target.value)} aria-label="Type d’acteur" className="w-40">
            <option value="">Tous les acteurs</option>
            <option value="USER">Utilisateurs</option>
            <option value="AUTOMATION">n8n</option>
            <option value="SYSTEM">Planificateur</option>
          </Select>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => update('du', e.target.value)} aria-label="Depuis le" className="w-40" />
          <Input type="date" value={to} min={from || undefined} onChange={(e) => update('au', e.target.value)} aria-label="Jusqu’au" className="w-40" />
          {filtered ? (
            <Button
              variant="ghost"
              icon={<IconClose className="size-4" aria-hidden="true" />}
              onClick={() => {
                setDraft('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Effacer
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} className="mb-4" /> : null}
      <div className={cn('panel overflow-clip rounded-[var(--radius-panel)] transition-opacity', isFetching && !isPending && 'opacity-70')}>
        {isPending ? (
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : data?.items.length ? (
          <ol>
            {data.items.map((log, index) => {
              const newDay = index === 0 || dayKey(data.items[index - 1].occurredAt) !== dayKey(log.occurredAt);
              return (
                <Fragment key={log.id}>
                  {newDay ? (
                    <li
                      aria-hidden="true"
                      className={cn('sticky top-[4.5rem] z-[1] border-b border-line bg-raised px-4 py-1.5 text-xs font-semibold capitalize text-ink-2', index > 0 && 'border-t')}
                    >
                      {formatDateLong(log.occurredAt)}
                    </li>
                  ) : null}
                  <AuditRow log={log} />
                </Fragment>
              );
            })}
          </ol>
        ) : (
          <EmptyState title="Aucune entrée">{filtered ? 'Aucune action ne correspond à ces filtres.' : 'Le journal est vide.'}</EmptyState>
        )}
        {data && data.totalPages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px]" aria-label="Pagination">
            <span className="text-ink-3">
              {formatNumber(data.total)} entrées · page {data.page} sur {data.totalPages}
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
