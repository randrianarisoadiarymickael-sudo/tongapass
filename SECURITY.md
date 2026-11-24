# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique**. Écrivez à l'équipe (adresse indiquée dans `docs/equipe.md`) en précisant :

- la version ou le commit concerné ;
- les étapes de reproduction et l'impact estimé ;
- si possible, une proposition de correctif.

Nous accusons réception sous 72 h et publions un correctif ou une mitigation dès que possible.

## Périmètre

API (`apps/api`), portail (`apps/portal`), workflows n8n (`automation/n8n`), configuration Keycloak et Docker (`infra/`, `docker-compose.yml`).
Les doublures de `tools/dev-stubs/` sont des outils de test : elles sont hors périmètre et ne doivent jamais être déployées.

## Bonnes pratiques attendues

- Ne jamais versionner `.env` ni aucun secret (Gitleaks bloque la CI).
- Régénérer les secrets (`node scripts/init-env.mjs --force`) avant toute démonstration publique.
