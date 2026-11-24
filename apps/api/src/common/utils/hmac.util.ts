import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signature HMAC-SHA256 au format `sha256=<hex>` calculée sur `${timestamp}.${body}`. */
export function signPayload(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `sha256=${digest}`;
}

/** Comparaison à temps constant pour éviter les attaques temporelles. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface SignatureCheck {
  valid: boolean;
  reason?: 'missing' | 'expired' | 'mismatch';
}

export function verifySignature(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: string,
  toleranceSeconds = 300,
  now: number = Date.now(),
): SignatureCheck {
  if (!timestamp || !signature) return { valid: false, reason: 'missing' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSeconds) {
    return { valid: false, reason: 'expired' };
  }
  const expected = signPayload(secret, timestamp, rawBody);
  return safeEqual(expected, signature) ? { valid: true } : { valid: false, reason: 'mismatch' };
}
