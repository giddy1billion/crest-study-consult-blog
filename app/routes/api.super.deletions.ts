/**
 * Super Admin API: Deletion Approvals
 * 
 * Secure endpoints for managing article deletion requests.
 * Editors can request deletion, super admin approves/rejects.
 * 
 * Endpoints:
 * GET    /api/super/deletions         - List pending deletion requests
 * POST   /api/super/deletions         - Create deletion request (from internal)
 * PATCH  /api/super/deletions         - Approve or reject deletion
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";
import {
  requireApiAuth,
  parseJsonBody,
  apiError,
  apiSuccess,
  logAuditEvent,
} from "~/utils/api-auth.server";

// ============================================
// GET /api/super/deletions - List deletion requests
// ============================================
export async function loader({ request }: LoaderFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "PENDING";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const deletions = await db.deletionRequest.findMany({
      where: status === "ALL" ? {} : { status: status as any },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });

    // Fetch associated article data where still exists
    const articleIds = deletions.map(d => d.articleId);
    const articles = await db.post.findMany({
      where: { id: { in: articleIds } },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        category: { select: { slug: true, name: true } },
      },
    });

    const articleMap = new Map(articles.map(a => [a.id, a]));

    const enrichedDeletions = deletions.map(d => ({
      ...d,
      article: articleMap.get(d.articleId) || null,
    }));

    await logAuditEvent({
      action: "LIST_DELETION_REQUESTS",
      resource: "deletion_requests",
      details: { status, count: deletions.length },
      request,
    });

    return apiSuccess({ deletions: enrichedDeletions, count: deletions.length });
  } catch (error) {
    console.error("Error listing deletion requests:", error);
    return apiError("Failed to list deletion requests", 500);
  }
}

// ============================================
// POST /api/super/deletions - Create deletion request
// PATCH /api/super/deletions - Approve/reject deletion
// ============================================
export async function action({ request }: ActionFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const method = request.method.toUpperCase();

  // ---- CREATE DELETION REQUEST ----
  if (method === "POST") {
    const { data: body, error: parseError } = await parseJsonBody<{
      articleId: string;
      requestedBy: string;
      reason: string;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { articleId, requestedBy, reason } = body;

    // Validation
    if (!articleId || !requestedBy || !reason) {
      return apiError("Missing required fields: articleId, requestedBy, reason");
    }

    if (reason.length < 10) {
      return apiError("Reason must be at least 10 characters");
    }

    // Check article exists
    const article = await db.post.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, status: true },
    });

    if (!article) {
      return apiError("Article not found", 404);
    }

    // Check no pending request exists for this article
    const existingRequest = await db.deletionRequest.findFirst({
      where: { articleId, status: "PENDING" },
    });

    if (existingRequest) {
      return apiError("A deletion request is already pending for this article");
    }

    try {
      // Update article status to DELETE_REQUESTED
      await db.post.update({
        where: { id: articleId },
        data: { status: "DELETE_REQUESTED" },
      });

      const deletionRequest = await db.deletionRequest.create({
        data: {
          articleId,
          articleTitle: article.title,
          requestedBy,
          reason,
        },
      });

      await logAuditEvent({
        action: "CREATE_DELETION_REQUEST",
        resource: "deletion_requests",
        resourceId: deletionRequest.id,
        details: { articleId, articleTitle: article.title, requestedBy, reason },
        request,
      });

      return apiSuccess({ deletionRequest }, 201);
    } catch (error) {
      console.error("Error creating deletion request:", error);
      return apiError("Failed to create deletion request", 500);
    }
  }

  // ---- APPROVE/REJECT DELETION ----
  if (method === "PATCH") {
    const { data: body, error: parseError } = await parseJsonBody<{
      id: string;
      action: "approve" | "reject";
      reviewedBy: string;
      reviewNotes?: string;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { id, action: reviewAction, reviewedBy, reviewNotes } = body;

    // Validation
    if (!id || !reviewAction || !reviewedBy) {
      return apiError("Missing required fields: id, action, reviewedBy");
    }

    if (!["approve", "reject"].includes(reviewAction)) {
      return apiError("Action must be 'approve' or 'reject'");
    }

    // Get deletion request
    const deletionRequest = await db.deletionRequest.findUnique({
      where: { id },
    });

    if (!deletionRequest) {
      return apiError("Deletion request not found", 404);
    }

    if (deletionRequest.status !== "PENDING") {
      return apiError(`Request already ${deletionRequest.status.toLowerCase()}`);
    }

    try {
      if (reviewAction === "approve") {
        // Delete the article
        const article = await db.post.findUnique({
          where: { id: deletionRequest.articleId },
        });

        if (article) {
          await db.post.delete({ where: { id: deletionRequest.articleId } });
        }

        // Update deletion request
        await db.deletionRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedBy,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes || null,
          },
        });

        await logAuditEvent({
          action: "APPROVE_DELETION",
          resource: "deletion_requests",
          resourceId: id,
          details: {
            articleId: deletionRequest.articleId,
            articleTitle: deletionRequest.articleTitle,
            reviewedBy,
          },
          request,
        });

        return apiSuccess({ 
          message: "Deletion approved and article deleted",
          articleTitle: deletionRequest.articleTitle,
        });
      } else {
        // Reject - restore article status
        const article = await db.post.findUnique({
          where: { id: deletionRequest.articleId },
        });

        if (article) {
          // Restore to DRAFT status
          await db.post.update({
            where: { id: deletionRequest.articleId },
            data: { status: "DRAFT" },
          });
        }

        // Update deletion request
        await db.deletionRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewedBy,
            reviewedAt: new Date(),
            reviewNotes: reviewNotes || null,
          },
        });

        await logAuditEvent({
          action: "REJECT_DELETION",
          resource: "deletion_requests",
          resourceId: id,
          details: {
            articleId: deletionRequest.articleId,
            articleTitle: deletionRequest.articleTitle,
            reviewedBy,
            reviewNotes,
          },
          request,
        });

        return apiSuccess({ 
          message: "Deletion rejected, article restored to draft",
          articleTitle: deletionRequest.articleTitle,
        });
      }
    } catch (error) {
      console.error("Error processing deletion:", error);
      return apiError("Failed to process deletion request", 500);
    }
  }

  return apiError("Method not allowed", 405);
}
