/**
 * Email Debug API Route
 * 
 * For debugging email delivery issues. Shows configuration
 * and sends a simple test email.
 * Protected by admin authentication.
 */

import type { Route } from "./+types/api.email-debug";
import { requireAdmin } from "~/utils/session.server";
import { Resend } from "resend";
import { EMAIL_CONFIG } from "~/utils/email.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;

  return Response.json({
    config: {
      from: EMAIL_CONFIG.from,
      replyTo: EMAIL_CONFIG.replyTo,
      audienceId: audienceId ? `${audienceId.substring(0, 8)}...` : "NOT SET",
      apiKeySet: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 8)}...` : "NOT SET",
    },
    note: "POST to this endpoint with email=your@email.com to send a test",
  });
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const testEmail = formData.get("email") as string;

  if (!testEmail) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  try {
    // First, check if we can list domains (validates API key)
    const { data: domains, error: domainError } = await resend.domains.list();

    if (domainError) {
      return Response.json({ 
        error: "Failed to verify API key",
        details: domainError,
      }, { status: 500 });
    }

    // Send a simple test email
    const { data: sendResult, error: sendError } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: testEmail,
      subject: "Crest Study Consult Email Test",
      html: `
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1>Email test successful!</h1>
            <p>If you're reading this, email delivery is working.</p>
            <p>Sent at: ${new Date().toISOString()}</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              This is a test email from Crest Study Consult blog admin.
            </p>
          </body>
        </html>
      `,
    });

    if (sendError) {
      return Response.json({ 
        error: "Failed to send test email",
        details: sendError,
        domains: domains?.data?.map(d => ({ name: d.name, status: d.status })),
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      messageId: sendResult?.id,
      domains: domains?.data?.map(d => ({ name: d.name, status: d.status })),
    });
  } catch (error) {
    return Response.json({ 
      error: "Exception during email send",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
