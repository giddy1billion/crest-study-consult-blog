/**
 * Crest Study Consult — Unsubscribe Token Utilities (server only)
 *
 * Stateless, tamper-proof HMAC-SHA256 tokens that authorize a one-click
 * unsubscribe for a specific email address. Used as the `t` query parameter
 * on `/unsubscribe?email=…&t=…` and in the RFC 8058 `List-Unsubscribe`
 * header so only links we generated can act on a subscriber.
 *
 * Design notes:
 * - The token is `base64url(HMAC-SHA256(secret, "unsub:v1:" + normalizedEmail))`.
 * - It is deterministic (same email → same token), so it never expires and a
 *   subscriber's footer link keeps working across every campaign. This is the
 *   expected behaviour for List-Unsubscribe links.
 * - Verification is constant-time to avoid signature-timing oracles.
 * - The secret is SESSION_SECRET (already required to be ≥32 chars), with a
 *   purpose prefix so these tokens can never collide with session JWTs.
 */

import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET;

if (!SECRET || SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set and be at least 32 characters to sign unsubscribe tokens"
  );
}

// Versioned, purpose-scoped message prefix (lets us rotate the scheme later).
const TOKEN_PREFIX = "unsub:v1:";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Generate the unsubscribe token for an email address.
 */
export function generateUnsubscribeToken(email: string): string {
  const message = TOKEN_PREFIX + normalizeEmail(email);
  return crypto.createHmac("sha256", SECRET as string).update(message).digest("base64url");
}

/**
 * Constant-time verification that `token` authorizes `email`.
 * Returns false for any malformed input rather than throwing.
 */
export function verifyUnsubscribeToken(email: string, token: unknown): boolean {
  if (typeof email !== "string" || typeof token !== "string" || token.length === 0) {
    return false;
  }

  const expected = generateUnsubscribeToken(email);

  // Lengths must match before timingSafeEqual, which requires equal-length buffers.
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(token);
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Build a fully-qualified, signed unsubscribe URL for an email address.
 */
export function buildUnsubscribeUrl(email: string, baseUrl: string): string {
  const normalized = normalizeEmail(email);
  const token = generateUnsubscribeToken(normalized);
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(normalized)}&t=${token}`;
}
