// Mobilité — Mattermost : rejoint les nouveaux canaux, quitte ceux qui ne sont plus prévus.
const empty = { chatChannels: [] };
const changes = (ctx.mobility && ctx.mobility.changes) || { added: empty, removed: empty };
const toJoin = changes.added.chatChannels || [];
const toLeave = changes.removed.chatChannels || [];
const done = (status, detail) => [stepEvent('chat.sync', status, detail)];

if ($env.CHAT_ENABLED !== 'true' || !MM) return done('SKIPPED', 'Messagerie d’équipe désactivée');
if (!toJoin.length && !toLeave.length) return done('SKIPPED', 'Aucun changement de canal');

try {
  const headers = await mattermostLogin();
  const team = await http({ method: 'GET', url: `${MM}/api/v4/teams/name/${TEAM}`, headers });
  if (team.status !== 200) throw new Error(`équipe « ${TEAM} » introuvable`);
  const found = await http({ method: 'GET', url: `${MM}/api/v4/users/username/${encodeURIComponent(employee.username)}`, headers });
  if (found.status !== 200) return done('SKIPPED', 'Aucun compte Mattermost pour cet employé');
  const user = found.body;

  const joined = [];
  const left = [];
  for (const name of toJoin) {
    const channel = await http({ method: 'GET', url: `${MM}/api/v4/teams/${team.body.id}/channels/name/${name}`, headers });
    if (channel.status !== 200) continue;
    const res = await http({ method: 'POST', url: `${MM}/api/v4/channels/${channel.body.id}/members`, headers, body: { user_id: user.id } });
    if (res.status >= 300) throw new Error(`ajout au canal ~${name} refusé (${describe(res)})`);
    joined.push(`~${name}`);
  }
  for (const name of toLeave) {
    const channel = await http({ method: 'GET', url: `${MM}/api/v4/teams/${team.body.id}/channels/name/${name}`, headers });
    if (channel.status !== 200) continue;
    const res = await http({ method: 'DELETE', url: `${MM}/api/v4/channels/${channel.body.id}/members/${user.id}`, headers });
    if (res.status >= 300 && res.status !== 404) throw new Error(`retrait du canal ~${name} refusé (${describe(res)})`);
    left.push(`~${name}`);
  }
  return done('SUCCEEDED', `Canaux rejoints : ${joined.join(', ') || 'aucun'} · quittés : ${left.join(', ') || 'aucun'}`);
} catch (error) {
  return done('FAILED', error.message);
}
