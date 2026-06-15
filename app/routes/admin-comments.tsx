import type { Route } from "./+types/admin-comments";
import { data, Form, Link, useNavigation, useActionData } from "react-router";
import { db } from "~/utils/db.server";
import { requireAdmin } from "~/utils/session.server";
import { sendCommentApprovalEmail } from "~/utils/email.server";
import { BRAND } from "~/utils/constants";
import { useState, useEffect } from "react";

/**
 * Admin Comments Management
 * Moderate comments: approve, reject as spam, delete
 */

export function meta() {
  return [{ title: `Manage Comments — ${BRAND.name} Admin` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "PENDING";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const [comments, totalCount, pendingCount] = await db.$transaction([
    db.comment.findMany({
      where: { status: statusFilter as "PENDING" | "APPROVED" | "SPAM" | "DELETED" },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        post: { select: { id: true, title: true, slug: true, category: { select: { slug: true } } } },
        parent: { select: { id: true, authorName: true } },
        replies: {
          where: { status: "APPROVED" },
          select: { id: true, authorName: true, content: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.comment.count({ where: { status: statusFilter as "PENDING" | "APPROVED" | "SPAM" | "DELETED" } }),
    db.comment.count({ where: { status: "PENDING" } }),
  ]);

  return data({
    comments,
    totalCount,
    pendingCount,
    statusFilter,
    page,
    totalPages: Math.ceil(totalCount / limit),
    user,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const commentId = formData.get("commentId") as string;
  const intent = formData.get("intent") as string;

  if (!commentId) {
    return data({ success: false, message: "Comment ID required", error: "Comment ID required" }, { status: 400 });
  }

  switch (intent) {
    case "approve":
      // Get comment details before updating
      const commentToApprove = await db.comment.findUnique({
        where: { id: commentId },
        include: {
          post: {
            select: { title: true, slug: true, category: { select: { slug: true } } },
          },
        },
      });

      await db.comment.update({ where: { id: commentId }, data: { status: "APPROVED" } });

      // Send approval notification email (non-blocking)
      if (commentToApprove?.authorEmail) {
        const articleUrl = `${BRAND.url}/${commentToApprove.post.category.slug}/${commentToApprove.post.slug}`;
        sendCommentApprovalEmail({
          email: commentToApprove.authorEmail,
          authorName: commentToApprove.authorName,
          articleTitle: commentToApprove.post.title,
          articleUrl,
          commentContent: commentToApprove.content,
        }).catch((err) => console.error("Failed to send approval email:", err));
      }

      return data({ success: true, message: "Comment approved" });
    
    case "spam":
      await db.comment.update({ where: { id: commentId }, data: { status: "SPAM" } });
      return data({ success: true, message: "Comment marked as spam" });
    
    case "delete":
      await db.comment.update({ where: { id: commentId }, data: { status: "DELETED" } });
      return data({ success: true, message: "Comment deleted" });
    
    case "restore":
      await db.comment.update({ where: { id: commentId }, data: { status: "PENDING" } });
      return data({ success: true, message: "Comment restored to pending" });
    
    case "bulk-approve":
      const approveIds = formData.getAll("selected") as string[];
      if (approveIds.length > 0) {
        // Get comment details before updating
        const commentsToApprove = await db.comment.findMany({
          where: { id: { in: approveIds } },
          include: {
            post: {
              select: { title: true, slug: true, category: { select: { slug: true } } },
            },
          },
        });

        await db.comment.updateMany({
          where: { id: { in: approveIds } },
          data: { status: "APPROVED" },
        });

        // Send approval notification emails (non-blocking)
        for (const comment of commentsToApprove) {
          if (comment.authorEmail) {
            const articleUrl = `${BRAND.url}/${comment.post.category.slug}/${comment.post.slug}`;
            sendCommentApprovalEmail({
              email: comment.authorEmail,
              authorName: comment.authorName,
              articleTitle: comment.post.title,
              articleUrl,
              commentContent: comment.content,
            }).catch((err) => console.error("Failed to send approval email:", err));
          }
        }
      }
      return data({ success: true, message: `${approveIds.length} comments approved` });
    
    case "bulk-spam":
      const spamIds = formData.getAll("selected") as string[];
      if (spamIds.length > 0) {
        await db.comment.updateMany({
          where: { id: { in: spamIds } },
          data: { status: "SPAM" },
        });
      }
      return data({ success: true, message: `${spamIds.length} comments marked as spam` });
    
    case "reply":
      const replyContent = formData.get("replyContent") as string;
      const adminName = formData.get("adminName") as string;
      const adminEmail = formData.get("adminEmail") as string;
      
      if (!replyContent?.trim()) {
        return data({ success: false, message: "Reply content is required", error: "Reply content is required" }, { status: 400 });
      }
      
      // Get the parent comment to find the postId
      const parentComment = await db.comment.findUnique({
        where: { id: commentId },
        select: { postId: true },
      });
      
      if (!parentComment) {
        return data({ success: false, message: "Parent comment not found", error: "Parent comment not found" }, { status: 404 });
      }
      
      // Create the reply as an auto-approved comment
      await db.comment.create({
        data: {
          content: replyContent.trim(),
          authorName: `${adminName} (Crest Study Consult Team)`,
          authorEmail: adminEmail,
          postId: parentComment.postId,
          parentId: commentId,
          status: "APPROVED", // Admin replies are auto-approved
        },
      });
      
      return data({ success: true, message: "Reply posted successfully" });
    
    default:
      return data({ success: false, message: "Unknown action", error: "Unknown action" }, { status: 400 });
  }
}

export default function AdminComments({ loaderData }: Route.ComponentProps) {
  const { comments, totalCount, pendingCount, statusFilter, page, totalPages, user } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  useEffect(() => {
    if (actionData?.success) {
      setShowToast(true);
      setSelectedIds(new Set());
      setReplyingTo(null); // Close reply form on success
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === comments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comments.map((c: typeof comments[0]) => c.id)));
    }
  };

  const statusTabs = [
    { value: "PENDING", label: "Pending", count: pendingCount },
    { value: "APPROVED", label: "Approved" },
    { value: "SPAM", label: "Spam" },
    { value: "DELETED", label: "Deleted" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Comments</h1>
              <p className="text-sm text-gray-500 mt-1">Moderate reader comments</p>
            </div>
            <Link to="/admin" className="text-sm text-gray-500 hover:text-teal-600 transition-colors">
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Tabs */}
        <div className="flex gap-2 mb-6">
          {statusTabs.map((tab) => (
            <Link
              key={tab.value}
              to={`/admin/comments?status=${tab.value}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? "bg-teal-100 text-teal-700"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium text-teal-700">
              {selectedIds.size} comment{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Form method="post">
                {Array.from(selectedIds).map((id) => (
                  <input key={id} type="hidden" name="selected" value={id} />
                ))}
                <input type="hidden" name="intent" value="bulk-approve" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Approve all"
                  )}
                </button>
              </Form>
              <Form method="post">
                {Array.from(selectedIds).map((id) => (
                  <input key={id} type="hidden" name="selected" value={id} />
                ))}
                <input type="hidden" name="intent" value="bulk-spam" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Mark as spam"
                  )}
                </button>
              </Form>
            </div>
          </div>
        )}

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No comments</h3>
            <p className="mt-2 text-gray-500">No {statusFilter.toLowerCase()} comments to show</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === comments.length && comments.length > 0}
                onChange={selectAll}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <span className="text-sm text-gray-500">
                {totalCount} comment{totalCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {comments.map((comment: typeof comments[0]) => (
                <div key={comment.id} className={`p-6 ${selectedIds.has(comment.id) ? "bg-teal-50/50" : "hover:bg-gray-50"} transition-colors`}>
                  <div className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(comment.id)}
                      onChange={() => toggleSelect(comment.id)}
                      className="mt-1 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{comment.authorName}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-sm text-gray-500">{comment.authorEmail}</span>
                            {comment.parent && (
                              <>
                                <span className="text-gray-400">·</span>
                                <span className="text-xs text-gray-500">
                                  Reply to {comment.parent.authorName}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(comment.createdAt).toLocaleString("en-GB")}
                            {comment.ipAddress && <span> · IP: {comment.ipAddress}</span>}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 flex-shrink-0">
                          {statusFilter !== "APPROVED" && (
                            <Form method="post">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="intent" value="approve" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </Form>
                          )}
                          
                          {statusFilter !== "SPAM" && (
                            <Form method="post">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="intent" value="spam" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Mark as spam"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </button>
                            </Form>
                          )}
                          
                          {statusFilter !== "DELETED" ? (
                            <Form method="post">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="intent" value="delete" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </Form>
                          ) : (
                            <Form method="post">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="intent" value="restore" />
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Restore"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                              </button>
                            </Form>
                          )}
                        </div>
                      </div>

                      {/* Comment content */}
                      <p className="mt-3 text-gray-700 whitespace-pre-wrap">{comment.content}</p>

                      {/* Existing replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-4 ml-4 pl-4 border-l-2 border-teal-200 space-y-3">
                          {comment.replies.map((reply: typeof comment.replies[0]) => (
                            <div key={reply.id} className="bg-teal-50/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-teal-700">{reply.authorName}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(reply.createdAt).toLocaleString("en-GB")}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-700">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply button and form - only for APPROVED comments */}
                      {statusFilter === "APPROVED" && (
                        <div className="mt-4">
                          {replyingTo === comment.id ? (
                            <Form method="post" className="space-y-3">
                              <input type="hidden" name="commentId" value={comment.id} />
                              <input type="hidden" name="intent" value="reply" />
                              <input type="hidden" name="adminName" value={user.name} />
                              <input type="hidden" name="adminEmail" value={user.email} />
                              <textarea
                                name="replyContent"
                                rows={3}
                                placeholder="Write your reply..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                                required
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  disabled={isSubmitting}
                                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                  {isSubmitting ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Posting...
                                    </>
                                  ) : (
                                    "Post reply"
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReplyingTo(null)}
                                  className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </Form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReplyingTo(comment.id)}
                              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Reply as {user.name}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Article link */}
                      <div className="mt-3 text-sm">
                        <span className="text-gray-500">On: </span>
                        <Link
                          to={`/${comment.post.category.slug}/${comment.post.slug}`}
                          target="_blank"
                          className="text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          {comment.post.title}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      to={`/admin/comments?status=${statusFilter}&page=${page - 1}`}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      to={`/admin/comments?status=${statusFilter}&page=${page + 1}`}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {showToast && actionData?.message && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-teal-600 text-white rounded-xl shadow-lg animate-in slide-in-from-bottom-5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{actionData.message}</span>
        </div>
      )}
    </div>
  );
}
