import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from '../enums';
import { AuthenticatedUser } from '../types';
import { RolesGuard } from './roles.guard';

function contextFor(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const user = (roles: AppRole[]): AuthenticatedUser => ({ sub: 's', username: 'u', roles });
const requireRoles = (reflector: Reflector, roles: AppRole[] | undefined) =>
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: unknown) => (key === 'roles' ? roles : undefined));

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('refuse un utilisateur sans aucun rôle TongaPass', () => {
    requireRoles(reflector, undefined);
    expect(() => guard.canActivate(contextFor(user([])))).toThrow(ForbiddenException);
  });

  it('autorise un utilisateur avec un rôle quand aucun rôle précis n’est exigé', () => {
    requireRoles(reflector, undefined);
    expect(guard.canActivate(contextFor(user([AppRole.AUDITOR])))).toBe(true);
  });

  it('autorise un rôle listé', () => {
    requireRoles(reflector, [AppRole.HR]);
    expect(guard.canActivate(contextFor(user([AppRole.HR])))).toBe(true);
  });

  it('refuse un rôle non listé (auditeur sur une action RH)', () => {
    requireRoles(reflector, [AppRole.HR]);
    expect(() => guard.canActivate(contextFor(user([AppRole.AUDITOR])))).toThrow(ForbiddenException);
  });

  it("autorise toujours l'administrateur", () => {
    requireRoles(reflector, [AppRole.AUDITOR]);
    expect(guard.canActivate(contextFor(user([AppRole.ADMIN])))).toBe(true);
  });
});
