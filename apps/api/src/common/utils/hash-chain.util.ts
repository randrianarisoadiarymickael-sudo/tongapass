import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

/** JSON canonique : clés triées récursivement, pour un hachage stable et vérifiable. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface HashableAuditEntry {
  occurredAt: Date;
  actorType: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
}

/** hash(n) = SHA-256(hash(n-1) + JSON canonique de l'entrée n) : toute altération casse la chaîne. */
export function computeAuditHash(prevHash: string, entry: HashableAuditEntry): string {
  return createHash('sha256').update(prevHash).update(canonicalJson(entry)).digest('hex');
}
