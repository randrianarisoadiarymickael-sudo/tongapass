import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_AUTOMATION_KEY } from '../decorators/automation.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppRole } from '../enums';
import { AuthenticatedUser } from '../types';

/**
 * Contrôle d'accès par rôle. Sans @Roles explicite, l'utilisateur doit au moins
 * posséder un rôle TongaPass : un salarié fraîchement intégré n'accède pas au portail RH.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTOMATION_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user || user.roles.length === 0) {
      throw new ForbiddenException("Votre compte n'a aucun rôle TongaPass");
    }
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;
    if (user.roles.includes(AppRole.ADMIN) || required.some((role) => user.roles.includes(role))) {
      return true;
    }
    throw new ForbiddenException(`Action réservée aux rôles : ${required.join(', ')}`);
  }
}
