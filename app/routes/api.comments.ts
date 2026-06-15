import type { Route } from "./+types/api.comments";
import { data } from "react-router";
import { db } from "~/utils/db.server";

/**
 * Comments API Route
 * Handles comment submission and retrieval for articles
 * 
 * POST /api/comments - Submit a new comment
 * GET /api/comments?postId=xxx - Get comments for an article
 */

// Simple spam detection patterns
const SPAM_PATTERNS = [
  /\b(viagra|cialis|casino|poker|lottery|crypto|bitcoin|nft)\b/i,
  /\b(click here|act now|limited time|free money)\b/i,
  /http[s]?:\/\/[^\s]{100,}/i, // Very long URLs
  /(.)\1{10,}/i, // Repeated characters
];

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_COMMENTS_PER_WINDOW = 3;
const commentRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if content looks like spam
 */
function isSpam(content: string, authorUrl?: string): boolean {
  // Check content for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) return true;
  }
  
  // Check for excessive links
  const linkCount = (content.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) return true;
  
  // Check author URL for suspicious patterns
  if (authorUrl && SPAM_PATTERNS.some(p => p.test(authorUrl))) return true;
  
  return false;
}

/**
 * Simple rate limiting by IP
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = commentRateLimits.get(ip);
  
  if (!record || now > record.resetAt) {
    commentRateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_COMMENTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * Sanitize HTML to prevent XSS
 */
function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .trim();
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * GET - Retrieve comments for an article
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  const includeReplies = url.searchParams.get("includeReplies") !== "false";
  
  if (!postId) {
    return data({ error: "postId is required" }, { status: 400 });
  }
  
  // Check if comments are enabled for this post
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, commentsEnabled: true, isPublished: true },
  });
  
  if (!post || !post.isPublished) {
    return data({ error: "Article not found" }, { status: 404 });
  }
  
  if (!post.commentsEnabled) {
    return data({ comments: [], commentsEnabled: false });
  }
  
  // Fetch approved comments
  const comments = await db.comment.findMany({
    where: {
      postId,
      status: "APPROVED",
      ...(includeReplies ? {} : { parentId: null }), // Top-level only if not including replies
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      authorName: true,
      authorUrl: true,
      parentId: true,
      createdAt: true,
      isEdited: true,
      replies: includeReplies ? {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          authorName: true,
          authorUrl: true,
          parentId: true,
          createdAt: true,
          isEdited: true,
        },
      } : false,
    },
  });
  
  // Count total comments
  const totalCount = await db.comment.count({
    where: { postId, status: "APPROVED" },
  });
  
  return data({
    comments: includeReplies ? comments.filter(c => !c.parentId) : comments,
    totalCount,
    commentsEnabled: true,
  });
}

/**
 * POST - Submit a new comment
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  
  const formData = await request.formData();
  const postId = formData.get("postId") as string;
  const content = formData.get("content") as string;
  const authorName = formData.get("authorName") as string;
  const authorEmail = formData.get("authorEmail") as string;
  const authorUrl = formData.get("authorUrl") as string | null;
  const parentId = formData.get("parentId") as string | null;
  
  // Get client info
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || request.headers.get("cf-connecting-ip") 
    || "unknown";
  const userAgent = request.headers.get("user-agent") || "";
  
  // Validation
  const errors: Record<string, string> = {};
  
  if (!postId) errors.postId = "Article ID is required";
  if (!content || content.trim().length < 5) errors.content = "Comment must be at least 5 characters";
  if (content && content.length > 2000) errors.content = "Comment must not exceed 2000 characters";
  if (!authorName || authorName.trim().length < 2) errors.authorName = "Name must be at least 2 characters";
  if (authorName && authorName.length > 100) errors.authorName = "Name must not exceed 100 characters";
  if (!authorEmail || !isValidEmail(authorEmail)) errors.authorEmail = "Valid email is required";
  if (authorUrl && !/^https?:\/\/.+/.test(authorUrl)) errors.authorUrl = "URL must start with http:// or https://";
  
  if (Object.keys(errors).length > 0) {
    return data({ errors, success: false }, { status: 400 });
  }
  
  // Check rate limit
  if (!checkRateLimit(ip)) {
    return data({ 
      error: "Too many comments. Please wait a minute before commenting again.",
      success: false 
    }, { status: 429 });
  }
  
  // Verify post exists and has comments enabled
  const post = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, commentsEnabled: true, isPublished: true },
  });
  
  if (!post || !post.isPublished) {
    return data({ error: "Article not found", success: false }, { status: 404 });
  }
  
  if (!post.commentsEnabled) {
    return data({ error: "Comments are disabled for this article", success: false }, { status: 403 });
  }
  
  // Verify parent comment exists if replying
  if (parentId) {
    const parent = await db.comment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, status: true },
    });
    
    if (!parent || parent.postId !== postId || parent.status !== "APPROVED") {
      return data({ error: "Parent comment not found", success: false }, { status: 400 });
    }
  }
  
  // Check for spam
  const spamDetected = isSpam(content, authorUrl || undefined);
  
  // Create comment
  const comment = await db.comment.create({
    data: {
      postId,
      content: sanitizeHtml(content),
      authorName: sanitizeHtml(authorName),
      authorEmail: authorEmail.toLowerCase().trim(),
      authorUrl: authorUrl ? sanitizeHtml(authorUrl) : null,
      parentId: parentId || null,
      status: spamDetected ? "SPAM" : "PENDING",
      ipAddress: ip,
      userAgent: userAgent.slice(0, 500),
    },
    select: {
      id: true,
      content: true,
      authorName: true,
      createdAt: true,
      status: true,
    },
  });
  
  return data({
    success: true,
    message: spamDetected 
      ? "Your comment has been flagged for review." 
      : "Your comment has been submitted and is pending moderation.",
    comment: {
      id: comment.id,
      authorName: comment.authorName,
      createdAt: comment.createdAt,
    },
  });
}
