# Workflows n8n de TongaPass

Les workflows sont gérés **« as code »** :

```
code/shared/*.js        prélude commun (contexte, client HTTP, événements), jeton Keycloak, session Mattermost,
                        gabarit d'e-mail commun (email-layout.js)
code/onboarding/*.js    nœuds Code de l'arrivée
code/mobility/*.js      nœuds Code de la mobilité interne
code/offboarding/*.js   nœuds Code du départ
build-workflows.mjs     assemble workflows/*.json, vérifie la syntaxe JS et les connexions
workflows/*.json        fichiers importés par n8n (générés : ne pas modifier à la main)
entrypoint.sh           au démarrage : import des credentials + workflows, publication, lancement
render-credentials.mjs  credentials SMTP et Header Auth construits depuis l'environnement
```

Après toute modification d'un fichier `code/**/*.js` :

```bash
node automation/n8n/build-workflows.mjs
docker compose restart n8n   # réimporte et republie
```

## Les quatre workflows

| ID | Nom | Déclencheur |
|---|---|---|
| `tpCallback000001` | TongaPass · Signaler à l'API | Sous-workflow : signe chaque événement (HMAC-SHA256) et l'envoie à l'API |
| `tpOnboarding0001` | TongaPass · Arrivée | `POST /webhook/tongapass/onboarding` |
| `tpMobility000001` | TongaPass · Mobilité | `POST /webhook/tongapass/mobility` |
| `tpOffboarding001` | TongaPass · Départ | `POST /webhook/tongapass/offboarding` |

n8n 2.x impose de **publier le sous-workflow avant** les workflows qui l'appellent : `entrypoint.sh` respecte cet ordre.

## Contrat d'entrée (API → n8n)

En-tête obligatoire : `X-TongaPass-Token: <N8N_WEBHOOK_TOKEN>` (identifiant n8n *Header Auth*). Sans ce jeton, n8n répond 403.

```json
{
  "runId": "uuid",
  "type": "ONBOARDING",
  "attempt": 1,
  "callbackUrl": "http://api:4100/api/v1/automation/events",
  "company": { "name": "TongaPass", "emailDomain": "tongapass.local" },
  "employee": {
    "id": "uuid", "employeeNumber": "TP-2026-0001", "firstName": "Hanitra", "lastName": "Rakoto",
    "fullName": "Hanitra Rakoto", "username": "hanitra.rakoto", "workEmail": "hanitra.rakoto@tongapass.local",
    "personalEmail": "hanitra@example.org", "jobTitle": "…", "department": "Engineering",
    "startDate": "2026-12-01", "managerName": "…", "managerEmail": "…",
    "keycloakUserId": null, "giteaUsername": null, "chatUserId": null
  },
  "access": {
    "profileCode": "devops", "profileName": "Ingénierie DevOps",
    "realmRoles": ["employee", "developer", "devops"], "groups": ["Engineering"],
    "giteaTeams": ["developers", "devops"], "chatChannels": ["town-square", "bienvenue", "engineering", "incidents"]
  },
  "options": { "sendWelcomeEmail": true, "announceInChat": true },
  "links": { "portal": "…", "account": "…/realms/tongapass/account", "gitea": "…", "mattermost": "…" },
  "steps": ["keycloak.account", "keycloak.roles", "keycloak.activation", "gitea.account", "chat.invite", "email.welcome"]
}
```

Réponse immédiate : `202 { "accepted": true, "executionId": "42" }`. Le traitement se poursuit en asynchrone.

Pour une **mobilité** (`"type": "MOBILITY"`), `access` décrit les droits **cibles** et un bloc `mobility` décrit l'écart à appliquer :

```json
"mobility": {
  "previousProfile": { "code": "dev-backend", "name": "Développement back-end" },
  "targetProfile": { "code": "devops", "name": "Ingénierie DevOps" },
  "previousAccess": { "realmRoles": ["employee", "developer"], "groups": ["Engineering"], "giteaTeams": ["developers"], "chatChannels": ["town-square", "bienvenue", "engineering"] },
  "changes": {
    "added":   { "realmRoles": ["devops"], "groups": [], "giteaTeams": ["devops"], "chatChannels": ["incidents"] },
    "removed": { "realmRoles": [], "groups": [], "giteaTeams": [], "chatChannels": [] }
  },
  "jobTitle": "Ingénieure DevOps",
  "department": "Engineering"
}
```

Les workflows n'appliquent **que** `changes` : un droit conservé n'est jamais retiré puis réattribué. Le rôle `employee` et le canal `town-square` ne figurent jamais dans `removed`.

## Contrat de sortie (n8n → API)

`POST {callbackUrl}` avec les en-têtes :

```
X-TongaPass-Timestamp: <secondes UNIX>
X-TongaPass-Signature: sha256=<hex HMAC_SHA256(AUTOMATION_HMAC_SECRET, timestamp + "." + corps)>
```

| `event` | Champs | Effet |
|---|---|---|
| `step` | `step`, `status` (`RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`), `detail`, `meta` | Met à jour l'étape, l'audit et la frise du portail |
| `run.finished` | `executionId` | Calcule le statut final et le statut de l'employé |

Clés `meta` reprises sur la fiche employé : `keycloak.account → userId`, `gitea.account → username`, `chat.invite → userId`. Les clés contenant `pass`, `secret`, `token` ou `credential` sont **toujours ignorées**.

## Étapes et criticité

| Arrivée | Critique | Mobilité | Critique | Départ | Critique |
|---|---|---|---|---|---|
| `keycloak.account` | oui | `keycloak.sync` | oui | `keycloak.disable` | oui |
| `keycloak.roles` | | `gitea.sync` | | `keycloak.sessions` | oui |
| `keycloak.activation` | | `chat.sync` | | `keycloak.roles` | |
| `gitea.account` | | `email.notify` | | `gitea.revoke` | |
| `chat.invite` | | | | `chat.deactivate` | |
| `email.welcome` | | | | `email.notify` | |

Pour une mobilité, l'API ne met à jour le profil, le poste et le service de l'employé **qu'à la réussite de `keycloak.sync`**.

## Variables d'environnement lues par les workflows

`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `TP_ASSIGNABLE_ROLES`, `GITEA_URL`, `GITEA_ORG`, `GITEA_ADMIN_USER`, `GITEA_ADMIN_PASSWORD`, `CHAT_ENABLED`, `MATTERMOST_URL`, `MATTERMOST_TEAM`, `MATTERMOST_ADMIN_USER`, `MATTERMOST_ADMIN_PASSWORD`, `MAIL_FROM`, `HR_NOTIFICATION_EMAIL`, `AUTOMATION_HMAC_SECRET`.

Prérequis côté n8n : `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (lecture de `$env`) et `NODE_FUNCTION_ALLOW_BUILTIN=crypto` (mots de passe jetables).
