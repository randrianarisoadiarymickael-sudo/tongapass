// Mattermost : compte, équipe, canaux du profil et annonce dans ~bienvenue.
const done = (status, detail, meta) => [stepEvent('chat.invite', status, detail, meta)];
if ($env.CHAT_ENABLED !== 'true' || !MM) return done('SKIPPED', 'Messagerie d’équipe désactivée');

try {
  const headers = await mattermostLogin();
  const team = await http({ method: 'GET', url: `${MM}/api/v4/teams/name/${TEAM}`, headers });
  if (team.status !== 200) throw new Error(`équipe « ${TEAM} » introuvable`);

  let user;
  const created = await http({
    method: 'POST',
    url: `${MM}/api/v4/users`,
    headers,
    body: {
      email: employee.workEmail,
      username: employee.username,
      first_name: employee.firstName,
      last_name: employee.lastName,
      password: randomPassword(),
      locale: 'fr',
    },
  });
  if (created.status === 201) {
    user = created.body;
  } else {
    const existing = await http({ method: 'GET', url: `${MM}/api/v4/users/username/${encodeURIComponent(employee.username)}`, headers });
    if (existing.status !== 200 || String(existing.body.email).toLowerCase() !== employee.workEmail.toLowerCase()) {
      throw new Error(`création refusée (${describe(created)})`);
    }
    user = existing.body;
    if (user.delete_at > 0) await http({ method: 'PUT', url: `${MM}/api/v4/users/${user.id}/active`, headers, body: { active: true } });
  }

  const member = await http({
    method: 'POST',
    url: `${MM}/api/v4/teams/${team.body.id}/members`,
    headers,
    body: { team_id: team.body.id, user_id: user.id },
  });
  if (member.status >= 300) throw new Error(`ajout à l'équipe refusé (${describe(member)})`);

  const joined = [];
  const missing = [];
  let welcomeChannelId = null;
  for (const name of access.chatChannels || []) {
    const channel = await http({ method: 'GET', url: `${MM}/api/v4/teams/${team.body.id}/channels/name/${name}`, headers });
    if (channel.status !== 200) {
      missing.push(name);
      continue;
    }
    if (name === 'bienvenue') welcomeChannelId = channel.body.id;
    if (name !== 'town-square') {
      const added = await http({ method: 'POST', url: `${MM}/api/v4/channels/${channel.body.id}/members`, headers, body: { user_id: user.id } });
      if (added.status >= 300) throw new Error(`ajout au canal ~${name} refusé (${describe(added)})`);
    }
    joined.push(`~${name}`);
  }

  if (options.announceInChat !== false && welcomeChannelId) {
    const start = new Date(`${employee.startDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    await http({
      method: 'POST',
      url: `${MM}/api/v4/posts`,
      headers,
      body: {
        channel_id: welcomeChannelId,
        message: `:wave: **Tonga soa !** Bienvenue à **${employee.fullName}**, ${employee.jobTitle} (${employee.department}), qui nous rejoint le ${start}. Dites bonjour à @${employee.username} !`,
      },
    });
  }

  const missingText = missing.length ? ` · canaux absents : ${missing.join(', ')}` : '';
  return done('SUCCEEDED', `Compte @${employee.username} · ${joined.join(', ')}${missingText}`, { userId: user.id });
} catch (error) {
  return done('FAILED', error.message);
}
