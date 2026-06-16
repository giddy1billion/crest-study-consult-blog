/**
 * Admin Newsletters Route
 * 
 * Lists all newsletters with stats, subscriber management,
 * and sync controls for Resend integration.
 */

import type { Route } from "./+types/admin-newsletters";
import { data, useLoaderData, useFetcher, useSearchParams, useSubmit, Form, Link } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { recordAdminAudit, AUDIT_ACTIONS, AUDIT_RESOURCES } from "~/utils/audit.server";
import { db } from "~/utils/db.server";
import {
  syncSubscribersFromResend,
  getSubscriberStats,
  getSegments,
  getAudience,
  getAudienceStats,
  createSegment,
  deleteSegment,
  addContact,
  importContacts,
  parseContactsCsv,
  assignToSegment,
  removeFromSegment,
  setContactStatus,
  deleteContact,
  bulkSetContactStatus,
  bulkDeleteContacts,
} from "~/utils/email.server";
import { useState } from "react";
import { useEffect, useRef } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q") || undefined;
  const segmentId = url.searchParams.get("segment") || undefined;
  const statusParam = url.searchParams.get("status") || undefined;
  const status =
    statusParam === "ACTIVE" ||
    statusParam === "UNSUBSCRIBED" ||
    statusParam === "BOUNCED" ||
    statusParam === "COMPLAINED"
      ? statusParam
      : undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const [newsletters, stats, segments, audience, audienceStats] = await Promise.all([
    db.newsletter.findMany({
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            category: { select: { name: true, slug: true } },
          },
        },
        _count: {
          select: { recipients: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getSubscriberStats(),
    getSegments(),
    getAudience({ search, segmentId, status, page }),
    getAudienceStats(),
  ]);

  // Get recent subscribers from Subscriber table (primary signup table)
  const recentSubscribers = await db.subscriber.findMany({
    take: 10,
    orderBy: { subscribedAt: "desc" },
    select: {
      id: true,
      email: true,
      source: true,
      isActive: true,
      subscribedAt: true,
    },
  });

  return data(
    {
      newsletters,
      stats,
      recentSubscribers,
      segments,
      audience,
      audienceStats,
      filters: { search: search || "", segmentId: segmentId || "", status: status || "" },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Record every subscriber/segment mutation through this route. Keyed by
  // intent so coverage stays complete as new intents are added.
  if (typeof intent === "string" && intent) {
    const subscriberId = String(formData.get("subscriberId") || "") || null;
    const segmentId = String(formData.get("segmentId") || "") || null;
    const email = String(formData.get("email") || "") || undefined;
    const selectedIds = formData.getAll("subscriberIds").map(String).filter(Boolean);
    const resource = intent === "sync" ? AUDIT_RESOURCES.NEWSLETTERS : AUDIT_RESOURCES.SUBSCRIBERS;
    await recordAdminAudit(actor, {
      request,
      action:
        intent === "sync" ? AUDIT_ACTIONS.SYNC_SUBSCRIBERS : `NEWSLETTER_${intent.toUpperCase().replace(/-/g, "_")}`,
      resource,
      resourceId: subscriberId || segmentId,
      details: {
        intent,
        ...(email ? { email } : {}),
        ...(selectedIds.length ? { count: selectedIds.length } : {}),
      },
    });
  }

  if (intent === "sync") {
    const result = await syncSubscribersFromResend();
    return data({
      success: result.success,
      message: result.success
        ? `Synced ${result.added} new subscriber(s), updated ${result.updated}`
        : result.error || "Sync failed for an unknown reason. Check the server logs for details.",
    });
  }

  // ---- Audience: add a single contact ----
  if (intent === "add-contact") {
    const email = String(formData.get("email") || "");
    const firstName = String(formData.get("firstName") || "");
    const lastName = String(formData.get("lastName") || "");
    const segmentIds = formData.getAll("segmentIds").map(String).filter(Boolean);

    const result = await addContact({ email, firstName, lastName, segmentIds });
    return data({
      success: result.success,
      message: result.success
        ? result.created
          ? `Added ${email}`
          : `Updated existing contact ${email}`
        : result.error || "Failed to add contact",
    });
  }

  // ---- Audience: bulk import (CSV file or pasted text) ----
  if (intent === "import-contacts") {
    const segmentIds = formData.getAll("segmentIds").map(String).filter(Boolean);
    const pasted = String(formData.get("csvText") || "");
    const file = formData.get("csvFile");

    let csv = pasted;
    if (file && typeof file === "object" && "text" in file && (file as File).size > 0) {
      try {
        csv = await (file as File).text();
      } catch (e) {
        return data({ success: false, message: "Could not read the uploaded file" });
      }
    }

    if (!csv.trim()) {
      return data({ success: false, message: "Paste contacts or choose a CSV file to import" });
    }

    const { rows, invalidLines } = parseContactsCsv(csv);
    if (rows.length === 0) {
      return data({
        success: false,
        message: `No valid contacts found. ${invalidLines.length} line(s) had invalid emails.`,
      });
    }

    const result = await importContacts({ rows, segmentIds });
    const parts = [
      `Imported ${result.added} new`,
      `${result.updated} updated`,
      `${result.skipped + invalidLines.length} skipped`,
    ];
    return data({
      success: result.success,
      message:
        parts.join(", ") +
        (result.errors.length ? `. Errors: ${result.errors.slice(0, 3).join("; ")}` : ""),
    });
  }

  // ---- Segments ----
  if (intent === "create-segment") {
    const name = String(formData.get("name") || "");
    const description = String(formData.get("description") || "");
    const color = String(formData.get("color") || "");
    const result = await createSegment({ name, description, color });
    return data({
      success: result.success,
      message: result.success ? `Segment "${name}" created` : result.error || "Failed to create segment",
    });
  }

  if (intent === "delete-segment") {
    const id = String(formData.get("segmentId") || "");
    const result = await deleteSegment(id);
    return data({
      success: result.success,
      message: result.success ? "Segment deleted" : result.error || "Failed to delete segment",
    });
  }

  if (intent === "assign-segment") {
    const subscriberId = String(formData.get("subscriberId") || "");
    const segmentId = String(formData.get("segmentId") || "");
    if (!subscriberId || !segmentId) {
      return data({ success: false, message: "Contact and segment are required" });
    }
    const result = await assignToSegment([subscriberId], segmentId);
    return data({
      success: result.success,
      message: result.success ? "Added to segment" : result.error || "Failed to assign segment",
    });
  }

  if (intent === "remove-segment") {
    const subscriberId = String(formData.get("subscriberId") || "");
    const segmentId = String(formData.get("segmentId") || "");
    const result = await removeFromSegment(subscriberId, segmentId);
    return data({
      success: result.success,
      message: result.success ? "Removed from segment" : result.error || "Failed to remove from segment",
    });
  }

  // ---- Contact status / delete ----
  if (intent === "unsubscribe-contact") {
    const subscriberId = String(formData.get("subscriberId") || "");
    const result = await setContactStatus(subscriberId, "UNSUBSCRIBED");
    return data({
      success: result.success,
      message: result.success ? "Contact unsubscribed" : result.error || "Failed to update contact",
    });
  }

  if (intent === "reactivate-contact") {
    const subscriberId = String(formData.get("subscriberId") || "");
    const result = await setContactStatus(subscriberId, "ACTIVE");
    return data({
      success: result.success,
      message: result.success ? "Contact reactivated" : result.error || "Failed to update contact",
    });
  }

  if (intent === "delete-contact") {
    const subscriberId = String(formData.get("subscriberId") || "");
    const result = await deleteContact(subscriberId);
    return data({
      success: result.success,
      message: result.success ? "Contact deleted" : result.error || "Failed to delete contact",
    });
  }

  // ---- Bulk actions ----
  if (
    intent === "bulk-unsubscribe" ||
    intent === "bulk-reactivate" ||
    intent === "bulk-delete" ||
    intent === "bulk-assign-segment"
  ) {
    const ids = formData.getAll("subscriberIds").map(String).filter(Boolean);
    if (ids.length === 0) {
      return data({ success: false, message: "No contacts selected" });
    }

    if (intent === "bulk-unsubscribe") {
      const result = await bulkSetContactStatus(ids, "UNSUBSCRIBED");
      return data({
        success: result.success,
        message: result.success
          ? `Unsubscribed ${result.count} contact${result.count === 1 ? "" : "s"}`
          : result.error || "Failed to unsubscribe contacts",
      });
    }

    if (intent === "bulk-reactivate") {
      const result = await bulkSetContactStatus(ids, "ACTIVE");
      return data({
        success: result.success,
        message: result.success
          ? `Reactivated ${result.count} contact${result.count === 1 ? "" : "s"}`
          : result.error || "Failed to reactivate contacts",
      });
    }

    if (intent === "bulk-delete") {
      const result = await bulkDeleteContacts(ids);
      return data({
        success: result.success,
        message: result.success
          ? `Deleted ${result.count} contact${result.count === 1 ? "" : "s"}`
          : result.error || "Failed to delete contacts",
      });
    }

    // bulk-assign-segment
    const segmentId = String(formData.get("segmentId") || "");
    if (!segmentId) {
      return data({ success: false, message: "Choose a segment to assign" });
    }
    const result = await assignToSegment(ids, segmentId);
    return data({
      success: result.success,
      message: result.success
        ? `Added ${ids.length} contact${ids.length === 1 ? "" : "s"} to segment`
        : result.error || "Failed to assign segment",
    });
  }

  return data({ success: false, message: "Unknown action" });
}

export default function AdminNewsletters() {
  const { newsletters, stats, recentSubscribers, segments, audience, audienceStats, filters } =
    useLoaderData<typeof loader>();
  const syncFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: "newsletters" | "subscribers" | "audience" =
    tabParam === "subscribers" || tabParam === "audience" ? tabParam : "newsletters";

  const setActiveTab = (tab: "newsletters" | "subscribers" | "audience") => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { preventScrollReset: true }
    );
  };

  const isSyncing = syncFetcher.state !== "idle";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletters</h1>
          <p className="mt-1 text-sm text-gray-600">
            Send articles to subscribers and track engagement
          </p>
        </div>
        <syncFetcher.Form method="post">
          <input type="hidden" name="intent" value="sync" />
          <button
            type="submit"
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <svg 
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? "Syncing..." : "Sync from Resend"}
          </button>
        </syncFetcher.Form>
      </div>

      {/* Sync result message */}
      {syncFetcher.data && (
        <div className={`p-4 rounded-xl text-sm ${
          syncFetcher.data.success 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {syncFetcher.data.message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total subscribers"
          value={stats.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          label="Active"
          value={stats.active}
          variant="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Unsubscribed"
          value={stats.unsubscribed}
          variant="warning"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Bounced"
          value={stats.bounced}
          variant="danger"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("newsletters")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "newsletters"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Newsletters ({newsletters.length})
          </button>
          <button
            onClick={() => setActiveTab("audience")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "audience"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Audience ({audienceStats.total})
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "subscribers"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Recent signups
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "newsletters" && <NewslettersTable newsletters={newsletters} />}
      {activeTab === "audience" && (
        <AudiencePanel
          segments={segments}
          audience={audience}
          audienceStats={audienceStats}
          filters={filters}
        />
      )}
      {activeTab === "subscribers" && <SubscribersTable subscribers={recentSubscribers} />}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  variant = "default" 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variants = {
    default: "bg-white border-gray-200",
    success: "bg-emerald-50 border-emerald-200",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200",
  };

  const iconVariants = {
    default: "text-gray-400",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <div className={`p-5 rounded-xl border ${variants[variant]}`}>
      <div className="flex items-center gap-3">
        <div className={iconVariants[variant]}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

function NewslettersTable({ newsletters }: { newsletters: Array<{
  id: string;
  subject: string;
  status: string;
  scheduledFor: Date | null;
  sentAt: Date | null;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  post: { id: string; title: string; slug: string; category: { name: string; slug: string } };
  _count: { recipients: number };
}> }) {
  if (newsletters.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No newsletters yet</h3>
        <p className="text-gray-500">
          Send your first newsletter from the article editor
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Newsletter
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sent
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Opens
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Clicks
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {newsletters.map((newsletter) => {
            const openRate = newsletter.totalSent > 0 
              ? ((newsletter.totalOpened / newsletter.totalSent) * 100).toFixed(1) 
              : "0";
            const clickRate = newsletter.totalOpened > 0 
              ? ((newsletter.totalClicked / newsletter.totalOpened) * 100).toFixed(1) 
              : "0";

            return (
              <tr key={newsletter.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{newsletter.subject}</div>
                  <div className="text-sm text-gray-500">
                    {newsletter.post.category.name} • {newsletter.post.title}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={newsletter.status} />
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">
                  {newsletter.totalSent.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {newsletter.totalOpened.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">{openRate}%</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {newsletter.totalClicked.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">{clickRate}%</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <a
                    href={`/admin/newsletter/${newsletter.id}`}
                    className="text-teal-600 hover:text-teal-800 text-sm font-medium"
                  >
                    View details
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    SCHEDULED: "bg-blue-100 text-blue-700",
    SENDING: "bg-amber-100 text-amber-700",
    SENT: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${variants[status] || variants.DRAFT}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function SubscribersTable({ subscribers }: { subscribers: Array<{
  id: string;
  email: string;
  source: string | null;
  isActive: boolean;
  subscribedAt: Date;
}> }) {
  if (subscribers.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No subscribers yet</h3>
        <p className="text-gray-500">
          Subscribers will appear here after they sign up
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Subscribed
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {subscribers.map((subscriber) => (
            <tr key={subscriber.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{subscriber.email}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                  subscriber.isActive 
                    ? "bg-emerald-100 text-emerald-700" 
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {subscriber.isActive ? "Active" : "Unsubscribed"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {subscriber.source || "Direct"}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(subscriber.subscribedAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Audience Panel
// ============================================

type SegmentItem = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  subscriberCount: number;
};

type AudienceContactItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  source: string | null;
  subscribedAt: string | Date;
  segments: { id: string; name: string; color: string | null }[];
};

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  ACTIVE: { label: "Active", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  UNSUBSCRIBED: { label: "Unsubscribed", dot: "bg-gray-400", chip: "bg-gray-100 text-gray-600" },
  BOUNCED: { label: "Bounced", dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  COMPLAINED: { label: "Complained", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
};

const SEGMENT_PALETTE = [
  "#0d9488", // teal
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#ea580c", // orange
  "#16a34a", // green
  "#ca8a04", // gold
  "#475569", // slate
];

function contactInitials(email: string, first: string | null, last: string | null): string {
  const fromName = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.trim();
  if (fromName) return fromName.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function AudiencePanel({
  segments,
  audience,
  audienceStats,
  filters,
}: {
  segments: SegmentItem[];
  audience: { contacts: AudienceContactItem[]; total: number; page: number; pageSize: number };
  audienceStats: { total: number; active: number; unsubscribed: number; bounced: number; segments: number };
  filters: { search: string; segmentId: string; status: string };
}) {
  const addFetcher = useFetcher<{ success: boolean; message: string }>();
  const importFetcher = useFetcher<{ success: boolean; message: string }>();
  const segmentFetcher = useFetcher<{ success: boolean; message: string }>();
  const bulkFetcher = useFetcher<{ success: boolean; message: string }>();
  const submit = useSubmit();

  // ---- Row selection ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = audience.contacts.map((c) => c.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id)) && !allSelected;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  const selectedIds = Array.from(selected);

  // ---- Bulk action modal state ----
  const [bulkModal, setBulkModal] = useState<null | "delete" | "unsubscribe" | "reactivate">(null);
  const [bulkSegmentId, setBulkSegmentId] = useState("");
  const [segmentToDelete, setSegmentToDelete] = useState<SegmentItem | null>(null);

  const runBulk = (intent: string, extra?: Record<string, string>) => {
    const fd = new FormData();
    fd.set("intent", intent);
    selectedIds.forEach((id) => fd.append("subscriberIds", id));
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
    bulkFetcher.submit(fd, { method: "post" });
  };

  // Clear selection + close modal once a bulk action completes successfully.
  useEffect(() => {
    if (bulkFetcher.state === "idle" && bulkFetcher.data?.success) {
      clearSelection();
      setBulkModal(null);
      setBulkSegmentId("");
    }
  }, [bulkFetcher.state, bulkFetcher.data]);

  // Close segment-delete modal once that action completes successfully.
  useEffect(() => {
    if (segmentFetcher.state === "idle" && segmentFetcher.data?.success) {
      setSegmentToDelete(null);
    }
  }, [segmentFetcher.state, segmentFetcher.data]);

  const bulkBusy = bulkFetcher.state !== "idle";

  const addFormRef = useRef<HTMLFormElement>(null);
  const importFormRef = useRef<HTMLFormElement>(null);
  const segmentFormRef = useRef<HTMLFormElement>(null);
  const filterFormRef = useRef<HTMLFormElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset entry forms after a successful submission so they're ready for reuse.
  useEffect(() => {
    if (addFetcher.state === "idle" && addFetcher.data?.success) addFormRef.current?.reset();
  }, [addFetcher.state, addFetcher.data]);
  useEffect(() => {
    if (importFetcher.state === "idle" && importFetcher.data?.success) importFormRef.current?.reset();
  }, [importFetcher.state, importFetcher.data]);
  useEffect(() => {
    if (segmentFetcher.state === "idle" && segmentFetcher.data?.success) segmentFormRef.current?.reset();
  }, [segmentFetcher.state, segmentFetcher.data]);

  const totalPages = Math.max(1, Math.ceil(audience.total / audience.pageSize));
  const hasFilters = Boolean(filters.search || filters.segmentId || filters.status);

  const inputCls =
    "w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 hover:border-gray-300";

  const submitFilters = () => {
    if (filterFormRef.current) submit(filterFormRef.current, { preventScrollReset: true });
  };
  const onSearchChange = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(submitFilters, 400);
  };

  const showingFrom = (audience.page - 1) * audience.pageSize + 1;
  const showingTo = Math.min(audience.page * audience.pageSize, audience.total);

  return (
    <div className="space-y-8">
      {/* Action result banners (dismissible, auto-refresh on new message) */}
      <ActionBanner data={addFetcher.data} />
      <ActionBanner data={importFetcher.data} />
      <ActionBanner data={segmentFetcher.data} />
      <ActionBanner data={bulkFetcher.data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add single contact */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </span>
            <h3 className="font-semibold text-gray-900">Add a contact</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Manually add a single subscriber.</p>
          <addFetcher.Form ref={addFormRef} method="post" className="space-y-3">
            <input type="hidden" name="intent" value="add-contact" />
            <input
              type="email"
              name="email"
              required
              placeholder="email@example.com"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" name="firstName" placeholder="First name" className={inputCls} />
              <input type="text" name="lastName" placeholder="Last name" className={inputCls} />
            </div>
            {segments.length > 0 && (
              <SegmentChips segments={segments} name="segmentIds" label="Assign to segments" />
            )}
            <button
              type="submit"
              disabled={addFetcher.state !== "idle"}
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addFetcher.state !== "idle" && <Spinner />}
              {addFetcher.state !== "idle" ? "Adding…" : "Add contact"}
            </button>
          </addFetcher.Form>
        </section>

        {/* Import contacts */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </span>
            <h3 className="font-semibold text-gray-900">Import contacts</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upload a CSV or paste rows. Columns:{" "}
            <code className="text-xs font-mono text-gray-600">email, firstName, lastName</code>.
          </p>
          <importFetcher.Form
            ref={importFormRef}
            method="post"
            encType="multipart/form-data"
            className="space-y-3"
          >
            <input type="hidden" name="intent" value="import-contacts" />
            <input
              type="file"
              name="csvFile"
              accept=".csv,text/csv,text/plain"
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer"
            />
            <textarea
              name="csvText"
              rows={3}
              placeholder={"email@example.com, Jane, Doe\nanother@example.com, John, Smith"}
              className={`${inputCls} font-mono`}
            />
            {segments.length > 0 && (
              <SegmentChips
                segments={segments}
                name="segmentIds"
                label="Assign imported contacts to segments"
              />
            )}
            <button
              type="submit"
              disabled={importFetcher.state !== "idle"}
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-xl hover:bg-gray-900 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importFetcher.state !== "idle" && <Spinner />}
              {importFetcher.state !== "idle" ? "Importing…" : "Import"}
            </button>
          </importFetcher.Form>
        </section>

        {/* Segments management */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50 text-teal-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 014 9V4a1 1 0 011-1z" />
              </svg>
            </span>
            <h3 className="font-semibold text-gray-900">Segments</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">Group contacts for targeted sends.</p>
          <segmentFetcher.Form ref={segmentFormRef} method="post" className="space-y-2.5 mb-4">
            <input type="hidden" name="intent" value="create-segment" />
            <div className="flex gap-2">
              <input
                type="text"
                name="name"
                required
                placeholder="New segment name"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={segmentFetcher.state !== "idle"}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-sm transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {segmentFetcher.state !== "idle" ? <Spinner /> : "Create"}
              </button>
            </div>
            <input
              type="text"
              name="description"
              placeholder="Short description (optional)"
              className={inputCls}
            />
            <ColorSwatchPicker name="color" />
          </segmentFetcher.Form>
          {segments.length === 0 ? (
            <div className="text-center py-6 px-3 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">No segments yet.</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Create one above to target sends.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {segments.map((s, i) => (
                <li
                  key={s.id}
                  className="group flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color || SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-800 truncate">{s.name}</span>
                      {s.description && (
                        <span className="block text-xs text-gray-400 truncate">{s.description}</span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="px-1.5 py-0.5 text-xs font-medium text-gray-500 bg-white rounded-md border border-gray-200">
                      {s.subscriberCount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSegmentToDelete(s)}
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      title="Delete segment"
                      aria-label={`Delete segment ${s.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Audience sub-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Contacts" value={audienceStats.total} tone="gray" icon="users" />
        <MiniStat label="Active" value={audienceStats.active} tone="emerald" icon="check" />
        <MiniStat label="Unsubscribed" value={audienceStats.unsubscribed} tone="amber" icon="minus" />
        <MiniStat label="Segments" value={audienceStats.segments} tone="teal" icon="tag" />
      </div>

      {/* Toolbar: search + filters */}
      <div className="space-y-3">
        <Form
          ref={filterFormRef}
          method="get"
          className="flex flex-col sm:flex-row gap-3"
          preventScrollReset
        >
          <input type="hidden" name="tab" value="audience" />
          <div className="relative flex-1">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              onChange={onSearchChange}
              placeholder="Search by email or name"
              className={`${inputCls} pl-10`}
            />
          </div>
          <select
            name="segment"
            defaultValue={filters.segmentId}
            onChange={submitFilters}
            className={`${inputCls} sm:w-48`}
          >
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            onChange={submitFilters}
            className={`${inputCls} sm:w-40`}
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="BOUNCED">Bounced</option>
            <option value="COMPLAINED">Complained</option>
          </select>
          <noscript>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-xl hover:bg-gray-900"
            >
              Filter
            </button>
          </noscript>
        </Form>
        {hasFilters && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              Showing <span className="font-medium text-gray-900">{audience.total.toLocaleString()}</span>{" "}
              matching {audience.total === 1 ? "contact" : "contacts"}
            </span>
            <Link
              to="?tab=audience"
              preventScrollReset
              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </Link>
          </div>
        )}
      </div>

      {/* Contacts table */}
      {audience.contacts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-50 text-gray-300 mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {hasFilters ? "No contacts match your filters" : "No contacts yet"}
          </h3>
          <p className="text-gray-500">
            {hasFilters ? "Try adjusting your search or filters." : "Add or import contacts above to get started."}
          </p>
          {hasFilters && (
            <Link
              to="?tab=audience"
              preventScrollReset
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Bulk action bar */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-teal-50 border-b border-teal-100">
              <span className="text-sm font-medium text-teal-900">
                {selectedIds.length} selected
              </span>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                {segments.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={bulkSegmentId}
                      onChange={(e) => setBulkSegmentId(e.target.value)}
                      disabled={bulkBusy}
                      className="text-sm bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-50"
                      aria-label="Segment to add selected contacts to"
                    >
                      <option value="">Add to segment…</option>
                      {segments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!bulkSegmentId || bulkBusy}
                      onClick={() => runBulk("bulk-assign-segment", { segmentId: bulkSegmentId })}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm transition-all disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setBulkModal("unsubscribe")}
                  className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-all disabled:opacity-50"
                >
                  Unsubscribe
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setBulkModal("reactivate")}
                  className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-all disabled:opacity-50"
                >
                  Reactivate
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => setBulkModal("delete")}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="pl-6 pr-2 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer"
                      aria-label="Select all contacts on this page"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Segments</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Added</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audience.contacts.map((c, i) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    segments={segments}
                    index={i}
                    selected={selected.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk confirmation modals */}
      <ConfirmModal
        open={bulkModal === "delete"}
        title={`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}?`}
        message="This permanently removes the selected contacts and cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={bulkBusy}
        onConfirm={() => runBulk("bulk-delete")}
        onCancel={() => setBulkModal(null)}
      />
      <ConfirmModal
        open={bulkModal === "unsubscribe"}
        title={`Unsubscribe ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}?`}
        message="They will stop receiving newsletters. You can reactivate them later."
        confirmLabel="Unsubscribe"
        tone="warning"
        busy={bulkBusy}
        onConfirm={() => runBulk("bulk-unsubscribe")}
        onCancel={() => setBulkModal(null)}
      />
      <ConfirmModal
        open={bulkModal === "reactivate"}
        title={`Reactivate ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}?`}
        message="They will be marked active and eligible to receive newsletters again."
        confirmLabel="Reactivate"
        tone="primary"
        busy={bulkBusy}
        onConfirm={() => runBulk("bulk-reactivate")}
        onCancel={() => setBulkModal(null)}
      />
      <ConfirmModal
        open={segmentToDelete !== null}
        title="Delete segment?"
        message={
          <>
            This removes the{" "}
            <span className="font-medium text-gray-900">{segmentToDelete?.name}</span> grouping.
            Contacts are kept — only the segment is deleted.
          </>
        }
        confirmLabel="Delete segment"
        tone="danger"
        busy={segmentFetcher.state !== "idle"}
        onConfirm={() => {
          if (segmentToDelete) {
            segmentFetcher.submit(
              { intent: "delete-segment", segmentId: segmentToDelete.id },
              { method: "post" }
            );
          }
        }}
        onCancel={() => setSegmentToDelete(null)}
      />

      {/* Pagination */}
      {audience.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{showingFrom.toLocaleString()}</span>–
            <span className="font-medium text-gray-900">{showingTo.toLocaleString()}</span> of{" "}
            <span className="font-medium text-gray-900">{audience.total.toLocaleString()}</span>
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <PageLink disabled={audience.page <= 1} page={audience.page - 1} filters={filters} label="Previous" />
              <span className="text-sm text-gray-500 px-1">
                Page {audience.page} of {totalPages}
              </span>
              <PageLink disabled={audience.page >= totalPages} page={audience.page + 1} filters={filters} label="Next" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  segments,
  index,
  selected,
  onToggle,
}: {
  contact: AudienceContactItem;
  segments: SegmentItem[];
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const availableSegments = segments.filter(
    (s) => !contact.segments.some((cs) => cs.id === s.id)
  );
  const statusMeta = STATUS_META[contact.status] ?? STATUS_META.UNSUBSCRIBED;
  const added = new Date(contact.subscribedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const avatarColor = SEGMENT_PALETTE[index % SEGMENT_PALETTE.length];

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${busy ? "opacity-60" : ""} ${selected ? "bg-teal-50/40" : ""}`}>
      {/* Select */}
      <td className="pl-6 pr-2 py-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer"
          aria-label={`Select ${contact.email}`}
        />
      </td>

      {/* Contact */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold text-white flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
            aria-hidden="true"
          >
            {contactInitials(contact.email, contact.firstName, contact.lastName)}
          </span>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{name || contact.email}</div>
            {name ? (
              <div className="text-sm text-gray-500 truncate">{contact.email}</div>
            ) : (
              contact.source && (
                <div className="text-xs text-gray-400 truncate">via {contact.source}</div>
              )
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${statusMeta.chip}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
          {statusMeta.label}
        </span>
      </td>

      {/* Segments */}
      <td className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {contact.segments.length === 0 && availableSegments.length === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
          {contact.segments.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-full"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: s.color || "#9ca3af" }}
              />
              {s.name}
              <fetcher.Form method="post" className="inline-flex">
                <input type="hidden" name="intent" value="remove-segment" />
                <input type="hidden" name="subscriberId" value={contact.id} />
                <input type="hidden" name="segmentId" value={s.id} />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  aria-label={`Remove ${contact.email} from ${s.name}`}
                  title={`Remove from ${s.name}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </fetcher.Form>
            </span>
          ))}
          {availableSegments.length > 0 && (
            <fetcher.Form method="post" className="inline-flex">
              <input type="hidden" name="intent" value="assign-segment" />
              <input type="hidden" name="subscriberId" value={contact.id} />
              <select
                name="segmentId"
                defaultValue=""
                disabled={busy}
                onChange={(e) => {
                  if (e.target.value) fetcher.submit(e.target.form);
                }}
                className="text-xs border border-dashed border-gray-300 rounded-full pl-2 pr-1 py-0.5 text-gray-500 bg-white hover:border-teal-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors disabled:opacity-40"
                aria-label={`Add ${contact.email} to a segment`}
              >
                <option value="" disabled>
                  + segment
                </option>
                {availableSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </fetcher.Form>
          )}
        </div>
      </td>

      {/* Added date */}
      <td className="px-6 py-4 hidden md:table-cell">
        <span className="text-sm text-gray-500">{added}</span>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {contact.status === "ACTIVE" ? (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="unsubscribe-contact" />
              <input type="hidden" name="subscriberId" value={contact.id} />
              <button
                type="submit"
                disabled={busy}
                className="px-2.5 py-1.5 text-xs font-medium text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-40"
              >
                Unsubscribe
              </button>
            </fetcher.Form>
          ) : (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="reactivate-contact" />
              <input type="hidden" name="subscriberId" value={contact.id} />
              <button
                type="submit"
                disabled={busy}
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-40"
              >
                Reactivate
              </button>
            </fetcher.Form>
          )}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete-contact" />
            <input type="hidden" name="subscriberId" value={contact.id} />
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              aria-label={`Delete ${contact.email}`}
              title="Delete contact"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <ConfirmModal
              open={confirmDelete}
              title="Delete contact?"
              message={
                <>
                  This permanently removes{" "}
                  <span className="font-medium text-gray-900">{contact.email}</span> and cannot be
                  undone.
                </>
              }
              confirmLabel="Delete"
              tone="danger"
              busy={busy}
              onConfirm={() => {
                setConfirmDelete(false);
                fetcher.submit(
                  { intent: "delete-contact", subscriberId: contact.id },
                  { method: "post" }
                );
              }}
              onCancel={() => setConfirmDelete(false)}
            />
          </fetcher.Form>
        </div>
      </td>
    </tr>
  );
}

function PageLink({
  page,
  filters,
  label,
  disabled,
}: {
  page: number;
  filters: { search: string; segmentId: string; status: string };
  label: string;
  disabled: boolean;
}) {
  const params = new URLSearchParams();
  params.set("tab", "audience");
  if (filters.search) params.set("q", filters.search);
  if (filters.segmentId) params.set("segment", filters.segmentId);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(page));

  if (disabled) {
    return (
      <span className="px-3 py-1.5 text-sm text-gray-300 border border-gray-100 rounded-xl cursor-not-allowed select-none">
        {label}
      </span>
    );
  }
  return (
    <Link
      to={`?${params.toString()}`}
      preventScrollReset
      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
    >
      {label}
    </Link>
  );
}

const MINISTAT_TONES: Record<string, { value: string; iconBg: string; iconColor: string }> = {
  gray: { value: "text-gray-900", iconBg: "bg-gray-100", iconColor: "text-gray-500" },
  emerald: { value: "text-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
  amber: { value: "text-amber-600", iconBg: "bg-amber-50", iconColor: "text-amber-500" },
  teal: { value: "text-teal-600", iconBg: "bg-teal-50", iconColor: "text-teal-500" },
};

function MiniStat({
  label,
  value,
  tone = "gray",
  icon,
}: {
  label: string;
  value: number;
  tone?: "gray" | "emerald" | "amber" | "teal";
  icon?: "users" | "check" | "minus" | "tag";
}) {
  const t = MINISTAT_TONES[tone];
  const paths: Record<string, string> = {
    users:
      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    minus: "M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
    tag: "M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 014 9V4a1 1 0 011-1z",
  };
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm">
      {icon && (
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${t.iconBg} ${t.iconColor}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={paths[icon]} />
          </svg>
        </span>
      )}
      <div>
        <p className={`text-xl font-bold ${t.value}`}>{value.toLocaleString()}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
}

/** Dismissible action banner that re-appears whenever the message changes. */
function ActionBanner({ data }: { data?: { success: boolean; message: string } }) {
  const [dismissed, setDismissed] = useState(false);
  const message = data?.message;
  const success = data?.success ?? false;

  useEffect(() => {
    setDismissed(false);
  }, [message]);

  if (!message || dismissed) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 p-4 rounded-2xl text-sm border ${
        success
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 ${success ? "text-emerald-500" : "text-red-500"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {success ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={`flex-shrink-0 rounded-md p-0.5 transition-colors ${
          success ? "hover:bg-emerald-100" : "hover:bg-red-100"
        }`}
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Accessible checkbox group rendered as selectable pills. */
function SegmentChips({
  segments,
  name,
  label,
}: {
  segments: SegmentItem[];
  name: string;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-gray-500 mb-1.5">
        {label} <span className="font-normal text-gray-400">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {segments.map((s, i) => (
          <label
            key={s.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-gray-200 cursor-pointer text-gray-600 hover:border-teal-300 transition-colors has-[:checked]:bg-teal-50 has-[:checked]:border-teal-300 has-[:checked]:text-teal-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500/30"
          >
            <input type="checkbox" name={name} value={s.id} className="sr-only" />
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color || SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }}
            />
            {s.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Radio-based color swatch picker for new segments. */
function ColorSwatchPicker({ name }: { name: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Segment color</legend>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 mr-0.5">Color</span>
        {SEGMENT_PALETTE.map((color, i) => (
          <label
            key={color}
            className="relative cursor-pointer"
            title={color}
          >
            <input
              type="radio"
              name={name}
              value={color}
              defaultChecked={i === 0}
              className="sr-only peer"
            />
            <span
              className="block w-5 h-5 rounded-full ring-offset-1 peer-checked:ring-2 peer-checked:ring-gray-400 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/40 transition-all"
              style={{ backgroundColor: color }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Small inline spinner for button loading states. */
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Branded confirmation modal (replaces native confirm()). */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  if (!open) return null;

  const toneStyles: Record<string, { iconBg: string; iconColor: string; btn: string; icon: string }> = {
    danger: {
      iconBg: "bg-red-50",
      iconColor: "text-red-600",
      btn: "bg-red-600 hover:bg-red-700",
      icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    },
    warning: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      btn: "bg-amber-600 hover:bg-amber-700",
      icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    },
    primary: {
      iconBg: "bg-teal-50",
      iconColor: "text-teal-600",
      btn: "bg-teal-600 hover:bg-teal-700",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };
  const t = toneStyles[tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <div className="flex items-start gap-4">
          <span className={`flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0 ${t.iconBg} ${t.iconColor}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={t.icon} />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 id="confirm-modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <div className="mt-1.5 text-sm text-gray-600">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm transition-all disabled:opacity-50 ${t.btn}`}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
