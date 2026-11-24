# Journal des versions

## En cours

- Accueil bleu nuit et lagon. Le parcours RH sélectionné et le schéma d’architecture tournent en boucle à l’écran, avec une commande de pause commune. Le tableau de bord et la barre supérieure réagissent aux événements du serveur.

### Refonte précédente

- Nouvelle charte café crème pour le portail, la connexion Keycloak et les e-mails. L’accueil présente une fiche d’accès interactive pour les trois mouvements RH.
- Titres en Instrument Serif, filtres utilisables au clavier et transitions courtes avec prise en compte des préférences de mouvement.
- Correction de la pagination des exécutions et des liens du tableau de bord. L’assistant vérifie les dates personnalisées avant de planifier l’arrivée.

## 1.2.0 — 2026-11-21

### Modifié
- **Nouvelle identité « Lagon de verre »** : surfaces en verre dépoli (flou d'arrière-plan) sur un fond d'aurore animé (halos lagon, indigo et ciel qui dérivent lentement), marque lagon et indigo, dégradé réservé à l'action principale. Contrastes AA recalculés sur le verre dans le pire cas.
- **Nouveau logo « le Seuil »** : porte en arche entrouverte, battant droit en verre, silhouette qui est aussi un trou de serrure. Favicon, logo, bannière et thème Keycloak mis à jour.
- **Pictogrammes originaux** : 55 icônes dessinées pour TongaPass (trait arrondi et aplat « verre ») remplacent la banque d'icônes Lucide, retirée des dépendances.
- Police **Plus Jakarta Sans** (interface et thème de connexion Keycloak) ; IBM Plex Mono conservée pour les identifiants.
- **Navigation** : barre latérale flottante repliable avec pilule active animée, barre supérieure flottante, menus et dialogues en verre renforcé.
- Tableau de bord : salutation, cartes indicateurs cliquables avec halo au survol, jauge de conformité animée, graphique en dégradé.
- Fiche employé : frise du cycle de vie et onglets en pilule ; exécutions : barre de progression à rayures pendant le direct.
- E-mails (bienvenue, mobilité, départ) aux couleurs de la nouvelle charte ; workflows n8n régénérés.
- Documentation sans émoji (rapport de vérification, doublures de test).

### Ajouté
- **Pouls temps réel** dans la barre supérieure : la ligne bat à chaque événement SSE reçu.
- **Fil d'activité en direct** (signaux n8n, exécutions, conformité) avec compteur de nouveautés.
- **Accueil refait** : barre de navigation en pilule, schéma d'architecture animé (portail, API, n8n, Keycloak, Gitea, Mattermost, SMTP), cycle de vie, sécurité, et correspondance point par point avec le livrable minimal du projet P03 et la grille d'évaluation.
- Captures de `docs/screenshots/` régénérées sur la pile réelle avec la nouvelle charte.

### Corrigé
- Page de connexion Keycloak : le champ mot de passe et le bouton « Montrer » forment un seul bloc (bordure et anneau de focus communs).
- Recette sur la pile réelle : l'audit d'accessibilité ne dépasse plus son délai (trace Playwright désactivée pour cet audit) ; recette complète en 1,5 min au lieu de 21.
- Parcours Playwright : connexion compatible avec la navigation en tiroir sur téléphone ; le test du fil d'Ariane crée ses propres données et passe sur une base vierge. Tests : 15 parcours avec doublures et 9 en recette réelle.

## 1.1.0 — 2026-11-19

### Ajouté
- **Mobilité interne** : aperçu de l'écart de droits (ajoutés, retirés, conservés), application immédiate ou planifiée, workflow n8n dédié (`tongapass/mobility`) qui synchronise Keycloak, Gitea et Mattermost, e-mail au manager.
- **Contrôle de conformité** : compte de service Keycloak `tongapass-auditor` en lecture seule, comparaison des droits réels et attendus, page Conformité, vérification depuis la fiche, contrôle automatique chaque nuit à 2 h.
- **Planification** : comptes créés la veille de l'arrivée par défaut (ou maintenant, ou à une date choisie), révocation programmée en fin de CDD ou de stage, exécutions planifiées avancées ou annulées depuis le portail, relance automatique des exécutions non transmises à n8n.
- Fiche employé à onglets : frise du cycle de vie, accès effectifs, comptes provisionnés, conformité, exécutions, historique d'audit de la personne.
- Annuaire : tri des colonnes, export CSV, actions rapides par ligne. Journal d'audit : filtre par période, entrées groupées par jour.
- Migration `ProfileColors` : nouvelle palette des profils d'accès, validée pour le daltonisme.

### Modifié
- **Nouvelle identité visuelle** « registre des accès » : vert ravinala, indigo, latérite et ocre ; IBM Plex Sans et Mono ; nouveau logo (badge d'accès et T-clé) ; fonds unis, cartes à liseré fin, plus de motifs ni de bandeaux décoratifs. Le style « aéroport » (volets *split-flap*, carte d'embarquement, tampons) est retiré.
- Thème de connexion Keycloak aligné sur la charte, police embarquée dans le thème.
- E-mails (bienvenue, mobilité, départ) : gabarit commun sobre, sans émoji.
- Les dates de l'API sont calculées dans le fuseau de l'entreprise (`COMPANY_TIMEZONE`).
- API : 36 routes ; tests : 43 unitaires et 41 e2e pour l'API, 12 parcours Playwright (doublures) et 9 en recette réelle.

## 1.0.0 — 2026-11-18

### Ajouté
- Portail RH : tableau des mouvements, assistant d'arrivée, départ immédiat ou planifié, annuaire, profils d'accès, journal d'audit, intégrations, palette de commandes, thèmes clair et sombre.
- API NestJS 12 : 22 routes OpenAPI, rôles Keycloak, rappels HMAC, idempotence, planificateur, chien de garde, relance, SSE, audit chaîné SHA-256 en ajout seul.
- Workflows n8n 2.48 « as code » : arrivée, départ, sous-workflow de rappel signé.
- Royaume Keycloak 26.8 importé (rôles, groupes, clients au moindre privilège, thème de connexion).
- Docker Compose (9 services), bootstrap idempotent de Gitea, Mattermost, Keycloak et n8n.
- Tests : 32 unitaires et 29 e2e pour l'API, Vitest pour le portail, Playwright et axe-core, recette sur la pile réelle.
- CI DevSecOps : lint, tests, build, Gitleaks, Trivy, npm audit, Dependabot.
