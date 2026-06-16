/**
 * Admin — Forced / voluntary password change
 *
 * Newly invited admins land here on first sign-in (mustChangePassword) and
 * cannot reach the dashboard until they set their own password. Existing admins
 * may also use this page to change their password voluntarily.
 *
 * On success the account's tokenVersion is incremented, which revokes every
 * other active session, and a fresh session is issued for the current device.
 */

import type { Route } from "./+types/admin-change-password";
import { data, redirect, Form, useActionData, useNavigation, useLoaderData } from "react-router";
import {
  requireAdmin,
  verifyLogin,
  hashPassword,
  validatePassword,
  createAdminSession,
} from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { BRAND } from "~/utils/constants";

export function meta() {
  return [
    { title: `Set your password — ${BRAND.name}` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Must be signed in. Does NOT enforce mustChangePassword here (avoids a loop).
  const user = await requireAdmin(request);
  return data(
    { name: user.name, forced: Boolean(user.mustChangePassword) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

type ActionData = { error?: string; fieldErrors?: Record<string, string> };

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  const formData = await request.formData();

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const fieldErrors: Record<string, string> = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "Enter your current password.";
  }

  const strength = validatePassword(newPassword);
  if (!strength.valid) {
    fieldErrors.newPassword = strength.error || "Choose a stronger password.";
  }
  if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (currentPassword && newPassword && currentPassword === newPassword) {
    fieldErrors.newPassword = "Choose a password different from your current one.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionData>({ fieldErrors }, { status: 400 });
  }

  // Verify the current password against the stored hash.
  const verified = await verifyLogin(user.email, currentPassword);
  if (!verified) {
    return data<ActionData>(
      { fieldErrors: { currentPassword: "Your current password is incorrect." } },
      { status: 400 }
    );
  }

  // Update the password, clear the first-login flag, and revoke other sessions.
  const updated = await db.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      tokenVersion: { increment: 1 },
    },
    select: { id: true, email: true, name: true, role: true, tokenVersion: true },
  });

  try {
    await db.auditLog.create({
      data: {
        action: "PASSWORD_CHANGED",
        resource: "admin_users",
        resourceId: updated.id,
        userId: updated.id,
        details: { self: true, actorEmail: updated.email, actorRole: updated.role },
        ipAddress:
          request.headers.get("X-Forwarded-For") ||
          request.headers.get("X-Real-IP") ||
          null,
        userAgent: request.headers.get("User-Agent") || null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }

  // Issue a fresh session carrying the new tokenVersion, then enter the dashboard.
  return createAdminSession({
    request,
    userId: updated.id,
    userData: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
    },
    tokenVersion: updated.tokenVersion,
    redirectTo: "/admin",
  });
}

export default function AdminChangePassword() {
  const { name, forced } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = actionData?.fieldErrors || {};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={BRAND.logo}
            alt={BRAND.name}
            className="h-12 mx-auto"
            width={120}
            height={48}
          />
          <h1 className="mt-6 text-2xl font-bold text-gray-900">
            {forced ? "Set your password" : "Change your password"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {forced
              ? `Welcome, ${name}. For your security, set a new password before accessing the dashboard.`
              : "Choose a new password for your admin account."}
          </p>
        </div>

        <Form
          method="post"
          className="space-y-5 bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 sm:p-8"
        >
          {actionData?.error && (
            <div className="rounded-xl bg-red-50 text-red-800 ring-1 ring-inset ring-red-100 px-4 py-3 text-sm">
              {actionData.error}
            </div>
          )}

          {/* Current / temporary password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              {forced ? "Temporary password" : "Current password"}
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
              placeholder={forced ? "From your invitation email" : "Your current password"}
            />
            {errors.currentPassword && (
              <p className="mt-1.5 text-xs text-red-600">{errors.currentPassword}</p>
            )}
          </div>

          {/* New password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
              placeholder="At least 12 characters"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Minimum 12 characters with an uppercase letter, a lowercase letter, and a number.
            </p>
            {errors.newPassword && (
              <p className="mt-1.5 text-xs text-red-600">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
              placeholder="Re-enter your new password"
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Saving..." : "Set password & continue"}
          </button>
        </Form>
      </div>
    </div>
  );
}
