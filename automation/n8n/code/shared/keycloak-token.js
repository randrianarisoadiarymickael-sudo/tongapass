// Jeton du compte de service « tongapass-provisioner » (client_credentials, droits limités à la gestion des utilisateurs).
const KC = $env.KEYCLOAK_URL;
const REALM = $env.KEYCLOAK_REALM;
const ADMIN = `${KC}/admin/realms/${REALM}`;

const keycloakToken = async () => {
  const form = [
    'grant_type=client_credentials',
    `client_id=${encodeURIComponent($env.KEYCLOAK_CLIENT_ID)}`,
    `client_secret=${encodeURIComponent($env.KEYCLOAK_CLIENT_SECRET)}`,
  ].join('&');
  const res = await http({
    method: 'POST',
    url: `${KC}/realms/${REALM}/protocol/openid-connect/token`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`authentification du compte de service refusée (${describe(res)})`);
  }
  return res.body.access_token;
};

const findKeycloakUser = async (headers) => {
  if (employee.keycloakUserId) {
    const byId = await http({ method: 'GET', url: `${ADMIN}/users/${employee.keycloakUserId}`, headers });
    if (byId.status === 200) return byId.body;
  }
  const found = await http({ method: 'GET', url: `${ADMIN}/users`, qs: { username: employee.username, exact: 'true' }, headers });
  return Array.isArray(found.body) && found.body.length ? found.body[0] : null;
};
