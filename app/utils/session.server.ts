/**
 * Crest Study Consult Session Management
 *
 * JWT-backed admin authentication. A signed HS256 JWT (see `jwt.server.ts`) is
 * stored as the value of an httpOnly, secure cookie. Every authenticated
 * request re-validates the token and reloads the user from the database so
 * deactivations, role changes, and password resets take effect immediately.
 */

import { createCookie, redirect } from "react-router";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "./db.server";
import { signJwt, verifyJwt, signToken, verifyToken } from "./jwt.server";
import { canManageAdmins } from "./constants";

// ============================================
// Configuration
// ============================================

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set in environment variables and be at least 32 characters"
  );
}

// Narrow to a definite string for the rest of the module.
const JWT_SECRET: string = SESSION_SECRET;

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

/**
 * The session cookie holds the raw JWT. The token is already cryptographically
 * signed, so the cookie itself does not need additional signing secrets.
 */
const sessionCookie = createCookie("__crest_admin_session", {
  httpOnly: true,
  maxAge: SESSION_MAX_AGE,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

const OTP_CHALLENGE_MAX_AGE = 60 * 10; // 10 minutes (seconds)

/**
 * Short-lived cookie holding a signed challenge token. It identifies the user
 * who passed password verification but still owes an emailed OTP. It carries no
 * authority on its own — it only authorises OTP submission for that account.
 */
const otpChallengeCookie = createCookie("__crest_otp_challenge", {
  httpOnly: true,
  maxAge: OTP_CHALLENGE_MAX_AGE,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

// ============================================
// Types
// ============================================

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  /** Present when loaded from the DB; true forces a password change before dashboard access. */
  mustChangePassword?: boolean;
};

// ============================================
// Cookie helpers
// ============================================

async function getTokenFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("Cookie");
  const token = await sessionCookie.parse(cookieHeader);
  return typeof token === "string" && token.length > 0 ? token : null;
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Get the logged-in admin user ID from a valid session token.
 * Does not hit the database — only validates the JWT signature/expiry.
 */
export async function getAdminUserId(request: Request): Promise<string | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;

  const claims = verifyJwt(token, JWT_SECRET);
  return claims?.sub ?? null;
}

/**
 * Get the full admin user for the current request.
 *
 * Validates the JWT, then reloads the user from the database to confirm the
 * account is still active and the token has not been revoked (tokenVersion).
 */
export async function getAdminUser(request: Request): Promise<AdminUser | null> {
  const token = await getTokenFromRequest(request);
  if (!token) return null;

  const claims = verifyJwt(token, JWT_SECRET);
  if (!claims) return null;

  const user = await db.adminUser.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      tokenVersion: true,
      mustChangePassword: true,
    },
  });

  // Reject if the account is gone, deactivated, or the token was revoked.
  if (!user || !user.isActive || user.tokenVersion !== claims.ver) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Require admin authentication.
 * Redirects to login if not authenticated.
 */
export async function requireAdmin(request: Request): Promise<AdminUser> {
  const user = await getAdminUser(request);

  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`, {
      // Clear any stale/invalid session cookie on the way out.
      headers: { "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }) },
    });
  }

  return user;
}

/**
 * Require one of the given roles. Throws 403 if the user lacks them.
 */
export async function requireRole(
  request: Request,
  roles: string[]
): Promise<AdminUser> {
  const user = await requireAdmin(request);

  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

/**
 * Require systems-administrator privileges (admin/user management).
 */
export async function requireSystemsAdmin(request: Request): Promise<AdminUser> {
  const user = await requireAdmin(request);

  if (!canManageAdmins(user.role)) {
    throw new Response("Forbidden — systems administrator access required", {
      status: 403,
    });
  }

  return user;
}

/**
 * Fetch an active admin by id (used to complete OTP login).
 * Returns null if the account is missing or deactivated.
 */
export async function getActiveAdminById(
  userId: string
): Promise<(AdminUser & { tokenVersion: number }) | null> {
  const user = await db.adminUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      tokenVersion: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Verify login credentials.
 * Returns user (plus tokenVersion) if valid, null if invalid.
 */
export async function verifyLogin(
  email: string,
  password: string
): Promise<(AdminUser & { tokenVersion: number }) | null> {
  const user = await db.adminUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
      tokenVersion: true,
    },
  });

  // Always run a comparison to reduce user-enumeration timing differences.
  const hashToCompare =
    user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinv";
  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !user.isActive || !isValid) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

/**
 * Create a new admin session after login.
 * Signs a JWT with the user's claims and stores it in the session cookie.
 */
export async function createAdminSession({
  userId,
  userData,
  tokenVersion,
  redirectTo,
}: {
  request?: Request;
  userId: string;
  userData: AdminUser;
  tokenVersion: number;
  redirectTo: string;
}) {
  const token = signJwt(
    {
      sub: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      ver: tokenVersion,
    },
    JWT_SECRET,
    SESSION_MAX_AGE
  );

  // Record the successful login (best-effort, non-blocking on failure).
  await db.adminUser
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionCookie.serialize(token),
    },
  });
}

/**
 * Logout and destroy the session cookie.
 */
export async function logout(_request: Request) {
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}

// ============================================
// OTP login challenge (two-factor)
// ============================================

export type OtpChallenge = {
  sub: string; // user id
  ver: number; // tokenVersion captured at password verification
  redirectTo: string;
};

/**
 * Build a Set-Cookie header value carrying a signed OTP challenge token.
 */
export async function serializeOtpChallenge(challenge: OtpChallenge): Promise<string> {
  const token = signToken(
    { sub: challenge.sub, ver: challenge.ver, redirectTo: challenge.redirectTo, purpose: "otp" },
    JWT_SECRET,
    OTP_CHALLENGE_MAX_AGE
  );
  return otpChallengeCookie.serialize(token);
}

/**
 * Read and validate the OTP challenge from the request, or null if absent/invalid.
 */
export async function getOtpChallenge(request: Request): Promise<OtpChallenge | null> {
  const cookieHeader = request.headers.get("Cookie");
  const token = await otpChallengeCookie.parse(cookieHeader);
  if (typeof token !== "string" || token.length === 0) return null;

  const payload = verifyToken<{
    sub: string;
    ver: number;
    redirectTo: string;
    purpose: string;
  }>(token, JWT_SECRET);

  if (!payload || payload.purpose !== "otp" || typeof payload.sub !== "string") {
    return null;
  }

  return {
    sub: payload.sub,
    ver: typeof payload.ver === "number" ? payload.ver : 0,
    redirectTo: typeof payload.redirectTo === "string" ? payload.redirectTo : "/admin",
  };
}

/**
 * Set-Cookie header value that clears the OTP challenge cookie.
 */
export async function clearOtpChallenge(): Promise<string> {
  return otpChallengeCookie.serialize("", { maxAge: 0 });
}

/**
 * Complete login after OTP verification: sign a session JWT and clear the
 * challenge cookie in the same response.
 */
export async function completeOtpLogin({
  userId,
  userData,
  tokenVersion,
  redirectTo,
}: {
  userId: string;
  userData: AdminUser;
  tokenVersion: number;
  redirectTo: string;
}) {
  const token = signJwt(
    {
      sub: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      ver: tokenVersion,
    },
    JWT_SECRET,
    SESSION_MAX_AGE
  );

  await db.adminUser
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch(() => {});

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionCookie.serialize(token));
  headers.append("Set-Cookie", await clearOtpChallenge());

  return redirect(redirectTo, { headers });
}

// ============================================
// Password Utilities
// ============================================

/**
 * Hash a password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
  return bcrypt.hash(password, rounds);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain an uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain a lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain a number" };
  }
  return { valid: true };
}

/**
 * Generate a strong temporary password for a newly invited admin.
 *
 * Always satisfies validatePassword(): includes upper, lower, digit, and a
 * symbol, with the remaining characters drawn from a secure RNG. The result is
 * shuffled so the guaranteed characters are not positionally predictable.
 */
export function generateTempPassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O for legibility
  const lower = "abcdefghijkmnpqrstuvwxyz"; // no l/o
  const digits = "23456789"; // no 0/1
  const symbols = "!@#$%^&*-_=+";
  const all = upper + lower + digits + symbols;

  const pick = (set: string) => set[crypto.randomInt(0, set.length)];

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remaining = Array.from({ length: Math.max(length, 12) - required.length }, () =>
    pick(all)
  );

  const chars = [...required, ...remaining];

  // Fisher–Yates shuffle with a secure RNG.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
