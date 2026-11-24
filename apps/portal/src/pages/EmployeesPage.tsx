import { DropdownMenu } from 'radix-ui';
import { IconArrival, IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight, IconClose, IconDownload, IconMore, IconPeople, IconSearch, IconSort } from '@/components/icons';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { EmployeeStatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Avatar, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useDepartments, useEmployees, useProfiles } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useOriginState } from '@/hooks/useOrigin';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { EmployeeStatus } from '@/lib/types';

type StatusFilter = 'all' | 'active' | 'incoming' | 'leaving' | 'issues' | 'departed';

const STATUS_FILTERS: { value: StatusFilter; label: string; statuses: EmployeeStatus[] }[] = [
  { value: 'all', label: 'Tous', statuses: [] },
  { value: 'active', label: 'Actifs', statuses: ['ACTIVE', 'OFFBOARDING_SCHEDULED'] },
  { value: 'incoming', label: 'En arrivée', statuses: ['PENDING', 'PROVISIONING'] },
  { value: 'leaving', label: 'En départ', statuses: ['OFFBOARDING_SCHEDULED', 'OFFBOARDING'] },
  { value: 'issues', label: 'À corriger', statuses: ['FAILED'] },
  { value: 'departed', label: 'Partis', statuses: ['DEPARTED', 'CANCELLED'] },
];

type SortKey = 'lastName' | 'startDate' | 'createdAt';

const menuItem = 'flex h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] text-ink-2 outline-none transition-colors data-[highlighted]:bg-hover data-[highlighted]:text-ink';

function SortHeader({ label, sortKey, sort, order, onSort }: { label: string; sortKey: SortKey; sort: SortKey; order: 'ASC' | 'DESC'; onSort: (key: SortKey) => void }) {
  const active = sort === sortKey;
  const Icon = !active ? IconSort : order === 'ASC' ? IconArrowUp : IconArrowDown;
  return (
    <th scope="col" aria-sort={active ? (order === 'ASC' ? 'ascending' : 'descending') : 'none'} className="px-4 py-2.5 font-medium">
      <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </th>
  );
}

export function EmployeesPage() {
  useDocumentTitle('Annuaire');
  const me = useMe();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const statusFilter = (params.get('statut') as StatusFilter | null) ?? 'all';
  const department = params.get('service') ?? '';
  const profile = params.get('profil') ?? '';
  const sort = (params.get('tri') as SortKey | null) ?? 'createdAt';
  const order = (params.get('ordre') as 'ASC' | 'DESC' | null) ?? 'DESC';
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const [draft, setDraft] = useState(search);
  const [exporting, setExporting] = useState(false);
  // Le fil d'Ariane de la fiche ramène à l'annuaire avec les mêmes filtres
  const linkState = useOriginState('Annuaire');

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.trim() !== search) update({ q: draft.trim() });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const statuses = STATUS_FILTERS.find((f) => f.value === statusFilter)?.statuses ?? [];
  const filters = {
    search: search || undefined,
    status: statuses,
    department: department || undefined,
    accessProfileId: profile || undefined,
    sort,
    order,
  };
  const { data, isPending, isFetching, error, refetch } = useEmployees({ ...filters, page, pageSize: 20 });
  const departments = useDepartments();
  const profiles = useProfiles(true);
  const hasFilters = !!(search || statusFilter !== 'all' || department || profile);

  const onSort = (key: SortKey) => {
    if (sort === key) update({ tri: key, ordre: order === 'ASC' ? 'DESC' : 'ASC' });
    else update({ tri: key, ordre: key === 'lastName' ? 'ASC' : 'DESC' });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/employees/export', filters, 'tongapass-annuaire.csv');
      toast.success('Export prêt', { description: 'Le fichier CSV a été téléchargé.' });
    } catch (e) {
      toast.error('Export impossible', { description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Annuaire"
        description="Tous les employés gérés par TongaPass et l’état de leurs accès."
        actions={
          <>
            <Button onClick={exportCsv} loading={exporting} icon={<IconDownload className="size-4" aria-hidden="true" />}>
              Exporter
            </Button>
            {me.permissions.manageEmployees ? (
              <ButtonLink to="/arrivees/nouvelle" variant="primary" icon={<IconArrival className="size-4" aria-hidden="true" />}>
                Déclarer une arrivée
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nom, identifiant, matricule ou e-mail…"
            aria-label="Rechercher un employé"
            className="pl-10"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <Select value={department} onChange={(event) => update({ service: event.target.value })} aria-label="Filtrer par service" className="lg:w-44">
          <option value="">Tous les services</option>
          {departments.data?.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select value={profile} onChange={(event) => update({ profil: event.target.value })} aria-label="Filtrer par profil d’accès" className="lg:w-52">
          <option value="">Tous les profils</option>
          {profiles.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Filtrer par statut"
          options={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={statusFilter}
          onChange={(value) => update({ statut: value })}
        />
        {hasFilters ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft('');
              setParams(new URLSearchParams(), { replace: true });
            }}
            icon={<IconClose className="size-3.5" aria-hidden="true" />}
          >
            Effacer les filtres
          </Button>
        ) : null}
        <span className="ml-auto text-[13px] tabular text-ink-3" aria-live="polite">
          {data ? `${data.total} employé${data.total > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} className="mb-3" /> : null}

      <div className={cn('overflow-hidden panel rounded-[var(--radius-panel)] transition-opacity', isFetching && !isPending && 'opacity-70')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-sunken text-left text-xs font-medium text-ink-2">
              <tr>
                <SortHeader label="Employé" sortKey="lastName" sort={sort} order={order} onSort={onSort} />
                <th scope="col" className="px-4 py-2.5 font-medium">Poste</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Profil d’accès</th>
                <SortHeader label="Arrivée" sortKey="startDate" sort={sort} order={order} onSort={onSort} />
                <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                <th scope="col" className="w-12 px-2 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isPending
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }, (__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((employee) => (
                    <tr
                      key={employee.id}
                      className="cursor-pointer transition-colors hover:bg-hover"
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('a, button, [role="menu"]')) return;
                        navigate(`/employes/${employee.id}`, { state: linkState });
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar first={employee.firstName} last={employee.lastName} color={employee.accessProfile.color} />
                          <span className="min-w-0">
                            <Link to={`/employes/${employee.id}`} state={linkState} className="block truncate font-medium text-ink hover:underline">
                              {employee.firstName} {employee.lastName}
                            </Link>
                            <span className="block truncate font-mono text-xs text-ink-3" translate="no">
                              {employee.username}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block text-ink">{employee.jobTitle}</span>
                        <span className="block text-xs text-ink-3">{employee.department}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <span className="size-2 rounded-[2px]" style={{ background: employee.accessProfile.color }} aria-hidden="true" />
                          {employee.accessProfile.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular text-ink-2">{formatDate(employee.startDate)}</td>
                      <td className="px-4 py-2.5">
                        <EmployeeStatusBadge status={employee.status} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger
                            className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink"
                            aria-label={`Actions pour ${employee.firstName} ${employee.lastName}`}
                          >
                            <IconMore className="size-4" aria-hidden="true" />
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 w-52 panel-raised rounded-xl p-1.5">
                              <DropdownMenu.Item className={menuItem} onSelect={() => navigate(`/employes/${employee.id}`, { state: linkState })}>
                                Ouvrir la fiche
                              </DropdownMenu.Item>
                              {me.permissions.manageEmployees && ['ACTIVE', 'OFFBOARDING_SCHEDULED'].includes(employee.status) ? (
                                <DropdownMenu.Item className={menuItem} onSelect={() => navigate(`/employes/${employee.id}?mobilite=1`, { state: linkState })}>
                                  Changer de poste…
                                </DropdownMenu.Item>
                              ) : null}
                              {me.permissions.manageEmployees && ['ACTIVE', 'FAILED'].includes(employee.status) ? (
                                <DropdownMenu.Item
                                  className={cn(menuItem, 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger')}
                                  onSelect={() => navigate(`/employes/${employee.id}?depart=1`, { state: linkState })}
                                >
                                  Déclarer le départ…
                                </DropdownMenu.Item>
                              ) : null}
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {data && data.items.length === 0 ? (
          <EmptyState
            icon={<IconPeople className="size-5" aria-hidden="true" />}
            title={hasFilters ? 'Aucun employé ne correspond' : 'L’annuaire est vide'}
            action={
              !hasFilters && me.permissions.manageEmployees ? (
                <ButtonLink to="/arrivees/nouvelle" variant="primary" size="sm">
                  Déclarer la première arrivée
                </ButtonLink>
              ) : null
            }
          >
            {hasFilters ? 'Essayez un autre nom ou retirez un filtre.' : 'Déclarez une arrivée pour provisionner automatiquement les accès.'}
          </EmptyState>
        ) : null}

        {data && data.totalPages > 1 ? (
          <nav className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px]" aria-label="Pagination">
            <span className="text-ink-3">
              Page {data.page} sur {data.totalPages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} icon={<IconChevronLeft className="size-4" aria-hidden="true" />}>
                Précédente
              </Button>
              <Button size="sm" disabled={page >= data.totalPages} onClick={() => update({ page: String(page + 1) })}>
                Suivante
                <IconChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
