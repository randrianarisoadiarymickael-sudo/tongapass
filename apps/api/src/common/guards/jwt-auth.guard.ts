import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TOKEN_VERIFIER, type TokenVerifier } from '../../modules/auth/token-verifier.service';
import { IS_AUTOMATION_KEY } from '../decorators/automation.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types';

/** Garde globale : toute route exige un jeton Bearer Keycloak valide, sauf @Public / @AutomationOnly. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTOMATION_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Authentification requise');
    }
    try {
      request.user = await this.verifier.verify(token);
    } catch (error) {
      // Toute erreur de vérification se traduit par un 401, jamais par une erreur 500.
      if (error instanceof HttpException) throw error;
      throw new UnauthorizedException('Jeton invalide');
    }
    return true;
  }
}
