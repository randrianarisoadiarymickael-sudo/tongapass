---
title: "Arrivées et départs des employés : automatiser l'IAM avec n8n et Keycloak (sans oublier de révoquer)"
published: false
tags: n8n, keycloak, devsecops, automation
canonical_url: ""
cover_image: ./branding/banner.svg
---

# Arrivées et départs des employés : automatiser l'IAM avec n8n et Keycloak

*Par l'équipe TongaPass, ESTI Licence 3, projet P03.*

Le premier jour d'un nouvel employé est souvent une course aux accès : un compte par-ci, une invitation par-là, un mot de passe envoyé… par e-mail. Le jour de son départ, c'est pire : on oublie souvent un outil, et le compte reste ouvert. Ces **comptes orphelins** sont une source classique de fuites.

Entre les deux, il y a un troisième moment que l'on oublie presque toujours : la **mobilité interne**. Un développeur devient DevOps, une comptable passe aux RH… et garde ses anciens droits en plus des nouveaux. Au fil des années, les droits s'accumulent.

Nous avons construit **TongaPass** (*tonga* = « arriver » en malgache) : un portail RH qui déclenche des workflows **n8n**, lesquels provisionnent **Keycloak**, **Gitea** et **Mattermost** à l'arrivée, ajustent les droits à chaque changement de poste, révoquent tout le jour du départ, puis vérifient chaque nuit que la réalité correspond au modèle. Voici ce que nous avons appris.

## 1. Le principe : l'API décide, n8n exécute

Notre première idée était de tout faire dans n8n. Nous avons changé d'avis : il faut une **source de vérité transactionnelle** pour savoir à tout instant qui a quoi. L'API NestJS enregistre l'employé et l'exécution, puis appelle un webhook n8n. Chaque étape terminée renvoie un événement à l'API, qui met à jour le portail en temps réel (Server-Sent Events).

```text
Portail ──► API ──webhook──► n8n ──► Keycloak / Gitea / Mattermost / SMTP
               ◄──rappel signé HMAC──┘
```

Ce découplage apporte trois choses : un **audit** fiable, la **relance** d'un workflow sans doublon et un **chien de garde** qui repère les exécutions bloquées.

## 2. Keycloak : un compte de service vraiment restreint

n8n n'utilise pas le compte administrateur. Il utilise un client `tongapass-provisioner` en `client_credentials`, avec seulement les rôles `manage-users`, `view-users`, `query-users`, `query-groups` et `view-realm`. Nous l'avons vérifié : il peut créer un utilisateur, mais une tentative de modification du royaume renvoie **403**.

> **Piège rencontré avec Keycloak 26.8.** Nos appels à l'API d'administration renvoyaient 401 alors que le jeton contenait les bons rôles. Les journaux de débogage indiquaient *« Expected audience not available in the token »*. Les jetons des comptes de service doivent désormais porter l'audience de l'API d'administration, fournie par le *client scope* intégré **`kc-admin-api`**. Il suffit de l'ajouter aux scopes par défaut du client :
>
> ```json
> { "clientId": "tongapass-provisioner", "defaultClientScopes": ["basic", "roles", "kc-admin-api"] }
> ```

Autre bonne pratique : **ne jamais envoyer de mot de passe**. `PUT /users/{id}/execute-actions-email` envoie un lien d'activation valable 48 h.

## 3. n8n « as code »

Nous voulions des workflows relus en code review comme le reste du projet. Le JavaScript de chaque nœud Code vit dans des fichiers `.js`. Un script Node assemble les JSON, vérifie la syntaxe et les connexions, puis la CI s'assure que les JSON versionnés sont à jour. Au démarrage, le conteneur réimporte et publie les workflows :

```sh
n8n import:credentials --input=/tmp/credentials.json   # chiffrés par N8N_ENCRYPTION_KEY
n8n import:workflow --separate --input=/opt/tongapass/workflows
n8n publish:workflow --id=tpCallback000001              # le sous-workflow d'abord !
n8n publish:workflow --id=tpOnboarding0001
```

> **Piège n8n 2.x.** `update:workflow --active=true` n'existe plus, il est remplacé par `publish:workflow`. De plus, un workflow qui appelle un sous-workflow ne peut pas être publié tant que ce sous-workflow ne l'est pas.

Dans le nœud Code, `this.helpers.httpRequest` permet d'enchaîner plusieurs appels d'API avec une vraie gestion d'erreur. Le module `crypto` n'est disponible qu'avec `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.

## 4. Des rappels qu'on ne peut pas falsifier

Si n'importe qui pouvait appeler `POST /automation/events`, il pourrait marquer un départ comme « terminé ». Chaque rappel est donc signé par un sous-workflow n8n (nœud *Crypto*) :

```text
X-TongaPass-Timestamp: 1795029514
X-TongaPass-Signature: sha256=HMAC_SHA256(secret, "1795029514." + corps)
```

L'API recalcule la signature sur le **corps brut**, compare à temps constant et refuse tout horodatage de plus de 5 minutes, ce qui bloque le rejeu.

## 5. Un journal d'audit infalsifiable

Chaque entrée est chaînée à la précédente par SHA-256. Un déclencheur PostgreSQL interdit `UPDATE`, `DELETE` et `TRUNCATE` sur la table. Un bouton « Vérifier l'intégrité » recalcule toute la chaîne.

```sql
CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
```

## 6. La mobilité : appliquer un écart, pas tout refaire

Changer de poste ne doit ni supprimer le compte (on perdrait l'historique Git et les conversations), ni empiler les droits. TongaPass calcule l'**écart** entre l'ancien et le nouveau profil et l'affiche avant validation :

```
Keycloak  rôles    employee  developer  + devops
Gitea     équipes  developers           + devops
Mattermost canaux  town-square  bienvenue  engineering  + incidents
```

Le workflow n8n de mobilité n'applique **que** cet écart. Et la fiche de l'employé ne change de profil qu'une fois Keycloak confirmé : le portail n'affiche jamais un état que l'IAM n'a pas atteint.

## 7. Contrôler, pas seulement exécuter

Même avec une automatisation parfaite, quelqu'un finira par ajouter un rôle « temporaire » à la main dans la console Keycloak. Chaque nuit, TongaPass relit les droits réels avec un **second compte de service en lecture seule** et les compare au profil attendu. Un rôle en trop, un compte d'ancien salarié encore actif : l'écart apparaît sur la vue d'ensemble et dans la page Conformité. Celui qui contrôle ne peut rien modifier, c'est la séparation des tâches appliquée à l'outillage.

## 8. Suivre un changement de droits

Une arrivée passe par plusieurs outils. Sur la fiche d’exécution, l’équipe RH peut voir que le compte Keycloak existe déjà alors que l’invitation Mattermost est encore en attente. Chaque rappel de n8n met à jour la ligne correspondante et le fil d’activité. Si le portail perd la connexion aux événements, la barre supérieure l’indique. Les états ont un libellé dans les deux thèmes.

## 9. Tester sans tout démarrer

La pile complète compte 9 conteneurs. Pour des tests navigateur rapides en CI, nous avons écrit deux **doublures de protocole** : un mini fournisseur OIDC compatible keycloak-js (PKCE, JWKS, SSO silencieux) et un simulateur des webhooks n8n qui renvoie des rappels signés. La recette sur la vraie pile (`npm run test:stack`) vérifie ensuite directement dans Keycloak, Gitea, Mattermost et Mailpit que les accès sont créés, ajustés lors d'une mobilité, puis révoqués, et qu'un rôle ajouté à la main est bien détecté.

## Conclusion

Automatiser l'arrivée, c'est du confort. Automatiser la mobilité et le départ, c'est de la sécurité. Contrôler en continu, c'est ce qui permet de le prouver. Avec n8n et Keycloak, une équipe de 5 étudiants peut construire en 50 heures une solution auditée, au moindre privilège et entièrement auto-hébergée.

Le code est ouvert : clonez le dépôt, lancez `node scripts/init-env.mjs && docker compose up -d` et déclarez votre première arrivée.

*Retours bienvenus dans les commentaires.*
