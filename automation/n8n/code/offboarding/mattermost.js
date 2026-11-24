// Mattermost : fermeture de toutes les sessions puis désactivation du compte.
const done = (status, detail) => [stepEvent('chat.deactivate', status, detail)];
if ($env.CHAT_ENABLED !== 'true' || !MM) return done('SKIPPED', 'Messagerie d’équipe désactivée');

try {
  const headers = await mattermostLogin();
  let userId = employee.chatUserId;
  if (!userId) {
    const found = await http({ method: 'GET', url: `${MM}/api/v4/users/username/${encodeURIComponent(employee.username)}`, headers });
    if (found.status === 404) return done('SKIPPED', 'Aucun compte Mattermost à désactiver');
    userId = found.body?.id;
  }
  const sessions = await http({ method: 'POST', url: `${MM}/api/v4/users/${userId}/sessions/revoke/all`, headers });
  if (sessions.status >= 300 && sessions.status !== 404) throw new Error(`révocation des sessions refusée (${describe(sessions)})`);
  const deactivated = await http({ method: 'DELETE', url: `${MM}/api/v4/users/${userId}`, headers });
  if (deactivated.status >= 300) throw new Error(`désactivation refusée (${describe(deactivated)})`);
  return done('SUCCEEDED', `Compte @${employee.username} désactivé, sessions fermées`);
} catch (error) {
  return done('FAILED', error.message);
}
