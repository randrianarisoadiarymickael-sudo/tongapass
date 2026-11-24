/**
 * Génération d'identifiants compatibles avec tous les outils provisionnés.
 * Contrainte la plus stricte : Mattermost (3 à 22 caractères, minuscules,
 * chiffres, « . », « - », « _ », doit commencer par une lettre).
 */
export const USERNAME_MAX_LENGTH = 22;

/** Supprime accents et caractères spéciaux : « Andrianasolo-Rakoto » → « andrianasolorakoto ». */
export function normalizeNamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Propose des identifiants par ordre de préférence :
 * prenom.nom → p.nom → prenom.n, tous tronqués à 22 caractères.
 */
export function usernameCandidates(firstName: string, lastName: string): string[] {
  const first = normalizeNamePart(firstName) || 'user';
  const last = normalizeNamePart(lastName) || 'tp';
  const raw = [`${first}.${last}`, `${first[0]}.${last}`, `${first}.${last[0]}`];
  const candidates = raw.map((candidate) => trimUsername(candidate));
  const unique = Array.from(new Set(candidates));
  return unique.map((candidate) => (/^[a-z]/.test(candidate) ? candidate : `u${candidate}`.slice(0, USERNAME_MAX_LENGTH)));
}

/** Ajoute un suffixe numérique en respectant la longueur maximale. */
export function withNumericSuffix(base: string, index: number): string {
  const suffix = String(index);
  return `${trimUsername(base.slice(0, USERNAME_MAX_LENGTH - suffix.length))}${suffix}`;
}

function trimUsername(value: string): string {
  return value.slice(0, USERNAME_MAX_LENGTH).replace(/[._-]+$/g, '');
}

export function workEmailFor(username: string, domain: string): string {
  return `${username}@${domain}`.toLowerCase();
}

/** Met en forme un nom propre : « rAKOTO » → « Rakoto », « jean-luc » → « Jean-Luc ». */
export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`);
}
