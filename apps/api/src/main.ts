import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true, // nécessaire à la vérification HMAC des callbacks n8n
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  setupSwagger(app);

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`TongaPass API prête sur le port ${port} — documentation : /api/docs`);
}

void bootstrap();
