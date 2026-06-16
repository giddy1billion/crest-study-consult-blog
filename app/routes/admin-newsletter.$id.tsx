/**
 * Admin Newsletter Detail Route
 * 
 * Shows detailed analytics for a specific newsletter,
 * including per-recipient engagement data.
 */

import type { Route } from "./+types/admin-newsletter.$id";
import { data, useLoaderData, useFetcher, Link } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { recordAdminAudit, AUDIT_ACTIONS, AUDIT_RESOURCES } from "~/utils/audit.server";
import { db } from "~/utils/db.server";
import { sendTestNewsletter, sendNewsletter, checkEmailStatus, resendTestNewsletter, getSegments } from "~/utils/email.server";
import { useState } from "react";
import type { Newsletter, NewsletterTestSend, NewsletterRecipient, NewsletterSubscriber } from "@prisma/client";

// Type for test send with status
type TestSendWithStatus = NewsletterTestSend & {
  deliveryStatus?: string;
};

// Type for the newsletter with included relations
type NewsletterWithRelations = Newsletter & {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    heroImage: string | null;
    heroImageAlt: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    readingTimeMin: number | null;
    category: { name: string; slug: string };
  };
  testSends: TestSendWithStatus[];
  recipients: (NewsletterRecipient & {
    subscriber: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  })[];
};

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);

  const newsletter = await db.newsletter.findUnique({
    where: { id: params.id },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          heroImage: true,
          heroImageAlt: true,
          metaTitle: true,
          metaDescription: true,
          readingTimeMin: true,
          category: { select: { name: true, slug: true } },
        },
      },
      testSends: {
        orderBy: { sentAt: "desc" },
        take: 5,
        select: {
          id: true,
          recipients: true,
          messageId: true,
          status: true,
          sentAt: true,
        },
      },
      recipients: {
        orderBy: { sentAt: "desc" },
        include: {
          subscriber: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  }) as NewsletterWithRelations | null;

  if (!newsletter) {
    throw new Response("Newsletter not found", { status: 404 });
  }

  // Check delivery status for recent test sends with messageId
  const testSendsWithStatus = await Promise.all(
    newsletter.testSends.map(async (testSend) => {
      if (testSend.messageId && testSend.status === "sent") {
        const { status } = await checkEmailStatus(testSend.messageId);
        // Update status in DB if changed
        if (status !== "sent" && status !== "unknown") {
          await db.newsletterTestSend.update({
            where: { id: testSend.id },
            data: { status },
          });
          return { ...testSend, status, deliveryStatus: status };
        }
        return { ...testSend, deliveryStatus: status };
      }
      return { ...testSend, deliveryStatus: testSend.status };
    })
  );

  const newsletterWithStatus = {
    ...newsletter,
    testSends: testSendsWithStatus,
  };

  const segments = await getSegments();

  return data(
    { newsletter: newsletterWithStatus, segments },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    }
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const actor = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "test") {
    const emails = formData.get("testEmails") as string;
    const testEmails = emails.split(",").map((e) => e.trim()).filter(Boolean);

    if (testEmails.length === 0) {
      return data({ success: false, message: "Please enter at least one email" });
    }

    const result = await sendTestNewsletter({
      newsletterId: params.id!,
      testEmails,
    });

    return data({
      success: result.success,
      message: result.success
        ? `Test sent to ${testEmails.join(", ")}${result.messageId ? ` (ID: ${result.messageId})` : ""}`
        : result.error,
    });
  }

  if (intent === "resend") {
    const testSendId = formData.get("testSendId") as string;

    if (!testSendId) {
      return data({ success: false, message: "Test send ID required" });
    }

    const result = await resendTestNewsletter(testSendId);

    return data({
      success: result.success,
      message: result.success
        ? `Resent successfully${result.messageId ? ` (ID: ${result.messageId})` : ""}`
        : result.error,
    });
  }

  if (intent === "send") {
    const segmentIds = formData.getAll("segmentIds").map(String).filter(Boolean);
    const result = await sendNewsletter({
      newsletterId: params.id!,
      sendImmediately: true,
      segmentIds,
    });

    if (result.success) {
      await recordAdminAudit(actor, {
        request,
        action: AUDIT_ACTIONS.SEND_NEWSLETTER,
        resource: AUDIT_RESOURCES.NEWSLETTERS,
        resourceId: params.id,
        details: { sentCount: result.sentCount, segmentIds },
      });
    }

    return data({
      success: result.success,
      message: result.success
        ? `Newsletter sent to ${result.sentCount} subscribers`
        : result.error,
    });
  }

  if (intent === "schedule") {
    const scheduledFor = formData.get("scheduledFor") as string;
    const segmentIds = formData.getAll("segmentIds").map(String).filter(Boolean);

    if (!scheduledFor) {
      return data({ success: false, message: "Please select a date and time" });
    }

    const result = await sendNewsletter({
      newsletterId: params.id!,
      sendImmediately: false,
      scheduledFor: new Date(scheduledFor),
      segmentIds,
    });

    if (result.success) {
      await recordAdminAudit(actor, {
        request,
        action: AUDIT_ACTIONS.SCHEDULE_NEWSLETTER,
        resource: AUDIT_RESOURCES.NEWSLETTERS,
        resourceId: params.id,
        details: { scheduledFor, segmentIds },
      });
    }

    return data({
      success: result.success,
      message: result.success
        ? `Scheduled for ${new Date(scheduledFor).toLocaleString()}`
        : result.error,
    });
  }

  if (intent === "update") {
    const subject = formData.get("subject") as string;
    const preheader = formData.get("preheader") as string;

    await db.newsletter.update({
      where: { id: params.id },
      data: {
        subject: subject || undefined,
        preheader: preheader || null,
      },
    });

    await recordAdminAudit(actor, {
      request,
      action: AUDIT_ACTIONS.UPDATE_NEWSLETTER,
      resource: AUDIT_RESOURCES.NEWSLETTERS,
      resourceId: params.id,
      details: { subject },
    });

    return data({ success: true, message: "Newsletter updated" });
  }

  return data({ success: false, message: "Unknown action" });
}

export default function AdminNewsletterDetail() {
  const { newsletter, segments } = useLoaderData<typeof loader>();
  const actionFetcher = useFetcher();
  const [testEmails, setTestEmails] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [subject, setSubject] = useState(newsletter.subject);
  const [preheader, setPreheader] = useState(newsletter.preheader || "");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

  const toggleSegment = (id: string) =>
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const audienceLabel =
    selectedSegments.length === 0
      ? "all active subscribers"
      : `${selectedSegments.length} selected segment${selectedSegments.length > 1 ? "s" : ""}`;

  const isSubmitting = actionFetcher.state !== "idle";
  const isSent = newsletter.status === "SENT";
  const isScheduled = newsletter.status === "SCHEDULED";
  const [showPreview, setShowPreview] = useState(true);

  // Calculate stats
  const openRate = newsletter.totalSent > 0
    ? ((newsletter.totalOpened / newsletter.totalSent) * 100).toFixed(1)
    : "0";
  const clickRate = newsletter.totalOpened > 0
    ? ((newsletter.totalClicked / newsletter.totalOpened) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/admin/newsletters"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to newsletters
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{newsletter.subject}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {newsletter.post.category.name} • {newsletter.post.title}
          </p>
        </div>
        <StatusBadge status={newsletter.status} />
      </div>

      {/* Action result message */}
      {actionFetcher.data && (
        <div className={`p-4 rounded-xl text-sm ${
          actionFetcher.data.success
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {actionFetcher.data.message}
        </div>
      )}

      {/* Email Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Email preview</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              This is exactly how the newsletter will appear in recipients' inboxes
            </p>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>
        {showPreview && (
          <div className="p-6 bg-gray-100">
            <div className="mx-auto max-w-[640px] shadow-lg rounded-xl overflow-hidden">
              <iframe
                src={`/api/newsletter-preview/${newsletter.id}`}
                title="Newsletter Preview"
                className="w-full bg-white"
                style={{ height: "800px", border: "none" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {isSent && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total sent" value={newsletter.totalSent} />
          <StatCard
            label="Opens"
            value={newsletter.totalOpened}
            subtext={`${openRate}% open rate`}
            variant="success"
          />
          <StatCard
            label="Clicks"
            value={newsletter.totalClicked}
            subtext={`${clickRate}% CTR`}
            variant="info"
          />
          <StatCard
            label="Sent at"
            value={newsletter.sentAt
              ? new Date(newsletter.sentAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-"
            }
            isText
          />
        </div>
      )}

      {/* Edit/Send Section */}
      {!isSent && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Newsletter settings</h2>

          {/* Edit Form */}
          <actionFetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="update" />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject line
              </label>
              <input
                type="text"
                name="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Enter email subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preheader text
                <span className="font-normal text-gray-400 ml-1">(preview text)</span>
              </label>
              <input
                type="text"
                name="preheader"
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Brief preview shown in email clients"
                maxLength={150}
              />
              <p className="mt-1 text-xs text-gray-400">{preheader.length}/150 characters</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-xl hover:bg-teal-100 disabled:opacity-50"
            >
              Save changes
            </button>
          </actionFetcher.Form>

          <hr className="border-gray-200" />

          {/* Test Send */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Send test email</h3>
            <actionFetcher.Form method="post" className="flex gap-3">
              <input type="hidden" name="intent" value="test" />
              <input
                type="text"
                name="testEmails"
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="email@example.com, another@example.com"
              />
              <button
                type="submit"
                disabled={isSubmitting || !testEmails.trim()}
                className="px-6 py-2.5 text-sm font-medium text-white bg-gray-800 rounded-xl hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
              >
                Send test
              </button>
            </actionFetcher.Form>
          </div>

          <hr className="border-gray-200" />

          {/* Audience targeting */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Audience</h3>
            <p className="text-sm text-gray-500 mb-3">
              Leave all unchecked to send to <strong>all active subscribers</strong>, or pick one or
              more segments to target. This newsletter will go to <strong>{audienceLabel}</strong>.
            </p>
            {segments.length === 0 ? (
              <p className="text-sm text-gray-400">
                No segments yet. Create segments in the Audience tab to target specific groups.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {segments.map((s) => {
                  const active = selectedSegments.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSegment(s.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        active
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-teal-400"
                      }`}
                    >
                      <span>{s.name}</span>
                      <span className={active ? "text-teal-100" : "text-gray-400"}>
                        {s.subscriberCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Send Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Send Immediately */}
            <div className="bg-teal-50 rounded-xl p-5">
              <h3 className="font-semibold text-teal-900 mb-2">Send immediately</h3>
              <p className="text-sm text-teal-700 mb-4">
                Send this newsletter to {audienceLabel} right now.
              </p>
              <actionFetcher.Form method="post">
                <input type="hidden" name="intent" value="send" />
                {selectedSegments.map((id) => (
                  <input key={id} type="hidden" name="segmentIds" value={id} />
                ))}
                <button
                  type="submit"
                  disabled={isSubmitting || isScheduled}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50"
                >
                  Send now
                </button>
              </actionFetcher.Form>
            </div>

            {/* Schedule */}
            <div className="bg-blue-50 rounded-xl p-5">
              <h3 className="font-semibold text-blue-900 mb-2">Schedule for later</h3>
              <p className="text-sm text-blue-700 mb-4">
                Choose a date and time to send this newsletter to {audienceLabel}.
              </p>
              <actionFetcher.Form method="post" className="space-y-3">
                <input type="hidden" name="intent" value="schedule" />
                {selectedSegments.map((id) => (
                  <input key={id} type="hidden" name="segmentIds" value={id} />
                ))}
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !scheduledFor}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  Schedule
                </button>
              </actionFetcher.Form>
            </div>
          </div>

          {/* Test Send History */}
          {newsletter.testSends.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent test sends</h3>
              <div className="space-y-2">
                {newsletter.testSends.map((test) => (
                  <div key={test.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-700 font-medium">{test.recipients.join(", ")}</span>
                      <StatusIndicator status={test.deliveryStatus || test.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">
                        {new Date(test.sentAt).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {(test.deliveryStatus || test.status) !== "delivered" && (
                        <actionFetcher.Form method="post">
                          <input type="hidden" name="intent" value="resend" />
                          <input type="hidden" name="testSendId" value={test.id} />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Resend test email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </actionFetcher.Form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recipients Table */}
      {isSent && newsletter.recipients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              Recipients ({newsletter.recipients.length})
            </h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Subscriber
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Delivered
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Opened
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Clicked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {newsletter.recipients.map((recipient) => (
                <tr key={recipient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{recipient.subscriber.email}</div>
                    {(recipient.subscriber.firstName || recipient.subscriber.lastName) && (
                      <div className="text-sm text-gray-500">
                        {[recipient.subscriber.firstName, recipient.subscriber.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {recipient.deliveredAt ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {recipient.openedAt ? (
                      <div>
                        <span className="text-emerald-600 font-medium">{recipient.openCount}×</span>
                        <div className="text-xs text-gray-400">
                          {new Date(recipient.openedAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {recipient.clickedAt ? (
                      <div>
                        <span className="text-blue-600 font-medium">{recipient.clickCount}×</span>
                        <div className="text-xs text-gray-400">
                          {new Date(recipient.clickedAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
    <span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${variants[status] || variants.DRAFT}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: string }> = {
    sent: { color: "text-amber-500", label: "Sent", icon: "clock" },
    delivered: { color: "text-emerald-500", label: "Delivered", icon: "check" },
    bounced: { color: "text-red-500", label: "Bounced", icon: "x" },
    complained: { color: "text-red-500", label: "Spam", icon: "x" },
    unknown: { color: "text-gray-400", label: "Unknown", icon: "question" },
  };

  const { color, label, icon } = config[status] || config.unknown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      {icon === "check" && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {icon === "clock" && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {icon === "x" && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {icon === "question" && (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  subtext,
  variant = "default",
  isText = false,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  variant?: "default" | "success" | "info";
  isText?: boolean;
}) {
  const variants = {
    default: "bg-white border-gray-200",
    success: "bg-emerald-50 border-emerald-200",
    info: "bg-blue-50 border-blue-200",
  };

  return (
    <div className={`p-5 rounded-xl border ${variants[variant]}`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`${isText ? "text-lg" : "text-2xl"} font-bold text-gray-900`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}
