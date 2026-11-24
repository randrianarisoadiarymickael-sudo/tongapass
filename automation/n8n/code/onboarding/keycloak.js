// Keycloak : compte (idempotent), rôles du profil (moindre privilège), groupes, lien d'activation.
const results = [];

let token;
try {
  token = await keycloakToken();
} catch (error) {
  return [stepEvent('keycloak.account', 'FAILED', `Keycloak injoignable : ${error.message}`)];
}
const headers = { Authorization: `Bearer ${token}` };

// 1. Compte -----------------------------------------------------------------
let userId = null;
try {
  const representation = {
    username: employee.username,
    email: employee.workEmail,
    firstName: employee.firstName,
    lastName: employee.lastName,
    enabled: true,
    emailVerified: true,
    requiredActions: ['UPDATE_PASSWORD'],
    attributes: {
      tongapassEmployeeId: [employee.id],
      employeeNumber: [employee.employeeNumber],
      department: [employee.department],
      jobTitle: [employee.jobTitle],
    },
  };
  const existing = await findKeycloakUser(headers);
  if (existing) {
    // Idempotence : on ne réutilise un compte que s'il appartient bien à cet employé.
    if (existing.attributes?.tongapassEmployeeId?.[0] !== employee.id) {
      throw new Error(`l'identifiant « ${employee.username} » appartient déjà à un autre compte Keycloak`);
    }
    userId = existing.id;
    await http({ method: 'PUT', url: `${ADMIN}/users/${userId}`, headers, body: { ...representation, requiredActions: existing.requiredActions } });
  } else {
    const created = await http({ method: 'POST', url: `${ADMIN}/users`, headers, body: representation });
    if (created.status !== 201) throw new Error(`création refusée (${describe(created)})`);
    userId = String(created.headers.location || '').split('/').pop() || (await findKeycloakUser(headers))?.id;
  }
  if (!userId) throw new Error('identifiant du compte introuvable après création');
  results.push(
    stepEvent('keycloak.account', 'SUCCEEDED', `Compte « ${employee.username} » prêt, mot de passe à définir à la première connexion`, {
      userId,
      username: employee.username,
    }),
  );
} catch (error) {
  results.push(stepEvent('keycloak.account', 'FAILED', error.message));
  return results;
}

// 2. Rôles et groupes ---------------------------------------------------------
try {
  const assignable = new Set(String($env.TP_ASSIGNABLE_ROLES || '').split(',').map((role) => role.trim()).filter(Boolean));
  const wanted = (access.realmRoles || []).filter((role) => !role.startsWith('tp-') && assignable.has(role));
  const refused = (access.realmRoles || []).filter((role) => !wanted.includes(role));
  const representations = [];
  for (const name of wanted) {
    const role = await http({ method: 'GET', url: `${ADMIN}/roles/${encodeURIComponent(name)}`, headers });
    if (role.status !== 200) throw new Error(`rôle « ${name} » introuvable dans le royaume`);
    representations.push({ id: role.body.id, name: role.body.name });
  }
  if (representations.length) {
    const mapped = await http({ method: 'POST', url: `${ADMIN}/users/${userId}/role-mappings/realm`, headers, body: representations });
    if (mapped.status >= 300) throw new Error(`attribution des rôles refusée (${describe(mapped)})`);
  }
  const joined = [];
  if ((access.groups || []).length) {
    const groups = await http({ method: 'GET', url: `${ADMIN}/groups`, qs: { briefRepresentation: 'true', max: '200' }, headers });
    for (const name of access.groups) {
      const group = (Array.isArray(groups.body) ? groups.body : []).find((candidate) => candidate.name === name);
      if (!group) throw new Error(`groupe « ${name} » introuvable`);
      const added = await http({ method: 'PUT', url: `${ADMIN}/users/${userId}/groups/${group.id}`, headers });
      if (added.status >= 300) throw new Error(`ajout au groupe ${name} refusé (${describe(added)})`);
      joined.push(name);
    }
  }
  const refusedText = refused.length ? ` · refusés (hors catalogue) : ${refused.join(', ')}` : '';
  results.push(
    stepEvent('keycloak.roles', 'SUCCEEDED', `Rôles : ${wanted.join(', ') || 'aucun'} · groupes : ${joined.join(', ') || 'aucun'}${refusedText}`, {
      roles: wanted.join(','),
      groups: joined.join(','),
    }),
  );
} catch (error) {
  results.push(stepEvent('keycloak.roles', 'FAILED', error.message));
}

// 3. Lien d'activation (Keycloak envoie l'e-mail via son SMTP) -----------------
try {
  const sent = await http({
    method: 'PUT',
    url: `${ADMIN}/users/${userId}/execute-actions-email`,
    qs: { lifespan: '172800' },
    headers,
    body: ['UPDATE_PASSWORD'],
  });
  if (sent.status >= 300) throw new Error(describe(sent));
  results.push(stepEvent('keycloak.activation', 'SUCCEEDED', `Lien d'activation valable 48 h envoyé à ${employee.workEmail}`));
} catch (error) {
  results.push(stepEvent('keycloak.activation', 'FAILED', `envoi du lien impossible : ${error.message}`));
}

return results;
