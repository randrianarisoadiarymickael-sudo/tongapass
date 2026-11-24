import { diffAccess, effectiveAccess } from './access-diff';

const developer = { realmRoles: ['employee', 'developer'], groups: ['Engineering'], giteaTeams: ['developers'], chatChannels: ['town-square', 'engineering'] };
const devops = { realmRoles: ['employee', 'developer', 'devops'], groups: ['Engineering'], giteaTeams: ['developers', 'devops'], chatChannels: ['town-square', 'engineering', 'incidents'] };
const support = { realmRoles: ['employee', 'support'], groups: ['Support'], giteaTeams: ['readers'], chatChannels: ['support'] };

describe('effectiveAccess', () => {
  it('ajoute les rôles supplémentaires sans doublon', () => {
    expect(effectiveAccess(developer, ['developer', 'devops']).realmRoles).toEqual(['employee', 'developer', 'devops']);
  });
});

describe('diffAccess', () => {
  it('ne retire rien lors d’une promotion qui étend les droits', () => {
    const diff = diffAccess(developer, devops);
    expect(diff.added).toEqual({ realmRoles: ['devops'], groups: [], giteaTeams: ['devops'], chatChannels: ['incidents'] });
    expect(diff.removed).toEqual({ realmRoles: [], groups: [], giteaTeams: [], chatChannels: [] });
    expect(diff.changed).toBe(true);
  });

  it('retire les droits devenus inutiles lors d’un changement de métier', () => {
    const diff = diffAccess(devops, support);
    expect(diff.removed.realmRoles).toEqual(['developer', 'devops']);
    expect(diff.removed.giteaTeams).toEqual(['developers', 'devops']);
    expect(diff.added.groups).toEqual(['Support']);
  });

  it('ne retire jamais le rôle socle ni le canal général', () => {
    const diff = diffAccess(developer, { realmRoles: [], groups: [], giteaTeams: [], chatChannels: [] });
    expect(diff.removed.realmRoles).not.toContain('employee');
    expect(diff.removed.chatChannels).not.toContain('town-square');
  });

  it('signale l’absence de changement', () => {
    expect(diffAccess(developer, developer).changed).toBe(false);
  });
});
