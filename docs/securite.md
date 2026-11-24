# Sécurité de TongaPass

## 1. Principes

1. **Moindre privilège** : chaque acteur (humain, service, conteneur) n'a que les droits nécessaires à sa tâche.
2. **Aucun secret dans le dépôt** : tout passe par `.env`, généré localement et ignoré par Git.
3. **Défense en profondeur** : un contrôle est vérifié à plusieurs niveaux (portail, API, n8n, base de données).
4. **Traçabilité** : toute action qui accorde ou retire un droit laisse une trace d'audit infalsifiable.

## 2. Moindre privilège, niveau par niveau

| Acteur | Droits accordés | Ce qu'il ne peut pas faire |
|---|---|---|
| RH (`tp-hr`) | Déclarer arrivées, mobilités et départs, modifier une fiche, vérifier la conformité d'un employé | Lire le journal d'audit, modifier les profils d'accès |
| Auditeur (`tp-auditor`) | Lecture seule, audit, conformité, intégrations | Toute écriture sur les employés et les profils |
| Admin IAM (`tp-admin`) | Profils d'accès, tout le portail | Rien de plus que le portail (pas d'accès admin Keycloak via ce rôle) |
| Salarié provisionné | Rôles de son profil (`employee`, `developer`…) | Accéder au portail RH (refus 403 vérifié en test) |
| n8n → Keycloak | Compte de service `tongapass-provisioner` : `manage-users`, `view-users`, `query-*`, `view-realm` | Modifier le royaume (**403 vérifié**), devenir `realm-admin` |
| API → Keycloak (conformité) | Compte de service `tongapass-auditor` : `view-users`, `query-users`, `query-groups` | Modifier quoi que ce soit : celui qui contrôle ne peut pas corriger en douce |
| n8n → rôles attribués | Liste blanche `TP_ASSIGNABLE_ROLES`, rôles `tp-*` toujours refusés | Accorder un rôle hors catalogue |
| Profils d'accès | Catalogue fermé validé par l'API (`IsIn`) + rôle socle `employee` obligatoire | Contenir `tp-admin` ou un rôle `realm-management` (400 vérifié en test) |
| Portail (client OIDC) | `fullScopeAllowed: false` : seuls les rôles `tp-*` sont dans le jeton | Voir les autres rôles de l'utilisateur |
| Services PostgreSQL | Un utilisateur et une base par service | Lire la base d'un autre service |
| Conteneurs | `no-new-privileges`, API `read_only` + non root, nginx non privilégié | Élever leurs privilèges |

## 3. Authentification et autorisation

- **Portail** : flux *Authorization Code + PKCE S256* (client public, pas de secret dans le navigateur). Les jetons restent en mémoire, jamais dans `localStorage`. Le jeton d'accès dure 5 minutes et se rafraîchit automatiquement. La session SSO est vérifiée par redirection (`prompt=none`), sans iframe : la CSP peut interdire tout cadrage.
- **API** : vérification de chaque jeton par JWKS (signature RS256/ES256/PS256, émetteur, audience `tongapass-api`, expiration avec 5 s de tolérance). Toute erreur de vérification donne un **401, jamais un 500**. Les gardes sont globales : une route est protégée par défaut, `@Public()` est explicite.
- **Keycloak** :
  - Politique de mot de passe : 12 caractères minimum, majuscule, minuscule, chiffre, ni identifiant ni e-mail, historique de 3.
  - Protection contre la force brute : 5 échecs, puis attente progressive jusqu'à 15 min.
  - Événements de connexion et d'administration journalisés.

## 4. Échanges machine à machine (API ↔ n8n)

| Sens | Mécanisme | Protection |
|---|---|---|
| API → n8n | Webhook avec l'identifiant n8n *Header Auth* `X-TongaPass-Token` | Requête refusée (403) sans le jeton |
| n8n → API | `X-TongaPass-Signature: sha256=HMAC(secret, timestamp + "." + corps)` et `X-TongaPass-Timestamp` | Intégrité du corps, rejeu bloqué au-delà de 5 min, comparaison à temps constant |
| Contenu des rappels | Méta filtrées (`pass`, `secret`, `token`, `credential` supprimés, scalaires uniquement) | Aucun secret ne peut être stocké par erreur (vérifié en test) |

## 5. Détection des écarts de droits

Une automatisation fiable ne suffit pas : un administrateur peut toujours ajouter un rôle à la main dans la console Keycloak. Le **contrôle de conformité** compare chaque nuit (et à la demande) les droits réels de chaque compte avec les droits attendus par son profil :

- rôle ou groupe **en trop** (ex. `finance` ajouté hors TongaPass) ou **manquant** : statut `DRIFT` ;
- compte d'un employé parti **encore actif** : statut `DRIFT` ;
- compte attendu **introuvable** : statut `NO_ACCOUNT`.

Chaque résultat est historisé (`compliance_checks`), le contrôle global est tracé dans le journal d'audit et la vue d'ensemble affiche le nombre d'écarts. La recette sur la pile réelle ajoute volontairement un rôle dans Keycloak et vérifie qu'il est détecté.

## 6. Journal d'audit infalsifiable

- **Ajout seul** : un déclencheur PostgreSQL (`audit_logs_append_only`) lève une erreur sur `UPDATE`, `DELETE` et `TRUNCATE`, même pour l'utilisateur SQL de l'application (vérifié en test).
- **Chaînage SHA-256** : `hash(n) = SHA-256(hash(n-1) ‖ JSON canonique de l'entrée n)`. L'écriture est sérialisée par un verrou consultatif (`pg_advisory_xact_lock`). La vérification recalcule toute la chaîne et indique la première entrée altérée.
- **Atomicité** : l'entrée d'audit est écrite dans la même transaction que l'opération métier.
- **Export CSV** protégé contre l'injection de formules (`=`, `+`, `-`, `@` préfixés).

## 7. Protection des données personnelles

- Aucun mot de passe n'est créé pour l'humain ni envoyé par e-mail. Keycloak envoie un lien d'activation valable 48 h, et les mots de passe Gitea et Mattermost sont jetables (`crypto.randomBytes`) puis réinitialisés par l'utilisateur.
- Les journaux masquent `Authorization`, les cookies et les signatures (`pino` *redact*).
- Les données de démonstration sont fictives. Mailpit capture tous les e-mails : aucun envoi réel.

## 8. Durcissement HTTP

- **API** : Helmet, CORS en liste blanche, `trust proxy` limité au premier saut, limitation de débit (120 requêtes/min par défaut), validation stricte (`whitelist`, `forbidNonWhitelisted`), corps JSON brut conservé uniquement pour la vérification HMAC.
- **Portail (nginx)** :
  - CSP `default-src 'self'` sans script inline (le thème est appliqué par un fichier externe), `frame-src 'none'`, `frame-ancestors 'none'`.
  - `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
  - `server_tokens off`.

## 8. Analyse des menaces (STRIDE)

| Menace | Exemple | Contre-mesure |
|---|---|---|
| **S**poofing (usurpation) | Faux appel « étape réussie » vers l'API | Signature HMAC + horodatage |
| **T**ampering (altération) | Modifier l'audit pour masquer un accès | Déclencheur *append-only* + chaîne SHA-256 vérifiable |
| **R**epudiation (contestation) | « Je n'ai pas déclaré ce départ » | Acteur, IP, user-agent et horodatage dans l'audit |
| **I**nformation disclosure (fuite) | Mot de passe dans un e-mail, jeton dans une URL | Lien d'activation, SSE avec en-tête, redaction des journaux |
| **D**enial of service (déni de service) | Rafale de requêtes | Limitation de débit, délais d'expiration HTTP, chien de garde |
| **E**levation of privilege (escalade) | Profil contenant `tp-admin` | Catalogue fermé (API) + liste blanche (n8n) + compte de service restreint (Keycloak) |

## 9. Chaîne DevSecOps

| Étape CI | Outil | Échoue si |
|---|---|---|
| Secrets | Gitleaks | Un secret est détecté dans l'historique Git |
| Dépendances | `npm audit --audit-level=high`, Trivy `fs` | Vulnérabilité haute ou critique corrigeable |
| Configuration | Trivy *misconfig* (Dockerfile, Compose) | Mauvaise configuration haute ou critique |
| Images | Trivy `image` | Vulnérabilité haute ou critique dans l'image construite |
| Code | ESLint, TypeScript strict, tests unitaires et e2e | Erreur de typage ou test en échec |
| Mises à jour | Dependabot (npm, Docker, Actions) | — |

## 10. Recommandations pour la production

- Keycloak en mode `start` (optimisé) derrière un proxy TLS, `sslRequired: all`, clés et secrets dans un coffre (Vault ou OpenBao).
- Rotation régulière de `TP_PROVISIONER_SECRET`, `AUTOMATION_HMAC_SECRET` et `N8N_WEBHOOK_TOKEN`.
- n8n en *queue mode* (Redis + workers), sauvegarde chiffrée de PostgreSQL, rétention des exécutions limitée (déjà fixée à 14 jours).
- SMTP réel avec SPF, DKIM et DMARC. Boîtes professionnelles créées par le fournisseur de messagerie avant l'envoi du lien d'activation.
- SSO OIDC de Gitea vers Keycloak (*auth source* OAuth2), pour supprimer le mot de passe local.
