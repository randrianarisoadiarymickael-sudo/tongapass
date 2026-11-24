import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppConfig } from '../../config/configuration';
import { verifySignature } from '../utils/hmac.util';

export const SIGNATURE_HEADER = 'x-tongapass-signature';
export const TIMESTAMP_HEADER = 'x-tongapass-timestamp';

/**
 * Authentifie les appels de n8n : signature HMAC-SHA256 du corps brut
 * + horodatage (fenêtre de 5 minutes) pour bloquer la falsification et le rejeu.
 */
@Injectable()
export class HmacSignatureGuard implements CanActivate {
  private readonly logger = new Logger(HmacSignatureGuard.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const secret = this.config.get('automation', { infer: true }).hmacSecret;
    const raw = request.rawBody ? request.rawBody.toString('utf8') : JSON.stringify(request.body ?? {});
    const check = verifySignature(
      secret,
      request.header(TIMESTAMP_HEADER),
      request.header(SIGNATURE_HEADER),
      raw,
    );
    if (!check.valid) {
      this.logger.warn(`Callback d'automatisation refusé (${check.reason}) depuis ${request.ip}`);
      throw new UnauthorizedException('Signature d’automatisation invalide');
    }
    return true;
  }
}
