import { BASELINE_ROLE } from './access-catalog';

/** Ensemble des droits d'un employé, tous systèmes confondus. */
export interface AccessSet {
  realmRoles: string[];
  groups: string[];
  giteaTeams: string[];
  chatChannels: string[];
}

export interface AccessDiff {
  added: AccessSet;
  removed: AccessSet;
  kept: AccessSet;
  changed: boolean;
}

const KINDS = ['realmRoles', 'groups', 'giteaTeams', 'chatChannels'] as const;

/** Droits jamais retirés lors d'une mobilité : socle salarié et canal général. */
const NEVER_REMOVED: Partial<Record<keyof AccessSet, string[]>> = {
  realmRoles: [BASELINE_ROLE],
  chatChannels: ['town-square'],
};

const unique = (values: string[]) => Array.from(new Set(values));

/** Droits effectifs : ceux du profil, plus les éventuels droits supplémentaires justifiés. */
export function effectiveAccess(
  profile: AccessSet,
  extraRealmRoles: string[] = [],
): AccessSet {
  return {
    realmRoles: unique([...profile.realmRoles, ...extraRealmRoles]),
    groups: unique(profile.groups),
    giteaTeams: unique(profile.giteaTeams),
    chatChannels: unique(profile.chatChannels),
  };
}

/** Écart entre deux ensembles de droits (ce qu'il faut ajouter, retirer, conserver). */
export function diffAccess(from: AccessSet, to: AccessSet): AccessDiff {
  const added = {} as AccessSet;
  const removed = {} as AccessSet;
  const kept = {} as AccessSet;
  for (const kind of KINDS) {
    const before = new Set(from[kind]);
    const after = new Set(to[kind]);
    const protectedValues = new Set(NEVER_REMOVED[kind] ?? []);
    added[kind] = [...after].filter((value) => !before.has(value));
    removed[kind] = [...before].filter((value) => !after.has(value) && !protectedValues.has(value));
    kept[kind] = [...after].filter((value) => before.has(value));
  }
  const changed = KINDS.some((kind) => added[kind].length > 0 || removed[kind].length > 0);
  return { added, removed, kept, changed };
}
