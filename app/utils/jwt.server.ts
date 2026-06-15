/**
 * Crest Study Consult — JWT Utilities (server only)
 *
 * Self-contained HS256 (HMAC-SHA256) JSON Web Token implementation built on
 * Node's native crypto module. No external dependencies, no `alg:none`
 * downgrade surface, and constant-time signature verification.
 *
 * Tokens are used as the value of an httpOnly, signed session cookie. Each
 * token embeds a `ver` claim (the user's `tokenVersion`) so individual
 * sessions can be revoked server-side (password change, deactivation).
 */

import crypto from "node:crypto";

// ============================================
// Types
// ============================================

export interface JwtClaims {
  /** Subject — the admin user id */
  sub: string;
  email: string;
  name: string;
  role: string;
  /** Token version — must match AdminUser.tokenVersion to stay valid */
  ver: number;
  /** Issued-at (seconds since epoch) */
  iat: number;
  /** Expiry (seconds since epoch) */
  exp: number;
  /** Unique token id (jti) for audit/debugging */
  jti: string;
}

export type JwtInput = Omit<JwtClaims, "iat" | "exp" | "jti">;

const ALG = "HS256";
const HEADER = { alg: ALG, typ: "JWT" } as const;

// ============================================
// Base64url helpers
// ============================================

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

// ============================================
// Public API
// ============================================

/**
 * Create a signed HS256 JWT.
 *
 * @param claims     The user-facing claims (sub, email, name, role, ver).
 * @param secret     The signing secret (must be strong, >= 32 chars).
 * @param expiresIn  Lifetime in seconds.
 */
export function signJwt(claims: JwtInput, secret: string, expiresIn: number): string {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: JwtClaims = {
    ...claims,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(),
  };

  const headerSegment = encodeSegment(HEADER);
  const payloadSegment = encodeSegment(fullClaims);
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = sign(signingInput, secret);

  return `${signingInput}.${signature}`;
}

/**
 * Verify a JWT and return its claims, or null if invalid/expired/tampered.
 *
 * Security properties:
 * - Rejects any algorithm other than HS256 (blocks `alg:none` and confusion).
 * - Constant-time signature comparison (blocks timing attacks).
 * - Enforces the `exp` claim.
 */
export function verifyJwt(token: unknown, secret: string): JwtClaims | null {
  if (typeof token !== "string" || token.length === 0) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerSegment, payloadSegment, providedSignature] = parts;

  // 1. Validate header / algorithm (defend against alg confusion + alg:none)
  let header: { alg?: string; typ?: string };
  try {
    header = decodeSegment(headerSegment);
  } catch {
    return null;
  }
  if (header.alg !== ALG) return null;

  // 2. Verify signature in constant time
  const expectedSignature = sign(`${headerSegment}.${payloadSegment}`, secret);
  const expectedBuf = Buffer.from(expectedSignature);
  const providedBuf = Buffer.from(providedSignature);
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  // 3. Decode + validate claims
  let claims: JwtClaims;
  try {
    claims = decodeSegment(payloadSegment);
  } catch {
    return null;
  }

  if (
    typeof claims.sub !== "string" ||
    typeof claims.role !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.ver !== "number"
  ) {
    return null;
  }

  // 4. Enforce expiry
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return null;

  return claims;
}

// ============================================
// Generic short-lived tokens (e.g. OTP login challenge)
// ============================================

interface BaseTokenClaims {
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Sign an arbitrary JSON payload as an HS256 token with an expiry.
 * Use for short-lived, single-purpose tokens (login OTP challenge, etc.).
 */
export function signToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    jti: crypto.randomUUID(),
  };

  const headerSegment = encodeSegment(HEADER);
  const payloadSegment = encodeSegment(fullPayload);
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = sign(signingInput, secret);

  return `${signingInput}.${signature}`;
}

/**
 * Verify a generic HS256 token. Enforces algorithm, signature, and expiry.
 * Returns the decoded payload, or null if invalid/expired/tampered.
 */
export function verifyToken<T extends Record<string, unknown>>(
  token: unknown,
  secret: string
): (T & BaseTokenClaims) | null {
  if (typeof token !== "string" || token.length === 0) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerSegment, payloadSegment, providedSignature] = parts;

  let header: { alg?: string };
  try {
    header = decodeSegment(headerSegment);
  } catch {
    return null;
  }
  if (header.alg !== ALG) return null;

  const expectedSignature = sign(`${headerSegment}.${payloadSegment}`, secret);
  const expectedBuf = Buffer.from(expectedSignature);
  const providedBuf = Buffer.from(providedSignature);
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  let payload: T & BaseTokenClaims;
  try {
    payload = decodeSegment(payloadSegment);
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number") return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}
