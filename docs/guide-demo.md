# Guide de démonstration et script vidéo (5 min)

## Préparation (avant d'enregistrer)

```bash
node scripts/init-env.mjs          # noter le mot de passe de démonstration affiché
docker compose up -d --build
docker compose ps                  # 8 services actifs, bootstrap terminé avec le code 0
```

Ouvrez dans des onglets : portail `http://localhost:8088`, Mailpit `http://localhost:8025`, Keycloak `http://localhost:8180/admin`, Gitea `http://localhost:3300`, Mattermost `http://localhost:8065`, n8n `http://localhost:5678`.

Affichage conseillé : navigateur à 110 %, thème clair, notifications système coupées.

## Script

| Temps | À l'écran | Voix off (proposition) |
|---|---|---|
| 0:00–0:20 | Accueil TongaPass. Suivre l’exemple d’Arrivée, puis sélectionner Mobilité et Départ | « Quand un salarié arrive, il lui faut des comptes. Quand il change de poste, ses droits doivent suivre. Quand il part, il faut tout lui retirer. TongaPass automatise ces trois moments avec n8n et Keycloak. *Tonga*, en malgache, veut dire *arriver*. » |
| 0:20–0:35 | Connexion Keycloak (page à la charte) en **rh.manager** | « Connexion unique OIDC avec PKCE : le portail ne voit jamais le mot de passe. » |
| 0:35–0:55 | Vue d'ensemble : indicateurs, jauge de conformité, agenda et dernier événement reçu | « La vue d'ensemble montre les mouvements à venir, les exécutions à traiter, les fins de contrat et l'état de conformité des comptes. Le fil d’activité permet de retrouver les derniers événements reçus de n8n. » |
| 0:55–1:35 | Assistant : Hanitra Rakoto, *Développement back-end*, étape Vérification, calendrier | « L'identifiant et l'adresse professionnelle sont générés. Le profil donne le minimum nécessaire. Par défaut, les comptes sont créés la veille de l'arrivée ; pour la démonstration, je les crée maintenant. » |
| 1:35–2:05 | Frise qui se valide étape par étape, puis ouverture du **fil d'activité en direct** | « n8n crée le compte Keycloak, attribue rôles et groupes, ouvre Gitea et Mattermost, puis envoie l'e-mail de bienvenue. Chaque étape est confirmée par un rappel signé, et apparaît aussitôt dans le fil d'activité. » |
| 2:05–2:30 | n8n (canvas), Keycloak (rôles), Mailpit (lien d'activation) | « Voici le workflow n8n, et le résultat réel. Aucun mot de passe par e-mail : un lien d'activation Keycloak valable 48 heures. » |
| 2:30–3:10 | Fiche, *Changer de poste* vers *Ingénierie DevOps* : écart affiché, puis appliqué | « Hanitra devient DevOps. Avant de valider, je vois exactement ce qui change : un rôle, une équipe Gitea, un canal. Rien d'autre n'est touché, et le compte est conservé. » |
| 3:10–3:40 | Console Keycloak : ajout manuel du rôle `finance` ; fiche : *Vérifier* → écart détecté | « Et si quelqu'un ajoute un droit à la main dans Keycloak ? Le contrôle de conformité, en lecture seule, le détecte : chaque nuit, ou à la demande. » |
| 3:40–4:15 | *Plus d'actions → Déclarer le départ*, recopie de l'identifiant, révocation | « Au départ, il faut recopier l'identifiant pour éviter toute erreur. Compte désactivé, sessions coupées, rôles retirés, Gitea et Mattermost bloqués, manager prévenu. » |
| 4:15–4:45 | Connexion **auditeur** : *Conformité*, puis *Journal d'audit → Vérifier l'intégrité* | « L'auditeur ne peut rien modifier. Le journal est chaîné par SHA-256 et protégé en base : la moindre altération serait détectée. » |
| 4:45–5:00 | README, CI, logo | « Code ouvert, Docker Compose, OpenAPI, CI DevSecOps. Merci. » |

## Questions fréquentes en soutenance

- **Que se passe-t-il si Gitea est en panne pendant une arrivée ?** L'étape passe en échec, l'exécution est `PARTIAL`, le tableau de bord signale « 1 workflow à traiter ». La relance rejoue le workflow sans doublon : les comptes existants sont reconnus.
- **Et si n8n ne répond plus ?** Le déclenchement est réessayé 3 fois. Après le délai prévu, le chien de garde passe l'exécution en `TIMED_OUT`, et la relance est possible.
- **Comment éviter qu'un profil donne des droits d'administrateur ?** Il y a trois verrous : le catalogue fermé de l'API, la liste blanche dans n8n et le compte de service Keycloak, qui n'a pas le droit d'administrer le royaume.
- **Pourquoi l'API et pas tout dans n8n ?** Pour avoir une source de vérité transactionnelle, l'audit, l'idempotence et le suivi en temps réel.
- **Pourquoi un workflow de mobilité plutôt qu'un départ suivi d'une arrivée ?** Pour conserver le compte, l'historique Git et les conversations, et ne toucher qu'aux droits qui changent.
- **Le contrôle de conformité peut-il corriger un écart tout seul ?** Non, volontairement : il utilise un compte en lecture seule. La correction reste une décision humaine (relancer une mobilité ou retirer le droit), elle-même tracée.
- **Que se passe-t-il à la fin d'un CDD ?** Si la case est cochée à l'arrivée, la révocation est planifiée pour le dernier jour à 18 h. Elle apparaît dans l'agenda et reste annulable en cas de renouvellement.
