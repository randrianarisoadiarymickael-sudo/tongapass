import { AccessChip } from '@/components/ui/Badge';
import type { AccessSet } from '@/lib/types';

const ROWS: { key: keyof AccessSet; system: string; label: string; prefix?: string }[] = [
  { key: 'realmRoles', system: 'Keycloak', label: 'Rôles' },
  { key: 'groups', system: 'Keycloak', label: 'Groupes', prefix: '/' },
  { key: 'giteaTeams', system: 'Gitea', label: 'Équipes' },
  { key: 'chatChannels', system: 'Mattermost', label: 'Canaux', prefix: '~' },
];

interface Props {
  access: AccessSet;
  sensitive?: Set<string>;
  /** Mode écart (mobilité) : droits ajoutés et retirés mis en évidence. */
  diff?: { added: AccessSet; removed: AccessSet };
}

/** Matrice des accès par système : ce que la personne peut faire, et où. */
export function AccessMatrix({ access, sensitive = new Set(), diff }: Props) {
  return (
    <table className="w-full text-sm">
      <thead className="sr-only">
        <tr>
          <th scope="col">Système</th>
          <th scope="col">Droits</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {ROWS.map((row) => {
          const kept = diff ? access[row.key].filter((v) => !diff.added[row.key].includes(v)) : access[row.key];
          const added = diff?.added[row.key] ?? [];
          const removed = diff?.removed[row.key] ?? [];
          const empty = kept.length + added.length + removed.length === 0;
          return (
            <tr key={row.key}>
              <th scope="row" className="w-36 py-2.5 pr-3 text-left align-top font-normal">
                <span className="block text-[13px] font-medium text-ink" translate="no">
                  {row.system}
                </span>
                <span className="block text-xs text-ink-3">{row.label}</span>
              </th>
              <td className="py-2.5">
                {empty ? (
                  <span className="text-[13px] text-ink-3">Aucun</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {kept.map((value) => (
                      <AccessChip key={value} prefix={row.prefix} sensitive={sensitive.has(value)}>
                        {value}
                      </AccessChip>
                    ))}
                    {added.map((value) => (
                      <AccessChip key={`+${value}`} prefix={row.prefix} change="added">
                        {value}
                      </AccessChip>
                    ))}
                    {removed.map((value) => (
                      <AccessChip key={`-${value}`} prefix={row.prefix} change="removed">
                        {value}
                      </AccessChip>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
