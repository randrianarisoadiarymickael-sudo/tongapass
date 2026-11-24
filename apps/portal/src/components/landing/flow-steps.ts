/** Version liste du même flux, pour les petits écrans (le schéma y serait illisible). */
export const FLOW_STEPS = [
  { title: 'Équipe RH', text: 'Déclare l’arrivée, la mobilité ou le départ dans le portail (connexion OIDC + PKCE).' },
  { title: 'API TongaPass', text: 'Valide, applique le profil d’accès, journalise et déclenche le workflow n8n.' },
  { title: 'n8n', text: 'Crée, ajuste ou révoque les accès dans Keycloak, Gitea, Mattermost et par e-mail.' },
  { title: 'Rappels signés', text: 'Chaque étape revient à l’API, signée HMAC-SHA256 : le portail s’actualise en direct.' },
];
