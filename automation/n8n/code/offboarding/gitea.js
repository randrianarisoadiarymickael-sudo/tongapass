// Gitea : blocage de la connexion (jetons d'API compris) et retrait de toutes les équipes.
const GITEA = $env.GITEA_URL;
const ORG = $env.GITEA_ORG || 'tongapass';
const done = (status, detail) => [stepEvent('gitea.revoke', status, detail)];
if (!GITEA) return done('SKIPPED', 'Gitea non configuré');

const headers = { Authorization: `Basic ${btoa(`${$env.GITEA_ADMIN_USER}:${$env.GITEA_ADMIN_PASSWORD}`)}` };
const username = employee.giteaUsername || employee.username;
const user = encodeURIComponent(username);

try {
  const existing = await http({ method: 'GET', url: `${GITEA}/api/v1/users/${user}`, headers });
  if (existing.status === 404) return done('SKIPPED', 'Aucun compte Gitea à révoquer');
  if (existing.status !== 200) throw new Error(describe(existing));

  const blocked = await http({
    method: 'PATCH',
    url: `${GITEA}/api/v1/admin/users/${user}`,
    headers,
    body: { login_name: username, source_id: 0, active: false, prohibit_login: true },
  });
  if (blocked.status >= 300) throw new Error(`blocage refusé (${describe(blocked)})`);

  const teams = await http({ method: 'GET', url: `${GITEA}/api/v1/orgs/${ORG}/teams`, headers });
  const left = [];
  for (const team of Array.isArray(teams.body) ? teams.body : []) {
    const member = await http({ method: 'GET', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (member.status !== 200) continue;
    const removed = await http({ method: 'DELETE', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (removed.status >= 300) throw new Error(`retrait de l'équipe ${team.name} refusé (${describe(removed)})`);
    left.push(team.name);
  }
  return done('SUCCEEDED', `Connexion bloquée pour « ${username} » · équipes quittées : ${left.join(', ') || 'aucune'}`);
} catch (error) {
  return done('FAILED', error.message);
}
