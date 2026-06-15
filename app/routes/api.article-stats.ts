/**
 * Article Stats API
 * 
 * Tracks article views and shares with bot protection and rate limiting.
 * POST /api/article-stats
 * 
 * Request body:
 * - action: "view" | "share"
 * - slug: article slug
 * - platform?: share platform (for shares only)
 * - referer?: where the user came from (for views)
 */

import type { Route } from "./+types/api.article-stats";
import { db } from "~/utils/db.server";
import { createHash } from "crypto";

// Rate limiting: max requests per IP per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_VIEWS = 30; // Max view requests per minute per IP
const RATE_LIMIT_MAX_SHARES = 20; // Max share requests per minute per IP

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Bot User-Agent patterns to block
const BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /scrape/i,
  /headless/i,
  /phantom/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /wget/i,
  /curl/i,
  /httpie/i,
  /postman/i,
  /insomnia/i,
];

/**
 * Check if User-Agent appears to be a bot
 */
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip: string, action: "view" | "share"): boolean {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const limit = action === "view" ? RATE_LIMIT_MAX_VIEWS : RATE_LIMIT_MAX_SHARES;

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Generate fingerprint from IP and User-Agent
 * Used to deduplicate views from same user
 */
function generateFingerprint(ip: string, userAgent: string): string {
  const hash = createHash("sha256");
  hash.update(`${ip}:${userAgent}`);
  return hash.digest("hex").substring(0, 32);
}

/**
 * Get client IP from request headers
 */
function getClientIP(request: Request): string {
  // Check common proxy headers
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIP = request.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;

  // Fallback
  return "unknown";
}

/**
 * Validate share platform
 */
const VALID_PLATFORMS = ["TWITTER", "LINKEDIN", "FACEBOOK", "WHATSAPP", "COPY_LINK", "EMAIL"] as const;
type SharePlatform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(platform: string): platform is SharePlatform {
  return VALID_PLATFORMS.includes(platform.toUpperCase() as SharePlatform);
}

export async function action({ request }: Route.ActionArgs) {
  // Only accept POST
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Get client info
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent");

  // Block bots
  if (isBot(userAgent)) {
    // Return success to not reveal detection (honeypot style)
    return Response.json({ success: true });
  }

  // Parse request body
  let body: { action?: string; slug?: string; platform?: string; referer?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, slug, platform, referer } = body;

  // Validate required fields
  if (!action || !slug) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (action !== "view" && action !== "share") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  // Rate limit check
  if (!checkRateLimit(ip, action)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Find the article
  const post = await db.post.findUnique({
    where: { slug },
    select: { id: true, isPublished: true },
  });

  if (!post || !post.isPublished) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  try {
    if (action === "view") {
      // Generate fingerprint for deduplication
      const fingerprint = generateFingerprint(ip, userAgent || "");

      // Check if this fingerprint viewed this article in the last hour
      const recentView = await db.articleView.findFirst({
        where: {
          postId: post.id,
          fingerprint,
          viewedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          },
        },
      });

      if (!recentView) {
        // Record the view
        await db.$transaction([
          db.articleView.create({
            data: {
              postId: post.id,
              fingerprint,
              ipAddress: ip,
              userAgent: userAgent?.substring(0, 500), // Limit UA length
              referer: referer?.substring(0, 500),
            },
          }),
          db.post.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
          }),
        ]);
      }

      return Response.json({ success: true });
    }

    if (action === "share") {
      // Validate platform
      if (!platform || !isValidPlatform(platform)) {
        return Response.json({ error: "Invalid platform" }, { status: 400 });
      }

      // Record the share
      await db.$transaction([
        db.articleShare.create({
          data: {
            postId: post.id,
            platform: platform.toUpperCase() as SharePlatform,
            ipAddress: ip,
            userAgent: userAgent?.substring(0, 500),
          },
        }),
        db.post.update({
          where: { id: post.id },
          data: { shareCount: { increment: 1 } },
        }),
      ]);

      return Response.json({ success: true });
    }
  } catch (error) {
    console.error("Error tracking article stat:", error);
    // Still return success to not leak internal errors
    return Response.json({ success: true });
  }

  return Response.json({ success: true });
}

// Health check for the endpoint
export async function loader() {
  return Response.json({ status: "ok" });
}
