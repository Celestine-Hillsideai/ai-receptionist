import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time shared-secret comparison used by both the Vapi webhook
 * (`x-vapi-secret`) and our internal n8n-facing endpoints. If `expected` is
 * null (secret not configured), access is allowed — permitted for local/dev
 * only (spec §18); every route using this must be behind a real secret
 * before it's reachable from anywhere but localhost.
 */
export function verifySharedSecret(headerValue: string | null, expected: string | null): boolean {
  if (!expected) return true;
  if (!headerValue) return false;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(headerValue);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
