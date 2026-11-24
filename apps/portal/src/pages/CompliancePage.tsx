import { IconScan, IconShieldCheck } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { ComplianceBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Segmented } from '@/components/ui/Segmented';
import { useComplianceOverview, useScanCompliance } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOriginState } from '@/hooks/useOrigin';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { COMPLIANCE_STATUS, TONE_DOT } from '@/lib/labels';
import type { ComplianceOverview, ComplianceStatus } from '@/lib/types';
import { NoAccess } from './StatusScreens';

const ORDER: ComplianceStatus[] = ['DRIFT', 'UNREACHABLE', 'NO_ACCOUNT', 'COMPLIANT'];

/** Répartition des contrôles : barre empilée, chaque segment étiqueté dans la légende. */
function Distribution({ counts, total }: { counts: Record<ComplianceStatus, number>; total: number }) {
  const segments = (['COMPLIANT', 'DRIFT', 'NO_ACCOUNT', 'UNREACHABLE'] as ComplianceStatus[]).filter((status) => counts[status] > 0);
  return (
    <div className="space-y-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={segments.length ? `Répartition : ${segments.map((s) => `${COMPLIANCE_STATUS[s].label} ${counts[s]}`).join(', ')}` : 'Aucun contrôle enregistré'}>
        {segments.map((status) => (
          <span
            key={status}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_DOT[COMPLIANCE_STATUS[status].tone])}
            style={{ width: `${(counts[status] / Math.max(total, 1)) * 100}%` }}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {(['COMPLIANT', 'DRIFT', 'NO_ACCOUNT', 'UNREACHABLE'] as ComplianceStatus[]).map((status) => (
          <div key={status}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className={cn('size-2 rounded-[2px]', TONE_DOT[COMPLIANCE_STATUS[status].tone])} aria-hidden="true" />
              {COMPLIANCE_STATUS[status].label}
            </dt>
            <dd className={cn('mt-0.5 text-xl font-semibold', status === 'DRIFT' && counts[status] > 0 && 'text-danger')}>
              <span className="tabular">{counts[status]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DriftDetail({ item }: { item: ComplianceOverview['items'][number] }) {
  const d = item.details;
  if (item.status === 'NO_ACCOUNT' || item.status === 'UNREACHABLE') return <p className="text-[13px] text-ink-2">{d.message}</p>;
  const parts = [
    d.missingRoles.length ? `rôles manquants : ${d.missingRoles.join(', ')}` : null,
    d.unexpectedRoles.length ? `rôles en trop : ${d.unexpectedRoles.join(', ')}` : null,
    d.missingGroups.length ? `groupes manquants : ${d.missingGroups.join(', ')}` : null,
    d.unexpectedGroups.length ? `groupes en trop : ${d.unexpectedGroups.join(', ')}` : null,
    d.enabledMismatch ? (d.expected.enabled ? 'compte désactivé' : 'compte encore actif') : null,
  ].filter(Boolean);
  return (
    <p className={cn('text-[13px]', item.status === 'COMPLIANT' ? 'text-ink-3' : 'text-ink-2')}>
      {parts.length ? <span translate="no">{parts.join(' · ')}</span> : d.message}
    </p>
  );
}

export function CompliancePage() {
  useDocumentTitle('Conformité');
  const linkState = useOriginState('Conformité');
  const me = useMe();
  const { data, isPending, error, refetch } = useComplianceOverview(me.permissions.viewAudit);
  const scan = useScanCompliance();
  const [filter, setFilter] = useState<'ALL' | 'ISSUES' | ComplianceStatus>('ISSUES');

  const items = useMemo(() => {
    const list = [...(data?.items ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
    if (filter === 'ALL') return list;
    if (filter === 'ISSUES') return list.filter((item) => item.status !== 'COMPLIANT');
    return list.filter((item) => item.status === filter);
  }, [data, filter]);

  if (!me.permissions.viewAudit) return <NoAccess what="Le contrôle de conformité est réservé aux rôles audit et administrateur." />;

  const summary = data?.summary;
  const issues = summary ? summary.counts.DRIFT + summary.counts.UNREACHABLE + summary.counts.NO_ACCOUNT : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conformité des droits"
        description="Compare les droits réels dans Keycloak aux droits attendus par le profil de chaque employé. Contrôle automatique chaque nuit à 2 h."
        actions={
          <Button
            variant="primary"
            loading={scan.isPending}
            disabled={summary ? !summary.enabled : false}
            icon={<IconScan className="size-4" aria-hidden="true" />}
            onClick={async () => {
              try {
                const result = await scan.mutateAsync();
                const drift = result.counts.DRIFT ?? 0;
                if (drift) toast.warning(`${drift} écart${drift > 1 ? 's' : ''} détecté${drift > 1 ? 's' : ''}`, { description: `${result.total} comptes contrôlés.` });
                else toast.success('Aucun écart', { description: `${result.total} comptes contrôlés.` });
              } catch (e) {
                toast.error('Contrôle impossible', { description: errorMessage(e) });
              }
            }}
          >
            Lancer un contrôle
          </Button>
        }
      />

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

      <section className="panel rounded-[var(--radius-panel)] p-4" aria-label="Synthèse">
        {isPending || !summary ? (
          <Skeleton className="h-24" />
        ) : !summary.enabled ? (
          <p className="text-sm text-ink-3">Le compte de service d’audit Keycloak n’est pas configuré : le contrôle est désactivé.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">{summary.total}</span> compte{summary.total > 1 ? 's' : ''} contrôlé{summary.total > 1 ? 's' : ''}
                {issues ? <span className="text-danger"> · {issues} à examiner</span> : <span className="text-success"> · tout est conforme</span>}
              </p>
              <p className="text-xs text-ink-3">
                {summary.lastCheckAt ? `Dernier contrôle ${formatRelative(summary.lastCheckAt)}` : 'Aucun contrôle encore effectué'}
              </p>
            </div>
            <Distribution counts={summary.counts} total={summary.total} />
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Filtrer les contrôles"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ISSUES', label: 'À examiner', count: issues },
            { value: 'DRIFT', label: 'Écarts', count: summary?.counts.DRIFT },
            { value: 'COMPLIANT', label: 'Conformes', count: summary?.counts.COMPLIANT },
            { value: 'ALL', label: 'Tous', count: summary?.total },
          ]}
        />
      </div>

      <div className="overflow-hidden panel rounded-[var(--radius-panel)]">
        {isPending ? (
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<IconShieldCheck className="size-5 text-success" aria-hidden="true" />} title={filter === 'ISSUES' ? 'Rien à examiner' : 'Aucun contrôle'}>
            {filter === 'ISSUES' ? 'Les droits réels correspondent aux profils attendus.' : 'Lancez un contrôle pour comparer les droits.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line bg-sunken text-left text-xs font-medium text-ink-2">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Employé</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Profil</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Résultat</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Détail</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Contrôlé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id} className="align-top transition-colors hover:bg-hover/60">
                    <td className="px-4 py-2.5">
                      <Link to={`/employes/${item.employee.id}?onglet=acces`} state={linkState} className="font-medium hover:text-info">
                        {item.employee.firstName} {item.employee.lastName}
                      </Link>
                      <span className="block font-mono text-xs text-ink-3" translate="no">
                        {item.employee.username}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <span className="size-2 rounded-[2px]" style={{ background: item.employee.profile.color }} aria-hidden="true" />
                        {item.employee.profile.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <ComplianceBadge status={item.status} />
                    </td>
                    <td className="max-w-md px-4 py-2.5">
                      <DriftDetail item={item} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular text-ink-3" title={item.triggeredBy}>
                      {formatDateTime(item.checkedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
