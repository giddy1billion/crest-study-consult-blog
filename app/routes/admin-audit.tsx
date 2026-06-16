/**
 * Admin — Audit Log (systems administrator only)
 *
 * Read-only, filterable view of the full audit trail recorded across the
 * dashboard and super-admin API. Restricted to SYSTEMS_ADMIN via
 * requireSystemsAdmin so only the system administrator can review all actions.
 */

import type { Route } from "./+types/admin-audit";
import { data, useLoaderData, useSearchParams, Link, Form } from "react-router";
import { requireSystemsAdmin } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { roleLabel } from "~/utils/constants";

export function meta() {
  return [
    { title: "Audit log — Crest Study Consult" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

const PAGE_SIZE = 50;

export async function loader({ request }: Route.LoaderArgs) {
  await requireSystemsAdmin(request);

  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim() || "";
  const resource = url.searchParams.get("resource")?.trim() || "";
  const userId = url.searchParams.get("userId")?.trim() || "";
  const startDate = url.searchParams.get("startDate")?.trim() || "";
  const endDate = url.searchParams.get("endDate")?.trim() || "";
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    const range: Record<string, Date> = {};
    if (startDate) range.gte = new Date(startDate);
    if (endDate) {
      // Include the whole end day.
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.createdAt = range;
  }

  const [logs, total, actors, distinctActions, distinctResources] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.adminUser.findMany({ select: { id: true, name: true, email: true } }),
    db.auditLog.findMany({ select: { action: true }, distinct: ["action"], orderBy: { action: "asc" } }),
    db.auditLog.findMany({ select: { resource: true }, distinct: ["resource"], orderBy: { resource: "asc" } }),
  ]);

  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

  return data(
    {
      logs,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
      actors,
      actorMap,
      actions: distinctActions.map((a) => a.action),
      resources: distinctResources.map((r) => r.resource),
      filters: { action, resource, userId, startDate, endDate },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function formatDateTime(value: string | Date): string {
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionTone(action: string): string {
  if (/DELETE|DEACTIVATE|SPAM|FAILED|REVOKE/.test(action)) return "bg-red-50 text-red-700";
  if (/CREATE|PUBLISH|APPROVE|ACTIVATE|SEND|LOGIN_SUCCESS|ADD/.test(action))
    return "bg-green-50 text-green-700";
  if (/UPDATE|CHANGE|EDIT|RESET|SCHEDULE|SYNC|RESTORE/.test(action))
    return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

export default function AdminAudit() {
  const {
    logs,
    total,
    page,
    totalPages,
    actors,
    actorMap,
    actions,
    resources,
    filters,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const buildPageLink = (targetPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Complete, immutable trail of admin actions. {total.toLocaleString()} event
          {total === 1 ? "" : "s"} recorded.
        </p>
      </div>

      {/* Filters */}
      <Form
        method="get"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-4"
      >
        <select
          name="action"
          defaultValue={filters.action}
          className="px-3 py-2 text-sm bg-gray-50 rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          name="resource"
          defaultValue={filters.resource}
          className="px-3 py-2 text-sm bg-gray-50 rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500"
        >
          <option value="">All resources</option>
          {resources.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          name="userId"
          defaultValue={filters.userId}
          className="px-3 py-2 text-sm bg-gray-50 rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500"
        >
          <option value="">All admins</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="startDate"
          defaultValue={filters.startDate}
          className="px-3 py-2 text-sm bg-gray-50 rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500"
        />
        <input
          type="date"
          name="endDate"
          defaultValue={filters.endDate}
          className="px-3 py-2 text-sm bg-gray-50 rounded-xl ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-green-500"
        />

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
          >
            Filter
          </button>
          <Link
            to="/admin/audit"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Reset
          </Link>
        </div>
      </Form>

      {/* Table */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  When
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Admin
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Resource
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    No audit events match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actor = log.userId ? actorMap[log.userId] : null;
                  const details = (log.details as Record<string, unknown> | null) || null;
                  const actorEmail = (details?.actorEmail as string) || actor?.email;
                  const actorRole = details?.actorRole as string | undefined;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {actor || actorEmail ? (
                          <div>
                            <p className="font-medium text-gray-900">
                              {actor?.name || actorEmail}
                            </p>
                            <p className="text-xs text-gray-500">
                              {actorEmail}
                              {actorRole ? ` · ${roleLabel(actorRole)}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">System / API</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionTone(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.resource}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        {details ? (
                          <code className="block truncate text-xs text-gray-500" title={JSON.stringify(details)}>
                            {JSON.stringify(
                              Object.fromEntries(
                                Object.entries(details).filter(
                                  ([k]) => k !== "actorEmail" && k !== "actorRole"
                                )
                              )
                            )}
                          </code>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  to={buildPageLink(page - 1)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  to={buildPageLink(page + 1)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
