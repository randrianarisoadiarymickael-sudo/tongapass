/** Configuration publique du portail (injectée au build par Vite). */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  keycloak: {
    url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8180',
    realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'tongapass',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'tongapass-portal',
  },
} as const;
