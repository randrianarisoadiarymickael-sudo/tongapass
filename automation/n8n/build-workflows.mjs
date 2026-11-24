#!/usr/bin/env node
// Génère les workflows n8n importables (workflows/*.json) à partir du code source des nœuds (code/**/*.js).
// Le code JavaScript reste ainsi lisible, relu et versionné comme le reste du projet.
// Usage : node automation/n8n/build-workflows.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(root, 'code', path), 'utf8').trim();

export const IDS = {
  callback: 'tpCallback000001',
  onboarding: 'tpOnboarding0001',
  offboarding: 'tpOffboarding001',
  mobility: 'tpMobility000001',
};
export const CREDENTIALS = {
  smtp: { id: 'tpSmtpMailpit001', name: 'TongaPass SMTP (Mailpit)' },
  webhook: { id: 'tpWebhookAuth001', name: 'TongaPass — jeton webhook' },
};

/** UUID v4 déterministe (stable d'une génération à l'autre : diff Git lisible). */
const uuid = (seed) => {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const code = (...parts) => [read('shared/prelude.js'), ...parts.map(read)].join('\n\n');

function node(workflow, name, type, typeVersion, position, parameters, extra = {}) {
  return { parameters, id: uuid(`${workflow}:${name}`), name, type, typeVersion, position, ...extra };
}

const codeNode = (workflow, name, position, jsCode, mode = 'runOnceForAllItems') =>
  node(workflow, name, 'n8n-nodes-base.code', 2, position, { mode, jsCode }, { alwaysOutputData: false });

const callbackNode = (workflow, name, position) =>
  node(
    workflow,
    name,
    'n8n-nodes-base.executeWorkflow',
    1.1,
    position,
    {
      source: 'database',
      workflowId: { __rl: true, value: IDS.callback, mode: 'id' },
      mode: 'once',
      options: { waitForSubWorkflow: true },
    },
    { onError: 'continueRegularOutput' },
  );

const emailNode = (workflow, name, position) =>
  node(
    workflow,
    name,
    'n8n-nodes-base.emailSend',
    2.1,
    position,
    {
      fromEmail: '={{ $env.MAIL_FROM }}',
      toEmail: '={{ $json.to }}',
      subject: '={{ $json.subject }}',
      emailFormat: 'both',
      text: '={{ $json.text }}',
      html: '={{ $json.html }}',
      options: { appendAttribution: false },
    },
    { credentials: { smtp: CREDENTIALS.smtp }, onError: 'continueRegularOutput' },
  );

const ifNode = (workflow, name, position, leftValue, operation = 'true') =>
  node(workflow, name, 'n8n-nodes-base.if', 2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: uuid(`${workflow}:${name}:condition`),
          leftValue,
          rightValue: '',
          operator: { type: 'boolean', operation, singleValue: true },
        },
      ],
      combinator: 'and',
    },
    options: {},
  });

const link = (connections, from, to, output = 0) => {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
};

const settings = {
  executionOrder: 'v1',
  saveDataErrorExecution: 'all',
  saveDataSuccessExecution: 'all',
  saveManualExecutions: true,
  callerPolicy: 'workflowsFromSameOwner',
  timezone: 'Indian/Antananarivo',
};

function webhookPart(workflow, path) {
  return [
    node(
      workflow,
      'Webhook TongaPass',
      'n8n-nodes-base.webhook',
      2,
      [0, 300],
      { httpMethod: 'POST', path, authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
      { webhookId: uuid(`${workflow}:webhook`), credentials: { httpHeaderAuth: CREDENTIALS.webhook } },
    ),
    node(workflow, 'Accusé de réception', 'n8n-nodes-base.respondToWebhook', 1.1, [220, 300], {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify({ accepted: true, executionId: $execution.id }) }}',
      options: { responseCode: 202 },
    }),
    codeNode(
      workflow,
      'Préparer le contexte',
      [440, 300],
      [
        "// Contrat d'entrée : voir automation/n8n/README.md",
        "const body = $('Webhook TongaPass').first().json.body;",
        "if (!body || !body.runId || !body.employee || !body.employee.username) {",
        "  throw new Error('Charge utile TongaPass invalide');",
        '}',
        'return [{ json: body }];',
      ].join('\n'),
    ),
  ];
}

const finishNode = (workflow, position) =>
  codeNode(
    workflow,
    'Clôturer',
    position,
    [
      "const ctx = $('Préparer le contexte').first().json;",
      "return [{ json: { runId: ctx.runId, callbackUrl: ctx.callbackUrl, event: 'run.finished', executionId: String($execution.id) } }];",
    ].join('\n'),
  );

// ---------------------------------------------------------------------------
// Sous-workflow : signature HMAC et envoi des événements à l'API
// ---------------------------------------------------------------------------
function callbackWorkflow() {
  const w = 'callback';
  const nodes = [
    node(w, 'Événement reçu', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, [0, 300], { inputSource: 'passthrough' }),
    codeNode(
      w,
      'Préparer la signature',
      [220, 300],
      [
        '// Corps canonique + horodatage : la signature couvre exactement les octets envoyés.',
        'const e = $json;',
        'const event = { runId: e.runId, event: e.event, step: e.step, status: e.status,',
        '  detail: e.detail ? String(e.detail).slice(0, 900) : undefined, meta: e.meta, executionId: e.executionId };',
        "const clean = Object.fromEntries(Object.entries(event).filter(([, v]) => v !== undefined && v !== null && v !== ''));",
        'const body = JSON.stringify(clean);',
        'const ts = String(Math.floor(Date.now() / 1000));',
        "return { json: { callbackUrl: e.callbackUrl, ts, body, toSign: ts + '.' + body } };",
      ].join('\n'),
      'runOnceForEachItem',
    ),
    node(w, 'Signer (HMAC-SHA256)', 'n8n-nodes-base.crypto', 1, [440, 300], {
      action: 'hmac',
      type: 'SHA256',
      value: '={{ $json.toSign }}',
      dataPropertyName: 'signature',
      secret: '={{ $env.AUTOMATION_HMAC_SECRET }}',
      encoding: 'hex',
    }),
    node(
      w,
      'Envoyer à l’API TongaPass',
      'n8n-nodes-base.httpRequest',
      4.2,
      [660, 300],
      {
        method: 'POST',
        url: '={{ $json.callbackUrl }}',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: 'X-TongaPass-Timestamp', value: '={{ $json.ts }}' },
            { name: 'X-TongaPass-Signature', value: '=sha256={{ $json.signature }}' },
          ],
        },
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '={{ $json.body }}',
        options: { timeout: 10000 },
      },
      { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 },
    ),
  ];
  const connections = {};
  link(connections, 'Événement reçu', 'Préparer la signature');
  link(connections, 'Préparer la signature', 'Signer (HMAC-SHA256)');
  link(connections, 'Signer (HMAC-SHA256)', 'Envoyer à l’API TongaPass');
  return { id: IDS.callback, name: 'TongaPass · Signaler à l’API', active: false, nodes, connections, settings, pinData: {} };
}

// ---------------------------------------------------------------------------
// Arrivée
// ---------------------------------------------------------------------------
function onboardingWorkflow() {
  const w = 'onboarding';
  const nodes = [
    ...webhookPart(w, 'tongapass/onboarding'),
    codeNode(w, 'Keycloak · compte, rôles, activation', [660, 300], code('shared/keycloak-token.js', 'onboarding/keycloak.js')),
    callbackNode(w, 'Signaler · Keycloak', [880, 300]),
    ifNode(
      w,
      'Compte Keycloak créé ?',
      [1100, 300],
      "={{ $('Keycloak · compte, rôles, activation').all().some(i => i.json.step === 'keycloak.account' && i.json.status === 'SUCCEEDED') }}",
    ),
    codeNode(w, 'Gitea · compte et équipes', [1320, 200], code('onboarding/gitea.js')),
    callbackNode(w, 'Signaler · Gitea', [1540, 200]),
    codeNode(w, 'Mattermost · invitation', [1760, 200], code('shared/mattermost-login.js', 'onboarding/mattermost.js')),
    callbackNode(w, 'Signaler · Mattermost', [1980, 200]),
    codeNode(w, 'Composer l’e-mail de bienvenue', [2200, 200], code('shared/email-layout.js', 'onboarding/welcome-email.js')),
    ifNode(w, 'E-mail demandé ?', [2420, 200], '={{ $json.skip }}', 'false'),
    emailNode(w, 'Envoyer l’e-mail de bienvenue', [2640, 100]),
    codeNode(
      w,
      'Résultat de l’envoi',
      [2860, 100],
      code('shared/email-result.js').replaceAll('__STEP_KEY__', 'email.welcome').replaceAll('__COMPOSER__', 'Composer l’e-mail de bienvenue'),
    ),
    codeNode(w, 'E-mail non demandé', [2860, 300], `${read('shared/prelude.js')}\n\nreturn [stepEvent('email.welcome', 'SKIPPED', 'Envoi désactivé lors de la déclaration')];`),
    callbackNode(w, 'Signaler · e-mail', [3080, 200]),
    finishNode(w, [3300, 300]),
    callbackNode(w, 'Signaler · fin', [3520, 300]),
  ];
  const c = {};
  link(c, 'Webhook TongaPass', 'Accusé de réception');
  link(c, 'Accusé de réception', 'Préparer le contexte');
  link(c, 'Préparer le contexte', 'Keycloak · compte, rôles, activation');
  link(c, 'Keycloak · compte, rôles, activation', 'Signaler · Keycloak');
  link(c, 'Signaler · Keycloak', 'Compte Keycloak créé ?');
  link(c, 'Compte Keycloak créé ?', 'Gitea · compte et équipes', 0);
  link(c, 'Compte Keycloak créé ?', 'Clôturer', 1);
  link(c, 'Gitea · compte et équipes', 'Signaler · Gitea');
  link(c, 'Signaler · Gitea', 'Mattermost · invitation');
  link(c, 'Mattermost · invitation', 'Signaler · Mattermost');
  link(c, 'Signaler · Mattermost', 'Composer l’e-mail de bienvenue');
  link(c, 'Composer l’e-mail de bienvenue', 'E-mail demandé ?');
  link(c, 'E-mail demandé ?', 'Envoyer l’e-mail de bienvenue', 0);
  link(c, 'E-mail demandé ?', 'E-mail non demandé', 1);
  link(c, 'Envoyer l’e-mail de bienvenue', 'Résultat de l’envoi');
  link(c, 'Résultat de l’envoi', 'Signaler · e-mail');
  link(c, 'E-mail non demandé', 'Signaler · e-mail');
  link(c, 'Signaler · e-mail', 'Clôturer');
  link(c, 'Clôturer', 'Signaler · fin');
  return { id: IDS.onboarding, name: 'TongaPass · Arrivée (onboarding)', active: true, nodes, connections: c, settings, pinData: {} };
}

// ---------------------------------------------------------------------------
// Départ
// ---------------------------------------------------------------------------
function offboardingWorkflow() {
  const w = 'offboarding';
  const nodes = [
    ...webhookPart(w, 'tongapass/offboarding'),
    codeNode(w, 'Keycloak · révocation', [660, 300], code('shared/keycloak-token.js', 'offboarding/keycloak.js')),
    callbackNode(w, 'Signaler · Keycloak', [880, 300]),
    codeNode(w, 'Gitea · blocage', [1100, 300], code('offboarding/gitea.js')),
    callbackNode(w, 'Signaler · Gitea', [1320, 300]),
    codeNode(w, 'Mattermost · désactivation', [1540, 300], code('shared/mattermost-login.js', 'offboarding/mattermost.js')),
    callbackNode(w, 'Signaler · Mattermost', [1760, 300]),
    codeNode(w, 'Composer le récapitulatif', [1980, 300], code('shared/email-layout.js', 'offboarding/summary-email.js')),
    ifNode(w, 'Destinataires connus ?', [2200, 300], '={{ $json.skip }}', 'false'),
    emailNode(w, 'Envoyer le récapitulatif', [2420, 200]),
    codeNode(
      w,
      'Résultat de l’envoi',
      [2640, 200],
      code('shared/email-result.js').replaceAll('__STEP_KEY__', 'email.notify').replaceAll('__COMPOSER__', 'Composer le récapitulatif'),
    ),
    codeNode(w, 'Aucun destinataire', [2640, 400], `${read('shared/prelude.js')}\n\nreturn [stepEvent('email.notify', 'SKIPPED', 'Aucun manager ni adresse RH à notifier')];`),
    callbackNode(w, 'Signaler · e-mail', [2860, 300]),
    finishNode(w, [3080, 300]),
    callbackNode(w, 'Signaler · fin', [3300, 300]),
  ];
  const c = {};
  link(c, 'Webhook TongaPass', 'Accusé de réception');
  link(c, 'Accusé de réception', 'Préparer le contexte');
  link(c, 'Préparer le contexte', 'Keycloak · révocation');
  link(c, 'Keycloak · révocation', 'Signaler · Keycloak');
  link(c, 'Signaler · Keycloak', 'Gitea · blocage');
  link(c, 'Gitea · blocage', 'Signaler · Gitea');
  link(c, 'Signaler · Gitea', 'Mattermost · désactivation');
  link(c, 'Mattermost · désactivation', 'Signaler · Mattermost');
  link(c, 'Signaler · Mattermost', 'Composer le récapitulatif');
  link(c, 'Composer le récapitulatif', 'Destinataires connus ?');
  link(c, 'Destinataires connus ?', 'Envoyer le récapitulatif', 0);
  link(c, 'Destinataires connus ?', 'Aucun destinataire', 1);
  link(c, 'Envoyer le récapitulatif', 'Résultat de l’envoi');
  link(c, 'Résultat de l’envoi', 'Signaler · e-mail');
  link(c, 'Aucun destinataire', 'Signaler · e-mail');
  link(c, 'Signaler · e-mail', 'Clôturer');
  link(c, 'Clôturer', 'Signaler · fin');
  return { id: IDS.offboarding, name: 'TongaPass · Départ (offboarding)', active: true, nodes, connections: c, settings, pinData: {} };
}

// ---------------------------------------------------------------------------
// Mobilité (changement de poste ou de profil)
// ---------------------------------------------------------------------------
function mobilityWorkflow() {
  const w = 'mobility';
  const nodes = [
    ...webhookPart(w, 'tongapass/mobility'),
    codeNode(w, 'Keycloak · ajustement des droits', [660, 300], code('shared/keycloak-token.js', 'mobility/keycloak.js')),
    callbackNode(w, 'Signaler · Keycloak', [880, 300]),
    ifNode(
      w,
      'Droits Keycloak ajustés ?',
      [1100, 300],
      "={{ $('Keycloak · ajustement des droits').all().some(i => i.json.step === 'keycloak.sync' && i.json.status === 'SUCCEEDED') }}",
    ),
    codeNode(w, 'Gitea · ajustement des équipes', [1320, 200], code('mobility/gitea.js')),
    callbackNode(w, 'Signaler · Gitea', [1540, 200]),
    codeNode(w, 'Mattermost · ajustement des canaux', [1760, 200], code('shared/mattermost-login.js', 'mobility/mattermost.js')),
    callbackNode(w, 'Signaler · Mattermost', [1980, 200]),
    codeNode(w, 'Composer la notification', [2200, 200], code('shared/email-layout.js', 'mobility/notify-email.js')),
    ifNode(w, 'Destinataires connus ?', [2420, 200], '={{ $json.skip }}', 'false'),
    emailNode(w, 'Envoyer la notification', [2640, 100]),
    codeNode(
      w,
      'Résultat de l’envoi',
      [2860, 100],
      code('shared/email-result.js').replaceAll('__STEP_KEY__', 'email.notify').replaceAll('__COMPOSER__', 'Composer la notification'),
    ),
    codeNode(w, 'Aucun destinataire', [2860, 300], `${read('shared/prelude.js')}\n\nreturn [stepEvent('email.notify', 'SKIPPED', 'Aucun destinataire à notifier')];`),
    callbackNode(w, 'Signaler · e-mail', [3080, 200]),
    finishNode(w, [3300, 300]),
    callbackNode(w, 'Signaler · fin', [3520, 300]),
  ];
  const c = {};
  link(c, 'Webhook TongaPass', 'Accusé de réception');
  link(c, 'Accusé de réception', 'Préparer le contexte');
  link(c, 'Préparer le contexte', 'Keycloak · ajustement des droits');
  link(c, 'Keycloak · ajustement des droits', 'Signaler · Keycloak');
  link(c, 'Signaler · Keycloak', 'Droits Keycloak ajustés ?');
  link(c, 'Droits Keycloak ajustés ?', 'Gitea · ajustement des équipes', 0);
  link(c, 'Droits Keycloak ajustés ?', 'Clôturer', 1);
  link(c, 'Gitea · ajustement des équipes', 'Signaler · Gitea');
  link(c, 'Signaler · Gitea', 'Mattermost · ajustement des canaux');
  link(c, 'Mattermost · ajustement des canaux', 'Signaler · Mattermost');
  link(c, 'Signaler · Mattermost', 'Composer la notification');
  link(c, 'Composer la notification', 'Destinataires connus ?');
  link(c, 'Destinataires connus ?', 'Envoyer la notification', 0);
  link(c, 'Destinataires connus ?', 'Aucun destinataire', 1);
  link(c, 'Envoyer la notification', 'Résultat de l’envoi');
  link(c, 'Résultat de l’envoi', 'Signaler · e-mail');
  link(c, 'Aucun destinataire', 'Signaler · e-mail');
  link(c, 'Signaler · e-mail', 'Clôturer');
  link(c, 'Clôturer', 'Signaler · fin');
  return { id: IDS.mobility, name: 'TongaPass · Mobilité (changement de poste)', active: true, nodes, connections: c, settings, pinData: {} };
}

const outDir = join(root, 'workflows');
mkdirSync(outDir, { recursive: true });
const workflows = {
  'tongapass-callback.json': callbackWorkflow(),
  'tongapass-onboarding.json': onboardingWorkflow(),
  'tongapass-mobility.json': mobilityWorkflow(),
  'tongapass-offboarding.json': offboardingWorkflow(),
};
for (const [file, workflow] of Object.entries(workflows)) {
  // Vérification : chaque connexion pointe vers un nœud existant.
  const names = new Set(workflow.nodes.map((n) => n.name));
  for (const [from, { main }] of Object.entries(workflow.connections)) {
    if (!names.has(from)) throw new Error(`${file} : nœud source inconnu ${from}`);
    for (const target of main.flat()) if (!names.has(target.node)) throw new Error(`${file} : nœud cible inconnu ${target.node}`);
  }
  writeFileSync(join(outDir, file), `${JSON.stringify(workflow, null, 2)}\n`);
  console.log(`✓ ${file} (${workflow.nodes.length} nœuds)`);
}
