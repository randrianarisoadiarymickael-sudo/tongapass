// ---------------------------------------------------------------------------
// Prélude commun injecté en tête de chaque nœud Code par build-workflows.mjs.
// Il fournit : le contexte TongaPass, un client HTTP tolérant aux erreurs,
// un générateur de mots de passe aléatoires et un constructeur d'événements.
// ---------------------------------------------------------------------------
const ctx = $('Préparer le contexte').first().json;
const employee = ctx.employee;
const access = ctx.access || { realmRoles: [], groups: [], giteaTeams: [], chatChannels: [] };
const options = ctx.options || {};

/** Appel HTTP qui ne lève pas d'exception sur les statuts 4xx/5xx. */
const http = async (request) => {
  const response = await this.helpers.httpRequest({
    json: true,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    timeout: 15000,
    ...request,
  });
  let body = response.body;
  if (typeof body === 'string' && body.length) {
    try {
      body = JSON.parse(body);
    } catch {
      /* corps texte */
    }
  }
  return { status: response.statusCode, body, headers: response.headers || {} };
};

const describe = (res) =>
  `HTTP ${res.status} ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? '')}`.slice(0, 240);

/** Mot de passe jetable fort, jamais communiqué : l'utilisateur définit le sien (lien d'activation). */
const randomPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!@#%';
  // Module « crypto » autorisé par NODE_FUNCTION_ALLOW_BUILTIN=crypto (docker-compose.yml)
  const bytes = require('crypto').randomBytes(28);
  return `${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}Aa9!`;
};

/** Événement d'étape attendu par l'API (POST /automation/events, signé par le sous-workflow). */
const stepEvent = (step, status, detail, meta = {}) => ({
  json: { runId: ctx.runId, callbackUrl: ctx.callbackUrl, event: 'step', step, status, detail, meta },
});
