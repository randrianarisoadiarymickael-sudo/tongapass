/**
 * Configuration typée de l'application, construite à partir des variables
 * d'environnement déjà validées par `envValidationSchema`.
 */
export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  corsOrigins: string[];
  publicApiUrl: string;
  portalUrl: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    ssl: boolean;
    timezone: string;
  };
  keycloak: {
    issuer: string;
    jwksUri: string;
    audience: string;
    internalUrl: string;
    realm: string;
    auditorClientId: string;
    auditorSecret: string;
  };
  automation: {
    n8nBaseUrl: string;
    webhookToken: string;
    hmacSecret: string;
    callbackUrl: string;
    timeoutMinutes: number;
  };
  company: {
    name: string;
    emailDomain: string;
    /** Décalage horaire de l'entreprise (Antananarivo : +03:00). */
    timezoneOffset: string;
  };
  integrations: {
    giteaUrl: string;
    mattermostUrl: string;
    mailpitUrl: string;
  };
  publicLinks: {
    n8n: string;
    gitea: string;
    mattermost: string;
    mailpit: string;
    keycloak: string;
  };
  throttle: { ttlSeconds: number; limit: number };
}

const bool = (value: string | undefined): boolean => value === 'true' || value === '1';

export default (): AppConfig => {
  const env = process.env;
  return {
    env: (env.NODE_ENV as AppConfig['env']) ?? 'development',
    port: Number(env.PORT ?? 4100),
    logLevel: env.LOG_LEVEL ?? 'info',
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    publicApiUrl: env.PUBLIC_API_URL ?? 'http://localhost:4100',
    portalUrl: env.PORTAL_URL ?? 'http://localhost:8088',
    database: {
      host: env.DATABASE_HOST ?? 'localhost',
      port: Number(env.DATABASE_PORT ?? 5432),
      user: env.DATABASE_USER ?? '',
      password: env.DATABASE_PASSWORD ?? '',
      name: env.DATABASE_NAME ?? 'tongapass',
      ssl: bool(env.DATABASE_SSL),
      timezone: env.COMPANY_TIMEZONE ?? 'Indian/Antananarivo',
    },
    keycloak: {
      issuer: env.KEYCLOAK_ISSUER ?? '',
      jwksUri: env.KEYCLOAK_JWKS_URI ?? '',
      audience: env.KEYCLOAK_AUDIENCE ?? 'tongapass-api',
      internalUrl: env.KEYCLOAK_INTERNAL_URL ?? 'http://keycloak:8080',
      realm: env.KEYCLOAK_REALM ?? 'tongapass',
      auditorClientId: env.KEYCLOAK_AUDITOR_CLIENT_ID ?? 'tongapass-auditor',
      auditorSecret: env.KEYCLOAK_AUDITOR_SECRET ?? '',
    },
    automation: {
      n8nBaseUrl: env.N8N_BASE_URL ?? 'http://n8n:5678',
      webhookToken: env.N8N_WEBHOOK_TOKEN ?? '',
      hmacSecret: env.AUTOMATION_HMAC_SECRET ?? '',
      callbackUrl: env.AUTOMATION_CALLBACK_URL ?? 'http://api:4100/api/v1/automation/events',
      timeoutMinutes: Number(env.AUTOMATION_TIMEOUT_MINUTES ?? 15),
    },
    company: {
      name: env.COMPANY_NAME ?? 'TongaPass',
      emailDomain: env.COMPANY_EMAIL_DOMAIN ?? 'tongapass.local',
      timezoneOffset: env.COMPANY_TIMEZONE_OFFSET ?? '+03:00',
    },
    integrations: {
      giteaUrl: env.GITEA_URL ?? '',
      mattermostUrl: env.MATTERMOST_URL ?? '',
      mailpitUrl: env.MAILPIT_URL ?? '',
    },
    publicLinks: {
      n8n: env.N8N_PUBLIC_URL ?? '',
      gitea: env.GITEA_PUBLIC_URL ?? '',
      mattermost: env.MATTERMOST_PUBLIC_URL ?? '',
      mailpit: env.MAILPIT_PUBLIC_URL ?? '',
      keycloak: env.KEYCLOAK_PUBLIC_URL ?? '',
    },
    throttle: {
      ttlSeconds: Number(env.THROTTLE_TTL_SECONDS ?? 60),
      limit: Number(env.THROTTLE_LIMIT ?? 120),
    },
  };
};
