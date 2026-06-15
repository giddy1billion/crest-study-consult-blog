/**
 * Admin Team / Users Route
 *
 * Systems-administrator-only management of admin accounts. Lists every admin,
 * supports activate/deactivate and session revocation, and links to the
 * create/edit screens. The canonical systems admin is admin@creststudyconsult.com.
 */

import type { Route } from "./+types/admin-users";
import { data, useLoaderData, Link, useFetcher } from "react-router";
import { requireSystemsAdmin } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { roleLabel, SYSTEMS_ADMIN_EMAIL } from "~/utils/constants";

export function meta() {
  return [
    { title: "Team & access — Crest Study Consult" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const current = await requireSystemsAdmin(request);

  const users = await db.adminUser.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
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

  return data(
    { users, currentUserId: current.id },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const current = await requireSystemsAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const userId = String(formData.get("userId") || "");

  if (!userId) {
    return data({ ok: false, message: "Missing user id" }, { status: 400 });
  }

  const target = await db.adminUser.findUnique({ where: { id: userId } });
  if (!target) {
    return data({ ok: false, message: "User not found" }, { status: 404 });
  }

  // Guard: never let a systems admin lock themselves out.
  const isSelf = target.id === current.id;
  const isCanonical = target.email === SYSTEMS_ADMIN_EMAIL;

  if (intent === "deactivate") {
    if (isSelf) {
      return data(
        { ok: false, message: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }
    if (isCanonical) {
      return data(
        { ok: false, message: "The primary systems administrator cannot be deactivated." },
        { status: 400 }
      );
    }
    // Deactivate and revoke all active sessions at once.
    await db.adminUser.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    await writeAudit(request, current.id, "DEACTIVATE_USER", userId, {
      email: target.email,
    });
    return data({ ok: true, message: `${target.name} deactivated.` });
  }

  if (intent === "activate") {
    await db.adminUser.update({
      where: { id: userId },
      data: { isActive: true },
    });
    await writeAudit(request, current.id, "ACTIVATE_USER", userId, {
      email: target.email,
    });
    return data({ ok: true, message: `${target.name} reactivated.` });
  }

  if (intent === "revoke") {
    await db.adminUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await writeAudit(request, current.id, "REVOKE_SESSIONS", userId, {
      email: target.email,
    });
    return data({ ok: true, message: `Active sessions for ${target.name} revoked.` });
  }

  return data({ ok: false, message: "Unknown action" }, { status: 400 });
}

async function writeAudit(
  request: Request,
  userId: string,
  action: string,
  resourceId: string,
  details: Record<string, unknown>
) {
  try {
    await db.auditLog.create({
      data: {
        action,
        resource: "admin_users",
        resourceId,
        userId,
        details: details as object,
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
}

function formatDate(value: string | Date | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RoleBadge({ role }: { role: string }) {
  const isSystems = role === "SYSTEMS_ADMIN";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        isSystems
          ? "bg-navy-700 text-white"
          : "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100"
      }`}
    >
      {roleLabel(role)}
    </span>
  );
}

export default function AdminUsers() {
  const { users, currentUserId } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok: boolean; message: string }>();

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team &amp; access</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage admin accounts. {activeCount} active of {users.length} total.
          </p>
        </div>
        <Link
          to="/admin/users/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New admin
        </Link>
      </div>

      {/* Flash message */}
      {fetcher.data?.message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            fetcher.data.ok
              ? "bg-green-50 text-green-800 ring-1 ring-inset ring-green-100"
              : "bg-red-50 text-red-800 ring-1 ring-inset ring-red-100"
          }`}
        >
          {fetcher.data.message}
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last login
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isCanonical = user.email === SYSTEMS_ADMIN_EMAIL;
                return (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center text-white text-sm font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.name}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-gray-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          user.isActive ? "text-green-700" : "text-gray-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.isActive ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/users/${user.id}/edit`}
                          className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50"
                        >
                          Edit
                        </Link>
                        <fetcher.Form method="post">
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="intent" value="revoke" />
                          <button
                            type="submit"
                            title="Sign this user out of all sessions"
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
                          >
                            Revoke
                          </button>
                        </fetcher.Form>
                        {user.isActive ? (
                          <fetcher.Form method="post">
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="intent" value="deactivate" />
                            <button
                              type="submit"
                              disabled={isSelf || isCanonical}
                              className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            >
                              Deactivate
                            </button>
                          </fetcher.Form>
                        ) : (
                          <fetcher.Form method="post">
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="intent" value="activate" />
                            <button
                              type="submit"
                              className="text-xs font-medium text-green-600 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50"
                            >
                              Activate
                            </button>
                          </fetcher.Form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
