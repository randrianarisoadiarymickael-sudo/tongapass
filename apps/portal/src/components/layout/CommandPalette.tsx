import { Command } from 'cmdk';
import { Dialog } from 'radix-ui';
import { IconArrival, IconArrowRight, IconExit, IconMoon, IconPerson, IconSearch } from '@/components/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, useMe } from '@/auth/AuthProvider';
import { useEmployees } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { EMPLOYEE_STATUS } from '@/lib/labels';
import { NAV_ITEMS } from './navigation';

const itemClass =
  'group flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-ink-2 transition-colors data-[selected=true]:bg-brand-soft data-[selected=true]:text-ink';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3';

/** Palette de commandes (Ctrl/⌘ + K) : navigation, recherche d'employés et actions rapides. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const me = useMe();
  const { logout } = useAuth();
  const { toggle } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const employees = useEmployees({ search: debounced, pageSize: 6 });
  const showEmployees = debounced.length >= 2 && (employees.data?.items.length ?? 0) > 0;

  const run = (action: () => void) => {
    onOpenChange(false);
    setSearch('');
    action();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1c1613]/45 data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content className="panel-raised fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl data-[state=open]:animate-[dialog-in_var(--duration-base)_var(--ease-out)]">
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <Dialog.Description className="sr-only">Recherchez une page, un employé ou une action</Dialog.Description>
          <Command label="Palette de commandes" shouldFilter={!showEmployees} loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <IconSearch className="size-5 text-brand" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Rechercher un employé, une page, une action…"
                className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3 sm:text-[15px]"
              />
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">Aucun résultat pour « {search} »</Command.Empty>

              {showEmployees ? (
                <Command.Group heading="Employés" className={groupClass}>
                  {employees.data?.items.map((employee) => (
                    <Command.Item
                      key={employee.id}
                      value={`${employee.firstName} ${employee.lastName} ${employee.username}`}
                      onSelect={() => run(() => navigate(`/employes/${employee.id}`))}
                      className={itemClass}
                    >
                      <IconPerson className="size-4 text-ink-3 group-data-[selected=true]:text-brand" />
                      <span className="flex-1 truncate">
                        <span className="font-medium text-ink">
                          {employee.firstName} {employee.lastName}
                        </span>{' '}
                        <span className="text-ink-3">· {employee.jobTitle}</span>
                      </span>
                      <span className="text-xs text-ink-3">{EMPLOYEE_STATUS[employee.status].label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : (
                <>
                  <Command.Group heading="Aller à" className={groupClass}>
                    {NAV_ITEMS.filter((item) => item.visible(me)).map((item) => (
                      <Command.Item key={item.to} value={item.label} onSelect={() => run(() => navigate(item.to))} className={itemClass}>
                        <item.icon className="size-[18px] text-ink-3 group-data-[selected=true]:text-brand" />
                        <span className="flex-1">{item.label}</span>
                        <IconArrowRight className="size-3.5 text-ink-3 opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="Actions" className={groupClass}>
                    {me.permissions.manageEmployees ? (
                      <Command.Item value="Déclarer une arrivée" onSelect={() => run(() => navigate('/arrivees/nouvelle'))} className={itemClass}>
                        <IconArrival className="size-[18px] text-ink-3 group-data-[selected=true]:text-brand" />
                        Déclarer une arrivée…
                      </Command.Item>
                    ) : null}
                    <Command.Item value="Changer de thème clair sombre" onSelect={() => run(toggle)} className={itemClass}>
                      <IconMoon className="size-[18px] text-ink-3 group-data-[selected=true]:text-brand" />
                      Basculer le thème clair / sombre
                    </Command.Item>
                    <Command.Item value="Se déconnecter" onSelect={() => run(() => void logout())} className={itemClass}>
                      <IconExit className="size-[18px] text-ink-3 group-data-[selected=true]:text-brand" />
                      Se déconnecter
                    </Command.Item>
                  </Command.Group>
                </>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
