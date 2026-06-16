/**
 * Admin — Create New Admin Account
 *
 * Systems-administrator-only form to create a new admin user with a role.
 */

import type { Route } from "./+types/admin-user-new";
import { data, Form, Link, useActionData, useNavigation } from "react-router";
import { requireSystemsAdmin, hashPassword, generateTempPassword } from "~/utils/session.server";
import { sendAdminInviteEmail } from "~/utils/email.server";
import { db } from "~/utils/db.server";
import { ASSIGNABLE_ROLES } from "~/utils/constants";
import { isValidRole, VALID_ROLES } from "~/utils/api-auth.server";

export function meta() {
  return [
    { title: "New admin — Crest Study Consult" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireSystemsAdmin(request);
  return data({}, { headers: { "Cache-Control": "private, no-store" } });
}

type ActionData = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  invitedEmail?: string;
  invitedName?: string;
  invitedRole?: string;
  emailSent?: boolean;
};

export async function action({ request }: Route.ActionArgs) {
  const current = await requireSystemsAdmin(request);
  const formData = await request.formData();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "EDITOR");

  const fieldErrors: Record<string, string> = {};

  if (name.length < 2) fieldErrors.name = "Enter a full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErrors.email = "Enter a valid email.";
  if (!isValidRole(role) || !ASSIGNABLE_ROLES.some((r) => r.value === role)) {
    fieldErrors.role = `Select a valid role (${VALID_ROLES.join(", ")}).`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionData>({ fieldErrors }, { status: 400 });
  }

  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    return data<ActionData>(
      { fieldErrors: { email: "An account with this email already exists." } },
      { status: 400 }
    );
  }

  // Generate a strong one-time password and require a change on first sign-in.
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await db.adminUser.create({
    data: {
      name,
      email,
      role: role as never,
      passwordHash,
      mustChangePassword: true,
    },
    select: { id: true },
  });

  // Email the invitation with the temporary credentials.
  let emailSent = false;
  try {
    const result = await sendAdminInviteEmail({
      to: email,
      name,
      tempPassword,
      role,
      inviterName: current.name,
    });
    emailSent = result.success;
    if (!result.success) {
      console.error("Failed to send admin invite email:", result.error);
    }
  } catch (error) {
    console.error("Failed to send admin invite email:", error);
  }

  try {
    await db.auditLog.create({
      data: {
        action: "CREATE_USER",
        resource: "admin_users",
        resourceId: created.id,
        userId: current.id,
        details: { email, name, role, invited: true, emailSent },
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

  return data<ActionData>({
    success: true,
    invitedEmail: email,
    invitedName: name,
    invitedRole: role,
    emailSent,
  });
}

export default function AdminUserNew() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = actionData?.fieldErrors || {};

  // Success: invitation created and (attempted) emailed.
  if (actionData?.success) {
    return (
      <div className="max-w-2xl space-y-8">
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
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Admin invited</h1>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{actionData.invitedName}</span> (
            <span className="font-mono">{actionData.invitedEmail}</span>) has been added as{" "}
            <span className="font-medium">{actionData.invitedRole}</span>.
          </p>

          {actionData.emailSent ? (
            <div className="mt-4 rounded-xl bg-green-50 text-green-800 ring-1 ring-inset ring-green-100 px-4 py-3 text-sm">
              An invitation email with temporary login details has been sent to{" "}
              <span className="font-medium">{actionData.invitedEmail}</span>. They will be required to
              set a new password on first sign-in before accessing the dashboard.
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 px-4 py-3 text-sm">
              The account was created, but the invitation email could not be sent. Please verify the
              email service configuration and re-issue credentials from the user's edit page.
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
            >
              Back to team
            </Link>
            <Link
              to="/admin/users/new"
              reloadDocument
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Invite another
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Create a new admin</h1>
        <p className="mt-1 text-sm text-gray-600">
          A secure temporary password is generated automatically and emailed to the new admin. They
          must set their own password on first sign-in before accessing the dashboard.
        </p>
      </div>

      <Form method="post" className="space-y-6 bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 sm:p-8">
        {actionData?.error && (
          <div className="rounded-xl bg-red-50 text-red-800 ring-1 ring-inset ring-red-100 px-4 py-3 text-sm">
            {actionData.error}
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
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            placeholder="Jane Doe"
          />
          {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            placeholder="jane@creststudyconsult.com"
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="EDITOR"
            className="block w-full px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.description}
              </option>
            ))}
          </select>
          {errors.role && <p className="mt-1.5 text-xs text-red-600">{errors.role}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Sending invite..." : "Create & send invite"}
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
