import { csvCell } from './audit.service';

describe('csvCell', () => {
  it('neutralise les formules (injection CSV)', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33 6 00')).toBe("'+33 6 00");
  });

  it('échappe les séparateurs et guillemets', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "bonjour"')).toBe('"dit ""bonjour"""');
  });

  it('laisse les valeurs simples intactes', () => {
    expect(csvCell('onboarding.requested')).toBe('onboarding.requested');
  });
});
