/**
 * Crest Study Consult API Authentication
 * 
 * Secure API key authentication for super admin endpoints.
 * These endpoints are accessed externally via secure API calls.
 */

import { data } from "react-router";
import { db } from "./db.server";
import bcrypt from "bcryptjs";

// ============================================
// API Key Authentication
// ============================================

const SUPER_ADMIN_API_KEY = process.env.SUPER_ADMIN_API_KEY;

/**
 * Validate super admin API key from request headers
 * Expects: Authorization: Bearer <API_KEY>
 */
export async function validateApiKey(request: Request): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Check API key is configured
  if (!SUPER_ADMIN_API_KEY || SUPER_ADMIN_API_KEY.length < 32) {
    console.error("SUPER_ADMIN_API_KEY not configured or too short");
    return { valid: false, error: "API not configured" };
  }

  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format. Use: Bearer <token>" };
  }

  const providedKey = authHeader.slice(7);
  
  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(providedKey, SUPER_ADMIN_API_KEY)) {
    await logAuditEvent({
      action: "API_AUTH_FAILED",
      resource: "api",
      details: { reason: "Invalid API key" },
      request,
    });
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}

/**
 * Middleware to require API authentication
 * Returns error response if invalid, null if valid
 */
export async function requireApiAuth(request: Request): Promise<Response | null> {
  const { valid, error } = await validateApiKey(request);
  
  if (!valid) {
    return new Response(
      JSON.stringify({ success: false, error: error || "Unauthorized" }),
      { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }

  return null; // Auth passed
}

// ============================================
// Timing-Safe Comparison
// ============================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// ============================================
// Password Utilities
// ============================================

const SALT_ROUNDS = 12;

/**
 * Hash a password securely
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Validate password strength
 * Returns null if valid, error message if invalid
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character";
  }
  return null;
}

// ============================================
// Audit Logging
// ============================================

interface AuditEventParams {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  details?: Record<string, unknown>;
  request: Request;
}

/**
 * Log an audit event for security tracking
 */
export async function logAuditEvent({
  action,
  resource,
  resourceId,
  userId,
  details,
  request,
}: AuditEventParams): Promise<void> {
  try {
    const ipAddress = request.headers.get("X-Forwarded-For") 
      || request.headers.get("X-Real-IP") 
      || "unknown";
    const userAgent = request.headers.get("User-Agent") || "unknown";

    // Log to database if AuditLog table exists, otherwise console log
    // For now, we log to console - schema migration adds the table
    console.log("[AUDIT]", {
      timestamp: new Date().toISOString(),
      action,
      resource,
      resourceId,
      userId,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

// ============================================
// Request Helpers
// ============================================

/**
 * Parse JSON body from request
 */
export async function parseJsonBody<T>(request: Request): Promise<{
  data?: T;
  error?: string;
}> {
  try {
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      return { error: "Content-Type must be application/json" };
    }
    
    const body = await request.json();
    return { data: body as T };
  } catch {
    return { error: "Invalid JSON body" };
  }
}

/**
 * Standard API error response
 */
export function apiError(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ success: true, data }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

// ============================================
// Role Constants
// ============================================

export const VALID_ROLES = [
  "SUPER_ADMIN",
  "ADMIN", 
  "EDITOR", 
  "WRITER", 
  "SEO_LEAD", 
  "RESEARCHER"
] as const;

export type ValidRole = typeof VALID_ROLES[number];

export function isValidRole(role: string): role is ValidRole {
  return VALID_ROLES.includes(role as ValidRole);
}
