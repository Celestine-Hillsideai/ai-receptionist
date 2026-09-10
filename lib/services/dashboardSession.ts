import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed-cookie session for the dashboard password gate (docs/DEPLOYMENT.md
 * option 1). No session store: the cookie is `${expiry}.${hmac}`, HMAC-keyed
 * on the dashboard password itself, so forging one requires knowing the
 * password. Imported by both `proxy.ts` (verify) and the login/logout
 * Server Actions (issue/clear) — kept dependency-free (no `getConfig()`) so
 * it stays cheap to run on every proxied request.
 */
export const DASHBOARD_SESSION_COOKIE = "dashboard_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(password: string, expiresAt: number): string {
  return createHmac("sha256", password).update(String(expiresAt)).digest("hex");
}

/** Constant-time string comparison — used for both the password check and the session signature check. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function verifyDashboardPassword(candidate: string, expected: string): boolean {
  return safeEqual(candidate, expected);
}

/** Value to set on the session cookie, plus its max-age for the cookie options. */
export function createDashboardSessionCookie(password: string): { value: string; maxAgeSeconds: number } {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return { value: `${expiresAt}.${sign(password, expiresAt)}`, maxAgeSeconds: SESSION_MAX_AGE_SECONDS };
}

export function verifyDashboardSessionCookie(token: string | undefined | null, password: string): boolean {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!signature || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  return safeEqual(signature, sign(password, expiresAt));
}
