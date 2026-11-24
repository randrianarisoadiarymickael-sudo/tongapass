# Rapport de vérification

Vérifications effectuées du 18 au 21 novembre 2026 sur Windows 11, Docker Desktop, Node.js 24 et Microsoft Edge (Playwright). La section 6 couvre le portail café crème.

## 1. Versions réellement exécutées

| Composant | Version |
|---|---|
| Keycloak | 26.8.2 |
| n8n | 2.48.5 |
| Mattermost Team Edition | 12.1.0 |
| Gitea | rootless, dernière image stable |
| Mailpit | 1.34 |
| PostgreSQL | 17 (Alpine) |
| NestJS / TypeORM / TypeScript | 12.5 / 1.1 / 6.0 |
| React / React Router / Vite / Tailwind | 19.3 / 8.5 / 8.3 / 4.3 |

## 2. Résultats

| Vérification | Résultat |
|---|---|
| API : typage strict, ESLint | Réussi : aucune erreur |
| API : tests unitaires (Jest) | Réussi : 43/43 |
| API : tests de bout en bout sur PostgreSQL réel | Réussi : 41/41 |
| Portail : typage, ESLint, tests (Vitest) | Réussi : 7/7, aucune erreur |
| Portail : build de production | Réussi |
| `npm audit --omit=dev` (API et portail) | Réussi : 0 vulnérabilité |
| Workflows n8n : génération, syntaxe JS, connexions | Réussi : 4 workflows (rappel 4, arrivée 18, mobilité 18, départ 17 nœuds) |
| n8n réel : import des credentials et workflows, publication | Réussi |
| n8n réel : webhook sans jeton ou avec un mauvais jeton | Réussi : refusé (403) |
| Keycloak réel : import du royaume avec placeholders | Réussi |
| Keycloak réel : compte de service, lecture des utilisateurs | Réussi : 200 |
| Keycloak réel : compte de service, modification du royaume | Réussi : refusée (403), moindre privilège |
| Keycloak réel : compte de service d'audit `tongapass-auditor` créé par le bootstrap, lecture seule | Réussi |
| Bootstrap : profil utilisateur Keycloak, organisation et équipes Gitea, équipe et canaux Mattermost, propriétaire n8n | Réussi : idempotent |
| Parcours navigateur avec doublures (suite exécutée en CI) : rôles, arrivée, mobilité, départ, historique, arrivée planifiée puis annulée, URL, clavier, animations réduites, axe-core | Réussi : 12/12 |
| Recette sur la pile Docker réelle : arrivée, mobilité, écart de droits détecté, départ, audit, intégrations, accessibilité (clair et sombre) | Réussi : 9/9 |
| axe-core WCAG 2.2 A/AA : accueil et 8 pages, thèmes clair et sombre | Réussi : 0 violation grave ou critique |
| Aucun secret du `.env` dans les fichiers versionnables | Réussi |

## 3. Problèmes trouvés pendant la vérification, et corrections

| Constat | Cause | Correction |
|---|---|---|
| L'API d'administration Keycloak refuse le compte de service (401) | Keycloak 26.8 exige l'audience de l'API d'administration | Scope client `kc-admin-api` ajouté au client `tongapass-provisioner` |
| Publication n8n refusée | n8n 2.x : un sous-workflow doit être publié avant ses appelants ; `update:workflow` n'existe plus | Ordre de publication avec `publish:workflow` dans `entrypoint.sh` |
| `crypto` indisponible dans le nœud Code | Bac à sable des *task runners* n8n | `NODE_FUNCTION_ALLOW_BUILTIN=crypto` et `require('crypto')` |
| Création des équipes Gitea refusée (400) | `units` et `units_map` ne peuvent pas être envoyés ensemble | `units_map` seul |
| Sonde Gitea en 403 | `REQUIRE_SIGNIN_VIEW` protège `/api/v1/version` | Sonde sur `/api/healthz` |
| Sonde Mailpit trop lente | Vérification de version vers Internet | `MP_DISABLE_VERSION_CHECK=true`, sonde `/readyz` |
| Healthcheck Mattermost en échec | Image *distroless* (ni `sh` ni `curl`) | `mmctl --local system status` |
| Portail bloqué au chargement | CSP trop stricte pour la vérification SSO par iframe, puis délai d'iframe dépassé sous forte charge | Vérification SSO par redirection (sans iframe), CSP `frame-ancestors 'none'` |
| Jeton falsifié : erreur 500 | Exception du vérificateur non convertie | La garde convertit toute erreur de vérification en 401 |
| Tableau de bord : requête des départs en erreur | TypeORM 1.x et `take()` avec une expression `COALESCE` | `limit()` (jointure plusieurs-à-un) |
| Message Gitea trompeur au départ | Gitea renvoie 204 même pour un non-membre | Vérification de l'appartenance avant retrait |
| E-mails de notification Mattermost en rafale | Mentions de l'annonce de bienvenue | `MM_EMAILSETTINGS_SENDEMAILNOTIFICATIONS=false` |
| axe : contraste insuffisant des en-têtes du tableau des mouvements | Texte blanc à 45 % sur fond sombre | 70 % (contraste ≈ 9:1) |
| axe : contrôles interactifs imbriqués dans le graphique | SVG `role="img"` contenant des zones focalisables | `role="group"` |
| Clavier : la 1re tabulation sautait le lien d'évitement | Focus déplacé sur le contenu dès le chargement | Focus déplacé uniquement après une navigation |
| Page Keycloak : marque peu lisible, double liseré, double « œil » | Styles du thème parent PatternFly et bouton natif d'Edge | Surcharges CSS du thème `tongapass` |
| Agenda : les arrivées de la veille apparaissaient comme « aujourd'hui » entre 0 h et 3 h | `CURRENT_DATE` calculé en UTC par PostgreSQL | Sessions de l'API dans le fuseau de l'entreprise (`COMPANY_TIMEZONE`) |
| Mobilité : droit sensible listé deux fois (rôle `devops` et équipe `devops`) | Valeurs identiques dans deux systèmes | Dédoublonnage de `sensitiveAdded` |
| axe : barre de répartition de conformité sans alternative textuelle quand aucun contrôle n'existe | Libellé vide | Libellé « Aucun contrôle enregistré » |
| axe : initiales des avatars peu contrastées en thème sombre | Teinte du profil trop présente sur fond sombre | Texte mêlant teinte et encre à parts égales |
| Recette : un test croyait l'exécution terminée trop tôt | Le libellé « Terminée » du résumé ressemblait au statut | Libellés « Début » et « Fin » |

## 4. Recette sur la pile réelle (`npm run test:stack`)

Le scénario `stack/full-stack.spec.ts` :

1. Se connecte en `rh.manager` sur la vraie page Keycloak.
2. Déclare une arrivée sur le profil *Développement back-end* et attend l'état « Terminée ».
3. Vérifie dans **Keycloak** : compte actif, matricule en attribut, rôles `employee` et `developer` (pas encore `devops`), **aucun rôle `tp-*`**, groupe `Engineering`.
4. Vérifie dans **Gitea** (compte), **Mattermost** (compte actif) et **Mailpit** (e-mail de bienvenue sur l'adresse personnelle et lien d'activation Keycloak sur l'adresse professionnelle).
5. Applique une **mobilité** vers *Ingénierie DevOps* après lecture de l'écart, puis vérifie dans Keycloak le rôle `devops` et dans Gitea l'appartenance à l'équipe `devops`.
6. En **admin.it**, vérifie la conformité (conforme), ajoute le rôle `finance` **directement dans Keycloak**, puis vérifie à nouveau : l'écart « rôles en trop : finance » est détecté sur la fiche et par le contrôle global. Le rôle est retiré en fin de test.
7. Déclare le départ immédiat (confirmation par l'identifiant).
8. Vérifie : compte Keycloak désactivé et sans rôle, Gitea bloqué, Mattermost désactivé, récapitulatif envoyé au manager et aux RH.

Le scénario `stack/accessibility.spec.ts` audite les 8 pages du portail avec **axe-core** (WCAG 2.2 A/AA), en thème clair et sombre, sur le build de production servi par nginx avec la CSP active.

## 5. Campagne du 21 novembre 2026 : charte « Lagon de verre »

Vérifications faites après la refonte visuelle (verre dépoli, aurore animée, logo « le Seuil », pictogrammes originaux, pouls et fil d'activité temps réel, nouvel accueil).

| Vérification | Résultat |
|---|---|
| Portail : typage strict (`tsc -b`), ESLint | Réussi : aucune erreur, aucun avertissement |
| Portail : tests unitaires (Vitest) | Réussi : 12/12 |
| Portail : build de production | Réussi |
| `npm audit` du portail après retrait de `lucide-react` et d'IBM Plex Sans | Réussi : 0 vulnérabilité |
| Workflows n8n régénérés (nouveau gabarit d'e-mail) : syntaxe JS et connexions | Réussi : 4 workflows (rappel 4, arrivée 18, mobilité 18, départ 17 nœuds) |
| Contrastes de la palette calculés sur le verre, y compris au centre d'un halo d'aurore (pire cas) | Réussi : texte courant ≥ 4,5:1 en clair et en sombre ; texte blanc ≥ 5,9:1 sur tout le dégradé du bouton principal |
| axe-core WCAG 2.2 A/AA sur l'accueil et 10 écrans du portail (données de démonstration), clair et sombre | Réussi : 0 violation grave ou critique sur les 22 combinaisons |
| Aucun défilement horizontal à 375 px (accueil et 10 écrans) | Réussi |

Problèmes trouvés pendant cette campagne, et corrections :

| Constat | Cause | Correction |
|---|---|---|
| Icône de loupe masquée dans les champs de recherche | Le flou d'arrière-plan du champ crée un calque peint au-dessus de l'icône | Flou retiré des champs (verre conservé), icône placée au premier plan |
| Barre supérieure plus large que l'écran sur téléphone (70 px) | Le bouton de recherche ne rétrécissait pas sous la largeur de son texte | `min-w-0` et texte tronqué ; actions de la fiche qui passent à la ligne |
| En-tête de jour du journal d'audit qui chevauche la première entrée | `overflow: hidden` faisait du tableau le conteneur de défilement de l'élément collant | `overflow: clip`, en-tête collé sous la barre flottante |
| axe : lignes de l'annuaire capturées en plein fondu (thème sombre) | Apparition en cascade jusqu'au 12e élément (0,56 s) | Cascade plafonnée au 6e élément : liste opaque en moins de 0,4 s |
| Étiquettes du schéma d'architecture qui chevauchent les blocs | Espacement trop étroit entre portail, API et n8n | Blocs écartés, étiquettes centrées dans les intervalles |
| Accueil plus large que l'écran sur téléphone (15 px) | Le halo décoratif derrière l'aperçu dépassait du bord | `overflow-x: clip` sur la page (la barre de navigation reste collante) |

### Suites de bout en bout relancées sur la nouvelle charte (21 novembre, soir)

Docker Desktop 29.7, Node.js 24.21, Microsoft Edge. La pile complète a été reconstruite (`docker compose up -d --build`) avec le portail « Lagon de verre ».

| Vérification | Résultat |
|---|---|
| API : typage strict, ESLint | Réussi : aucune erreur |
| API : tests unitaires (Jest) | Réussi : 43/43 |
| API : tests de bout en bout sur une base PostgreSQL vierge | Réussi : 41/41 |
| Portail : typage strict, ESLint | Réussi : aucune erreur |
| Parcours Playwright avec doublures sur une base vierge (comme en CI) : rôles, accessibilité clair et sombre, 375 px, clavier, animations réduites, cycle de vie, arrivée planifiée, brouillon, fil d'Ariane, recherche | Réussi : 15/15 (2,2 min) |
| Recette sur la pile Docker réelle : arrivée, mobilité, écart de droits détecté, départ, intégrité du journal, workflows n8n, axe-core clair et sombre | Réussi : 9/9 (1,5 min) |
| Captures de `docs/screenshots/` | Régénérées sur la pile réelle avec la nouvelle charte |

Problèmes trouvés en relançant ces suites, et corrections :

| Constat | Cause | Correction |
|---|---|---|
| Recette : audit axe-core en thème clair arrêté au délai de 6 min (12 min, recette entière en 21 min) | La trace Playwright enregistrait chaque mutation du portail (horloge, pouls SSE, aurore animée) pendant les analyses axe : une page passait de 1 s à plus d'une minute, puis l'archive de trace dépassait le délai à la fermeture | Trace désactivée pour l'audit d'accessibilité (la liste des violations suffit au diagnostic) : audit en 37 s, recette en 1,5 min |
| Parcours : le test « 375 px » échouait dès la connexion | L'aide de connexion attendait la navigation principale, repliée dans un tiroir sur téléphone depuis la refonte | Attente du menu du compte, présent dans la barre supérieure à toutes les largeurs |
| Parcours : le test du fil d'Ariane échouait sur une base vierge (« 0 employé ») | Il supposait un employé actif déjà présent ; le seul créé par la suite est parti à la fin du premier parcours | Le test crée sa propre arrivée planifiée et filtre l'annuaire sur « En arrivée » et sur son nom |
| Page de connexion Keycloak : bouton « Montrer le mot de passe » détaché du champ | Le champ gardait ses coins arrondis et sa bordure complète ; le bouton n'avait qu'une bordure partielle | Champ et bouton réunis en un seul bloc (coins arrondis aux extrémités, même bordure, anneau de focus commun) |

Pendant le diagnostic, axe signale un défaut de contraste sur des lignes de l'annuaire et des cartes de profils **s'il est lancé pendant le fondu d'apparition** ; il disparaît avec les animations réduites et après la pause de 400 à 500 ms prévue par les tests. Ce n'est pas un défaut de la palette.

## 6. Portail café crème, 21 novembre 2026

| Vérification | Résultat |
|---|---|
| Typage et lint de l’API et du portail, compilation de production | Réussis |
| Tests unitaires de l’API et du portail | 43 et 12 tests réussis |
| Tests d’intégration de l’API sur PostgreSQL isolé | 41 tests réussis, dont la pagination de deux exécutions à plusieurs étapes |
| Recette sur Docker avec Keycloak, n8n, Gitea, Mattermost et Mailpit | Arrivée, mobilité, contrôle des droits, départ et vérification du journal réussis |
| Audit axe-core | Aucune violation grave ou critique détectée sur l’accueil et sur huit écrans du portail en clair et en sombre |
| Téléphone de 375 px, animations réduites | Fiche d’exemple navigable au clavier, retour Keycloak vers l’assistant, validation des dates et filtres du tableau de bord vérifiés |

La recette de cycle de vie utilise un employé fictif. Son départ termine le parcours et son historique reste consultable dans la base de démonstration.

## 7. Portail lagon et suivi en direct, 21 novembre 2026

Dans Edge, un gestionnaire RH déclare une arrivée pendant qu’un second onglet affiche le tableau de bord. Le second onglet reçoit l’étape Keycloak et la fin de l’exécution sans rechargement. Les deux entrées du fil ouvrent la même exécution. Le test vérifie aussi qu’elle apparaît une seule fois comme « en cours » pendant les rappels successifs de n8n. [Capture du fil d’activité](screenshots/activite-en-direct.png)

La démonstration publique joue les trois étapes puis recommence automatiquement. Le test observe deux passages consécutifs, active la pause au clavier et vérifie que la lecture reprend. À 375 px, les flèches du clavier sélectionnent les trois mouvements. Avec la réduction des animations activée, chaque scénario présente directement son résultat. [Accueil sur ordinateur](screenshots/accueil.png) · [Accueil sur téléphone](screenshots/accueil-mobile.png)

Après correction du contraste des initiales du profil, axe-core ne détecte aucune violation grave ou critique sur l’accueil et sur les huit écrans authentifiés testés en clair et en sombre.
