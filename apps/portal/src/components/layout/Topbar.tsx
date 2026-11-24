import { DropdownMenu } from 'radix-ui';
import { useAuth, useMe } from '@/auth/AuthProvider';
import { IconExit, IconExternal, IconMenu, IconMoon, IconSearch, IconSun } from '@/components/icons';
import { useLive } from '@/hooks/useLiveEvents';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import { IconButton } from '../ui/Button';
import { Avatar, Kbd } from '../ui/Feedback';
import { LiveActivity } from './LiveActivity';

const TOOL_LINKS: { key: keyof ReturnType<typeof useMe>['workspace']['links']; label: string }[] = [
  { key: 'keycloak', label: 'Console Keycloak' },
  { key: 'n8n', label: 'Workflows n8n' },
  { key: 'gitea', label: 'Gitea' },
  { key: 'mattermost', label: 'Mattermost' },
  { key: 'mailpit', label: 'Boîte de test (Mailpit)' },
  { key: 'apiDocs', label: 'Documentation de l’API' },
];

const menuItem =
  'flex h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 text-[13px] text-ink-2 outline-none transition-colors data-[highlighted]:bg-hover data-[highlighted]:text-ink';

/** Barre supérieure : recherche, état de la connexion temps réel, activité, thème et compte. */
export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  const me = useMe();
  const { logout } = useAuth();
  const { connected, events } = useLive();
  const signal = events[0]?.seq;
  const { resolved, toggle } = useTheme();
  const [first = '', last = ''] = (me.name ?? me.username).split(' ');
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="workspace-topbar sticky top-0 z-30 border-b border-line bg-surface">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <IconButton label="Ouvrir le menu" className="lg:hidden" onClick={onOpenMenu}>
          <IconMenu className="size-5" />
        </IconButton>

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Rechercher un employé, une page (Ctrl + K)"
          className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-ink-3/60 sm:max-w-md"
        >
          <IconSearch className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Rechercher un employé, une page…</span>
          <span className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <span
            role="status"
            className={cn(
              'live-indicator mr-1 hidden items-center gap-1.5 text-xs md:inline-flex',
              connected ? 'text-success' : 'text-ink-3',
            )}
            title={connected ? 'Les mises à jour arrivent en temps réel' : 'Reconnexion au flux temps réel…'}
          >
            <svg viewBox="0 0 42 18" className="h-4 w-9" aria-hidden="true" data-signal={signal ?? 0}>
              <path d="M1 10H41" fill="none" stroke="currentColor" opacity=".45" />
              {signal && connected ? <path key={signal} className="signal-stroke" d="M1 10h10l3-3 4 8 5-13 4 10 3-2h11" pathLength="1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /> : null}
            </svg>
            <span>{connected ? 'Synchronisé' : 'Reconnexion…'}</span>
          </span>

          <LiveActivity />

          <IconButton label={resolved === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'} onClick={toggle}>
            {resolved === 'dark' ? <IconSun className="size-[18px]" /> : <IconMoon className="size-[18px]" />}
          </IconButton>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="ml-1 rounded-full" aria-label={`Compte de ${me.name ?? me.username}`}>
              <Avatar first={first} last={last || first.slice(1)} size="sm" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={10} className="panel-raised z-50 w-64 rounded-lg p-1">
                <div className="flex items-center gap-3 px-2.5 py-2.5">
                  <Avatar first={first} last={last || first.slice(1)} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{me.name ?? me.username}</p>
                    <p className="truncate text-xs text-ink-3" translate="no">
                      {me.email ?? me.username}
                    </p>
                  </div>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-ink-3">Outils de la pile</DropdownMenu.Label>
                {TOOL_LINKS.filter((tool) => me.workspace.links[tool.key]).map((tool) => (
                  <DropdownMenu.Item key={tool.key} asChild>
                    <a href={me.workspace.links[tool.key] ?? '#'} target="_blank" rel="noreferrer" className={menuItem}>
                      {tool.label}
                      <IconExternal className="size-3.5 text-ink-3" />
                    </a>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item
                  onSelect={() => void logout()}
                  className={cn(menuItem, 'justify-start text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger')}
                >
                  <IconExit className="size-4" />
                  Se déconnecter
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
