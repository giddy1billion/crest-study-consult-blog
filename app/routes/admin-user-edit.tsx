/**
 * Admin — Edit Admin Account
 *
 * Systems-administrator-only screen to update an admin's name, role, and
 * status, or reset their password (which revokes all active sessions).
 */

import type { Route } from "./+types/admin-user-edit";
import {
  data,
  redirect,
  Form,
  Link,
  useLoaderData,
  useActionData,
  useNavigation,
} from "react-router";
import { requireSystemsAdmin, hashPassword, validatePassword } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { ASSIGNABLE_ROLES, SYSTEMS_ADMIN_EMAIL, roleLabel } from "~/utils/constants";
import { isValidRole } from "~/utils/api-auth.server";

export function meta() {
  return [
    { title: "Edit admin — Crest Study Consult" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const current = await requireSystemsAdmin(request);

  const user = await db.adminUser.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new Response("Admin user not found", { status: 404 });
  }

  return data(
    { user, isSelf: user.id === current.id, isCanonical: user.email === SYSTEMS_ADMIN_EMAIL },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

type ActionData = { error?: string; fieldErrors?: Record<string, string>; success?: string };

export async function action({ request, params }: Route.ActionArgs) {
  const current = await requireSystemsAdmin(request);

  const target = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!target) {
    throw new Response("Admin user not found", { status: 404 });
  }

  const isSelf = target.id === current.id;
  const isCanonical = target.email === SYSTEMS_ADMIN_EMAIL;

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || target.role);
  const isActive = formData.get("isActive") === "on";
  const newPassword = String(formData.get("password") || "");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) fieldErrors.name = "Enter a full name.";

  if (!isValidRole(role) || !ASSIGNABLE_ROLES.some((r) => r.value === role)) {
    fieldErrors.role = "Select a valid role.";
  }

  // Guards to prevent lockout / privilege loss for protected accounts.
  if ((isSelf || isCanonical) && role !== "SYSTEMS_ADMIN") {
    fieldErrors.role = isSelf
      ? "You cannot remove your own systems-admin role."
      : "The primary systems administrator must keep the systems-admin role.";
  }
  if ((isSelf || isCanonical) && !isActive) {
    fieldErrors.isActive = isSelf
      ? "You cannot deactivate your own account."
      : "The primary systems administrator cannot be deactivated.";
  }

  if (newPassword.length > 0) {
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) fieldErrors.password = pwCheck.error || "Weak password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionData>({ fieldErrors }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    name,
    role: role as never,
    isActive,
  };

  // Resetting the password revokes every active session for the account.
  if (newPassword.length > 0) {
    updateData.passwordHash = await hashPassword(newPassword);
    updateData.tokenVersion = { increment: 1 };
  }

  await db.adminUser.update({ where: { id: target.id }, data: updateData });

  try {
    await db.auditLog.create({
      data: {
        action: "UPDATE_USER",
        resource: "admin_users",
        resourceId: target.id,
        userId: current.id,
        details: {
          email: target.email,
          fields: Object.keys(updateData),
          passwordReset: newPassword.length > 0,
        },
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

  return redirect("/admin/users");
}

export default function AdminUserEdit() {
  const { user, isSelf, isCanonical } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = actionData?.fieldErrors || {};
  const locked = isSelf || isCanonical;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to team
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Edit {user.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {user.email} · Current role: {roleLabel(user.role)}
        </p>
      </div>

      <Form method="post" className="space-y-6 bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 sm:p-8">
        {locked && (
          <div className="rounded-xl bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 px-4 py-3 text-sm">
            {isSelf
              ? "This is your own account. You can update your name and password, but you cannot change your own role or status."
              : "This is the primary systems administrator. Its role and status are protected."}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={user.name}
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={ASSIGNABLE_ROLES.some((r) => r.value === user.role) ? user.role : "EDITOR"}
            disabled={locked}
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.description}
              </option>
            ))}
          </select>
          {errors.role && <p className="mt-1.5 text-xs text-red-600">{errors.role}</p>}
        </div>

        {/* Active status */}
        <div className="flex items-start gap-3">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={user.isActive}
            disabled={locked}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-60"
          />
          <div>
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Account is active
            </label>
            <p className="text-xs text-gray-500">
              Inactive accounts cannot sign in and existing sessions are revoked.
            </p>
            {errors.isActive && <p className="mt-1.5 text-xs text-red-600">{errors.isActive}</p>}
          </div>
        </div>

        {/* Reset password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Reset password <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="password"
            name="password"
            type="text"
            autoComplete="new-password"
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all font-mono"
            placeholder="Leave blank to keep current password"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Setting a new password immediately signs this user out of all devices.
          </p>
          {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
          <Link
            to="/admin/users"
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}
