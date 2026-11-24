import { safeEqual, signPayload, verifySignature } from './hmac.util';

describe('hmac.util', () => {
  const secret = 'un-secret-de-test-suffisamment-long-0123456789';
  const body = JSON.stringify({ runId: 'abc', event: 'step' });
  const now = 1_763_424_000_000;
  const ts = String(Math.floor(now / 1000));

  it('produit une signature préfixée sha256=', () => {
    expect(signPayload(secret, ts, body)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('accepte une signature valide', () => {
    const signature = signPayload(secret, ts, body);
    expect(verifySignature(secret, ts, signature, body, 300, now)).toEqual({ valid: true });
  });

  it('refuse un corps modifié', () => {
    const signature = signPayload(secret, ts, body);
    expect(verifySignature(secret, ts, signature, body.replace('abc', 'abd'), 300, now).reason).toBe('mismatch');
  });

  it('refuse un horodatage hors fenêtre (rejeu)', () => {
    const old = String(Math.floor(now / 1000) - 600);
    const signature = signPayload(secret, old, body);
    expect(verifySignature(secret, old, signature, body, 300, now).reason).toBe('expired');
  });

  it('refuse les en-têtes manquants', () => {
    expect(verifySignature(secret, undefined, undefined, body).reason).toBe('missing');
  });

  it('compare à temps constant y compris pour des longueurs différentes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
