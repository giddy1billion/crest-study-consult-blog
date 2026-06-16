/**
 * Crest Study Consult — Centralized Audit Trail
 *
 * Single source of truth for recording admin/user actions to the AuditLog
 * table. Every privileged mutation in the dashboard and super-admin API should
 * route through `recordAudit` so that no action is left untracked.
 *
 * Design goals:
 * - Best-effort: auditing must NEVER break the underlying action. All writes
 *   are wrapped and failures are logged, not thrown.
 * - Attributable: captures the acting admin (id + email + role snapshot), the
 *   request IP and user agent, and structured before/after detail.
 * - Queryable: stable `action` and `resource` vocabularies for filtering.
 */

import { db } from "./db.server";

// ============================================
// Action & resource vocabularies
// ============================================

export const AUDIT_ACTIONS = {
  // Authentication & session
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_OTP_SENT: "LOGIN_OTP_SENT",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // Admin user management
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  ACTIVATE_USER: "ACTIVATE_USER",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  REVOKE_SESSIONS: "REVOKE_SESSIONS",
  RESET_USER_PASSWORD: "RESET_USER_PASSWORD",

  // Articles / content
  CREATE_ARTICLE: "CREATE_ARTICLE",
  UPDATE_ARTICLE: "UPDATE_ARTICLE",
  DELETE_ARTICLE: "DELETE_ARTICLE",
  PUBLISH_ARTICLE: "PUBLISH_ARTICLE",
  UNPUBLISH_ARTICLE: "UNPUBLISH_ARTICLE",
  CHANGE_ARTICLE_STATUS: "CHANGE_ARTICLE_STATUS",
  REQUEST_ARTICLE_DELETION: "REQUEST_ARTICLE_DELETION",

  // Comments
  APPROVE_COMMENT: "APPROVE_COMMENT",
  SPAM_COMMENT: "SPAM_COMMENT",
  DELETE_COMMENT: "DELETE_COMMENT",
  RESTORE_COMMENT: "RESTORE_COMMENT",
  REPLY_COMMENT: "REPLY_COMMENT",
  BULK_MODERATE_COMMENTS: "BULK_MODERATE_COMMENTS",

  // Newsletters
  CREATE_NEWSLETTER: "CREATE_NEWSLETTER",
  UPDATE_NEWSLETTER: "UPDATE_NEWSLETTER",
  SEND_NEWSLETTER: "SEND_NEWSLETTER",
  SCHEDULE_NEWSLETTER: "SCHEDULE_NEWSLETTER",
  SYNC_SUBSCRIBERS: "SYNC_SUBSCRIBERS",
  ADD_CONTACT: "ADD_CONTACT",

  // Media
  UPLOAD_MEDIA: "UPLOAD_MEDIA",
  DELETE_MEDIA: "DELETE_MEDIA",
  UPDATE_MEDIA: "UPDATE_MEDIA",

  // Authors (super API)
  CREATE_AUTHOR: "CREATE_AUTHOR",
  UPDATE_AUTHOR: "UPDATE_AUTHOR",
  DELETE_AUTHOR: "DELETE_AUTHOR",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_RESOURCES = {
  AUTH: "auth",
  ADMIN_USERS: "admin_users",
  ARTICLES: "articles",
  COMMENTS: "comments",
  NEWSLETTERS: "newsletters",
  SUBSCRIBERS: "subscribers",
  MEDIA: "media",
  AUTHORS: "authors",
} as const;

export type AuditResource = (typeof AUDIT_RESOURCES)[keyof typeof AUDIT_RESOURCES];

// ============================================
// Request metadata
// ============================================

/**
 * Extract the client IP and user agent from a request.
 * Falls back to null so the audit row is still written.
 */
export function getRequestMeta(request?: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!request) return { ipAddress: null, userAgent: null };

  const ipAddress =
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    request.headers.get("CF-Connecting-IP") ||
    null;
  const userAgent = request.headers.get("User-Agent") || null;

  return { ipAddress, userAgent };
}

// ============================================
// Core recorder
// ============================================

export interface RecordAuditParams {
  /** The request, used to capture IP and user agent. */
  request?: Request;
  /** Acting admin user id (null for anonymous/system/API-key actions). */
  actorId?: string | null;
  /** Acting admin email — snapshotted into details for resilience. */
  actorEmail?: string | null;
  /** Acting admin role — snapshotted into details for resilience. */
  actorRole?: string | null;
  /** What happened (use AUDIT_ACTIONS). */
  action: string;
  /** What it happened to (use AUDIT_RESOURCES). */
  resource: string;
  /** The affected record id, when applicable. */
  resourceId?: string | null;
  /** Structured context: before/after values, reason, target email, etc. */
  details?: Record<string, unknown>;
}

/**
 * Record a single audit event. Best-effort — never throws.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const { request, actorId, actorEmail, actorRole, action, resource, resourceId, details } =
    params;

  const { ipAddress, userAgent } = getRequestMeta(request);

  // Snapshot actor identity into details so the trail survives user deletion.
  const enrichedDetails: Record<string, unknown> = {
    ...(details || {}),
  };
  if (actorEmail) enrichedDetails.actorEmail = actorEmail;
  if (actorRole) enrichedDetails.actorRole = actorRole;

  try {
    await db.auditLog.create({
      data: {
        action,
        resource,
        resourceId: resourceId || null,
        userId: actorId || null,
        details: Object.keys(enrichedDetails).length
          ? (JSON.parse(JSON.stringify(enrichedDetails)) as object)
          : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Auditing must never break the action it describes.
    console.error("[audit] Failed to record event:", action, resource, error);
  }
}

/**
 * Convenience overload for an authenticated admin actor.
 */
export async function recordAdminAudit(
  actor: { id: string; email: string; role: string } | null | undefined,
  params: Omit<RecordAuditParams, "actorId" | "actorEmail" | "actorRole">
): Promise<void> {
  return recordAudit({
    ...params,
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? null,
  });
}
