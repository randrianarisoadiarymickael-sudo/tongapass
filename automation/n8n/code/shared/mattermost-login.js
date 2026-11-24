// Session du compte de service Mattermost (jeton renvoyé dans l'en-tête « token »).
const MM = $env.MATTERMOST_URL;
const TEAM = $env.MATTERMOST_TEAM || 'tongapass';

const mattermostLogin = async () => {
  const res = await http({
    method: 'POST',
    url: `${MM}/api/v4/users/login`,
    body: { login_id: $env.MATTERMOST_ADMIN_USER, password: $env.MATTERMOST_ADMIN_PASSWORD },
  });
  const token = res.headers.token || res.headers.Token;
  if (res.status !== 200 || !token) throw new Error(`connexion du compte de service refusée (${describe(res)})`);
  return { Authorization: `Bearer ${token}` };
};
