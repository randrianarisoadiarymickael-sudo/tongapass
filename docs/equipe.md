# L'équipe TongaPass

> Remplacez les noms ci-dessous par ceux des membres de l'équipe (4 à 5 étudiants, L3 ESTI).

| Rôle | Membre | Responsabilités principales | Livrables portés |
|---|---|---|---|
| Chef de projet | *Prénom Nom* | Backlog, planning des 50 h, coordination, soutenance | Planning, démonstration, présentation |
| Développement back-end | *Prénom Nom* | API NestJS, modèle de données, audit, tests e2e | `apps/api`, OpenAPI |
| Développement front-end et UX | *Prénom Nom* | Portail React, design system, accessibilité | `apps/portal`, charte graphique |
| Infrastructure, automatisation et DevOps | *Prénom Nom* | Docker Compose, Keycloak, n8n, CI/CD | `infra/`, `automation/`, `.github/` |
| Sécurité, documentation et communication | *Prénom Nom* | Moindre privilège, scans, veille, article, vidéo, communauté | `docs/` |

## Répartition des 50 heures

| Phase | Heures | Contenu | Responsable |
|---|---|---|---|
| Veille et cadrage | 6 h | Comparaison des outils, architecture, backlog, rôles | Chef de projet + sécurité |
| Mise en place | 8 h | Dépôt, Docker Compose, royaume Keycloak, CI de base | DevOps |
| Développement du MVP | 22 h | API, portail, workflows n8n, IAM au moindre privilège | Back, front, DevOps |
| Tests, sécurité, documentation | 6 h | Tests unitaires et e2e, Gitleaks et Trivy, README, OpenAPI | Back + sécurité |
| Publication, branding, communauté | 5 h | Article, vidéo, logo, contribution externe | Communication |
| Soutenance et démonstration | 3 h | Répétition, script vidéo, questions/réponses | Toute l'équipe |

## Matrice RACI

R = réalise · A = approuve · C = consulté · I = informé

| Activité | Chef de projet | Back | Front | DevOps | Sécurité/Com |
|---|---|---|---|---|---|
| Architecture | A | R | C | R | C |
| Royaume Keycloak et moindre privilège | I | C | I | R | A |
| Workflows n8n | I | C | I | R | C |
| API et audit | I | R | C | C | A |
| Portail et accessibilité | I | C | R | I | C |
| CI/CD DevSecOps | I | C | C | R | A |
| Veille, article, vidéo | A | C | C | C | R |

## Méthode

- Itérations courtes (*sprints* de 2 à 3 jours), tableau Kanban (À faire, En cours, En revue, Terminé).
- Branches `feat/…` et `fix/…`, *pull requests* relues par au moins un membre, CI verte obligatoire.
- Messages de commit conventionnels (`feat:`, `fix:`, `docs:`, `test:`, `ci:`).
