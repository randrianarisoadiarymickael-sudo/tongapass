# Contribuer à TongaPass

1. Créez une branche : `feat/…`, `fix/…`, `docs/…`.
2. Installez et vérifiez localement :
   ```bash
   cd apps/api && npm ci && npm run lint && npm test && npm run test:e2e
   cd ../portal && npm ci && npm run lint && npm run typecheck && npm test
   node ../../automation/n8n/build-workflows.mjs
   ```
3. Modifiez les workflows n8n **dans `automation/n8n/code/*.js`**, jamais dans les JSON générés.
4. Toute nouvelle route d'API : décorateurs Swagger, DTO validé, contrôle de rôle explicite, test e2e.
5. Toute nouvelle action qui accorde ou retire un droit : entrée dans le journal d'audit.
6. Messages de commit conventionnels (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `refactor:`).
7. Ouvrez une *pull request* : la CI (tests, Gitleaks, Trivy) doit être verte et un membre de l'équipe doit l'approuver.
