import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { FieldError } from './common/filters/problem-details.filter';
import { AppConfig } from './config/configuration';

export const API_PREFIX = 'api/v1';

function flattenErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flattenErrors(error.children ?? [], field)];
  });
}

/** Configuration HTTP commune à l'exécution et aux tests de bout en bout. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<AppConfig, true>);

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id', 'Last-Event-ID'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Certains champs sont invalides',
          errors: flattenErrors(errors),
        }),
    }),
  );
  app.enableShutdownHooks();
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('TongaPass API')
    .setDescription(
      [
        'API d’orchestration des **arrivées et départs** des employés.',
        '',
        '- Authentification : jeton **Bearer OIDC** émis par Keycloak (royaume `tongapass`, audience `tongapass-api`).',
        '- Autorisations : rôles `tp-admin`, `tp-hr`, `tp-auditor` (moindre privilège).',
        '- Automatisation : n8n appelle `POST /automation/events` avec une signature **HMAC-SHA256**.',
        '- Erreurs : format **RFC 9457** `application/problem+json`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setContact('Équipe TongaPass', 'https://github.com/tongapass/tongapass', 'equipe@tongapass.local')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addServer('/', 'Serveur courant')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    customSiteTitle: 'TongaPass API — documentation',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha' },
  });
}
