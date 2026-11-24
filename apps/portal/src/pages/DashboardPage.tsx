import { IconAlert, IconArrival, IconBars, IconCalendar, IconChevronRight, IconClock, IconEnter, IconExit, IconFlow, IconPeople, IconPulse, IconShieldCheck, IconSwap, type IconComponent } from '@/components/icons';
import { Link } from 'react-router';
import { useMe } from '@/auth/AuthProvider';
import { MovementsChart } from '@/components/charts/MovementsChart';
import { StepSegments } from '@/components/flow/RunTimeline';
import { Badge, EmployeeStatusBadge, RunStatusBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Panel, Skeleton } from '@/components/ui/Feedback';
import { useLive } from '@/hooks/useLiveEvents';
import { describeLiveEvent } from '@/lib/live-event';
import { useDashboard } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOriginState } from '@/hooks/useOrigin';
import { cn } from '@/lib/cn';
import { formatDate, formatDateLong, formatDuration, formatRelative, formatTime } from '@/lib/format';
import { CONTRACT_LABEL, RUN_TYPE } from '@/lib/labels';
import type { AgendaItem, DashboardSummary, EmployeeStatus } from '@/lib/types';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const KIND = {
  ARRIVAL: { label: 'Arrivée', icon: IconEnter, className: 'text-success' },
  MOBILITY: { label: 'Mobilité', icon: IconSwap, className: 'text-info' },
  DEPARTURE: { label: 'Départ', icon: IconExit, className: 'text-danger' },
} as const;

function dayLabel(date: Date): string {
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(today)) / 86_400_000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  return capitalize(formatDateLong(date));
}

/** Indicateur clé : libellé, valeur et précision ; toute la case mène à la liste correspondante. */
function Kpi({ label, value, hint, to, icon: Icon }: { label: string; value: string | number; hint: string; to?: string; icon: IconComponent }) {
  const body = (
    <>
      <Icon className="metric-icon" aria-hidden="true" />
      <p className="mt-2 text-[13px] font-medium text-ink-2 xl:min-h-10 2xl:min-h-0">{label}</p>
      <p key={value} className="metric-value tabular text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-3">{hint}</p>
    </>
  );
  return (
    <li className="metric-cell min-w-0">
      {to ? (
        <Link to={to} className="block h-full px-4 py-3.5 transition-colors hover:bg-hover">
          {body}
        </Link>
      ) : (
        <div className="h-full px-4 py-3.5">{body}</div>
      )}
    </li>
  );
}

function Kpis({ kpis }: { kpis: DashboardSummary['kpis'] }) {
  return (
    <ul
      className="metrics-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
      aria-label="Indicateurs clés"
    >
      <Kpi icon={IconPeople} label="Employés actifs" value={kpis.activeEmployees} hint="Départs planifiés inclus" to="/employes?statut=active" />
      <Kpi
        icon={IconFlow}
        label="Exécutions en cours"
        value={kpis.runsInProgress}
        hint={kpis.runsInProgress ? 'Suivies en direct' : 'Aucun workflow actif'}
        to="/executions?status=QUEUED,RUNNING"
      />
      <Kpi icon={IconArrival} label="Arrivées planifiées" value={kpis.scheduledArrivals} hint="Création programmée" to="/executions?type=ONBOARDING&status=SCHEDULED" />
      <Kpi icon={IconCalendar} label="Départs planifiés" value={kpis.scheduledDepartures} hint="Révocation programmée" to="/executions?type=OFFBOARDING&status=SCHEDULED" />
      <Kpi icon={IconExit} label="Départs traités" value={kpis.revokedThisMonth} hint="Ce mois-ci" />
      <Kpi icon={IconClock} label="Délai de création" value={formatDuration(kpis.avgProvisioningSeconds)} hint="De la demande aux accès" />
    </ul>
  );
}

/** Anneau de conformité : part des comptes conformes, sans animation. */
function ComplianceGauge({ compliant, total }: { compliant: number; total: number }) {
  const ratio = total ? compliant / total : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-20 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 76 76" className="size-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--tp-hover)" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--tp-brand)" strokeWidth="7" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular">{Math.round(ratio * 100)} %</span>
    </div>
  );
}

function Agenda({ items }: { items: AgendaItem[] }) {
  const linkState = useOriginState('Vue d’ensemble');
  if (items.length === 0) {
    return (
      <EmptyState icon={<IconCalendar className="size-5" aria-hidden="true" />} title="Aucun mouvement prévu">
        Les arrivées, mobilités et départs planifiés sur 45 jours apparaîtront ici.
      </EmptyState>
    );
  }
  const groups = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = new Date(item.date).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <div className="-mx-4 -my-4">
      {[...groups.entries()].map(([key, group]) => (
        <section key={key} aria-label={dayLabel(new Date(group[0].date))}>
          <h3 className="bg-sunken px-5 py-1.5 text-xs font-medium text-ink-2">{dayLabel(new Date(group[0].date))}</h3>
          <ul className="divide-y divide-line">
            {group.map((item) => {
              const kind = KIND[item.kind];
              return (
                <li key={`${item.kind}-${item.employeeId}-${item.runId ?? ''}`}>
                  <div>
                    <Link to={`/employes/${item.employeeId}`} state={linkState} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-hover">
                      <kind.icon className={cn('size-4 shrink-0', kind.className)} aria-hidden="true" />
                      <span className="w-16 shrink-0 text-xs text-ink-3">
                        {kind.label}
                        {item.kind !== 'ARRIVAL' ? <span className="block tabular">{formatTime(item.date)}</span> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{item.name}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {item.jobTitle} · {item.department}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1.5 text-xs text-ink-3 md:flex">
                        <span className="size-2 rounded-[2px]" style={{ background: item.profile.color }} aria-hidden="true" />
                        {item.profile.name}
                      </span>
                      <span className="hidden sm:contents">
                        {item.kind === 'ARRIVAL' ? <EmployeeStatusBadge status={item.status as EmployeeStatus} /> : <RunStatusBadge status="SCHEDULED" />}
                      </span>
                      <IconChevronRight className="size-4 text-ink-3" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DashboardSignal() {
  const { events, connected } = useLive();
  const latest = events[0];
  const item = latest && describeLiveEvent(latest);
  return (
    <div className="dashboard-signal">
      <IconPulse aria-hidden="true" />
      <span>{connected ? 'Activité en direct' : 'Reconnexion…'}</span>
      {latest && item ? <span className="dashboard-event" key={latest.seq}>
        <time dateTime={latest.at}>{formatTime(latest.at)}</time>
        {item.to ? <Link to={item.to}>{item.title}</Link> : item.title}
      </span> : <span className="dashboard-event">{connected ? 'En attente du prochain mouvement' : 'Connexion au flux d’activité'}</span>}
    </div>
  );
}

export function DashboardPage() {
  const me = useMe();
  const { data, isPending, error, refetch } = useDashboard();
  useDocumentTitle('Vue d’ensemble');
  const linkState = useOriginState('Vue d’ensemble');

  return (
    <div className="space-y-5">
      <header className="dashboard-intro">
        <div className="dashboard-heading">
          <div><p>{capitalize(formatDateLong(new Date()))}</p><h1>Vue d’ensemble</h1></div>
          {me.permissions.manageEmployees && <ButtonLink to="/arrivees/nouvelle" variant="primary" icon={<IconArrival className="size-4" aria-hidden="true" />}>Déclarer une arrivée</ButtonLink>}
        </div>
        <DashboardSignal />
      </header>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      {isPending ? (
        <div className="space-y-5">
          <Skeleton className="h-[88px]" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : data ? (
        <>
          <Kpis kpis={data.kpis} />

          {data.kpis.needsAttention > 0 ? (
            <Link
              to="/executions?status=FAILED,PARTIAL,TIMED_OUT"
              className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm transition-colors hover:border-warning/50"
            >
              <IconAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="flex-1">
                <span className="font-medium">
                  {data.kpis.needsAttention} exécution{data.kpis.needsAttention > 1 ? 's' : ''} à traiter
                </span>
                <span className="text-ink-3"> : des accès n’ont pas pu être accordés ou révoqués. Vérifiez puis relancez.</span>
              </span>
              <IconChevronRight className="size-4 text-ink-3" aria-hidden="true" />
            </Link>
          ) : null}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 gap-5">
              <Panel title="Agenda des mouvements" description="45 prochains jours" id="agenda" icon={<IconCalendar />}>
                <Agenda items={data.agenda} />
              </Panel>
              <Panel title="Arrivées et départs" description="Par mois, sur six mois" id="chart" icon={<IconBars />}>
                <MovementsChart data={data.monthly} />
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel
                title="Conformité des accès"
                id="compliance"
                icon={<IconShieldCheck />}
                actions={
                  me.permissions.viewAudit ? (
                    <Link to="/conformite" className="text-[13px] font-medium text-info hover:underline">
                      Détails
                    </Link>
                  ) : null
                }
              >
                {data.compliance.total === 0 ? (
                  <p className="text-[13px] text-ink-3">
                    {data.compliance.enabled
                      ? 'Aucun contrôle effectué pour l’instant. Un contrôle automatique a lieu chaque nuit.'
                      : 'Contrôle désactivé : compte de service d’audit non configuré.'}
                  </p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ComplianceGauge compliant={data.compliance.counts.COMPLIANT} total={data.compliance.total} />
                    <div className="min-w-0 space-y-2">
                      <p className="text-sm">
                        <span className="font-bold tabular">{data.compliance.counts.COMPLIANT}</span>
                        <span className="text-ink-2"> / {data.compliance.total} comptes conformes</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.compliance.counts.DRIFT ? (
                          <Badge tone="danger">
                            {data.compliance.counts.DRIFT} écart{data.compliance.counts.DRIFT > 1 ? 's' : ''}
                          </Badge>
                        ) : null}
                        {data.compliance.counts.NO_ACCOUNT ? (
                          <Badge tone="warning">
                            {data.compliance.counts.NO_ACCOUNT} compte{data.compliance.counts.NO_ACCOUNT > 1 ? 's' : ''} manquant
                            {data.compliance.counts.NO_ACCOUNT > 1 ? 's' : ''}
                          </Badge>
                        ) : null}
                        {!data.compliance.counts.DRIFT && !data.compliance.counts.NO_ACCOUNT ? <Badge tone="success">Aucun écart</Badge> : null}
                      </div>
                      <p className="text-xs text-ink-3">Dernier contrôle {formatRelative(data.compliance.lastCheckAt)}</p>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel
                title="Exécutions récentes"
                id="recent-runs"
                icon={<IconFlow />}
                bodyClassName="p-0"
                actions={
                  <Link to="/executions" className="text-[13px] font-medium text-info hover:underline">
                    Tout voir
                  </Link>
                }
              >
                {data.recentRuns.length === 0 ? (
                  <EmptyState title="Aucune exécution">Les workflows apparaîtront après la première arrivée.</EmptyState>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.recentRuns.map((run) => (
                      <li key={run.id}>
                        <div>
                          <Link to={`/executions/${run.id}`} state={linkState} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {run.employee.firstName} {run.employee.lastName}
                              </span>
                              <span className="block text-xs text-ink-3">
                                {RUN_TYPE[run.type]} · {formatRelative(run.createdAt)}
                              </span>
                            </span>
                            <span className="flex flex-col items-end gap-1.5">
                              <RunStatusBadge status={run.status} />
                              <StepSegments total={run.progress.total} done={run.progress.done} failed={run.failedSteps} running={run.status === 'RUNNING'} />
                            </span>
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Fins de contrat" description="Sous 30 jours, sans révocation planifiée" id="contracts" bodyClassName="p-0" icon={<IconClock />}>
                {data.contractsEnding.length === 0 ? (
                  <EmptyState title="Rien à planifier">Aucun CDD ni stage ne se termine sans départ planifié.</EmptyState>
                ) : (
                  <ul className="divide-y divide-line">
                    {data.contractsEnding.map((contract) => (
                      <li key={contract.employeeId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{contract.name}</span>
                          <span className="block text-xs text-ink-3">
                            {CONTRACT_LABEL[contract.contractType]} jusqu’au {formatDate(contract.endDate)}
                          </span>
                        </span>
                        <Link to={`/employes/${contract.employeeId}${me.permissions.manageEmployees ? '?depart=1' : ''}`} state={linkState} className="text-[13px] font-medium text-info hover:underline">
                          {me.permissions.manageEmployees ? 'Planifier' : 'Voir la fiche'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
