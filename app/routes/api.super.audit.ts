/**
 * Super Admin API: Audit Logs
 * 
 * Secure endpoints for viewing audit trail.
 * Read-only access to all admin actions.
 * 
 * Endpoints:
 * GET /api/super/audit - List audit logs with filtering
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";
import {
  requireApiAuth,
  parseJsonBody,
  apiError,
  apiSuccess,
} from "~/utils/api-auth.server";

// ============================================
// GET /api/super/audit - List audit logs
// ============================================
export async function loader({ request }: LoaderFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    
    // Query parameters for filtering
    const action = url.searchParams.get("action");
    const resource = url.searchParams.get("resource");
    const userId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Record<string, unknown> = {};

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, Date>).lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return apiSuccess({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    // If AuditLog table doesn't exist yet, return empty array
    if (error instanceof Error && error.message.includes("does not exist")) {
      return apiSuccess({
        logs: [],
        pagination: { total: 0, limit: 100, offset: 0, hasMore: false },
        message: "Audit log table not yet created. Run migrations.",
      });
    }
    
    console.error("Error listing audit logs:", error);
    return apiError("Failed to list audit logs", 500);
  }
}

// ============================================
// POST /api/super/audit - Log external action
// ============================================
export async function action({ request }: ActionFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const method = request.method.toUpperCase();

  if (method !== "POST") {
    return apiError("Method not allowed", 405);
  }

  const { data: body, error: parseError } = await parseJsonBody<{
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    details?: Record<string, unknown>;
  }>(request);

  if (parseError || !body) {
    return apiError(parseError || "Invalid request body");
  }

  const { action: logAction, resource, resourceId, userId, details } = body;

  if (!logAction || !resource) {
    return apiError("Missing required fields: action, resource");
  }

  try {
    const ipAddress = request.headers.get("X-Forwarded-For") 
      || request.headers.get("X-Real-IP") 
      || "unknown";
    const userAgent = request.headers.get("User-Agent") || "unknown";

    const log = await db.auditLog.create({
      data: {
        action: logAction,
        resource,
        resourceId: resourceId || null,
        userId: userId || null,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        ipAddress,
        userAgent,
      },
    });

    return apiSuccess({ log }, 201);
  } catch (error) {
    // If table doesn't exist, just acknowledge
    if (error instanceof Error && error.message.includes("does not exist")) {
      console.log("[AUDIT]", { action: logAction, resource, resourceId, userId, details });
      return apiSuccess({ message: "Logged to console (table not migrated)" }, 201);
    }

    console.error("Error creating audit log:", error);
    return apiError("Failed to create audit log", 500);
  }
}
