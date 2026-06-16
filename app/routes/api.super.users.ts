/**
 * Super Admin API: Admin Users
 * 
 * Secure endpoints for managing admin users.
 * Accessed externally via API key authentication.
 * 
 * Endpoints:
 * GET    /api/super/users         - List all admin users
 * POST   /api/super/users         - Create new admin user
 * GET    /api/super/users/:id     - Get single admin user
 * PATCH  /api/super/users/:id     - Update admin user
 * DELETE /api/super/users/:id     - Deactivate admin user
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";
import { sendAdminInviteEmail } from "~/utils/email.server";
import {
  requireApiAuth,
  parseJsonBody,
  apiError,
  apiSuccess,
  hashPassword,
  validatePasswordStrength,
  logAuditEvent,
  isValidRole,
  VALID_ROLES,
} from "~/utils/api-auth.server";

// ============================================
// GET /api/super/users - List all admin users
// ============================================
export async function loader({ request }: LoaderFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const users = await db.adminUser.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    await logAuditEvent({
      action: "LIST_USERS",
      resource: "admin_users",
      request,
    });

    return apiSuccess({ users, count: users.length });
  } catch (error) {
    console.error("Error listing users:", error);
    return apiError("Failed to list users", 500);
  }
}

// ============================================
// POST /api/super/users - Create new admin user
// PATCH /api/super/users - Update admin user (with id in body)
// DELETE /api/super/users - Deactivate admin user (with id in body)
// ============================================
export async function action({ request }: ActionFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const method = request.method.toUpperCase();

  // ---- CREATE USER ----
  if (method === "POST") {
    const { data: body, error: parseError } = await parseJsonBody<{
      email: string;
      password: string;
      name: string;
      role?: string;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { email, password, name, role = "EDITOR" } = body;

    // Validation
    if (!email || !password || !name) {
      return apiError("Missing required fields: email, password, name");
    }

    if (!email.includes("@")) {
      return apiError("Invalid email format");
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return apiError(passwordError);
    }

    if (!isValidRole(role)) {
      return apiError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
    }

    // Check if email already exists
    const existing = await db.adminUser.findUnique({ where: { email } });
    if (existing) {
      return apiError("Email already registered");
    }

    try {
      const passwordHash = await hashPassword(password);
      
      const user = await db.adminUser.create({
        data: {
          email,
          passwordHash,
          name,
          role: role as any,
          // Treat the provided password as temporary: require a change on first login.
          mustChangePassword: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      // Email the invitation with temporary credentials (best-effort).
      let emailSent = false;
      try {
        const result = await sendAdminInviteEmail({
          to: email,
          name,
          tempPassword: password,
          role,
        });
        emailSent = result.success;
        if (!result.success) {
          console.error("Failed to send admin invite email:", result.error);
        }
      } catch (error) {
        console.error("Failed to send admin invite email:", error);
      }

      await logAuditEvent({
        action: "CREATE_USER",
        resource: "admin_users",
        resourceId: user.id,
        details: { email, name, role, invited: true, emailSent },
        request,
      });

      return apiSuccess({ user, emailSent }, 201);
    } catch (error) {
      console.error("Error creating user:", error);
      return apiError("Failed to create user", 500);
    }
  }

  // ---- UPDATE USER ----
  if (method === "PATCH") {
    const { data: body, error: parseError } = await parseJsonBody<{
      id: string;
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      isActive?: boolean;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { id, email, password, name, role, isActive } = body;

    if (!id) {
      return apiError("Missing required field: id");
    }

    // Check user exists
    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return apiError("User not found", 404);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (email !== undefined) {
      if (!email.includes("@")) {
        return apiError("Invalid email format");
      }
      // Check email not taken by another user
      const emailTaken = await db.adminUser.findFirst({
        where: { email, id: { not: id } },
      });
      if (emailTaken) {
        return apiError("Email already in use");
      }
      updateData.email = email;
    }

    if (password !== undefined) {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return apiError(passwordError);
      }
      updateData.passwordHash = await hashPassword(password);
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (role !== undefined) {
      if (!isValidRole(role)) {
        return apiError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
      }
      updateData.role = role;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("No fields to update");
    }

    try {
      const user = await db.adminUser.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await logAuditEvent({
        action: "UPDATE_USER",
        resource: "admin_users",
        resourceId: id,
        details: { fields: Object.keys(updateData) },
        request,
      });

      return apiSuccess({ user });
    } catch (error) {
      console.error("Error updating user:", error);
      return apiError("Failed to update user", 500);
    }
  }

  // ---- DEACTIVATE USER ----
  if (method === "DELETE") {
    const { data: body, error: parseError } = await parseJsonBody<{
      id: string;
      permanent?: boolean;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { id, permanent = false } = body;

    if (!id) {
      return apiError("Missing required field: id");
    }

    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return apiError("User not found", 404);
    }

    try {
      if (permanent) {
        // Hard delete - use with caution
        await db.adminUser.delete({ where: { id } });
        
        await logAuditEvent({
          action: "DELETE_USER_PERMANENT",
          resource: "admin_users",
          resourceId: id,
          details: { email: existing.email, name: existing.name },
          request,
        });

        return apiSuccess({ message: "User permanently deleted" });
      } else {
        // Soft delete - deactivate
        await db.adminUser.update({
          where: { id },
          data: { isActive: false },
        });

        await logAuditEvent({
          action: "DEACTIVATE_USER",
          resource: "admin_users",
          resourceId: id,
          details: { email: existing.email, name: existing.name },
          request,
        });

        return apiSuccess({ message: "User deactivated" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      return apiError("Failed to delete user", 500);
    }
  }

  return apiError("Method not allowed", 405);
}
