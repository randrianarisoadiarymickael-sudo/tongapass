#!/usr/bin/env node
// ATTENTION : OUTIL DE TEST UNIQUEMENT — ne jamais déployer.
// Fournisseur OIDC minimal compatible keycloak-js (Authorization Code + PKCE S256, JWKS, refresh,
// SSO silencieux) pour exécuter le portail et l'API de bout en bout sans conteneur Keycloak
// (tests Playwright en CI, poste de développement hors ligne).
// Usage : node tools/dev-stubs/fake-oidc.mjs   (port 8180, royaume « tongapass »)
import { createHash, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_OIDC_PORT ?? 8180);
const REALM = process.env.FAKE_OIDC_REALM ?? 'tongapass';
const ISSUER = `${process.env.FAKE_OIDC_PUBLIC_URL ?? `http://localhost:${PORT}`}/realms/${REALM}`;
const AUDIENCE = 'tongapass-api';
const BASE = `/realms/${REALM}/protocol/openid-connect`;

const USERS = {
  'admin.it': { name: 'Mamy Rakotobe', email: 'admin.it@tongapass.local', roles: ['tp-admin'] },
  'rh.manager': { name: 'Hanta Rasoanaivo', email: 'rh.manager@tongapass.local', roles: ['tp-hr'] },
  auditeur: { name: 'Fara Andriamihaja', email: 'auditeur@tongapass.local', roles: ['tp-auditor'] },
  'dev.lambda': { name: 'Dev Lambda', email: 'dev.lambda@tongapass.local', roles: ['employee', 'developer'] },
};

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = `fake-${randomBytes(4).toString('hex')}`;
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const b64url = (input) => Buffer.from(input).toString('base64url');
function sign(claims) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

const codes = new Map(); // code -> { username, nonce, clientId, challenge, sid }
const sessions = new Map(); // sid -> username

function tokens(username, clientId, nonce, sid) {
  const user = USERS[username];
  const now = Math.floor(Date.now() / 1000);
  const common = { iss: ISSUER, sub: `fake-${username}`, sid, session_state: sid, azp: clientId, iat: now, nonce };
  const profile = { preferred_username: username, name: user.name, email: user.email, email_verified: true };
  return {
    access_token: sign({ ...common, ...profile, exp: now + 300, typ: 'Bearer', aud: [AUDIENCE, 'account'], realm_access: { roles: user.roles }, scope: 'openid profile email' }),
    id_token: sign({ ...common, ...profile, exp: now + 300, typ: 'ID', aud: clientId }),
    refresh_token: sign({ ...common, exp: now + 1800, typ: 'Refresh', aud: ISSUER, username }),
    token_type: 'Bearer',
    expires_in: 300,
    refresh_expires_in: 1800,
    session_state: sid,
    scope: 'openid profile email',
  };
}

const cookies = (req) =>
  Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter(([k]) => k));

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }
}

function redirectWithCode(res, params, username, sid) {
  const code = randomUUID();
  codes.set(code, { username, nonce: params.get('nonce'), clientId: params.get('client_id'), challenge: params.get('code_challenge'), sid });
  const target = new URL(params.get('redirect_uri'));
  const mode = params.get('response_mode') ?? 'query';
  const values = new URLSearchParams({ state: params.get('state') ?? '', session_state: sid, iss: ISSUER, code });
  if (mode === 'fragment') target.hash = values.toString();
  else values.forEach((value, key) => target.searchParams.set(key, value));
  send(res, 302, '', { Location: target.toString(), 'Set-Cookie': `FAKE_OIDC_SESSION=${sid}; Path=/; HttpOnly; SameSite=Lax` });
}

const loginPage = (params) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion — fournisseur OIDC de test</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;font-family:system-ui,sans-serif;color:#151b2c}
main{width:min(420px,92vw);background:#fff;border-radius:8px;padding:28px;border:1px solid #e3e6eb}
h1{font-size:22px;margin:0 0 4px}p{color:#5e6a7b;font-size:14px;margin:0 0 20px}.warn{background:#fff3cf;color:#5c4300;padding:10px 12px;border-radius:10px;font-size:13px}
button{display:flex;width:100%;justify-content:space-between;align-items:center;margin:8px 0;padding:14px 16px;border:1px solid #dde2e9;border-radius:12px;background:#fff;font-size:15px;cursor:pointer}
button:hover{border-color:#151b2c}small{color:#5e6a7b}</style></head><body><main>
<h1>TongaPass — connexion de test</h1><p class="warn">Fournisseur OIDC factice pour les tests. En production, la connexion passe par Keycloak.</p>
<form method="post" action="${BASE}/login-action">${[...params].map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`).join('')}
${Object.entries(USERS).map(([u, info]) => `<button name="username" value="${u}" type="submit"><span><b>${info.name}</b><br><small>${u}</small></span><small>${info.roles.join(', ')}</small></button>`).join('')}
</form></main></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (url.pathname === `/realms/${REALM}/.well-known/openid-configuration`) {
    return send(res, 200, JSON.stringify({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
      token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
      jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
      end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
      code_challenge_methods_supported: ['S256'],
    }), { 'Content-Type': 'application/json' });
  }
  if (url.pathname === `${BASE}/certs`) return send(res, 200, JSON.stringify({ keys: [jwk] }), { 'Content-Type': 'application/json' });

  if (url.pathname === `${BASE}/3p-cookies/step1.html`) {
    return send(res, 200, '<!doctype html><script>location.href="step2.html"</script>', { 'Content-Type': 'text/html' });
  }
  if (url.pathname === `${BASE}/3p-cookies/step2.html`) {
    return send(res, 200, '<!doctype html><script>parent.postMessage("supported","*")</script>', { 'Content-Type': 'text/html' });
  }

  if (url.pathname === `${BASE}/auth`) {
    const sid = cookies(req).FAKE_OIDC_SESSION;
    const username = sid ? sessions.get(sid) : undefined;
    if (username) return redirectWithCode(res, url.searchParams, username, sid);
    if (url.searchParams.get('prompt') === 'none') {
      const target = new URL(url.searchParams.get('redirect_uri'));
      const values = new URLSearchParams({ error: 'login_required', state: url.searchParams.get('state') ?? '' });
      if ((url.searchParams.get('response_mode') ?? 'query') === 'fragment') target.hash = values.toString();
      else values.forEach((v, k) => target.searchParams.set(k, v));
      return send(res, 302, '', { Location: target.toString() });
    }
    return send(res, 200, loginPage(url.searchParams), { 'Content-Type': 'text/html; charset=utf-8' });
  }

  if (url.pathname === `${BASE}/login-action` && req.method === 'POST') {
    const params = new URLSearchParams(await readBody(req));
    const username = params.get('username');
    if (!USERS[username]) return send(res, 400, 'Utilisateur inconnu');
    params.delete('username');
    const sid = randomUUID();
    sessions.set(sid, username);
    return redirectWithCode(res, params, username, sid);
  }

  if (url.pathname === `${BASE}/token` && req.method === 'POST') {
    const params = new URLSearchParams(await readBody(req));
    const json = (status, body) => send(res, status, JSON.stringify(body), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (params.get('grant_type') === 'authorization_code') {
      const entry = codes.get(params.get('code'));
      codes.delete(params.get('code'));
      if (!entry) return json(400, { error: 'invalid_grant' });
      const verifier = params.get('code_verifier') ?? '';
      if (entry.challenge && createHash('sha256').update(verifier).digest('base64url') !== entry.challenge) {
        return json(400, { error: 'invalid_grant', error_description: 'PKCE invalide' });
      }
      return json(200, tokens(entry.username, entry.clientId, entry.nonce, entry.sid));
    }
    if (params.get('grant_type') === 'refresh_token') {
      try {
        const claims = JSON.parse(Buffer.from(String(params.get('refresh_token')).split('.')[1], 'base64url').toString());
        if (!sessions.has(claims.sid)) return json(400, { error: 'invalid_grant' });
        return json(200, tokens(claims.username, claims.azp, claims.nonce, claims.sid));
      } catch {
        return json(400, { error: 'invalid_grant' });
      }
    }
    return json(400, { error: 'unsupported_grant_type' });
  }

  if (url.pathname === `${BASE}/logout`) {
    const sid = cookies(req).FAKE_OIDC_SESSION;
    if (sid) sessions.delete(sid);
    const target = url.searchParams.get('post_logout_redirect_uri') ?? url.searchParams.get('redirect_uri') ?? '/';
    return send(res, 302, '', { Location: target, 'Set-Cookie': 'FAKE_OIDC_SESSION=; Path=/; Max-Age=0' });
  }

  send(res, 404, 'Not found');
});

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

server.listen(PORT, () => console.log(`[fake-oidc] ${ISSUER} prêt (outil de test uniquement)`));
