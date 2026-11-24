# Participation communautaire

La grille demande **au moins une contribution externe**. Pendant le projet, nous avons rencontré trois vrais pièges d'intégration. Chacun donne lieu à une contribution utile, rédigée et prête à publier. L'équipe choisit au moins deux canaux, publie, puis consigne les liens dans le tableau de suivi (section 5).

## 1. Stack Overflow — question/réponse auto-documentée (Keycloak 26.8)

**Titre :** *Keycloak 26.8: service account gets 401 "Expected audience not available in the token" on Admin REST API*

> **Question.** My `client_credentials` token contains `realm-management` roles (`manage-users`, `view-users`), but every call to `/admin/realms/{realm}/users` returns **401**. With `org.keycloak.services.managers` set to DEBUG, the log says: `Failed to verify identity token: Expected audience not available in the token`. The `admin-cli` token works. What changed?
>
> **Réponse.** In recent Keycloak 26.x releases, Admin REST API tokens must contain the admin-API audience (`<frontend-url>/admin/realms/<realm>`). `admin-cli` has the built-in client scope **`kc-admin-api`** (mapper `oidc-admin-api-audience-mapper`) in its default scopes. Add that scope to your service-account client:
>
> ```json
> "defaultClientScopes": ["basic", "roles", "kc-admin-api"]
> ```
>
> Or in the admin console: *Clients → your client → Client scopes → Add client scope → kc-admin-api (Default)*. The token `aud` then becomes `["http://host/admin/realms/<realm>", "realm-management"]` and calls succeed.

## 2. Communauté n8n — publication d'un modèle de workflow

**Où :** <https://community.n8n.io/> (catégorie *Built with n8n*), et éventuellement soumission sur la galerie de modèles n8n.

**Titre :** *Employee onboarding/offboarding with Keycloak, Gitea & Mattermost — signed callbacks (HMAC) and workflows-as-code*

Contenu à publier :
- Les fichiers `automation/n8n/workflows/*.json`, sans aucun identifiant : les credentials sont référencés par nom.
- Les deux leçons propres à n8n 2.x :
  1. `publish:workflow` remplace `update:workflow --active=true` ;
  2. un sous-workflow doit être publié **avant** le workflow appelant (*« Cannot publish workflow: Node … references workflow … which is not published »*).
- Le motif de **rappel signé** : sous-workflow *Execute Workflow Trigger*, puis *Crypto (HMAC-SHA256)*, puis *HTTP Request* avec un corps brut identique à la chaîne signée.

## 3. Issue ou pull request open source

Pistes concrètes, à vérifier avant ouverture (rechercher d'abord une issue existante) :

| Projet | Proposition | Type |
|---|---|---|
| Keycloak (documentation) | Mentionner `kc-admin-api` dans la section *Service accounts / Admin REST API* du guide de mise à niveau | Issue ou PR sur `keycloak/keycloak` (dossier `docs`) |
| n8n (documentation CLI) | Préciser dans la page *CLI commands* l'ordre de publication des sous-workflows | PR sur `n8n-io/n8n-docs` |
| Mattermost (documentation Docker) | Les images récentes sont *distroless* : un healthcheck basé sur `curl` échoue ; proposer `mmctl --local system status` | Issue sur `mattermost/docker` |

Modèle d'issue :

```markdown
### Contexte
Version : Keycloak 26.8.2 (image quay.io/keycloak/keycloak:26.8), mode start-dev, royaume importé.

### Comportement observé
Les jetons client_credentials d'un client avec des rôles realm-management obtiennent 401 sur l'API d'administration.
Journal DEBUG : « Expected audience not available in the token ».

### Comportement attendu / suggestion
Documenter que le client scope `kc-admin-api` doit être affecté aux clients de compte de service.

### Reproduction
(lien vers un dépôt minimal ou extrait de realm.json)
```

## 4. Atelier pour les autres promotions (1 h 30)

**Titre :** *« Zéro compte orphelin » : automatiser l'IAM avec n8n et Keycloak*

| Durée | Séquence |
|---|---|
| 10 min | Pourquoi le départ des employés est un risque de sécurité (comptes orphelins, moindre privilège) |
| 20 min | Démonstration TongaPass : arrivée, puis départ, puis vérification d'intégrité |
| 40 min | Atelier guidé : créer un workflow n8n qui crée un utilisateur Keycloak via un compte de service, puis le désactive |
| 15 min | Sécuriser un webhook : jeton d'en-tête et signature HMAC |
| 5 min | Questions, liens vers le dépôt et l'article |

Support : `docs/guide-demo.md`, `docs/article-blog.md`, le dépôt public.

## 5. Suivi des contributions

| Date | Canal | Lien | Auteur | Statut |
|---|---|---|---|---|
| | Stack Overflow | | | à publier |
| | Forum n8n | | | à publier |
| | GitHub (issue/PR) | | | à publier |
| | Atelier ESTI | | | à planifier |
