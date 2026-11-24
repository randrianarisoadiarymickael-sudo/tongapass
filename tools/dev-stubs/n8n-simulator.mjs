#!/usr/bin/env node
// ATTENTION : OUTIL DE TEST UNIQUEMENT — ne jamais déployer.
// Simule les webhooks n8n de TongaPass : même contrat d'entrée, même authentification par en-tête,
// et rappels signés HMAC vers l'API pour chaque étape, avec un délai réaliste.
// Permet de tester le portail et l'API de bout en bout sans Keycloak/Gitea/Mattermost.
// Variables : N8N_WEBHOOK_TOKEN, AUTOMATION_HMAC_SECRET, SIM_FAIL_STEPS (ex. « chat.invite »), SIM_DELAY_MS.
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.N8N_SIM_PORT ?? 5678);
const TOKEN = process.env.N8N_WEBHOOK_TOKEN;
const SECRET = process.env.AUTOMATION_HMAC_SECRET;
const FAIL = new Set((process.env.SIM_FAIL_STEPS ?? '').split(',').filter(Boolean));
const DELAY = Number(process.env.SIM_DELAY_MS ?? 900);
const CALLBACK_OVERRIDE = process.env.SIM_CALLBACK_URL;

if (!TOKEN || !SECRET) {
  console.error('[n8n-simulator] N8N_WEBHOOK_TOKEN et AUTOMATION_HMAC_SECRET sont requis');
  process.exit(1);
}

let executions = 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callback(url, event) {
  const body = JSON.stringify(event);
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex')}`;
  const res = await fetch(CALLBACK_OVERRIDE ?? url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-TongaPass-Timestamp': ts, 'X-TongaPass-Signature': signature },
    body,
  });
  if (!res.ok) console.error(`[n8n-simulator] callback refusé : HTTP ${res.status} ${await res.text()}`);
}

function describe(step, payload) {
  const e = payload.employee;
  const a = payload.access;
  const details = {
    'keycloak.account': [`Compte « ${e.username} » prêt, mot de passe à définir à la première connexion`, { userId: e.keycloakUserId ?? randomUUID() }],
    'keycloak.roles': [`Rôles : ${a.realmRoles.join(', ')} · groupes : ${a.groups.join(', ') || 'aucun'}`, {}],
    'keycloak.activation': [`Lien d'activation valable 48 h envoyé à ${e.workEmail}`, {}],
    'gitea.account': a.giteaTeams.length ? [`Compte « ${e.username} » · équipes : ${a.giteaTeams.join(', ')}`, { username: e.username }] : null,
    'chat.invite': [`Compte @${e.username} · ${a.chatChannels.map((c) => `~${c}`).join(', ')}`, { userId: randomUUID().replace(/-/g, '').slice(0, 26) }],
    'email.welcome': payload.options?.sendWelcomeEmail === false ? null : [`E-mail envoyé à ${e.personalEmail}`, {}],
    'keycloak.sync': [`Rôles ajoutés : ${(payload.mobility?.changes?.added?.realmRoles ?? []).join(', ') || 'aucun'} · retirés : ${(payload.mobility?.changes?.removed?.realmRoles ?? []).join(', ') || 'aucun'}`, {}],
    'gitea.sync': [`Équipes rejointes : ${(payload.mobility?.changes?.added?.giteaTeams ?? []).join(', ') || 'aucune'}`, {}],
    'chat.sync': [`Canaux rejoints : ${(payload.mobility?.changes?.added?.chatChannels ?? []).map((c) => '~' + c).join(', ') || 'aucun'}`, {}],
    'keycloak.disable': [`Compte « ${e.username} » désactivé : plus aucune connexion possible`, {}],
    'keycloak.sessions': ['2 session(s) active(s) fermée(s), 0 consentement(s) révoqué(s)', { sessions: 2 }],
    'gitea.revoke': [`Connexion bloquée pour « ${e.giteaUsername ?? e.username} »`, {}],
    'chat.deactivate': [`Compte @${e.username} désactivé, sessions fermées`, {}],
    'email.notify': [`E-mail envoyé à ${[e.managerEmail, 'rh@tongapass.local'].filter(Boolean).join(', ')}`, {}],
  };
  return details[step];
}

async function simulate(payload, executionId) {
  await sleep(400);
  for (const step of payload.steps ?? []) {
    const info = describe(step, payload);
    if (FAIL.has(step)) {
      await callback(payload.callbackUrl, { runId: payload.runId, event: 'step', step, status: 'FAILED', detail: 'Service injoignable (simulation)' });
    } else if (!info) {
      await callback(payload.callbackUrl, { runId: payload.runId, event: 'step', step, status: 'SKIPPED', detail: 'Non prévu par le profil' });
    } else {
      await callback(payload.callbackUrl, { runId: payload.runId, event: 'step', step, status: 'SUCCEEDED', detail: info[0], meta: info[1] });
    }
    await sleep(DELAY * (0.6 + Math.random() * 0.8));
  }
  await callback(payload.callbackUrl, { runId: payload.runId, event: 'run.finished', executionId });
  console.log(`[n8n-simulator] exécution #${executionId} terminée (${payload.type})`);
}

createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }
  if (req.method === 'POST' && ['/webhook/tongapass/onboarding', '/webhook/tongapass/mobility', '/webhook/tongapass/offboarding'].includes(req.url)) {
    if (req.headers['x-tongapass-token'] !== TOKEN) {
      res.writeHead(403);
      return res.end('Authorization data is wrong!');
    }
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const payload = JSON.parse(raw);
      const executionId = String((executions += 1));
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true, executionId }));
      simulate(payload, executionId).catch((error) => console.error('[n8n-simulator]', error));
    });
    return undefined;
  }
  res.writeHead(404);
  return res.end();
}).listen(PORT, () => console.log(`[n8n-simulator] webhooks prêts sur :${PORT} (outil de test uniquement)`));
