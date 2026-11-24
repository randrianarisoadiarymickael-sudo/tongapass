import * as Joi from 'joi';

/**
 * Schéma de validation des variables d'environnement.
 * L'application refuse de démarrer si une variable obligatoire manque ou est trop faible :
 * c'est la première barrière contre les déploiements mal configurés.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4100),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:8088'),
  PUBLIC_API_URL: Joi.string().uri().default('http://localhost:4100'),
  PORTAL_URL: Joi.string().uri().default('http://localhost:8088'),

  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().default('tongapass'),
  DATABASE_SSL: Joi.boolean().default(false),

  KEYCLOAK_ISSUER: Joi.string().uri().required(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().required(),
  KEYCLOAK_AUDIENCE: Joi.string().default('tongapass-api'),
  KEYCLOAK_INTERNAL_URL: Joi.string().uri().default('http://keycloak:8080'),
  KEYCLOAK_REALM: Joi.string().default('tongapass'),
  KEYCLOAK_AUDITOR_CLIENT_ID: Joi.string().default('tongapass-auditor'),
  KEYCLOAK_AUDITOR_SECRET: Joi.string().allow('').default(''),

  N8N_BASE_URL: Joi.string().uri().default('http://n8n:5678'),
  N8N_WEBHOOK_TOKEN: Joi.string().min(24).required(),
  AUTOMATION_HMAC_SECRET: Joi.string().min(32).required(),
  AUTOMATION_CALLBACK_URL: Joi.string().uri().default('http://api:4100/api/v1/automation/events'),
  AUTOMATION_TIMEOUT_MINUTES: Joi.number().integer().min(1).default(15),

  COMPANY_NAME: Joi.string().default('TongaPass'),
  COMPANY_EMAIL_DOMAIN: Joi.string().hostname().default('tongapass.local'),
  COMPANY_TIMEZONE_OFFSET: Joi.string().pattern(/^[+-]\d{2}:\d{2}$/).default('+03:00'),
  COMPANY_TIMEZONE: Joi.string()
    .pattern(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/)
    .default('Indian/Antananarivo'),

  GITEA_URL: Joi.string().uri().allow('').default(''),
  MATTERMOST_URL: Joi.string().uri().allow('').default(''),
  MAILPIT_URL: Joi.string().uri().allow('').default(''),
  N8N_PUBLIC_URL: Joi.string().uri().allow('').default(''),
  GITEA_PUBLIC_URL: Joi.string().uri().allow('').default(''),
  MATTERMOST_PUBLIC_URL: Joi.string().uri().allow('').default(''),
  MAILPIT_PUBLIC_URL: Joi.string().uri().allow('').default(''),
  KEYCLOAK_PUBLIC_URL: Joi.string().uri().allow('').default(''),

  THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
});

/**
 * Valide et normalise l'environnement au démarrage (toutes les erreurs d'un coup).
 * Lève une erreur explicite plutôt que de démarrer avec une configuration incomplète.
 */
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (error) {
    const details = error.details.map((detail) => `  - ${detail.message}`).join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  return value as Record<string, unknown>;
}
