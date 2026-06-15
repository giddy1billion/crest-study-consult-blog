/**
 * Newsletter Unsubscribe Endpoint
 * 
 * Processes one-click unsubscribe and shows confirmation page.
 * Path: /api/newsletter-unsubscribe/:trackingId
 */

import type { LoaderFunctionArgs } from "react-router";
import { processNewsletterUnsubscribe } from "~/utils/email.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { trackingId } = params;

  if (!trackingId) {
    return new Response(getUnsubscribePage(false, "Invalid unsubscribe link"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const success = await processNewsletterUnsubscribe(trackingId);

  return new Response(getUnsubscribePage(success), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function getUnsubscribePage(success: boolean, error?: string): string {
  const title = success ? "Unsubscribed successfully" : "Unsubscribe failed";
  const message = success
    ? "You have been successfully unsubscribed from Crest Study Consult Research newsletter. You will no longer receive emails from us."
    : error || "We couldn't process your unsubscribe request. The link may have expired or already been used.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Crest Study Consult</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    .icon.success { background: #f0f8e9; }
    .icon.error { background: #fef2f2; }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 32px;
    }
    a {
      display: inline-block;
      padding: 14px 28px;
      background-color: #4f9a2a;
      color: white;
      text-decoration: none;
      font-weight: 600;
      border-radius: 12px;
      transition: background-color 0.2s;
    }
    a:hover { background-color: #3f7c22; }
    .footer {
      margin-top: 32px;
      font-size: 14px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? 'success' : 'error'}">
      ${success ? '✓' : '✕'}
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://blog.creststudyconsult.com">Return to Crest Study Consult</a>
    <p class="footer">Crest Study Consult LTD</p>
  </div>
</body>
</html>
  `.trim();
}
