/**
 * Crest Study Consult Email Service
 * 
 * Server-side email utilities using Resend.
 * Handles newsletter signups, transactional emails, and notifications.
 */

import { Resend } from "resend";
import { db as prisma } from "~/utils/db.server";
import { randomUUID } from "crypto";
import { buildUnsubscribeUrl } from "~/utils/unsubscribe-token.server";

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
      html: getWelcomeEmailHtml(firstName, email),
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
 * Send an admin invitation email containing temporary login credentials.
 *
 * Sent when a new admin account is created. The recipient must change their
 * password on first sign-in before they can access the dashboard.
 */
export async function sendAdminInviteEmail({
  to,
  name,
  tempPassword,
  role,
  inviterName,
}: {
  to: string;
  name: string;
  tempPassword: string;
  role: string;
  inviterName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const loginUrl = "https://blog.creststudyconsult.com/admin/login";
  return sendEmail({
    to,
    subject: "Your Crest Study Consult admin account",
    html: getAdminInviteEmailHtml({ name, email: to, tempPassword, role, loginUrl, inviterName }),
    text:
      `Hi ${name},\n\n` +
      `An administrator account has been created for you on the Crest Study Consult editorial dashboard` +
      `${inviterName ? ` by ${inviterName}` : ""}.\n\n` +
      `Sign in at: ${loginUrl}\n` +
      `Email: ${to}\n` +
      `Temporary password: ${tempPassword}\n` +
      `Role: ${role}\n\n` +
      `For your security you will be required to set a new password the first time you sign in, ` +
      `before you can access the dashboard. This temporary password can only be used once.\n\n` +
      `If you did not expect this email, please notify the systems administrator immediately.`,
  });
}

/**
 * Admin invitation email HTML template
 */
function getAdminInviteEmailHtml({
  name,
  email,
  tempPassword,
  role,
  loginUrl,
  inviterName,
}: {
  name: string;
  email: string;
  tempPassword: string;
  role: string;
  loginUrl: string;
  inviterName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Crest Study Consult admin account</title>
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
                You've been invited as an administrator
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #4b5563;">
                Hi ${name}, an administrator account has been created for you on the Crest Study Consult
                editorial dashboard${inviterName ? ` by ${inviterName}` : ""}. Use the temporary credentials
                below to sign in.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: #f3f4f6; border-radius: 12px;">
                <tr><td style="padding: 20px 24px;">
                  <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280;">Email</p>
                  <p style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #111827;">${email}</p>
                  <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280;">Temporary password</p>
                  <p style="margin: 0 0 20px; font-size: 18px; font-weight: 700; letter-spacing: 1px; font-family: 'Courier New', monospace; color: #111827;">${tempPassword}</p>
                  <p style="margin: 0 0 12px; font-size: 14px; color: #6b7280;">Role</p>
                  <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${role}</p>
                </td></tr>
              </table>
              <a href="${loginUrl}" style="display: inline-block; padding: 14px 28px; background-color: #4f9a2a; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
                Sign in to the dashboard
              </a>
              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                <strong style="color: #4b5563;">For your security</strong>, you will be required to set a new
                password the first time you sign in, before you can access the dashboard. This temporary
                password can only be used once.
              </p>
              <p style="margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                If you did not expect this email, please notify the systems administrator immediately.
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
function getWelcomeEmailHtml(firstName?: string, email?: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Welcome,";
  const unsubscribeUrl = email
    ? buildUnsubscribeUrl(email, "https://blog.creststudyconsult.com")
    : `https://blog.creststudyconsult.com/unsubscribe`;
  
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
                <a href="${unsubscribeUrl}" style="color: #4f9a2a;">Unsubscribe</a>
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
  email,
}: {
  title: string;
  excerpt: string;
  url: string;
  category: string;
  readingTime: number;
  email?: string;
}): string {
  const unsubscribeUrl = email
    ? buildUnsubscribeUrl(email, "https://blog.creststudyconsult.com")
    : `https://blog.creststudyconsult.com/unsubscribe`;
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
                <a href="${unsubscribeUrl}" style="color: #4f9a2a;">Unsubscribe</a> · 
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
    // Guard: API key must be configured
    if (!process.env.RESEND_API_KEY) {
      const error = "RESEND_API_KEY is not configured in the environment";
      console.error("[syncSubscribersFromResend]", error);
      return { success: false, added: 0, updated: 0, error };
    }

    // Guard: audience ID must be configured
    if (!EMAIL_CONFIG.newsletterListId) {
      const error =
        "RESEND_AUDIENCE_ID is not configured. Set it in your environment to enable syncing.";
      console.error("[syncSubscribersFromResend]", error);
      return { success: false, added: 0, updated: 0, error };
    }

    console.info(
      `[syncSubscribersFromResend] Fetching contacts for audience ${EMAIL_CONFIG.newsletterListId}`
    );

    // Fetch all contacts from Resend
    const response = await resend.contacts.list({
      audienceId: EMAIL_CONFIG.newsletterListId,
    });

    // Surface the actual Resend API error if present
    if (response.error) {
      const { name, message } = response.error;
      const detailedError = `Resend API error${name ? ` (${name})` : ""}: ${
        message || "Unknown error returned by Resend"
      }`;
      console.error("[syncSubscribersFromResend] Resend returned an error:", response.error);
      return { success: false, added: 0, updated: 0, error: detailedError };
    }

    // The list endpoint returns { data: { object, data: Contact[] } }
    const contacts = response.data?.data;

    if (!Array.isArray(contacts)) {
      const error =
        "Unexpected response shape from Resend — no contact array was returned. " +
        `Received: ${JSON.stringify(response.data)}`;
      console.error("[syncSubscribersFromResend]", error);
      return { success: false, added: 0, updated: 0, error };
    }

    console.info(
      `[syncSubscribersFromResend] Retrieved ${contacts.length} contact(s) from Resend`
    );

    let added = 0;
    let updated = 0;
    const rowErrors: string[] = [];

    for (const contact of contacts) {
      if (!contact.email) {
        rowErrors.push(`Skipped contact ${contact.id ?? "(no id)"}: missing email`);
        continue;
      }

      try {
        const existing = await prisma.newsletterSubscriber.findUnique({
          where: { email: contact.email.toLowerCase() },
        });

        const status: "ACTIVE" | "UNSUBSCRIBED" = contact.unsubscribed
          ? "UNSUBSCRIBED"
          : "ACTIVE";

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
      } catch (rowError) {
        const message = rowError instanceof Error ? rowError.message : String(rowError);
        console.error(
          `[syncSubscribersFromResend] Failed to upsert contact ${contact.email}:`,
          rowError
        );
        rowErrors.push(`${contact.email}: ${message}`);
      }
    }

    if (rowErrors.length > 0) {
      const error = `Synced with ${rowErrors.length} error(s): ${rowErrors.join("; ")}`;
      console.warn("[syncSubscribersFromResend]", error);
      // Partial success — return what we managed plus the detail
      return { success: false, added, updated, error };
    }

    console.info(
      `[syncSubscribersFromResend] Done — added ${added}, updated ${updated}`
    );
    return { success: true, added, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[syncSubscribersFromResend] Unexpected failure:", error);
    return {
      success: false,
      added: 0,
      updated: 0,
      error: `Failed to sync subscribers: ${message}`,
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

// ============================================
// AUDIENCE & SEGMENT MANAGEMENT
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AudienceContact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  source: string | null;
  subscribedAt: Date;
  segments: { id: string; name: string; color: string | null }[];
};

export type SegmentSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  subscriberCount: number;
  createdAt: Date;
};

/**
 * List all segments with their active subscriber counts.
 */
export async function getSegments(): Promise<SegmentSummary[]> {
  const segments = await prisma.segment.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { subscribers: true } } },
  });

  return segments.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    color: s.color,
    subscriberCount: s._count.subscribers,
    createdAt: s.createdAt,
  }));
}

/**
 * Create a new segment. Returns the created segment or an error.
 */
export async function createSegment({
  name,
  description,
  color,
}: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Segment name is required" };
  }

  try {
    const existing = await prisma.segment.findUnique({ where: { name: trimmed } });
    if (existing) {
      return { success: false, error: `A segment named "${trimmed}" already exists` };
    }

    const segment = await prisma.segment.create({
      data: {
        name: trimmed,
        description: description?.trim() || null,
        color: color?.trim() || null,
      },
    });
    return { success: true, id: segment.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[createSegment] Failed:", error);
    return { success: false, error: `Failed to create segment: ${message}` };
  }
}

/**
 * Delete a segment (does not delete the subscribers, only the grouping).
 */
export async function deleteSegment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.segment.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[deleteSegment] Failed:", error);
    return { success: false, error: `Failed to delete segment: ${message}` };
  }
}

/**
 * Add or update a single contact, optionally assigning to segments.
 */
export async function addContact({
  email,
  firstName,
  lastName,
  segmentIds = [],
  source = "manual",
}: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  segmentIds?: string[];
  source?: string;
}): Promise<{ success: boolean; created?: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    const segmentConnect = segmentIds.length
      ? { connect: segmentIds.map((sid) => ({ id: sid })) }
      : undefined;

    if (existing) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          firstName: firstName?.trim() || existing.firstName,
          lastName: lastName?.trim() || existing.lastName,
          // Re-activate if they were previously removed
          status: existing.status === "ACTIVE" ? existing.status : "ACTIVE",
          segments: segmentConnect,
        },
      });
      return { success: true, created: false };
    }

    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        status: "ACTIVE",
        source,
        segments: segmentConnect,
      },
    });
    return { success: true, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[addContact] Failed:", error);
    return { success: false, error: `Failed to add contact: ${message}` };
  }
}

/**
 * Parse raw CSV text into contact rows.
 * Accepts headers (email, firstName/first_name/first name, lastName/last_name)
 * or simple "email,firstName,lastName" positional rows.
 */
export function parseContactsCsv(csv: string): {
  rows: { email: string; firstName: string | null; lastName: string | null }[];
  invalidLines: string[];
} {
  const rows: { email: string; firstName: string | null; lastName: string | null }[] = [];
  const invalidLines: string[] = [];

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { rows, invalidLines };

  // Detect a header row
  const splitLine = (line: string) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

  const firstCols = splitLine(lines[0]).map((c) => c.toLowerCase());
  let emailIdx = 0;
  let firstIdx = 1;
  let lastIdx = 2;
  let startRow = 0;

  const looksLikeHeader = firstCols.some((c) =>
    ["email", "e-mail", "firstname", "first name", "first_name", "lastname", "last name", "last_name"].includes(c)
  );

  if (looksLikeHeader) {
    emailIdx = firstCols.findIndex((c) => c === "email" || c === "e-mail");
    firstIdx = firstCols.findIndex((c) => ["firstname", "first name", "first_name", "name"].includes(c));
    lastIdx = firstCols.findIndex((c) => ["lastname", "last name", "last_name"].includes(c));
    if (emailIdx === -1) emailIdx = 0;
    startRow = 1;
  }

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const email = (cols[emailIdx] || "").toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      invalidLines.push(lines[i]);
      continue;
    }
    rows.push({
      email,
      firstName: firstIdx >= 0 ? cols[firstIdx]?.trim() || null : null,
      lastName: lastIdx >= 0 ? cols[lastIdx]?.trim() || null : null,
    });
  }

  return { rows, invalidLines };
}

/**
 * Bulk import contacts (from CSV rows or a pasted list).
 * Deduplicates by email, optionally assigns all to the given segments.
 */
export async function importContacts({
  rows,
  segmentIds = [],
  source = "import",
}: {
  rows: { email: string; firstName?: string | null; lastName?: string | null }[];
  segmentIds?: string[];
  source?: string;
}): Promise<{
  success: boolean;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Deduplicate within the batch by email (last wins for names)
  const byEmail = new Map<string, { email: string; firstName?: string | null; lastName?: string | null }>();
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      skipped++;
      continue;
    }
    byEmail.set(email, { ...row, email });
  }

  for (const row of byEmail.values()) {
    const result = await addContact({
      email: row.email,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      segmentIds,
      source,
    });
    if (!result.success) {
      errors.push(`${row.email}: ${result.error}`);
      continue;
    }
    if (result.created) added++;
    else updated++;
  }

  return { success: errors.length === 0, added, updated, skipped, errors };
}

/**
 * Assign existing subscribers to a segment.
 */
export async function assignToSegment(
  subscriberIds: string[],
  segmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.segment.update({
      where: { id: segmentId },
      data: { subscribers: { connect: subscriberIds.map((id) => ({ id })) } },
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[assignToSegment] Failed:", error);
    return { success: false, error: `Failed to assign to segment: ${message}` };
  }
}

/**
 * Remove a subscriber from a segment.
 */
export async function removeFromSegment(
  subscriberId: string,
  segmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.segment.update({
      where: { id: segmentId },
      data: { subscribers: { disconnect: { id: subscriberId } } },
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[removeFromSegment] Failed:", error);
    return { success: false, error: `Failed to remove from segment: ${message}` };
  }
}

/**
 * Update a contact's status (e.g. unsubscribe) or delete it.
 */
export async function setContactStatus(
  subscriberId: string,
  status: "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINED"
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: {
        status,
        unsubscribedAt: status === "UNSUBSCRIBED" ? new Date() : null,
      },
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[setContactStatus] Failed:", error);
    return { success: false, error: `Failed to update contact: ${message}` };
  }
}

export async function deleteContact(
  subscriberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.newsletterSubscriber.delete({ where: { id: subscriberId } });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[deleteContact] Failed:", error);
    return { success: false, error: `Failed to delete contact: ${message}` };
  }
}

/**
 * Bulk-update status for many subscribers at once.
 */
export async function bulkSetContactStatus(
  subscriberIds: string[],
  status: "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINED"
): Promise<{ success: boolean; count: number; error?: string }> {
  const ids = subscriberIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: false, count: 0, error: "No contacts selected" };
  }
  try {
    const result = await prisma.newsletterSubscriber.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        unsubscribedAt: status === "UNSUBSCRIBED" ? new Date() : null,
      },
    });
    return { success: true, count: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bulkSetContactStatus] Failed:", error);
    return { success: false, count: 0, error: `Failed to update contacts: ${message}` };
  }
}

/**
 * Bulk-delete many subscribers at once.
 */
export async function bulkDeleteContacts(
  subscriberIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  const ids = subscriberIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: false, count: 0, error: "No contacts selected" };
  }
  try {
    const result = await prisma.newsletterSubscriber.deleteMany({
      where: { id: { in: ids } },
    });
    return { success: true, count: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bulkDeleteContacts] Failed:", error);
    return { success: false, count: 0, error: `Failed to delete contacts: ${message}` };
  }
}

/**
 * Paginated, searchable, filterable audience list for the Audience tab.
 */
export async function getAudience({
  search,
  segmentId,
  status,
  page = 1,
  pageSize = 25,
}: {
  search?: string;
  segmentId?: string;
  status?: "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINED";
  page?: number;
  pageSize?: number;
} = {}): Promise<{ contacts: AudienceContact[]; total: number; page: number; pageSize: number }> {
  const where: Record<string, unknown> = {};

  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (segmentId) {
    where.segments = { some: { id: segmentId } };
  }
  if (status) {
    where.status = status;
  }

  const safePage = Math.max(1, page);

  const [contacts, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { subscribedAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: { segments: { select: { id: true, name: true, color: true } } },
    }),
    prisma.newsletterSubscriber.count({ where }),
  ]);

  return {
    contacts: contacts.map((c) => ({
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.status,
      source: c.source,
      subscribedAt: c.subscribedAt,
      segments: c.segments,
    })),
    total,
    page: safePage,
    pageSize,
  };
}

/**
 * Audience statistics from the NewsletterSubscriber table (the table that
 * newsletters are actually delivered to).
 */
export async function getAudienceStats(): Promise<{
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  segments: number;
}> {
  const [total, active, unsubscribed, bounced, segments] = await Promise.all([
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { status: "ACTIVE" } }),
    prisma.newsletterSubscriber.count({ where: { status: "UNSUBSCRIBED" } }),
    prisma.newsletterSubscriber.count({ where: { status: "BOUNCED" } }),
    prisma.segment.count(),
  ]);

  return { total, active, unsubscribed, bounced, segments };
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
  segmentIds,
}: {
  newsletterId: string;
  sendImmediately?: boolean;
  scheduledFor?: Date;
  segmentIds?: string[];
}): Promise<{ success: boolean; sentCount?: number; error?: string }> {
  try {
    const newsletter = await prisma.newsletter.findUnique({
      where: { id: newsletterId },
      include: { post: { include: { category: true } } },
    });

    if (!newsletter) {
      return { success: false, error: "Newsletter not found" };
    }

    // Normalize segment targeting (empty array or undefined = all subscribers)
    const targetSegmentIds = (segmentIds ?? []).filter(Boolean);

    // If scheduling for later, just update status (persist target segments too)
    if (!sendImmediately && scheduledFor) {
      await prisma.newsletter.update({
        where: { id: newsletterId },
        data: {
          status: "SCHEDULED",
          scheduledFor,
          targetSegments: targetSegmentIds.length
            ? { set: targetSegmentIds.map((id) => ({ id })) }
            : { set: [] },
        },
      });
      return { success: true, sentCount: 0 };
    }

    // Get active subscribers — scoped to the chosen segments if any
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: {
        status: "ACTIVE",
        ...(targetSegmentIds.length
          ? { segments: { some: { id: { in: targetSegmentIds } } } }
          : {}),
      },
    });

    if (subscribers.length === 0) {
      return {
        success: false,
        error: targetSegmentIds.length
          ? "No active subscribers in the selected segment(s)"
          : "No active subscribers",
      };
    }

    // Record which segments this campaign targeted
    await prisma.newsletter.update({
      where: { id: newsletterId },
      data: {
        status: "SENDING",
        targetSegments: targetSegmentIds.length
          ? { set: targetSegmentIds.map((id) => ({ id })) }
          : { set: [] },
      },
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
          subscriberEmail: subscriber.email,
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
 * Look up the subscription status for an email across both subscriber tables.
 * Used by the public /unsubscribe page to render the correct state without
 * mutating anything (safe for GET requests / email-scanner prefetch).
 */
export type EmailSubscriptionState = "not-found" | "active" | "unsubscribed";

export async function getSubscriberStatusByEmail(email: string): Promise<{
  state: EmailSubscriptionState;
  firstName: string | null;
}> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    return { state: "not-found", firstName: null };
  }

  const [newsletterSub, legacySub] = await Promise.all([
    prisma.newsletterSubscriber.findUnique({ where: { email: normalized } }),
    prisma.subscriber.findUnique({ where: { email: normalized } }),
  ]);

  if (!newsletterSub && !legacySub) {
    return { state: "not-found", firstName: null };
  }

  const isActive =
    (newsletterSub && newsletterSub.status === "ACTIVE") ||
    (legacySub && legacySub.isActive);

  return {
    state: isActive ? "active" : "unsubscribed",
    firstName: newsletterSub?.firstName ?? null,
  };
}

/**
 * Unsubscribe an email across both subscriber tables and Resend.
 * Idempotent — safe to call when already unsubscribed.
 */
export async function unsubscribeByEmail(
  email: string,
  reason?: string | null
): Promise<{ success: boolean; state: EmailSubscriptionState; error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    return { success: false, state: "not-found", error: "Please provide a valid email address" };
  }

  try {
    const [newsletterSub, legacySub] = await Promise.all([
      prisma.newsletterSubscriber.findUnique({ where: { email: normalized } }),
      prisma.subscriber.findUnique({ where: { email: normalized } }),
    ]);

    if (!newsletterSub && !legacySub) {
      return { success: false, state: "not-found", error: "We couldn't find that email on our list" };
    }

    const now = new Date();
    const tasks: Promise<unknown>[] = [];

    if (newsletterSub) {
      tasks.push(
        prisma.newsletterSubscriber.update({
          where: { id: newsletterSub.id },
          data: {
            status: "UNSUBSCRIBED",
            unsubscribedAt: now,
            ...(reason ? { source: `unsubscribe:${reason}`.slice(0, 191) } : {}),
          },
        })
      );

      if (newsletterSub.resendId && EMAIL_CONFIG.newsletterListId) {
        tasks.push(
          resend.contacts
            .update({
              id: newsletterSub.resendId,
              audienceId: EMAIL_CONFIG.newsletterListId,
              unsubscribed: true,
            })
            .catch((err: unknown) => {
              console.error("[unsubscribeByEmail] Resend update failed:", err);
            })
        );
      }
    }

    if (legacySub) {
      tasks.push(
        prisma.subscriber.update({
          where: { id: legacySub.id },
          data: { isActive: false, unsubscribedAt: now },
        })
      );
    }

    await Promise.all(tasks);

    return { success: true, state: "unsubscribed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[unsubscribeByEmail] Failed:", error);
    return { success: false, state: "active", error: `Failed to unsubscribe: ${message}` };
  }
}

/**
 * Re-subscribe an email (undo an unsubscribe) across both tables and Resend.
 */
export async function resubscribeByEmail(
  email: string
): Promise<{ success: boolean; state: EmailSubscriptionState; error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    return { success: false, state: "not-found", error: "Please provide a valid email address" };
  }

  try {
    const [newsletterSub, legacySub] = await Promise.all([
      prisma.newsletterSubscriber.findUnique({ where: { email: normalized } }),
      prisma.subscriber.findUnique({ where: { email: normalized } }),
    ]);

    if (!newsletterSub && !legacySub) {
      await prisma.subscriber.create({
        data: { email: normalized, source: "resubscribe", isActive: true },
      });
      return { success: true, state: "active" };
    }

    const tasks: Promise<unknown>[] = [];

    if (newsletterSub) {
      tasks.push(
        prisma.newsletterSubscriber.update({
          where: { id: newsletterSub.id },
          data: { status: "ACTIVE", unsubscribedAt: null },
        })
      );
      if (newsletterSub.resendId && EMAIL_CONFIG.newsletterListId) {
        tasks.push(
          resend.contacts
            .update({
              id: newsletterSub.resendId,
              audienceId: EMAIL_CONFIG.newsletterListId,
              unsubscribed: false,
            })
            .catch((err: unknown) => {
              console.error("[resubscribeByEmail] Resend update failed:", err);
            })
        );
      }
    }

    if (legacySub) {
      tasks.push(
        prisma.subscriber.update({
          where: { id: legacySub.id },
          data: { isActive: true, unsubscribedAt: null, subscribedAt: new Date() },
        })
      );
    }

    await Promise.all(tasks);

    return { success: true, state: "active" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[resubscribeByEmail] Failed:", error);
    return { success: false, state: "unsubscribed", error: `Failed to re-subscribe: ${message}` };
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
  subscriberEmail,
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
  subscriberEmail?: string;
}): string {
  const greeting = subscriberName ? `Hi ${subscriberName},` : "Hello,";
  const articleUrl = `${BASE_URL}/${post.category.slug}/${post.slug}`;
  
  // Build tracked URL if tracking is enabled
  const trackedArticleUrl = trackingId 
    ? `${BASE_URL}/api/newsletter-click?t=${trackingId}&url=${encodeURIComponent(articleUrl)}`
    : articleUrl;
  
  // Unsubscribe link points to the signed, confirmation-based page.
  // Prefer the email-signed URL (anti-prefetch + tamper-proof); fall back to
  // the legacy one-click tracking endpoint only when no email is available.
  const unsubscribeUrl = subscriberEmail
    ? buildUnsubscribeUrl(subscriberEmail, BASE_URL)
    : trackingId
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
