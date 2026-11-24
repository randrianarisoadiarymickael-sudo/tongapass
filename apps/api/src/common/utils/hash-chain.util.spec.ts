import { canonicalJson, computeAuditHash, GENESIS_HASH, HashableAuditEntry } from './hash-chain.util';

const entry = (overrides: Partial<HashableAuditEntry> = {}): HashableAuditEntry => ({
  occurredAt: new Date('2026-11-18T08:00:00.000Z'),
  actorType: 'USER',
  actorId: 'u-1',
  actorName: 'Hanta RH',
  action: 'onboarding.requested',
  targetType: 'employee',
  targetId: 'e-1',
  targetLabel: 'Hanitra Rakoto',
  summary: 'Arrivée demandée',
  metadata: { b: 2, a: [1, { d: 4, c: 3 }] },
  ip: '10.0.0.1',
  ...overrides,
});

describe('hash-chain.util', () => {
  it("produit un JSON canonique indépendant de l'ordre des clés", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('est déterministe', () => {
    expect(computeAuditHash(GENESIS_HASH, entry())).toBe(computeAuditHash(GENESIS_HASH, entry()));
  });

  it('change si une donnée change', () => {
    const original = computeAuditHash(GENESIS_HASH, entry());
    expect(computeAuditHash(GENESIS_HASH, entry({ summary: 'Arrivée annulée' }))).not.toBe(original);
    expect(computeAuditHash(GENESIS_HASH, entry({ metadata: { b: 3 } }))).not.toBe(original);
  });

  it('dépend du hash précédent (chaînage)', () => {
    const first = computeAuditHash(GENESIS_HASH, entry());
    expect(computeAuditHash(first, entry())).not.toBe(first);
  });
});
