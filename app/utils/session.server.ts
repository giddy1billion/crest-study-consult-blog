/**
 * Crest Study Consult Session Management
 * 
 * Cookie-based session for admin authentication.
 * Uses React Router's built-in session handling.
 */

import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { db } from "./db.server";

// Session secret from environment
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in environment variables");
}

// Session storage configuration
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__Crest Study Consult_admin_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

// ============================================
// Session Helpers
// ============================================

/**
 * Get the current session from request
 */
export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

/**
 * Commit session to response headers
 */
export async function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return sessionStorage.commitSession(session);
}

/**
 * Destroy session (logout)
 */
export async function destroySession(session: Awaited<ReturnType<typeof getSession>>) {
  return sessionStorage.destroySession(session);
}

// ============================================
// Authentication Functions
// ============================================

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

/**
 * Get the logged-in admin user ID from session
 */
export async function getAdminUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const userId = session.get("adminUserId");
  return typeof userId === "string" ? userId : null;
}

/**
 * Get the full admin user from session
 * First checks session cache, then falls back to database
 */
export async function getAdminUser(request: Request): Promise<AdminUser | null> {
  const session = await getSession(request);
  
  // Check if user data is cached in session
  const cachedUser = session.get("adminUserData") as AdminUser | undefined;
  if (cachedUser && cachedUser.id) {
    return cachedUser;
  }

  // Fall back to database lookup
  const userId = session.get("adminUserId");
  if (typeof userId !== "string") return null;

  const user = await db.adminUser.findUnique({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return user;
}

/**
 * Require admin authentication
 * Redirects to login if not authenticated
 */
export async function requireAdmin(request: Request): Promise<AdminUser> {
  const user = await getAdminUser(request);
  
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}

/**
 * Require specific admin role
 */
export async function requireRole(request: Request, roles: string[]): Promise<AdminUser> {
  const user = await requireAdmin(request);
  
  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

/**
 * Verify login credentials
 * Returns user if valid, null if invalid
 */
export async function verifyLogin(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const user = await db.adminUser.findUnique({
    where: { email, isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  // Don't return the password hash
  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Create a new admin session after login
 * Caches user data in session to avoid DB lookups on subsequent requests
 */
export async function createAdminSession({
  request,
  userId,
  userData,
  redirectTo,
}: {
  request: Request;
  userId: string;
  userData: AdminUser;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set("adminUserId", userId);
  session.set("adminUserData", userData); // Cache user data in session
  
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

/**
 * Logout and destroy session
 */
export async function logout(request: Request) {
  const session = await getSession(request);
  
  return redirect("/admin/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
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
