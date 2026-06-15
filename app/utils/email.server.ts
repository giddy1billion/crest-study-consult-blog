/**
 * Crest Study Consult Email Service
 * 
 * Server-side email utilities using Resend.
 * Handles newsletter signups, transactional emails, and notifications.
 */

import { Resend } from "resend";
import { db as prisma } from "~/utils/db.server";
import { randomUUID } from "crypto";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Base URL for tracking
const BASE_URL = process.env.NODE_ENV === "production" 
  ? "https://blog.creststudyconsult.com" 
  : "http://localhost:3000";

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.NEWSLETTER_FROM || "Crest Study Consult <noreply@notifications.creststudyconsult.com>",
  replyTo: process.env.NEWSLETTER_REPLY_TO || "hello@notifications.creststudyconsult.com",
  newsletterListId: process.env.RESEND_AUDIENCE_ID || "",
} as const;

/**
 * Newsletter signup result
 */
export type NewsletterResult = 
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Subscribe an email to the newsletter
 */
export async function subscribeToNewsletter(
  email: string,
  firstName?: string,
  source?: string
): Promise<NewsletterResult> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  try {
    // Check if subscriber already exists in database
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingSubscriber) {
      // If already subscribed and active, return error
      if (existingSubscriber.isActive) {
        return { success: false, error: "This email is already subscribed" };
      }
      // If previously unsubscribed, reactivate
      await prisma.subscriber.update({
        where: { id: existingSubscriber.id },
        data: { 
          isActive: true, 
          unsubscribedAt: null,
          subscribedAt: new Date(),
        },
      });
    } else {
      // Create new subscriber in database
      await prisma.subscriber.create({
        data: {
          email: email.toLowerCase(),
          source: source || "newsletter_form",
          isActive: true,
        },
      });
    }

    // Add contact to Resend audience (for email delivery)
    if (EMAIL_CONFIG.newsletterListId) {
      try {
        await resend.contacts.create({
          email,
          firstName: firstName || undefined,
          audienceId: EMAIL_CONFIG.newsletterListId,
        });
      } catch (resendError) {
        // Log but don't fail if Resend sync fails - we have the DB record
        console.warn("Resend contact sync failed:", resendError);
      }
    }

    // Send welcome email
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: email,
      replyTo: EMAIL_CONFIG.replyTo,
      subject: "Welcome to Crest Study Consult Research",
      html: getWelcomeEmailHtml(firstName),
    });

    return { 
      success: true, 
      message: "Welcome to Crest Study Consult Research. Check your inbox for confirmation." 
    };
  } catch (error) {
    console.error("Newsletter signup error:", error);
    
    // Handle Prisma unique constraint error
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, error: "This email is already subscribed" };
    }

    return { 
      success: false, 
      error: "Unable to subscribe. Please try again later." 
    };
  }
}

/**
 * Send a transactional email
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      replyTo: EMAIL_CONFIG.replyTo,
      subject,
      html,
      text,
    });

    return { success: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send email" 
    };
  }
}

/**
 * Send an admin login OTP (two-factor) email.
 *
 * Used during admin sign-in for every account except the systems administrator.
 */
export async function sendAdminOtpEmail({
  to,
  name,
  code,
  expiresMinutes,
}: {
  to: string;
  name: string;
  code: string;
  expiresMinutes: number;
}): Promise<{ success: boolean; error?: string }> {
  const spacedCode = code.split("").join(" ");
  return sendEmail({
    to,
    subject: `Your Crest Study Consult admin login code: ${code}`,
    html: getAdminOtpEmailHtml({ name, code, expiresMinutes }),
    text:
      `Hi ${name},\n\n` +
      `Your Crest Study Consult admin login code is ${spacedCode}.\n` +
      `It expires in ${expiresMinutes} minutes and can be used once.\n\n` +
      `If you did not try to sign in, change your password immediately and notify the systems administrator.`,
  });
}

/**
 * Admin OTP email HTML template
 */
function getAdminOtpEmailHtml({
  name,
  code,
  expiresMinutes,
}: {
  name: string;
  code: string;
  expiresMinutes: number;
}): string {
  const spacedCode = code.split("").join("&nbsp;&nbsp;");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your admin login code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background: linear-gradient(135deg, #3a464f 0%, #2e383f 100%); padding: 32px 40px;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="120" style="display: block;">
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">
                Confirm your sign-in
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Hi ${name}, use this one-time code to finish signing in to the Crest Study Consult editorial dashboard.
              </p>
              <div style="margin: 0 0 24px; padding: 24px; text-align: center; background-color: #f3f4f6; border-radius: 12px;">
                <span style="font-size: 34px; font-weight: 700; letter-spacing: 6px; color: #111827;">
                  ${spacedCode}
                </span>
              </div>
              <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #6b7280;">
                This code expires in ${expiresMinutes} minutes and can only be used once.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If you did not try to sign in, change your password immediately and notify the systems administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Crest Study Consult LTD · This is an automated security message. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Welcome email HTML template
 */
function getWelcomeEmailHtml(firstName?: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Welcome,";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Crest Study Consult Research</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3a464f 0%, #2e383f 100%); padding: 40px 40px 30px;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="120" style="display: block;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827;">
                ${greeting}
              </h1>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Thank you for subscribing to Crest Study Consult Research. You've joined a community of students, parents, and education advisors who value trusted, practical guidance for studying abroad.
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Here's what you can expect:
              </p>
              <ul style="margin: 0 0 30px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #4b5563;">
                <li><strong>Study destinations</strong> — Country and university pathway guides</li>
                <li><strong>Admissions guidance</strong> — Requirements, timelines, and application strategy</li>
                <li><strong>Visa & immigration</strong> — Student visa documentation and process updates</li>
                <li><strong>Scholarships & funding</strong> — Grants, bursaries, and funding opportunities</li>
              </ul>
              <a href="https://blog.creststudyconsult.com" style="display: inline-block; padding: 14px 28px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                Explore the blog →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                Crest Study Consult LTD
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you subscribed at blog.creststudyconsult.com.
                <a href="https://blog.creststudyconsult.com/unsubscribe" style="color: #4f9a2a;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * New article notification email template
 */
export function getNewArticleEmailHtml({
  title,
  excerpt,
  url,
  category,
  readingTime,
}: {
  title: string;
  excerpt: string;
  url: string;
  category: string;
  readingTime: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; border-bottom: 1px solid #e5e7eb;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="100" style="display: block;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #4f9a2a;">
                ${category} · ${readingTime} min read
              </p>
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">
                ${title}
              </h1>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                ${excerpt}
              </p>
              <a href="${url}" style="display: inline-block; padding: 14px 28px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                Read article →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                Crest Study Consult LTD
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                <a href="https://blog.creststudyconsult.com/unsubscribe" style="color: #4f9a2a;">Unsubscribe</a> · 
                <a href="https://blog.creststudyconsult.com" style="color: #4f9a2a;">View in browser</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send comment approval notification email
 */
export async function sendCommentApprovalEmail({
  email,
  authorName,
  articleTitle,
  articleUrl,
  commentContent,
}: {
  email: string;
  authorName: string;
  articleTitle: string;
  articleUrl: string;
  commentContent: string;
}): Promise<{ success: boolean; error?: string }> {
  const html = getCommentApprovalEmailHtml({
    authorName,
    articleTitle,
    articleUrl,
    commentContent,
  });

  return sendEmail({
    to: email,
    subject: `Your comment on "${articleTitle}" is now live`,
    html,
  });
}

/**
 * Comment approval email HTML template
 */
function getCommentApprovalEmailHtml({
  authorName,
  articleTitle,
  articleUrl,
  commentContent,
}: {
  authorName: string;
  articleTitle: string;
  articleUrl: string;
  commentContent: string;
}): string {
  // Truncate comment for email preview
  const truncatedComment = commentContent.length > 200 
    ? commentContent.slice(0, 200) + "..." 
    : commentContent;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your comment is live</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3a464f 0%, #2e383f 100%); padding: 30px 40px;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="100" style="display: block;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827;">
                Hi ${authorName}, your comment is now live!
              </h1>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Thank you for joining the discussion. Your comment on <strong>"${articleTitle}"</strong> has been approved and is now visible to other readers.
              </p>
              
              <!-- Comment preview -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-left: 4px solid #5cb031; border-radius: 0 12px 12px 0;">
                <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #374151;">Your comment:</p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4b5563; font-style: italic;">
                  "${truncatedComment}"
                </p>
              </div>
              
              <a href="${articleUrl}#comments" style="display: inline-block; padding: 14px 28px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                View your comment →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                Crest Study Consult LTD
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you commented on blog.creststudyconsult.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send reply notification email
 */
export async function sendCommentReplyEmail({
  email,
  authorName,
  replierName,
  articleTitle,
  articleUrl,
  replyContent,
}: {
  email: string;
  authorName: string;
  replierName: string;
  articleTitle: string;
  articleUrl: string;
  replyContent: string;
}): Promise<{ success: boolean; error?: string }> {
  const html = getCommentReplyEmailHtml({
    authorName,
    replierName,
    articleTitle,
    articleUrl,
    replyContent,
  });

  return sendEmail({
    to: email,
    subject: `${replierName} replied to your comment on "${articleTitle}"`,
    html,
  });
}

/**
 * Comment reply email HTML template
 */
function getCommentReplyEmailHtml({
  authorName,
  replierName,
  articleTitle,
  articleUrl,
  replyContent,
}: {
  authorName: string;
  replierName: string;
  articleTitle: string;
  articleUrl: string;
  replyContent: string;
}): string {
  const truncatedReply = replyContent.length > 200 
    ? replyContent.slice(0, 200) + "..." 
    : replyContent;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Someone replied to your comment</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3a464f 0%, #2e383f 100%); padding: 30px 40px;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="100" style="display: block;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #111827;">
                Hi ${authorName}, ${replierName} replied to you
              </h1>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Someone replied to your comment on <strong>"${articleTitle}"</strong>.
              </p>
              
              <!-- Reply preview -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f0f8e9; border-left: 4px solid #5cb031; border-radius: 0 12px 12px 0;">
                <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #3a464f;">${replierName} wrote:</p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1E293B;">
                  "${truncatedReply}"
                </p>
              </div>
              
              <a href="${articleUrl}#comments" style="display: inline-block; padding: 14px 28px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                View the conversation →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                Crest Study Consult LTD
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because someone replied to your comment on blog.creststudyconsult.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ============================================
// NEWSLETTER FUNCTIONS
// ============================================

/**
 * Sync subscribers from Resend audience to local database
 * Handles deduplication and status sync
 */
export async function syncSubscribersFromResend(): Promise<{
  success: boolean;
  added: number;
  updated: number;
  error?: string;
}> {
  try {
    if (!EMAIL_CONFIG.newsletterListId) {
      return { success: false, added: 0, updated: 0, error: "No audience ID configured" };
    }

    // Fetch all contacts from Resend
    const response = await resend.contacts.list({
      audienceId: EMAIL_CONFIG.newsletterListId,
    });

    if (!response.data) {
      return { success: false, added: 0, updated: 0, error: "Failed to fetch contacts" };
    }

    let added = 0;
    let updated = 0;

    for (const contact of response.data.data) {
      const existing = await prisma.newsletterSubscriber.findUnique({
        where: { email: contact.email.toLowerCase() },
      });

      const status: "ACTIVE" | "UNSUBSCRIBED" = contact.unsubscribed ? "UNSUBSCRIBED" : "ACTIVE";

      if (existing) {
        // Update if status changed
        if (existing.status !== status || existing.resendId !== contact.id) {
          await prisma.newsletterSubscriber.update({
            where: { id: existing.id },
            data: {
              resendId: contact.id,
              status,
              firstName: contact.first_name || existing.firstName,
              lastName: contact.last_name || existing.lastName,
            },
          });
          updated++;
        }
      } else {
        // Create new subscriber
        await prisma.newsletterSubscriber.create({
          data: {
            email: contact.email.toLowerCase(),
            resendId: contact.id,
            firstName: contact.first_name || null,
            lastName: contact.last_name || null,
            status,
            source: "RESEND_SYNC",
          },
        });
        added++;
      }
    }

    return { success: true, added, updated };
  } catch (error) {
    console.error("Sync subscribers error:", error);
    return {
      success: false,
      added: 0,
      updated: 0,
      error: error instanceof Error ? error.message : "Failed to sync subscribers",
    };
  }
}

/**
 * Get all active subscribers (from both local DB and Resend sync)
 */
export async function getActiveSubscribers(): Promise<{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  source: string | null;
  subscribedAt: Date;
}[]> {
  return prisma.newsletterSubscriber.findMany({
    where: { status: "ACTIVE" },
    orderBy: { subscribedAt: "desc" },
  });
}

/**
 * Get subscriber statistics
 */
export async function getSubscriberStats(): Promise<{
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
}> {
  // Query from Subscriber table (primary signup table)
  const [total, active, unsubscribed] = await Promise.all([
    prisma.subscriber.count(),
    prisma.subscriber.count({ where: { isActive: true } }),
    prisma.subscriber.count({ where: { isActive: false } }),
  ]);

  // Bounced count from NewsletterSubscriber if available
  let bounced = 0;
  try {
    bounced = await prisma.newsletterSubscriber.count({ where: { status: "BOUNCED" } });
  } catch {
    // Table may not exist or be empty
  }

  return { total, active, unsubscribed, bounced };
}

/**
 * Send a test newsletter to specific email addresses
 */
export async function sendTestNewsletter({
  newsletterId,
  testEmails,
}: {
  newsletterId: string;
  testEmails: string[];
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const newsletter = await prisma.newsletter.findUnique({
      where: { id: newsletterId },
      include: { post: { include: { category: true } } },
    });

    if (!newsletter) {
      return { success: false, error: "Newsletter not found" };
    }

    // Generate test email HTML without tracking
    const html = getNewsletterHtml({
      post: newsletter.post,
      trackingId: null, // No tracking for test emails
      preheader: newsletter.preheader || undefined,
    });

    console.log("[Newsletter Test] Sending to:", testEmails.join(", "));
    console.log("[Newsletter Test] From:", EMAIL_CONFIG.from);
    console.log("[Newsletter Test] Subject:", `[TEST] ${newsletter.subject}`);

    // Send to test recipients
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: testEmails,
      replyTo: EMAIL_CONFIG.replyTo,
      subject: `[TEST] ${newsletter.subject}`,
      html,
    });

    if (sendError) {
      console.error("[Newsletter Test] Resend API error:", sendError);
      return {
        success: false,
        error: `Resend API error: ${sendError.message || JSON.stringify(sendError)}`,
      };
    }

    console.log("[Newsletter Test] Send result:", sendResult);
    const messageId = sendResult?.id || null;

    // Log test send with message ID for status tracking
    await prisma.newsletterTestSend.create({
      data: {
        newsletterId,
        recipients: testEmails,
        messageId,
        status: "sent",
      },
    });

    return { success: true, messageId: messageId || undefined };
  } catch (error) {
    console.error("[Newsletter Test] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send test",
    };
  }
}

/**
 * Check email delivery status from Resend API
 */
export async function checkEmailStatus(messageId: string): Promise<{
  status: string;
  lastEvent?: string;
}> {
  try {
    const { data, error } = await resend.emails.get(messageId);
    
    if (error) {
      console.error("[Email Status] Error fetching:", error);
      return { status: "unknown" };
    }

    // Resend returns last_event which can be: sent, delivered, bounced, complained, etc.
    const lastEvent = data?.last_event || "sent";
    
    return {
      status: lastEvent,
      lastEvent,
    };
  } catch (error) {
    console.error("[Email Status] Exception:", error);
    return { status: "unknown" };
  }
}

/**
 * Resend a test newsletter by test send ID
 */
export async function resendTestNewsletter(testSendId: string): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
}> {
  try {
    const testSend = await prisma.newsletterTestSend.findUnique({
      where: { id: testSendId },
      include: {
        newsletter: {
          include: { post: { include: { category: true } } },
        },
      },
    });

    if (!testSend) {
      return { success: false, error: "Test send not found" };
    }

    // Generate test email HTML without tracking
    const html = getNewsletterHtml({
      post: testSend.newsletter.post,
      trackingId: null,
      preheader: testSend.newsletter.preheader || undefined,
    });

    console.log("[Newsletter Resend] Sending to:", testSend.recipients.join(", "));

    // Resend to same recipients
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: testSend.recipients,
      replyTo: EMAIL_CONFIG.replyTo,
      subject: `[TEST] ${testSend.newsletter.subject}`,
      html,
    });

    if (sendError) {
      console.error("[Newsletter Resend] Resend API error:", sendError);
      return {
        success: false,
        error: `Resend API error: ${sendError.message || JSON.stringify(sendError)}`,
      };
    }

    const messageId = sendResult?.id || null;

    // Update the test send record with new message ID
    await prisma.newsletterTestSend.update({
      where: { id: testSendId },
      data: {
        messageId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    return { success: true, messageId: messageId || undefined };
  } catch (error) {
    console.error("[Newsletter Resend] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resend",
    };
  }
}

/**
 * Send newsletter to all active subscribers
 * Returns immediately if scheduled for later
 */
export async function sendNewsletter({
  newsletterId,
  sendImmediately = true,
  scheduledFor,
}: {
  newsletterId: string;
  sendImmediately?: boolean;
  scheduledFor?: Date;
}): Promise<{ success: boolean; sentCount?: number; error?: string }> {
  try {
    const newsletter = await prisma.newsletter.findUnique({
      where: { id: newsletterId },
      include: { post: { include: { category: true } } },
    });

    if (!newsletter) {
      return { success: false, error: "Newsletter not found" };
    }

    // If scheduling for later, just update status
    if (!sendImmediately && scheduledFor) {
      await prisma.newsletter.update({
        where: { id: newsletterId },
        data: {
          status: "SCHEDULED",
          scheduledFor,
        },
      });
      return { success: true, sentCount: 0 };
    }

    // Get all active subscribers
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { status: "ACTIVE" },
    });

    if (subscribers.length === 0) {
      return { success: false, error: "No active subscribers" };
    }

    // Update newsletter status to SENDING
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: { status: "SENDING" },
    });

    let sentCount = 0;
    const errors: string[] = [];

    // Send to each subscriber with unique tracking ID
    for (const subscriber of subscribers) {
      try {
        const trackingId = randomUUID();
        
        // Create recipient record
        await prisma.newsletterRecipient.create({
          data: {
            newsletterId,
            subscriberId: subscriber.id,
            trackingId,
          },
        });

        const html = getNewsletterHtml({
          post: newsletter.post,
          trackingId,
          preheader: newsletter.preheader || undefined,
          subscriberName: subscriber.firstName || undefined,
        });

        await resend.emails.send({
          from: EMAIL_CONFIG.from,
          to: subscriber.email,
          replyTo: EMAIL_CONFIG.replyTo,
          subject: newsletter.subject,
        html,
        });

        // Update recipient as delivered
        await prisma.newsletterRecipient.updateMany({
          where: { trackingId },
          data: { deliveredAt: new Date() },
        });

        sentCount++;
      } catch (err) {
        errors.push(`Failed to send to ${subscriber.email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Update newsletter stats
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        totalSent: sentCount,
      },
    });

    if (errors.length > 0) {
      console.error("Some newsletter sends failed:", errors);
    }

    return { success: true, sentCount };
  } catch (error) {
    console.error("Send newsletter error:", error);
    
    // Revert to draft on complete failure
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: { status: "DRAFT" },
    }).catch(() => {});

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send newsletter",
    };
  }
}

/**
 * Process scheduled newsletters (called by cron job)
 */
export async function processScheduledNewsletters(): Promise<{ processed: number }> {
  const now = new Date();
  
  const scheduledNewsletters = await prisma.newsletter.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
  });

  let processed = 0;

  for (const newsletter of scheduledNewsletters) {
    const result = await sendNewsletter({
      newsletterId: newsletter.id,
      sendImmediately: true,
    });
    
    if (result.success) {
      processed++;
    }
  }

  return { processed };
}

/**
 * Create a newsletter from a post
 */
export async function createNewsletterFromPost({
  postId,
  subject,
  preheader,
}: {
  postId: string;
  subject: string;
  preheader?: string;
}): Promise<{
  id: string;
  postId: string;
  subject: string;
  status: string;
}> {
  return prisma.newsletter.create({
    data: {
      postId,
      subject,
      preheader,
      status: "DRAFT",
    },
  });
}

/**
 * Record newsletter open event
 */
export async function recordNewsletterOpen(trackingId: string): Promise<void> {
  const recipient = await prisma.newsletterRecipient.findUnique({
    where: { trackingId },
    include: { newsletter: true },
  });

  if (!recipient) return;

  // Update recipient open tracking
  await prisma.newsletterRecipient.update({
    where: { trackingId },
    data: {
      openCount: { increment: 1 },
      ...(!recipient.openedAt && { openedAt: new Date() }),
    },
  });

  // Log event
  await prisma.newsletterEvent.create({
    data: {
      recipientId: recipient.id,
      type: "OPEN",
    },
  });

  // Update aggregate stats
  if (!recipient.openedAt) {
    await prisma.newsletter.update({
      where: { id: recipient.newsletterId },
      data: { totalOpened: { increment: 1 } },
    });
  }
}

/**
 * Record newsletter click event
 */
export async function recordNewsletterClick(trackingId: string, url: string): Promise<void> {
  const recipient = await prisma.newsletterRecipient.findUnique({
    where: { trackingId },
    include: { newsletter: true },
  });

  if (!recipient) return;

  // Update recipient click tracking
  await prisma.newsletterRecipient.update({
    where: { trackingId },
    data: {
      clickCount: { increment: 1 },
      ...(!recipient.clickedAt && { clickedAt: new Date() }),
    },
  });

  // Log event
  await prisma.newsletterEvent.create({
    data: {
      recipientId: recipient.id,
      type: "CLICK",
      url,
    },
  });

  // Update aggregate stats
  if (!recipient.clickedAt) {
    await prisma.newsletter.update({
      where: { id: recipient.newsletterId },
      data: { totalClicked: { increment: 1 } },
    });
  }
}

/**
 * Process newsletter unsubscribe
 */
export async function processNewsletterUnsubscribe(trackingId: string): Promise<boolean> {
  const recipient = await prisma.newsletterRecipient.findUnique({
    where: { trackingId },
    include: { subscriber: true },
  });

  if (!recipient) return false;

  // Update subscriber status
  await prisma.newsletterSubscriber.update({
    where: { id: recipient.subscriberId },
    data: { status: "UNSUBSCRIBED" },
  });

  // Log event
  await prisma.newsletterEvent.create({
    data: {
      recipientId: recipient.id,
      type: "UNSUBSCRIBE",
    },
  });

  // Also unsubscribe from Resend if they have a resendId
  if (recipient.subscriber.resendId && EMAIL_CONFIG.newsletterListId) {
    try {
      await resend.contacts.update({
        id: recipient.subscriber.resendId,
        audienceId: EMAIL_CONFIG.newsletterListId,
        unsubscribed: true,
      });
    } catch (err) {
      console.error("Failed to unsubscribe from Resend:", err);
    }
  }

  return true;
}

/**
 * Generate newsletter HTML with tracking
 * Exported for preview purposes
 */
export function getNewsletterHtml({
  post,
  trackingId,
  preheader,
  subscriberName,
}: {
  post: { 
    title: string; 
    slug: string; 
    metaTitle: string | null;
    metaDescription: string | null;
    excerpt: string | null;
    heroImage: string | null;
    heroImageAlt: string | null;
    readingTimeMin: number | null;
    category: { name: string; slug: string };
  };
  trackingId: string | null;
  preheader?: string;
  subscriberName?: string;
}): string {
  const greeting = subscriberName ? `Hi ${subscriberName},` : "Hello,";
  const articleUrl = `${BASE_URL}/${post.category.slug}/${post.slug}`;
  
  // Build tracked URL if tracking is enabled
  const trackedArticleUrl = trackingId 
    ? `${BASE_URL}/api/newsletter-click?t=${trackingId}&url=${encodeURIComponent(articleUrl)}`
    : articleUrl;
  
  const unsubscribeUrl = trackingId 
    ? `${BASE_URL}/api/newsletter-unsubscribe/${trackingId}`
    : `${BASE_URL}/unsubscribe`;

  // Tracking pixel (1x1 transparent GIF)
  const trackingPixel = trackingId 
    ? `<img src="${BASE_URL}/api/newsletter-track/${trackingId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
    : "";

  // Preheader text (hidden preview text)
  const preheaderHtml = preheader 
    ? `<div style="display:none;font-size:1px;color:#f9fafb;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.metaTitle || post.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3a464f 0%, #2e383f 100%); padding: 30px 40px;">
              <img src="https://blog.creststudyconsult.com/logo.png" alt="Crest Study Consult" width="120" style="display: block;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #4b5563;">
                ${greeting}
              </p>
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #4f9a2a;">
                ${post.category.name} · ${post.readingTimeMin || 5} min read
              </p>
              <h1 style="margin: 0 0 20px; font-size: 26px; font-weight: 700; color: #111827; line-height: 1.3;">
                ${post.title}
              </h1>
              
              ${post.heroImage ? `
              <img src="${post.heroImage}" alt="${post.heroImageAlt || post.title}" width="520" style="display: block; width: 100%; height: auto; border-radius: 12px; margin-bottom: 24px;">
              ` : ""}
              
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.7; color: #4b5563;">
                ${post.metaDescription || post.excerpt || ""}
              </p>
              
              <a href="${trackedArticleUrl}" style="display: inline-block; padding: 16px 32px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                Read the full article →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 15px; font-size: 14px; color: #6b7280;">
                Crest Study Consult LTD
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you subscribed at blog.creststudyconsult.com.<br>
                <a href="${unsubscribeUrl}" style="color: #4f9a2a;">Unsubscribe</a> · 
                <a href="${BASE_URL}" style="color: #4f9a2a;">View in browser</a>
              </p>
              ${trackingPixel}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
