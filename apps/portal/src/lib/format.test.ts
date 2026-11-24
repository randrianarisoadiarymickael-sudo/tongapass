import { describe, expect, it } from 'vitest';
import { formatDuration, formatRelative, initials } from './format';

describe('format', () => {
  it('formate les durées en français', () => {
    expect(formatDuration(42)).toBe('42\u00a0s');
    expect(formatDuration(74)).toBe('1\u00a0min 14\u00a0s');
    expect(formatDuration(3600 + 120)).toBe('1\u00a0h 2\u00a0min');
    expect(formatDuration(null)).toBe('—');
  });

  it('produit des dates relatives', () => {
    const now = Date.parse('2026-11-18T10:00:00Z');
    expect(formatRelative('2026-11-18T09:58:00Z', now)).toBe('il y a 2 minutes');
    expect(formatRelative('2026-11-19T10:00:00Z', now)).toBe('demain');
  });

  it('calcule les initiales', () => {
    expect(initials('hanitra', 'rakoto')).toBe('HR');
  });
});
