import {
  normalizeNamePart,
  toTitleCase,
  USERNAME_MAX_LENGTH,
  usernameCandidates,
  withNumericSuffix,
  workEmailFor,
} from './identity.util';

describe('identity.util', () => {
  it('supprime accents, espaces et ponctuation', () => {
    expect(normalizeNamePart('Andrianasolo-Rakoto')).toBe('andrianasolorakoto');
    expect(normalizeNamePart("N'Diaye Éloïse")).toBe('ndiayeeloise');
  });

  it('propose prenom.nom en premier', () => {
    expect(usernameCandidates('Hanitra', 'Rakoto')[0]).toBe('hanitra.rakoto');
  });

  it('respecte la limite Mattermost de 22 caractères', () => {
    const candidates = usernameCandidates('Andriamanantena', 'Rakotonirinasoa');
    for (const candidate of candidates) {
      expect(candidate.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
      expect(candidate).toMatch(/^[a-z][a-z0-9._-]*[a-z0-9]$/);
    }
  });

  it('commence toujours par une lettre', () => {
    expect(usernameCandidates('2pac', 'Shakur')[0]).toMatch(/^[a-z]/);
  });

  it('ajoute un suffixe sans dépasser la longueur maximale', () => {
    const suffixed = withNumericSuffix('andriamanantena.rakoto', 12);
    expect(suffixed.endsWith('12')).toBe(true);
    expect(suffixed.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it("construit l'e-mail professionnel en minuscules", () => {
    expect(workEmailFor('Hanitra.Rakoto', 'TongaPass.local')).toBe('hanitra.rakoto@tongapass.local');
  });

  it('met les noms propres en forme', () => {
    expect(toTitleCase('  jean-luc   RAKOTO ')).toBe('Jean-Luc Rakoto');
    expect(toTitleCase("o'neil")).toBe("O'Neil");
  });
});
