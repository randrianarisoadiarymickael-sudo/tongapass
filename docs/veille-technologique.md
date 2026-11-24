# Fiche de veille technologique — Automatisation de l'onboarding et IAM

**Projet P03 · ESTI Licence 3 · Novembre 2026**
**Sujet :** automatiser l'arrivée et le départ des employés (*joiner / leaver*) avec un moteur de workflows et un fournisseur d'identité.

## 1. État de l'art

Le cycle de vie des identités (*Identity Lifecycle Management*) couvre trois moments : **l'arrivée** (*joiner* : créer les comptes, accorder les droits), **la mobilité** (*mover* : ajuster les droits) et **le départ** (*leaver* : tout révoquer). Fait à la main, il produit deux défauts bien documentés :

- des **comptes orphelins**, c'est-à-dire des accès qui survivent au départ et ouvrent une porte aux fuites de données ;
- une **accumulation de privilèges**, quand des droits sont ajoutés sans jamais être retirés.

Les référentiels en font des exigences explicites : NIST SP 800-53 (contrôles AC-2 *gestion des comptes* et AC-6 *moindre privilège*), ISO/IEC 27001:2022 (mesures 5.18 *droits d'accès* et 6.5 *responsabilités après la fin du contrat*), OWASP ASVS (chapitre V4, contrôle d'accès).

Le marché combine deux briques :

1. **Un fournisseur d'identité (IdP)** qui centralise comptes, rôles et sessions et expose OpenID Connect (OIDC) et SAML pour l'authentification unique (SSO). Les standards de provisionnement sont **SCIM 2.0** (RFC 7643/7644) et les API d'administration propres à chaque IdP.
2. **Un orchestrateur** qui enchaîne les actions sur les outils (forge Git, messagerie, e-mail) à partir d'un événement RH. Les plateformes IGA (*Identity Governance & Administration*) du marché (SailPoint, Saviynt, Okta Lifecycle Management) intègrent les deux, mais elles sont coûteuses et propriétaires. L'approche **open source auto-hébergée** (n8n + Keycloak) donne une solution souveraine, adaptée aux PME et à l'enseignement.

Tendances de 2025-2026 : workflows « as code » versionnés (GitOps), automatisation pilotée par événements avec rappels signés, *zero trust* (vérifier chaque requête, sessions courtes), arrivée des agents IA dans les plateformes de workflows (n8n intègre des nœuds IA).

## 2. Comparaison des moteurs d'automatisation

| Critère | **n8n** (retenu) | Make | Zapier | Node-RED |
|---|---|---|---|---|
| Modèle | *Fair-code* (Sustainable Use License), auto-hébergeable | SaaS propriétaire | SaaS propriétaire | Open source Apache 2.0 (OpenJS Foundation) |
| Hébergement des données | Chez soi (Docker) | Cloud (UE ou US) | Cloud (US) | Chez soi |
| Code dans les workflows | Nœud Code JS/Python, appels HTTP complets | Limité (fonctions) | Limité (« Code by Zapier ») | Natif (JavaScript) |
| Webhooks authentifiés, sous-workflows | Oui (Header Auth, Execute Workflow) | Oui | Oui | À construire |
| Versionnement Git | CLI import/export, workflows en JSON | Non natif | Non | Fichiers JSON |
| Coût | Gratuit en auto-hébergement | À l'opération | À la tâche | Gratuit |
| Cible | Équipes techniques, intégrations métier | Métiers, no-code | Métiers, no-code | IoT, intégrations techniques |

**Avantages de n8n :** souveraineté des données (les données RH ne quittent pas l'infrastructure), interface visuelle compréhensible par un non-développeur, nœud Code et requêtes HTTP sans limite, sous-workflows réutilisables, CLI pour l'intégration continue.

**Limites de n8n :** la licence *fair-code* n'est pas une licence OSI (la revente en SaaS est interdite), la publication des workflows a changé en version 2 (publication explicite, sous-workflows publiés d'abord), et la haute disponibilité demande le *queue mode* (Redis + workers).

## 3. Comparaison des fournisseurs d'identité

| Critère | **Keycloak** (retenu) | Authentik | Zitadel | Microsoft Entra ID |
|---|---|---|---|---|
| Licence | Apache 2.0, projet CNCF | Cœur MIT, édition Enterprise *source-available* | AGPL 3.0 depuis la v3 (2025) | Propriétaire (SaaS) |
| Protocoles | OIDC, OAuth 2.1, SAML 2.0, LDAP/AD | OIDC, SAML, LDAP, RADIUS, proxy | OIDC, SAML, *passkeys* | OIDC, SAML, SCIM |
| API d'administration | REST complète, comptes de service | REST | gRPC/REST | Microsoft Graph |
| Rôles, groupes, moindre privilège | Rôles royaume/client, groupes, droits fins `realm-management` | Groupes, politiques | Organisations, rôles | Rôles, PIM |
| Personnalisation | Thèmes, SPI Java, profil utilisateur déclaratif | Flux configurables | Marque, actions | Limitée |
| Maturité | Très élevée (Red Hat, depuis 2014) | En croissance | En croissance | Très élevée |

**Avantages de Keycloak :** standard de fait en open source, comptes de service à privilèges ciblés (`manage-users` sans `realm-admin`), import du royaume « as code » avec substitution de variables d'environnement, e-mails d'action (`execute-actions-email`) qui évitent d'envoyer un mot de passe.

**Limites de Keycloak :**
- Empreinte mémoire importante (JVM).
- Courbe d'apprentissage réelle (royaumes, clients, *scopes*).
- Évolutions de sécurité à suivre : en version 26.x, l'API d'administration exige l'audience `kc-admin-api` sur les jetons des comptes de service. Ce point a été rencontré et documenté pendant le projet.

## 4. Justification des choix

| Besoin du sujet P03 | Choix | Pourquoi |
|---|---|---|
| Automatisation visuelle et démontrable | **n8n 2.x** | Workflows lisibles en soutenance, nœud Code pour la logique métier, auto-hébergé |
| IAM avec rôles et révocation | **Keycloak 26** | API d'administration complète, compte de service au moindre privilège, SSO OIDC du portail |
| Outils à provisionner | **Gitea**, **Mattermost** | Alternatives auto-hébergées à GitHub et Slack, API REST complètes |
| E-mails de test | **Mailpit** | Serveur SMTP de capture, interface web, aucun envoi réel |
| Données et audit | **PostgreSQL 17** | Transactions, verrous consultatifs pour la chaîne d'audit, déclencheurs *append-only* |
| Portail et API | **React 19**, **NestJS 12** | Écosystèmes majeurs, typage de bout en bout, OpenAPI natif |

**Architecture retenue.** L'API est la *source de vérité* (employés, exécutions, audit) et n8n *exécute* les actions. Ce découplage permet de rejouer un workflow sans doublon (idempotence), de détecter une exécution bloquée (chien de garde) et de garder une trace d'audit même quand un outil tiers est en panne.

## 5. Sources

- n8n — Documentation officielle et licence : <https://docs.n8n.io/>, <https://docs.n8n.io/sustainable-use-license/>
- Make : <https://www.make.com/> · Zapier : <https://zapier.com/> · Node-RED : <https://nodered.org/>
- Keycloak — Documentation serveur et API d'administration : <https://www.keycloak.org/documentation>
- Authentik — Licences et édition Enterprise : <https://docs.goauthentik.io/enterprise/>, <https://github.com/goauthentik/authentik/discussions/18682>
- Zitadel — Passage à l'AGPL 3.0 : <https://zitadel.com/blog/apache-to-agpl>, <https://zitadel.com/license-faq>
- IETF — SCIM 2.0 : RFC 7643 et RFC 7644 · Problem Details for HTTP APIs : RFC 9457
- NIST SP 800-53 Rev. 5, contrôles AC-2 et AC-6 : <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>
- OWASP Application Security Verification Standard : <https://owasp.org/www-project-application-security-verification-standard/>
