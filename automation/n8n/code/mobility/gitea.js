// Mobilité — Gitea : rejoint les nouvelles équipes, quitte celles qui ne sont plus prévues.
const GITEA = $env.GITEA_URL;
const ORG = $env.GITEA_ORG || 'tongapass';
const empty = { giteaTeams: [] };
const changes = (ctx.mobility && ctx.mobility.changes) || { added: empty, removed: empty };
const toJoin = changes.added.giteaTeams || [];
const toLeave = changes.removed.giteaTeams || [];
const done = (status, detail, meta) => [stepEvent('gitea.sync', status, detail, meta)];

if (!GITEA) return done('SKIPPED', 'Gitea non configuré');
if (!toJoin.length && !toLeave.length) return done('SKIPPED', 'Aucun changement d’équipe Gitea');

const headers = { Authorization: `Basic ${btoa(`${$env.GITEA_ADMIN_USER}:${$env.GITEA_ADMIN_PASSWORD}`)}` };
const username = employee.giteaUsername || employee.username;
const user = encodeURIComponent(username);

try {
  const existing = await http({ method: 'GET', url: `${GITEA}/api/v1/users/${user}`, headers });
  if (existing.status === 404) {
    if (!toJoin.length) return done('SKIPPED', 'Aucun compte Gitea : rien à retirer');
    // Premier accès au code source : création du compte (mot de passe jetable, à réinitialiser).
    const created = await http({
      method: 'POST',
      url: `${GITEA}/api/v1/admin/users`,
      headers,
      body: {
        username,
        email: employee.workEmail,
        full_name: employee.fullName,
        password: randomPassword(),
        must_change_password: true,
        send_notify: false,
        visibility: 'private',
      },
    });
    if (created.status !== 201) throw new Error(`création du compte refusée (${describe(created)})`);
  } else if (existing.status !== 200) {
    throw new Error(describe(existing));
  }

  const teams = await http({ method: 'GET', url: `${GITEA}/api/v1/orgs/${ORG}/teams`, headers });
  if (teams.status !== 200) throw new Error(`équipes illisibles (${describe(teams)})`);
  const byName = (name) => teams.body.find((team) => team.name === name);
  const joined = [];
  const left = [];
  for (const name of toJoin) {
    const team = byName(name);
    if (!team) throw new Error(`équipe « ${name} » introuvable`);
    const res = await http({ method: 'PUT', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (res.status >= 300) throw new Error(`ajout à l'équipe ${name} refusé (${describe(res)})`);
    joined.push(name);
  }
  for (const name of toLeave) {
    const team = byName(name);
    if (!team) continue;
    const member = await http({ method: 'GET', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (member.status !== 200) continue;
    const res = await http({ method: 'DELETE', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (res.status >= 300) throw new Error(`retrait de l'équipe ${name} refusé (${describe(res)})`);
    left.push(name);
  }
  return done('SUCCEEDED', `Équipes rejointes : ${joined.join(', ') || 'aucune'} · quittées : ${left.join(', ') || 'aucune'}`, { username });
} catch (error) {
  return done('FAILED', error.message);
}
