// Keycloak : désactivation, révocation des sessions et consentements, retrait des rôles et groupes.
// Sécurité : on poursuit la révocation même si une sous-étape échoue (ne jamais laisser d'accès résiduel).
const steps = ['keycloak.disable', 'keycloak.sessions', 'keycloak.roles'];

let token;
try {
  token = await keycloakToken();
} catch (error) {
  return steps.map((step) => stepEvent(step, 'FAILED', `Keycloak injoignable : ${error.message}`));
}
const headers = { Authorization: `Bearer ${token}` };

const user = await findKeycloakUser(headers);
if (!user) return steps.map((step) => stepEvent(step, 'SKIPPED', 'Aucun compte Keycloak à révoquer'));
const results = [];

// 1. Désactivation -------------------------------------------------------------
try {
  const disabled = await http({ method: 'PUT', url: `${ADMIN}/users/${user.id}`, headers, body: { ...user, enabled: false } });
  if (disabled.status >= 300) throw new Error(describe(disabled));
  results.push(stepEvent('keycloak.disable', 'SUCCEEDED', `Compte « ${user.username} » désactivé : plus aucune connexion possible`, { userId: user.id }));
} catch (error) {
  results.push(stepEvent('keycloak.disable', 'FAILED', `désactivation impossible : ${error.message}`));
}

// 2. Sessions, jetons hors ligne et consentements --------------------------------
try {
  const sessions = await http({ method: 'GET', url: `${ADMIN}/users/${user.id}/sessions`, headers });
  const offline = await http({ method: 'GET', url: `${ADMIN}/users/${user.id}/consents`, headers });
  const logout = await http({ method: 'POST', url: `${ADMIN}/users/${user.id}/logout`, headers });
  if (logout.status >= 300) throw new Error(describe(logout));
  let consents = 0;
  for (const consent of Array.isArray(offline.body) ? offline.body : []) {
    const revoked = await http({ method: 'DELETE', url: `${ADMIN}/users/${user.id}/consents/${encodeURIComponent(consent.clientId)}`, headers });
    if (revoked.status < 300) consents += 1;
  }
  const count = Array.isArray(sessions.body) ? sessions.body.length : 0;
  results.push(stepEvent('keycloak.sessions', 'SUCCEEDED', `${count} session(s) active(s) fermée(s), ${consents} consentement(s) révoqué(s)`, { sessions: count }));
} catch (error) {
  results.push(stepEvent('keycloak.sessions', 'FAILED', `révocation des sessions impossible : ${error.message}`));
}

// 3. Rôles et groupes -------------------------------------------------------------
try {
  const mappings = await http({ method: 'GET', url: `${ADMIN}/users/${user.id}/role-mappings/realm`, headers });
  const roles = (Array.isArray(mappings.body) ? mappings.body : []).filter((role) => !role.name.startsWith('default-roles-'));
  if (roles.length) {
    const removed = await http({ method: 'DELETE', url: `${ADMIN}/users/${user.id}/role-mappings/realm`, headers, body: roles });
    if (removed.status >= 300) throw new Error(`retrait des rôles refusé (${describe(removed)})`);
  }
  const groups = await http({ method: 'GET', url: `${ADMIN}/users/${user.id}/groups`, headers });
  const left = [];
  for (const group of Array.isArray(groups.body) ? groups.body : []) {
    const removed = await http({ method: 'DELETE', url: `${ADMIN}/users/${user.id}/groups/${group.id}`, headers });
    if (removed.status >= 300) throw new Error(`retrait du groupe ${group.name} refusé (${describe(removed)})`);
    left.push(group.name);
  }
  results.push(
    stepEvent('keycloak.roles', 'SUCCEEDED', `Rôles retirés : ${roles.map((r) => r.name).join(', ') || 'aucun'} · groupes quittés : ${left.join(', ') || 'aucun'}`),
  );
} catch (error) {
  results.push(stepEvent('keycloak.roles', 'FAILED', error.message));
}

return results;
