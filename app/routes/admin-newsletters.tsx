/**
 * Admin Newsletters Route
 * 
 * Lists all newsletters with stats, subscriber management,
 * and sync controls for Resend integration.
 */

import type { Route } from "./+types/admin-newsletters";
import { data, useLoaderData, useFetcher } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { 
  syncSubscribersFromResend, 
  getSubscriberStats 
} from "~/utils/email.server";
import { useState } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const [newsletters, stats] = await Promise.all([
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
    { newsletters, stats, recentSubscribers },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync") {
    const result = await syncSubscribersFromResend();
    return data({
      success: result.success,
      message: result.success
        ? `Synced ${result.added} new subscriber(s), updated ${result.updated}`
        : result.error || "Sync failed for an unknown reason. Check the server logs for details.",
    });
  }

  return data({ success: false, message: "Unknown action" });
}

export default function AdminNewsletters() {
  const { newsletters, stats, recentSubscribers } = useLoaderData<typeof loader>();
  const syncFetcher = useFetcher();
  const [activeTab, setActiveTab] = useState<"newsletters" | "subscribers">("newsletters");

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
            onClick={() => setActiveTab("subscribers")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "subscribers"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Recent subscribers
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "newsletters" ? (
        <NewslettersTable newsletters={newsletters} />
      ) : (
        <SubscribersTable subscribers={recentSubscribers} />
      )}
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
