# Doublures de test (développement et CI)

> **Attention : ne jamais déployer.** Ces scripts imitent des protocoles pour les tests. Ils n'offrent aucune sécurité réelle.

| Script | Remplace | Port | Ce qu'il fait |
|---|---|---|---|
| `fake-oidc.mjs` | Keycloak | 8180 | OIDC compatible keycloak-js : *Authorization Code* + PKCE S256, JWKS (clé RSA générée au démarrage), rafraîchissement, SSO silencieux, déconnexion. Page de connexion avec 4 comptes : `admin.it`, `rh.manager`, `auditeur`, `dev.lambda` (sans rôle TongaPass) |
| `n8n-simulator.mjs` | n8n | 5678 | Mêmes webhooks et même authentification par en-tête que n8n. Envoie pour chaque étape un rappel signé HMAC vers l'API, avec un délai réaliste |

## Développer sans Docker (hors PostgreSQL)

```bash
docker compose up -d postgres
set -a && . ./.env && set +a
node tools/dev-stubs/fake-oidc.mjs &
node tools/dev-stubs/n8n-simulator.mjs &
cd apps/api && npm run build && \
  DATABASE_HOST=localhost DATABASE_PORT=5434 DATABASE_USER=tongapass DATABASE_PASSWORD=$TP_DB_PASSWORD \
  KEYCLOAK_ISSUER=http://localhost:8180/realms/tongapass \
  KEYCLOAK_JWKS_URI=http://localhost:8180/realms/tongapass/protocol/openid-connect/certs \
  N8N_BASE_URL=http://localhost:5678 AUTOMATION_CALLBACK_URL=http://localhost:4100/api/v1/automation/events \
  node dist/database/run-migrations.js && node dist/main.js &
cd apps/portal && npm run dev   # http://localhost:5173
```

Simuler une panne : `SIM_FAIL_STEPS=chat.invite,gitea.account node tools/dev-stubs/n8n-simulator.mjs`. L'exécution passe en `PARTIAL` et le portail propose la relance.

Les tests Playwright (`e2e/`) démarrent automatiquement ces doublures, l'API et le portail.
