import { ComplianceStatus } from '../../common/enums';
import { evaluateCompliance } from './compliance.util';

const expectedActive = { enabled: true, realmRoles: ['developer', 'employee'], groups: ['Engineering'] };
const expectedDeparted = { enabled: false, realmRoles: [], groups: [] };
const user = (over = {}) => ({ id: 'u1', username: 'hanitra', enabled: true, realmRoles: ['employee', 'developer'], groups: ['Engineering'], ...over });

describe('evaluateCompliance', () => {
  it('conforme quand les droits réels correspondent au profil', () => {
    expect(evaluateCompliance(expectedActive, user()).status).toBe(ComplianceStatus.COMPLIANT);
  });

  it('détecte un rôle ajouté à la main (escalade de privilèges)', () => {
    const result = evaluateCompliance(expectedActive, user({ realmRoles: ['employee', 'developer', 'tp-admin'] }));
    expect(result.status).toBe(ComplianceStatus.DRIFT);
    expect(result.details.unexpectedRoles).toEqual(['tp-admin']);
    expect(result.details.message).toContain('rôles en trop : tp-admin');
  });

  it('détecte un groupe manquant', () => {
    const result = evaluateCompliance(expectedActive, user({ groups: [] }));
    expect(result.details.missingGroups).toEqual(['Engineering']);
  });

  it('détecte un compte encore actif après le départ', () => {
    const result = evaluateCompliance(expectedDeparted, user());
    expect(result.status).toBe(ComplianceStatus.DRIFT);
    expect(result.details.enabledMismatch).toBe(true);
    expect(result.details.unexpectedRoles).toEqual(['developer', 'employee']);
  });

  it('accepte un compte désactivé et vidé pour un employé parti', () => {
    expect(evaluateCompliance(expectedDeparted, user({ enabled: false, realmRoles: [], groups: [] })).status).toBe(ComplianceStatus.COMPLIANT);
  });

  it('signale un compte introuvable pour un employé actif', () => {
    expect(evaluateCompliance(expectedActive, null).status).toBe(ComplianceStatus.NO_ACCOUNT);
    expect(evaluateCompliance(expectedDeparted, null).status).toBe(ComplianceStatus.COMPLIANT);
  });
});
