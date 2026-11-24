import { ComplianceStatus, EmployeeStatus } from '../../common/enums';
import type { ComplianceDetails } from './compliance-check.entity';
import type { DirectoryUser } from './keycloak-directory.client';

export interface ExpectedAccess {
  enabled: boolean;
  realmRoles: string[];
  groups: string[];
}

/** Statuts d'employé qui doivent avoir un compte actif avec les droits du profil. */
export const ACTIVE_EXPECTATION: readonly EmployeeStatus[] = [
  EmployeeStatus.ACTIVE,
  EmployeeStatus.OFFBOARDING_SCHEDULED,
  EmployeeStatus.FAILED,
];

const minus = (a: string[], b: string[]) => a.filter((value) => !b.includes(value)).sort();

/**
 * Compare l'état réel d'un compte à l'état attendu. Un employé parti doit avoir un compte
 * désactivé et sans droit (ou supprimé) ; un employé actif, exactement les droits de son profil.
 */
export function evaluateCompliance(
  expected: ExpectedAccess,
  actual: DirectoryUser | null,
): { status: ComplianceStatus; details: ComplianceDetails } {
  if (!actual) {
    const fine = !expected.enabled;
    return {
      status: fine ? ComplianceStatus.COMPLIANT : ComplianceStatus.NO_ACCOUNT,
      details: {
        expected,
        actual: { exists: false, enabled: null, realmRoles: [], groups: [] },
        missingRoles: fine ? [] : [...expected.realmRoles].sort(),
        unexpectedRoles: [],
        missingGroups: fine ? [] : [...expected.groups].sort(),
        unexpectedGroups: [],
        enabledMismatch: false,
        message: fine ? 'Aucun compte : conforme pour un employé parti' : 'Compte Keycloak introuvable',
      },
    };
  }
  const missingRoles = minus(expected.realmRoles, actual.realmRoles);
  const unexpectedRoles = minus(actual.realmRoles, expected.realmRoles);
  const missingGroups = minus(expected.groups, actual.groups);
  const unexpectedGroups = minus(actual.groups, expected.groups);
  const enabledMismatch = actual.enabled !== expected.enabled;
  const drift =
    enabledMismatch || missingRoles.length > 0 || unexpectedRoles.length > 0 || missingGroups.length > 0 || unexpectedGroups.length > 0;

  const problems: string[] = [];
  if (enabledMismatch) problems.push(expected.enabled ? 'compte désactivé' : 'compte encore actif');
  if (unexpectedRoles.length) problems.push(`rôles en trop : ${unexpectedRoles.join(', ')}`);
  if (missingRoles.length) problems.push(`rôles manquants : ${missingRoles.join(', ')}`);
  if (unexpectedGroups.length) problems.push(`groupes en trop : ${unexpectedGroups.join(', ')}`);
  if (missingGroups.length) problems.push(`groupes manquants : ${missingGroups.join(', ')}`);

  return {
    status: drift ? ComplianceStatus.DRIFT : ComplianceStatus.COMPLIANT,
    details: {
      expected,
      actual: { exists: true, enabled: actual.enabled, realmRoles: [...actual.realmRoles].sort(), groups: [...actual.groups].sort() },
      missingRoles,
      unexpectedRoles,
      missingGroups,
      unexpectedGroups,
      enabledMismatch,
      message: drift ? `Écart détecté : ${problems.join(' · ')}` : 'Droits conformes au profil',
    },
  };
}
