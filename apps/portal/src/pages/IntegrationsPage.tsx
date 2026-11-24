import { IconExternal, IconRetry } from '@/components/icons';
import { useMe } from '@/auth/AuthProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { useIntegrations } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { NoAccess } from './StatusScreens';

const NBSP = String.fromCharCode(160);

const STATE = {
  up: { label: 'Opérationnel', tone: 'success' },
  down: { label: 'Injoignable', tone: 'danger' },
  disabled: { label: 'Non configuré', tone: 'neutral' },
} as const;

/** Latence lisible : vert sous 300 ms, ocre au-delà d'une seconde. */
function latencyClass(ms: number | null) {
  if (ms === null) return 'text-ink-3';
  if (ms > 1000) return 'text-warning';
  return 'text-ink';
}

export function IntegrationsPage() {
  useDocumentTitle('Intégrations');
  const me = useMe();
  const { data, isPending, isFetching, error, refetch, dataUpdatedAt } = useIntegrations(me.permissions.viewIntegrations);
  if (!me.permissions.viewIntegrations) return <NoAccess what="L’état des intégrations est réservé aux rôles audit et administrateur." />;

  const up = data?.filter((i) => i.state === 'up').length ?? 0;
  const down = data?.filter((i) => i.state === 'down').length ?? 0;

  return (
    <div>
      <PageHeader
        title="Intégrations"
        description="Les services pilotés par les workflows n8n. Un service injoignable met les étapes correspondantes en échec, sans bloquer les autres."
        actions={
          <Button loading={isFetching} onClick={() => void refetch()} icon={<IconRetry className="size-4" aria-hidden="true" />}>
            Tester maintenant
          </Button>
        }
      />
      {error ? <ErrorState error={error} onRetry={() => void refetch()} className="mb-4" /> : null}
      {data ? (
        <p className="mb-4 text-[13px] text-ink-3" aria-live="polite">
          <span className={cn('font-medium', down ? 'text-danger' : 'text-ink')}>
            {up} sur {data.length} opérationnels
          </span>{' '}
          · contrôle automatique toutes les 30 s · dernier {formatRelative(new Date(dataUpdatedAt))}
        </p>
      ) : null}
      <div className="overflow-hidden panel rounded-[var(--radius-panel)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-sunken text-left text-xs font-medium text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Service</th>
                <th scope="col" className="px-4 py-2.5 font-medium">État</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Latence</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Version</th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Console</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isPending
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))
                : data?.map((integration) => (
                    <tr key={integration.key} className="align-top">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium" translate="no">
                            {integration.name}
                          </p>
                          <p className="text-xs text-ink-3">{integration.role}</p>
                          {integration.error ? <p className="mt-1.5 text-xs text-danger">{integration.error}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATE[integration.state].tone}>{STATE[integration.state].label}</Badge>
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular', latencyClass(integration.latencyMs))}>
                        {integration.latencyMs !== null ? `${integration.latencyMs}${NBSP}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-ink-2" translate="no">
                        {integration.version ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {integration.link ? (
                          <a
                            href={integration.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] font-medium text-info underline-offset-4 hover:underline"
                          >
                            Ouvrir <IconExternal className="size-3.5" aria-hidden="true" />
                            <span className="sr-only">la console {integration.name}</span>
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
