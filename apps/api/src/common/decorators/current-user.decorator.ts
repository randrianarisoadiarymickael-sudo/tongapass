import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ActorType } from '../enums';
import { ActorContext, AuthenticatedUser } from '../types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>().user,
);

/** Construit le contexte d'audit (qui, d'où) à partir de la requête courante. */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
  const user = req.user;
  return {
    type: ActorType.USER,
    id: user?.sub ?? 'anonymous',
    name: user?.name || user?.username || 'anonyme',
    ip: req.ip ?? null,
    userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 255) || null,
  };
});
