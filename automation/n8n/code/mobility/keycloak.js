// Mobilité — Keycloak : applique l'écart de droits calculé par l'API (ajouts et retraits).
const empty = { realmRoles: [], groups: [], giteaTeams: [], chatChannels: [] };
const changes = (ctx.mobility && ctx.mobility.changes) || { added: empty, removed: empty };
const done = (status, detail, meta) => [stepEvent('keycloak.sync', status, detail, meta)];

let token;
try {
  token = await keycloakToken();
} catch (error) {
  return done('FAILED', `Keycloak injoignable : ${error.message}`);
}
const headers = { Authorization: `Bearer ${token}` };

try {
  const user = await findKeycloakUser(headers);
  if (!user) return done('FAILED', `Compte Keycloak « ${employee.username} » introuvable`);

  // Rôles : jamais de rôle tp-* ni de rôle hors liste blanche, même s'il était demandé.
  const assignable = new Set(String($env.TP_ASSIGNABLE_ROLES || '').split(',').map((role) => role.trim()).filter(Boolean));
  const allowed = (role) => !role.startsWith('tp-') && assignable.has(role);
  const roleRepresentations = async (names) => {
    const list = [];
    for (const name of names.filter(allowed)) {
      const role = await http({ method: 'GET', url: `${ADMIN}/roles/${encodeURIComponent(name)}`, headers });
      if (role.status !== 200) throw new Error(`rôle « ${name} » introuvable dans le royaume`);
      list.push({ id: role.body.id, name: role.body.name });
    }
    return list;
  };
  const toAdd = await roleRepresentations(changes.added.realmRoles || []);
  const toRemove = await roleRepresentations(changes.removed.realmRoles || []);
  if (toAdd.length) {
    const added = await http({ method: 'POST', url: `${ADMIN}/users/${user.id}/role-mappings/realm`, headers, body: toAdd });
    if (added.status >= 300) throw new Error(`ajout des rôles refusé (${describe(added)})`);
  }
  if (toRemove.length) {
    const removed = await http({ method: 'DELETE', url: `${ADMIN}/users/${user.id}/role-mappings/realm`, headers, body: toRemove });
    if (removed.status >= 300) throw new Error(`retrait des rôles refusé (${describe(removed)})`);
  }

  // Groupes
  const groupNames = [...(changes.added.groups || []), ...(changes.removed.groups || [])];
  const groupsJoined = [];
  const groupsLeft = [];
  if (groupNames.length) {
    const groups = await http({ method: 'GET', url: `${ADMIN}/groups`, qs: { briefRepresentation: 'true', max: '200' }, headers });
    const byName = (name) => (Array.isArray(groups.body) ? groups.body : []).find((group) => group.name === name);
    for (const name of changes.added.groups || []) {
      const group = byName(name);
      if (!group) throw new Error(`groupe « ${name} » introuvable`);
      const res = await http({ method: 'PUT', url: `${ADMIN}/users/${user.id}/groups/${group.id}`, headers });
      if (res.status >= 300) throw new Error(`ajout au groupe ${name} refusé (${describe(res)})`);
      groupsJoined.push(name);
    }
    for (const name of changes.removed.groups || []) {
      const group = byName(name);
      if (!group) continue;
      const res = await http({ method: 'DELETE', url: `${ADMIN}/users/${user.id}/groups/${group.id}`, headers });
      if (res.status >= 300 && res.status !== 404) throw new Error(`retrait du groupe ${name} refusé (${describe(res)})`);
      groupsLeft.push(name);
    }
  }

  // Attributs métier (poste, service) tenus à jour dans l'annuaire
  const attributes = { ...(user.attributes || {}), jobTitle: [ctx.mobility.jobTitle], department: [ctx.mobility.department] };
  await http({ method: 'PUT', url: `${ADMIN}/users/${user.id}`, headers, body: { ...user, attributes } });

  const list = (values) => (values.length ? values.join(', ') : 'aucun');
  return done(
    'SUCCEEDED',
    `Rôles ajoutés : ${list(toAdd.map((r) => r.name))} · retirés : ${list(toRemove.map((r) => r.name))} · groupes rejoints : ${list(groupsJoined)} · quittés : ${list(groupsLeft)}`,
    { added: toAdd.length, removed: toRemove.length },
  );
} catch (error) {
  return done('FAILED', error.message);
}
