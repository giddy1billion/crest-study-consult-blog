/**
 * Secure Rate Limiter for Authentication
 * 
 * Features:
 * - Per-IP and per-email rate limiting
 * - Progressive delays with exponential backoff
 * - Account lockout after max failures
 * - Automatic cleanup of stale records
 * - Detailed attempt tracking for security audits
 */

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Window and attempt limits
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_ATTEMPTS_PER_IP: 10,   // Max login attempts per IP in window
  MAX_ATTEMPTS_PER_EMAIL: 5, // Max login attempts per email in window
  
  // Lockout settings
  LOCKOUT_THRESHOLD: 5,      // Failures before progressive lockout
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 min lockout after threshold
  
  // Cleanup interval
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // Clean stale records every 5 min
} as const;

// ============================================
// Types
// ============================================

interface AttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockoutUntil: number | null;
  failedAttempts: number; // Track consecutive failures
}

interface RateLimitResult {
  allowed: boolean;
  reason?: "ip_limit" | "email_limit" | "lockout";
  retryAfterMs?: number;
  remainingAttempts?: number;
  lockoutUntil?: Date;
}

// ============================================
// Storage (In-Memory with TTL)
// ============================================

const ipRecords = new Map<string, AttemptRecord>();
const emailRecords = new Map<string, AttemptRecord>();
let lastCleanup = Date.now();

/**
 * Cleanup stale records to prevent memory leaks
 */
function cleanupStaleRecords(): void {
  const now = Date.now();
  
  // Only cleanup periodically
  if (now - lastCleanup < CONFIG.CLEANUP_INTERVAL_MS) {
    return;
  }
  
  lastCleanup = now;
  const windowStart = now - CONFIG.WINDOW_MS;
  
  // Clean IP records
  for (const [key, record] of ipRecords) {
    if (record.lastAttemptAt < windowStart && (!record.lockoutUntil || record.lockoutUntil < now)) {
      ipRecords.delete(key);
    }
  }
  
  // Clean email records
  for (const [key, record] of emailRecords) {
    if (record.lastAttemptAt < windowStart && (!record.lockoutUntil || record.lockoutUntil < now)) {
      emailRecords.delete(key);
    }
  }
}

/**
 * Create a new attempt record
 */
function createRecord(now: number): AttemptRecord {
  return {
    attempts: 1,
    firstAttemptAt: now,
    lastAttemptAt: now,
    lockoutUntil: null,
    failedAttempts: 0,
  };
}

/**
 * Get or create record for a key
 */
function getOrCreateRecord(map: Map<string, AttemptRecord>, key: string, now: number): AttemptRecord {
  let record = map.get(key);
  
  if (!record) {
    record = createRecord(now);
    map.set(key, record);
    return record;
  }
  
  // Reset if window has passed and not locked out
  if (now - record.firstAttemptAt > CONFIG.WINDOW_MS && (!record.lockoutUntil || record.lockoutUntil < now)) {
    record = createRecord(now);
    map.set(key, record);
    return record;
  }
  
  return record;
}

/**
 * Normalize email for consistent tracking
 * Handles case-insensitivity and common aliases
 */
function normalizeEmail(email: string): string {
  const lower = email.toLowerCase().trim();
  
  // Handle Gmail plus addressing (user+tag@gmail.com → user@gmail.com)
  const [localPart, domain] = lower.split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const baseLocal = localPart.split("+")[0].replace(/\./g, "");
    return `${baseLocal}@gmail.com`;
  }
  
  return lower;
}

/**
 * Extract client IP from request headers
 * Handles various proxy configurations (Cloudflare, nginx, etc.)
 */
export function getClientIP(request: Request): string {
  // Cloudflare
  const cfConnectingIP = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIP) return cfConnectingIP;
  
  // Standard proxy headers
  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (xForwardedFor) {
    // Take first IP (original client)
    const firstIP = xForwardedFor.split(",")[0].trim();
    if (firstIP) return firstIP;
  }
  
  // Real IP header (nginx)
  const xRealIP = request.headers.get("X-Real-IP");
  if (xRealIP) return xRealIP;
  
  // Fallback - should never happen in production
  return "unknown";
}

// ============================================
// Main Rate Limiting Functions
// ============================================

/**
 * Check if a login attempt should be allowed
 * Call this BEFORE verifying credentials
 */
export function checkLoginRateLimit(request: Request, email: string): RateLimitResult {
  cleanupStaleRecords();
  
  const now = Date.now();
  const ip = getClientIP(request);
  const normalizedEmail = normalizeEmail(email);
  
  // Get records
  const ipRecord = getOrCreateRecord(ipRecords, ip, now);
  const emailRecord = getOrCreateRecord(emailRecords, normalizedEmail, now);
  
  // Check IP lockout
  if (ipRecord.lockoutUntil && ipRecord.lockoutUntil > now) {
    return {
      allowed: false,
      reason: "lockout",
      retryAfterMs: ipRecord.lockoutUntil - now,
      lockoutUntil: new Date(ipRecord.lockoutUntil),
    };
  }
  
  // Check email lockout
  if (emailRecord.lockoutUntil && emailRecord.lockoutUntil > now) {
    return {
      allowed: false,
      reason: "lockout",
      retryAfterMs: emailRecord.lockoutUntil - now,
      lockoutUntil: new Date(emailRecord.lockoutUntil),
    };
  }
  
  // Check IP rate limit
  if (ipRecord.attempts >= CONFIG.MAX_ATTEMPTS_PER_IP) {
    return {
      allowed: false,
      reason: "ip_limit",
      retryAfterMs: CONFIG.WINDOW_MS - (now - ipRecord.firstAttemptAt),
      remainingAttempts: 0,
    };
  }
  
  // Check email rate limit
  if (emailRecord.attempts >= CONFIG.MAX_ATTEMPTS_PER_EMAIL) {
    return {
      allowed: false,
      reason: "email_limit",
      retryAfterMs: CONFIG.WINDOW_MS - (now - emailRecord.firstAttemptAt),
      remainingAttempts: 0,
    };
  }
  
  // Allowed - increment attempt counters
  ipRecord.attempts++;
  ipRecord.lastAttemptAt = now;
  emailRecord.attempts++;
  emailRecord.lastAttemptAt = now;
  
  return {
    allowed: true,
    remainingAttempts: Math.min(
      CONFIG.MAX_ATTEMPTS_PER_IP - ipRecord.attempts,
      CONFIG.MAX_ATTEMPTS_PER_EMAIL - emailRecord.attempts
    ),
  };
}

/**
 * Record a failed login attempt
 * Call this AFTER credential verification fails
 */
export function recordFailedLogin(request: Request, email: string): void {
  const now = Date.now();
  const ip = getClientIP(request);
  const normalizedEmail = normalizeEmail(email);
  
  const ipRecord = ipRecords.get(ip);
  const emailRecord = emailRecords.get(normalizedEmail);
  
  // Increment failure counters
  if (ipRecord) {
    ipRecord.failedAttempts++;
    
    // Progressive lockout based on failures
    if (ipRecord.failedAttempts >= CONFIG.LOCKOUT_THRESHOLD) {
      // Exponential backoff: 30min, 1hr, 2hr, 4hr...
      const lockoutMultiplier = Math.pow(2, ipRecord.failedAttempts - CONFIG.LOCKOUT_THRESHOLD);
      ipRecord.lockoutUntil = now + (CONFIG.LOCKOUT_DURATION_MS * lockoutMultiplier);
    }
  }
  
  if (emailRecord) {
    emailRecord.failedAttempts++;
    
    if (emailRecord.failedAttempts >= CONFIG.LOCKOUT_THRESHOLD) {
      const lockoutMultiplier = Math.pow(2, emailRecord.failedAttempts - CONFIG.LOCKOUT_THRESHOLD);
      emailRecord.lockoutUntil = now + (CONFIG.LOCKOUT_DURATION_MS * lockoutMultiplier);
    }
  }
}

/**
 * Record a successful login
 * Call this AFTER successful authentication to reset failure counters
 */
export function recordSuccessfulLogin(request: Request, email: string): void {
  const ip = getClientIP(request);
  const normalizedEmail = normalizeEmail(email);
  
  // Reset failure counters on success
  const ipRecord = ipRecords.get(ip);
  if (ipRecord) {
    ipRecord.failedAttempts = 0;
    ipRecord.lockoutUntil = null;
  }
  
  const emailRecord = emailRecords.get(normalizedEmail);
  if (emailRecord) {
    emailRecord.failedAttempts = 0;
    emailRecord.lockoutUntil = null;
  }
}

/**
 * Format retry time for user-friendly display
 */
export function formatRetryTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

// ============================================
// Security Logging (for audit trail)
// ============================================

interface SecurityEvent {
  type: "rate_limited" | "lockout" | "failed_login" | "successful_login";
  ip: string;
  email?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Log security events (integrate with your logging service)
 * In production, send these to a secure logging service
 */
export function logSecurityEvent(event: SecurityEvent): void {
  // In development, log to console
  if (process.env.NODE_ENV !== "production") {
    console.log(`[SECURITY] ${event.type}:`, {
      ...event,
      timestamp: event.timestamp.toISOString(),
    });
  }
  
  // TODO: In production, send to logging service (e.g., Datadog, Sentry)
  // Example: await logService.log("security", event);
}
