import { AppRole } from '../../common/enums';
import { claimsToUser } from './token-verifier.service';

describe('claimsToUser', () => {
  it('ne conserve que les rôles applicatifs tp-*', () => {
    const user = claimsToUser(
      {
        sub: 'abc',
        preferred_username: 'rh.manager',
        name: 'Hanta Rasoa',
        realm_access: { roles: ['tp-hr', 'offline_access', 'default-roles-tongapass'] },
        resource_access: { 'tongapass-api': { roles: ['tp-auditor'] }, account: { roles: ['manage-account'] } },
      },
      'tongapass-api',
    );
    expect(user).toEqual({
      sub: 'abc',
      username: 'rh.manager',
      name: 'Hanta Rasoa',
      email: undefined,
      roles: [AppRole.HR, AppRole.AUDITOR],
    });
  });

  it('retourne une liste vide sans rôle', () => {
    expect(claimsToUser({ sub: 'x' }, 'tongapass-api').roles).toEqual([]);
  });
});
