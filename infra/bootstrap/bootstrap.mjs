// Initialisation idempotente des services tiers (exécutée par le conteneur « bootstrap »).
// Aucune dépendance : Node 24 fournit fetch. Relançable sans effet de bord.

const env = process.env;
const log = (scope, message) => console.log(`[bootstrap:${scope}] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(scope, url, { attempts = 90, delay = 4000 } = {}) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.status < 500) return;
    } catch {
      /* service pas encore prêt */
    }
    if (i % 5 === 0) log(scope, `en attente de ${url} (${i}/${attempts})`);
    await sleep(delay);
  }
  throw new Error(`${scope} injoignable : ${url}`);
}

async function call(scope, method, url, { headers = {}, body, expect = [200, 201, 204] } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!expect.includes(response.status)) {
    throw new Error(`${scope} ${method} ${url} → HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  return { status: response.status, data, headers: response.headers };
}

// ---------------------------------------------------------------------------
// Keycloak : autoriser les attributs métier (matricule, service) sur les comptes
// ---------------------------------------------------------------------------
async function keycloak() {
  const base = env.KEYCLOAK_URL;
  const realm = env.KEYCLOAK_REALM ?? 'tongapass';
  await waitFor('keycloak', `${base}/realms/${realm}/.well-known/openid-configuration`);
  const token = await call('keycloak', 'POST', `${base}/realms/master/protocol/openid-connect/token`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: env.KEYCLOAK_ADMIN_USER ?? 'admin',
      password: env.KEYCLOAK_ADMIN_PASSWORD,
    }).toString(),
  });
  const auth = { Authorization: `Bearer ${token.data.access_token}` };
  const profile = await call('keycloak', 'GET', `${base}/admin/realms/${realm}/users/profile`, { headers: auth });
  if (profile.data.unmanagedAttributePolicy !== 'ADMIN_EDIT') {
    await call('keycloak', 'PUT', `${base}/admin/realms/${realm}/users/profile`, {
      headers: auth,
      body: { ...profile.data, unmanagedAttributePolicy: 'ADMIN_EDIT' },
    });
    log('keycloak', 'attributs métier autorisés (unmanagedAttributePolicy=ADMIN_EDIT)');
  } else {
    log('keycloak', 'profil utilisateur déjà configuré');
  }
  await ensureAuditorClient(base, realm, auth);
}

/**
 * Compte de service « tongapass-auditor » en lecture seule (contrôle de conformité).
 * Créé ici s'il manque : le bootstrap sert aussi de migration pour une installation existante.
 */
async function ensureAuditorClient(base, realm, auth) {
  if (!env.TP_AUDITOR_SECRET) {
    log('keycloak', 'TP_AUDITOR_SECRET absent : contrôle de conformité désactivé');
    return;
  }
  const admin = `${base}/admin/realms/${realm}`;
  let [client] = (await call('keycloak', 'GET', `${admin}/clients?clientId=tongapass-auditor`, { headers: auth })).data;
  const representation = {
    clientId: 'tongapass-auditor',
    name: 'TongaPass — contrôle de conformité',
    description: 'Compte de service en lecture seule (comparaison des droits réels et attendus).',
    enabled: true,
    publicClient: false,
    clientAuthenticatorType: 'client-secret',
    secret: env.TP_AUDITOR_SECRET,
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: true,
  };
  if (!client) {
    await call('keycloak', 'POST', `${admin}/clients`, { headers: auth, body: representation });
    [client] = (await call('keycloak', 'GET', `${admin}/clients?clientId=tongapass-auditor`, { headers: auth })).data;
    log('keycloak', 'client tongapass-auditor créé');
  } else {
    await call('keycloak', 'PUT', `${admin}/clients/${client.id}`, { headers: auth, body: { ...client, secret: env.TP_AUDITOR_SECRET } });
  }
  // Audience de l'API d'administration (exigée depuis Keycloak 26.x)
  const scopes = (await call('keycloak', 'GET', `${admin}/client-scopes`, { headers: auth })).data;
  const adminScope = scopes.find((scope) => scope.name === 'kc-admin-api');
  if (adminScope) {
    await call('keycloak', 'PUT', `${admin}/clients/${client.id}/default-client-scopes/${adminScope.id}`, { headers: auth, expect: [200, 204] });
  }
  // Droits strictement en lecture
  const serviceAccount = (await call('keycloak', 'GET', `${admin}/clients/${client.id}/service-account-user`, { headers: auth })).data;
  const [management] = (await call('keycloak', 'GET', `${admin}/clients?clientId=realm-management`, { headers: auth })).data;
  const wanted = [];
  for (const name of ['view-users', 'query-users', 'query-groups']) {
    wanted.push((await call('keycloak', 'GET', `${admin}/clients/${management.id}/roles/${name}`, { headers: auth })).data);
  }
  await call('keycloak', 'POST', `${admin}/users/${serviceAccount.id}/role-mappings/clients/${management.id}`, {
    headers: auth,
    body: wanted.map((role) => ({ id: role.id, name: role.name })),
    expect: [200, 204],
  });
  log('keycloak', 'compte de service tongapass-auditor prêt (lecture seule)');
}

// ---------------------------------------------------------------------------
// Gitea : organisation, équipes (moindre privilège) et dépôts de démonstration
// ---------------------------------------------------------------------------
async function gitea() {
  const base = env.GITEA_URL;
  const org = env.GITEA_ORG ?? 'tongapass';
  await waitFor('gitea', `${base}/api/healthz`);
  const auth = { Authorization: `Basic ${Buffer.from(`${env.GITEA_ADMIN_USER}:${env.GITEA_ADMIN_PASSWORD}`).toString('base64')}` };

  // L'administrateur est créé par infra/gitea/start.sh juste après le démarrage.
  for (let i = 0; i < 30; i += 1) {
    const me = await fetch(`${base}/api/v1/user`, { headers: auth });
    if (me.ok) break;
    await sleep(3000);
  }

  const existing = await call('gitea', 'GET', `${base}/api/v1/orgs/${org}`, { headers: auth, expect: [200, 404] });
  if (existing.status === 404) {
    await call('gitea', 'POST', `${base}/api/v1/orgs`, {
      headers: auth,
      body: { username: org, full_name: 'TongaPass', visibility: 'private', description: 'Organisation de démonstration' },
    });
    log('gitea', `organisation ${org} créée`);
  }

  for (const repo of [
    { name: 'portail-rh', description: 'Application web RH (démo)' },
    { name: 'infrastructure', description: 'Infrastructure as Code (démo)' },
    { name: 'documentation', description: 'Documentation interne (démo)' },
  ]) {
    const found = await call('gitea', 'GET', `${base}/api/v1/repos/${org}/${repo.name}`, { headers: auth, expect: [200, 404] });
    if (found.status === 404) {
      await call('gitea', 'POST', `${base}/api/v1/orgs/${org}/repos`, {
        headers: auth,
        body: { ...repo, private: true, auto_init: true, default_branch: 'main', readme: 'Default' },
      });
      log('gitea', `dépôt ${repo.name} créé`);
    }
  }

  const teams = await call('gitea', 'GET', `${base}/api/v1/orgs/${org}/teams`, { headers: auth });
  const wanted = [
    { name: 'developers', permission: 'write', description: 'Lecture/écriture sur les dépôts applicatifs', repos: ['portail-rh', 'documentation'] },
    { name: 'devops', permission: 'admin', description: 'Administration des dépôts d’infrastructure', repos: ['infrastructure', 'portail-rh'] },
    { name: 'readers', permission: 'read', description: 'Lecture seule', repos: ['documentation'] },
  ];
  const units = ['repo.code', 'repo.issues', 'repo.pulls', 'repo.releases', 'repo.wiki'];
  for (const team of wanted) {
    let current = teams.data.find((t) => t.name === team.name);
    if (!current) {
      const created = await call('gitea', 'POST', `${base}/api/v1/orgs/${org}/teams`, {
        headers: auth,
        body: {
          name: team.name,
          description: team.description,
          permission: team.permission,
          includes_all_repositories: false,
          can_create_org_repo: team.permission === 'admin',
          units_map: Object.fromEntries(units.map((unit) => [unit, team.permission])),
        },
      });
      current = created.data;
      log('gitea', `équipe ${team.name} (${team.permission}) créée`);
    }
    for (const repo of team.repos) {
      await call('gitea', 'PUT', `${base}/api/v1/teams/${current.id}/repos/${org}/${repo}`, { headers: auth, expect: [204, 200, 422] });
    }
  }
}

// ---------------------------------------------------------------------------
// Mattermost : administrateur, équipe et canaux du catalogue
// ---------------------------------------------------------------------------
async function mattermost() {
  const base = env.MATTERMOST_URL;
  const teamName = env.MATTERMOST_TEAM ?? 'tongapass';
  await waitFor('mattermost', `${base}/api/v4/system/ping`, { attempts: 120 });

  const credentials = { login_id: env.MATTERMOST_ADMIN_USER, password: env.MATTERMOST_ADMIN_PASSWORD };
  let login = await call('mattermost', 'POST', `${base}/api/v4/users/login`, { body: credentials, expect: [200, 401, 400] });
  if (login.status !== 200) {
    // Le tout premier compte créé sur une instance vierge devient administrateur système.
    await call('mattermost', 'POST', `${base}/api/v4/users`, {
      body: {
        email: `${env.MATTERMOST_ADMIN_USER}@tongapass.local`,
        username: env.MATTERMOST_ADMIN_USER,
        password: env.MATTERMOST_ADMIN_PASSWORD,
        first_name: 'TongaPass',
        last_name: 'Automatisation',
      },
    });
    log('mattermost', `administrateur ${env.MATTERMOST_ADMIN_USER} créé`);
    login = await call('mattermost', 'POST', `${base}/api/v4/users/login`, { body: credentials });
  }
  const auth = { Authorization: `Bearer ${login.headers.get('token')}` };
  const me = login.data;

  let team = await call('mattermost', 'GET', `${base}/api/v4/teams/name/${teamName}`, { headers: auth, expect: [200, 404] });
  if (team.status === 404) {
    team = await call('mattermost', 'POST', `${base}/api/v4/teams`, {
      headers: auth,
      body: { name: teamName, display_name: 'TongaPass', type: 'I' },
    });
    log('mattermost', `équipe ${teamName} créée`);
  }
  await call('mattermost', 'POST', `${base}/api/v4/teams/${team.data.id}/members`, {
    headers: auth,
    body: { team_id: team.data.id, user_id: me.id },
    expect: [200, 201],
  });

  const channels = [
    ['bienvenue', 'Bienvenue', 'Annonces des arrivées'],
    ['engineering', 'Engineering', 'Échanges techniques'],
    ['incidents', 'Incidents', 'Astreinte et incidents'],
    ['people', 'People', 'Équipe RH'],
    ['finance', 'Finance', 'Équipe finance'],
    ['support', 'Support', 'Équipe support'],
  ];
  for (const [name, display, purpose] of channels) {
    const found = await call('mattermost', 'GET', `${base}/api/v4/teams/${team.data.id}/channels/name/${name}`, {
      headers: auth,
      expect: [200, 404],
    });
    if (found.status === 404) {
      await call('mattermost', 'POST', `${base}/api/v4/channels`, {
        headers: auth,
        body: { team_id: team.data.id, name, display_name: display, purpose, type: name === 'incidents' ? 'P' : 'O' },
      });
      log('mattermost', `canal ~${name} créé`);
    }
  }
}

// ---------------------------------------------------------------------------
// n8n : compte propriétaire de l'interface (pour la démonstration)
// ---------------------------------------------------------------------------
async function n8n() {
  const base = env.N8N_URL;
  await waitFor('n8n', `${base}/healthz`);
  const response = await fetch(`${base}/rest/owner/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: env.N8N_OWNER_EMAIL,
      firstName: 'Équipe',
      lastName: 'TongaPass',
      password: env.N8N_OWNER_PASSWORD,
    }),
  });
  log('n8n', response.ok ? `propriétaire ${env.N8N_OWNER_EMAIL} créé` : `propriétaire déjà configuré (HTTP ${response.status})`);
}

const tasks = [
  ['keycloak', keycloak, !!env.KEYCLOAK_URL],
  ['gitea', gitea, !!env.GITEA_URL],
  ['mattermost', mattermost, env.CHAT_ENABLED === 'true' && !!env.MATTERMOST_URL],
  ['n8n', n8n, !!env.N8N_URL && !!env.N8N_OWNER_PASSWORD],
];

let failed = 0;
for (const [name, task, enabled] of tasks) {
  if (!enabled) {
    log(name, 'désactivé');
    continue;
  }
  try {
    await task();
    log(name, 'OK');
  } catch (error) {
    failed += 1;
    console.error(`[bootstrap:${name}] ÉCHEC : ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
