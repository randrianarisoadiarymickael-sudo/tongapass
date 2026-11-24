import { DropdownMenu } from 'radix-ui';
import { IconCalendar, IconChevronRight, IconEdit, IconMore, IconRetry, IconShieldCheck, IconSwap } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { AccessMatrix } from '@/components/employee/AccessMatrix';
import { EditEmployeeDialog, MobilityDialog, OffboardingDialog } from '@/components/employee/EmployeeDialogs';
import { LifecycleStepper } from '@/components/employee/LifecycleStepper';
import { RunTimeline } from '@/components/flow/RunTimeline';
import { ScheduledRunActions } from '@/components/flow/ScheduledRunActions';
import { ComplianceBadge, EmployeeStatusBadge, RunStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar, DescriptionItem, EmptyState, ErrorState, Panel, Skeleton } from '@/components/ui/Feedback';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import {
  useCatalog,
  useCheckCompliance,
  useEmployee,
  useEmployeeCompliance,
  useEmployeeHistory,
  useRetryRun,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOrigin, useOriginState } from '@/hooks/useOrigin';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { AUDIT_ACTION_LABEL, CONTRACT_LABEL, RUN_TYPE } from '@/lib/labels';
import type { AccessSet, EmployeeDetail, RunDetail } from '@/lib/types';

const NO_ACCESS: AccessSet = { realmRoles: [], groups: [], giteaTeams: [], chatChannels: [] };

const menuItem ='flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] text-ink-2 outline-none transition-colors data-[highlighted]:bg-hover data-[highlighted]:text-ink';

const SCHEDULED_TITLE: Record<RunDetail['type'], string> = {
  ONBOARDING: 'Création des comptes planifiée',
  MOBILITY: 'Changement de poste planifié',
  OFFBOARDING: 'Révocation des accès planifiée',
};

function ScheduledActions({ employee, canManage }: { employee: EmployeeDetail; canManage: boolean }) {
  const scheduled = employee.runs.filter((run) => run.status === 'SCHEDULED');
  if (scheduled.length === 0) return null;
  return (
    <div className="divide-y divide-line panel rounded-[var(--radius-panel)]">
      {scheduled.map((run) => (
        <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <IconCalendar className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {SCHEDULED_TITLE[run.type]} le {formatDateTime(run.scheduledFor)}
            </p>
            {run.reason ? <p className="text-xs text-ink-3">{run.reason}</p> : null}
          </div>
          {canManage ? <ScheduledRunActions run={run} employeeName={`${employee.firstName} ${employee.lastName}`} /> : null}
        </div>
      ))}
    </div>
  );
}

function CompliancePanel({ employeeId }: { employeeId: string }) {
  const { data: last, isPending } = useEmployeeCompliance(employeeId);
  const check = useCheckCompliance(employeeId);
  return (
    <Panel
      title="Conformité dans Keycloak"
      id="compliance"
      actions={
        <Button
          size="sm"
          loading={check.isPending}
          onClick={async () => {
            try {
              const result = await check.mutateAsync();
              if (result.status === 'COMPLIANT') toast.success('Droits conformes au profil');
              else toast.warning('Écart détecté', { description: result.details.message });
            } catch (e) {
              toast.error('Vérification impossible', { description: errorMessage(e) });
            }
          }}
          icon={<IconShieldCheck className="size-4" aria-hidden="true" />}
        >
          Vérifier
        </Button>
      }
    >
      {isPending ? (
        <Skeleton className="h-10" />
      ) : !last ? (
        <p className="text-[13px] text-ink-3">Jamais vérifié. Comparez les droits réels dans Keycloak avec les droits attendus.</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <ComplianceBadge status={last.status} />
            <span className="text-xs text-ink-3">{formatRelative(last.checkedAt)}</span>
          </div>
          <p className={cn('text-[13px]', last.status === 'COMPLIANT' ? 'text-ink-2' : 'text-danger')}>{last.details.message}</p>
        </div>
      )}
    </Panel>
  );
}

function AccountRow({ system, account, revoked }: { system: string; account: { id: string; active: boolean } | null; revoked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] font-medium" translate="no">
        {system}
      </span>
      {account ? (
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className="truncate font-mono text-ink-3" translate="no" title={account.id}>
            {account.id}
          </span>
          <span className={cn('shrink-0 font-medium', revoked ? 'text-danger' : 'text-success')}>{revoked ? 'Révoqué' : 'Actif'}</span>
        </span>
      ) : (
        <span className="text-xs text-ink-3">Non provisionné</span>
      )}
    </div>
  );
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, error } = useEmployeeHistory(employeeId, page);
  if (error) return <ErrorState error={error} />;
  if (isPending) return <Skeleton className="h-48" />;
  if (!data?.items.length) return <EmptyState title="Aucune action enregistrée" />;
  return (
    <div className="panel rounded-[var(--radius-panel)]">
      <ol className="divide-y divide-line">
        {data.items.map((log) => (
          <li key={log.id}>
            <div className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
              <time dateTime={log.occurredAt} className="text-xs tabular text-ink-3 sm:pt-0.5">
                {formatDateTime(log.occurredAt)}
              </time>
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</span>
                  <span className="text-ink-2"> · {log.summary}</span>
                </p>
                <p className="text-xs text-ink-3">{log.actorName}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[13px]">
          <span className="text-ink-3">
            Page {data.page} sur {data.totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Précédente
            </Button>
            <Button size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivante
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const { data: employee, isPending, error, refetch } = useEmployee(id);
  const catalog = useCatalog();
  const retry = useRetryRun();
  const [dialog, setDialog] = useState<'offboarding' | 'mobility' | 'edit' | null>(null);
  const tab = params.get('onglet') ?? 'acces';
  const location = useLocation();
  const origin = useOrigin({ path: '/employes', label: 'Annuaire' });
  const runLinkState = useOriginState(employee ? `${employee.firstName} ${employee.lastName}` : 'Employé');
  useDocumentTitle(employee ? `${employee.firstName} ${employee.lastName}` : 'Employé');

  const sensitive = useMemo(
    () =>
      new Set(
        Object.values(catalog.data ?? {})
          .flat()
          .filter((item) => item.sensitive)
          .map((item) => item.value),
      ),
    [catalog.data],
  );

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending || !employee) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const canManage = me.permissions.manageEmployees;
  const canOffboard = canManage && ['ACTIVE', 'FAILED'].includes(employee.status);
  const canMove = canManage && ['ACTIVE', 'OFFBOARDING_SCHEDULED'].includes(employee.status) && !employee.runs.some((r) => r.status === 'RUNNING' || r.status === 'QUEUED');
  const departed = employee.status === 'DEPARTED';
  const latest = employee.runs.find((run) => run.status !== 'SCHEDULED') ?? employee.runs[0];

  // Liens profonds (?depart=1, ?mobilite=1) : ouvrent directement le dialogue correspondant.
  const linked = params.get('depart') === '1' && canOffboard ? 'offboarding' : params.get('mobilite') === '1' && canMove ? 'mobility' : null;
  const openDialog = dialog ?? linked;
  const closeDialog = () => {
    setDialog(null);
    if (params.has('depart') || params.has('mobilite')) {
      const next = new URLSearchParams(params);
      next.delete('depart');
      next.delete('mobilite');
      setParams(next, { replace: true, state: location.state });
    }
  };
  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'acces') next.delete('onglet');
    else next.set('onglet', value);
    // Conserve l'origine (fil d'Ariane) en changeant d'onglet
    setParams(next, { replace: true, state: location.state });
  };

  const onRetry = async (runId: string) => {
    try {
      await retry.mutateAsync(runId);
      toast.success('Workflow relancé', { description: 'Les étapes déjà réalisées sont reconnues sans doublon.' });
    } catch (e) {
      toast.error('Relance impossible', { description: errorMessage(e) });
    }
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-1 text-[13px] text-ink-3">
        <Link to={origin.path} className="hover:text-ink">
          {origin.label}
        </Link>
        <IconChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-ink" aria-current="page">
          {employee.firstName} {employee.lastName}
        </span>
      </nav>

      <section className="panel rounded-[var(--radius-panel)]" aria-label="Identité et cycle de vie">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <Avatar first={employee.firstName} last={employee.lastName} color={employee.accessProfile.color} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-semibold leading-7">
                {employee.firstName} {employee.lastName}
              </h1>
              <EmployeeStatusBadge status={employee.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-3">
              {employee.jobTitle} · {employee.department}
              {employee.location ? ` · ${employee.location}` : ''}
            </p>
          </div>
          {canManage && !departed && employee.status !== 'CANCELLED' ? (
            <div className="flex flex-wrap items-center gap-2">
              {canMove ? (
                <Button onClick={() => setDialog('mobility')} icon={<IconSwap className="size-4" aria-hidden="true" />}>
                  Changer de poste
                </Button>
              ) : null}
              <Button onClick={() => setDialog('edit')} icon={<IconEdit className="size-4" aria-hidden="true" />}>
                Modifier
              </Button>
              {canOffboard ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger className="inline-flex size-9 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-raised" aria-label="Plus d’actions">
                    <IconMore className="size-4" aria-hidden="true" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" sideOffset={4} className="z-50 w-56 panel-raised rounded-xl p-1.5">
                      <DropdownMenu.Item
                        className={cn(menuItem, 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger')}
                        onSelect={() => setDialog('offboarding')}
                      >
                        Déclarer le départ…
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : null}
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          <DescriptionItem label="Matricule" mono>
            {employee.employeeNumber}
          </DescriptionItem>
          <DescriptionItem label="Identifiant" mono>
            {employee.username}
          </DescriptionItem>
          <DescriptionItem label="E-mail professionnel">{employee.workEmail}</DescriptionItem>
          <DescriptionItem label="Contrat">
            {CONTRACT_LABEL[employee.contractType]}
            {employee.endDate ? ` jusqu’au ${formatDate(employee.endDate)}` : ''}
          </DescriptionItem>
          <DescriptionItem label={departed ? 'Départ' : 'Arrivée'}>{formatDate(departed ? employee.departedAt : employee.startDate)}</DescriptionItem>
          <DescriptionItem label="Manager">{employee.managerName ?? '—'}</DescriptionItem>
        </dl>
        <div className="border-t border-line px-5 pb-4 pt-5">
          <LifecycleStepper status={employee.status} />
        </div>
      </section>

      <ScheduledActions employee={employee} canManage={canManage} />

      <Tabs
        label="Sections de la fiche"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'acces', label: 'Accès' },
          { value: 'executions', label: 'Exécutions', count: employee.runs.length },
          { value: 'historique', label: 'Historique' },
        ]}
      >
        <TabPanel value="acces" className="pt-5 outline-none">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title={departed ? 'Droits retirés au départ' : 'Accès effectifs'}
              description={
                departed
                  ? `Profil « ${employee.accessProfile.name} » · révoqués le ${formatDate(employee.departedAt)}`
                  : `Profil « ${employee.accessProfile.name} »`
              }
              id="access"
            >
              {departed ? (
                <AccessMatrix access={NO_ACCESS} diff={{ added: NO_ACCESS, removed: employee.effectiveAccess }} />
              ) : (
                <AccessMatrix access={employee.effectiveAccess} sensitive={sensitive} />
              )}
              {employee.extraRealmRoles.length ? (
                <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2">
                  <span className="font-medium text-warning">Droits supplémentaires : {employee.extraRealmRoles.join(', ')}.</span>{' '}
                  {employee.extraAccessJustification}
                </p>
              ) : null}
            </Panel>
            <div className="space-y-5">
              <Panel title="Comptes provisionnés" id="accounts" bodyClassName="px-4 py-1.5">
                <div className="divide-y divide-line">
                  <AccountRow system="Keycloak" account={employee.effectiveAccess.accounts.keycloak} revoked={departed} />
                  <AccountRow system="Gitea" account={employee.effectiveAccess.accounts.gitea} revoked={departed} />
                  <AccountRow system="Mattermost" account={employee.effectiveAccess.accounts.chat} revoked={departed} />
                </div>
              </Panel>
              {employee.keycloakUserId && (me.permissions.manageEmployees || me.permissions.viewAudit) ? <CompliancePanel employeeId={employee.id} /> : null}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="executions" className="pt-5 outline-none">
          {latest ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Panel
                title={`${RUN_TYPE[latest.type]} · dernière exécution`}
                description={`${latest.triggeredBy}, ${formatRelative(latest.createdAt)}${latest.attempt > 1 ? ` · tentative ${latest.attempt}` : ''}`}
                id="latest-run"
                actions={<RunStatusBadge status={latest.status} />}
              >
                <RunTimeline steps={latest.steps} />
                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                  <Link to={`/executions/${latest.id}`} state={runLinkState} className="text-[13px] font-medium text-info hover:underline">
                    Détail de l’exécution
                  </Link>
                  {canManage && ['FAILED', 'PARTIAL', 'TIMED_OUT'].includes(latest.status) ? (
                    <Button size="sm" className="ml-auto" loading={retry.isPending} onClick={() => void onRetry(latest.id)} icon={<IconRetry className="size-3.5" aria-hidden="true" />}>
                      Relancer
                    </Button>
                  ) : null}
                </div>
              </Panel>
              <Panel title="Toutes les exécutions" id="runs" bodyClassName="p-0">
                <ul className="divide-y divide-line">
                  {employee.runs.map((run) => (
                    <li key={run.id}>
                      <Link to={`/executions/${run.id}`} state={runLinkState} className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-hover">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{RUN_TYPE[run.type]}</span>
                          <span className="block text-xs text-ink-3">
                            {formatDateTime(run.scheduledFor ?? run.createdAt)} · {run.triggeredBy}
                          </span>
                        </span>
                        <RunStatusBadge status={run.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : (
            <EmptyState title="Aucune exécution">Aucun workflow n’a encore été lancé pour cet employé.</EmptyState>
          )}
        </TabPanel>

        <TabPanel value="historique" className="pt-5 outline-none">
          {tab === 'historique' ? <HistoryTab employeeId={employee.id} /> : null}
        </TabPanel>
      </Tabs>

      {openDialog === 'offboarding' ? <OffboardingDialog employee={employee} open onOpenChange={(open) => !open && closeDialog()} /> : null}
      {openDialog === 'mobility' ? <MobilityDialog employee={employee} sensitive={sensitive} open onOpenChange={(open) => !open && closeDialog()} /> : null}
      {openDialog === 'edit' ? <EditEmployeeDialog employee={employee} open onOpenChange={(open) => !open && closeDialog()} /> : null}
    </div>
  );
}
