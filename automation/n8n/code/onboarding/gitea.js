// Gitea : compte (idempotent) et appartenance aux seules équipes prévues par le profil.
const GITEA = $env.GITEA_URL;
const ORG = $env.GITEA_ORG || 'tongapass';
const done = (status, detail, meta) => [stepEvent('gitea.account', status, detail, meta)];

if (!GITEA) return done('SKIPPED', 'Gitea non configuré');
if (!(access.giteaTeams || []).length) return done('SKIPPED', 'Le profil ne prévoit aucun accès Gitea (moindre privilège)');

const headers = { Authorization: `Basic ${btoa(`${$env.GITEA_ADMIN_USER}:${$env.GITEA_ADMIN_PASSWORD}`)}` };
const user = encodeURIComponent(employee.username);

try {
  const created = await http({
    method: 'POST',
    url: `${GITEA}/api/v1/admin/users`,
    headers,
    body: {
      username: employee.username,
      email: employee.workEmail,
      full_name: employee.fullName,
      password: randomPassword(),
      must_change_password: true,
      send_notify: false,
      visibility: 'private',
    },
  });
  if (created.status === 422 || created.status === 409) {
    const existing = await http({ method: 'GET', url: `${GITEA}/api/v1/users/${user}`, headers });
    if (existing.status !== 200 || String(existing.body.email).toLowerCase() !== employee.workEmail.toLowerCase()) {
      throw new Error(`l'identifiant « ${employee.username} » est déjà pris dans Gitea`);
    }
    // Réembauche : on réactive le compte existant.
    await http({
      method: 'PATCH',
      url: `${GITEA}/api/v1/admin/users/${user}`,
      headers,
      body: { login_name: employee.username, source_id: 0, active: true, prohibit_login: false },
    });
  } else if (created.status !== 201) {
    throw new Error(`création refusée (${describe(created)})`);
  }

  const teams = await http({ method: 'GET', url: `${GITEA}/api/v1/orgs/${ORG}/teams`, headers });
  if (teams.status !== 200) throw new Error(`équipes de l'organisation illisibles (${describe(teams)})`);
  const joined = [];
  for (const name of access.giteaTeams) {
    const team = teams.body.find((candidate) => candidate.name === name);
    if (!team) throw new Error(`équipe « ${name} » introuvable`);
    const added = await http({ method: 'PUT', url: `${GITEA}/api/v1/teams/${team.id}/members/${user}`, headers });
    if (added.status >= 300) throw new Error(`ajout à l'équipe ${name} refusé (${describe(added)})`);
    joined.push(name);
  }
  return done('SUCCEEDED', `Compte « ${employee.username} » · équipes : ${joined.join(', ')} · mot de passe via « Mot de passe oublié »`, {
    username: employee.username,
  });
} catch (error) {
  return done('FAILED', error.message);
}
