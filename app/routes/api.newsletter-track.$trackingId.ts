/**
 * Newsletter Open Tracking Endpoint
 * 
 * Returns a 1x1 transparent GIF pixel and records the open event.
 * Path: /api/newsletter-track/:trackingId
 */

import type { LoaderFunctionArgs } from "react-router";
import { recordNewsletterOpen } from "~/utils/email.server";

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function loader({ params }: LoaderFunctionArgs) {
  const { trackingId } = params;

  if (trackingId) {
    // Record open event asynchronously (don't wait)
    recordNewsletterOpen(trackingId).catch((err) => {
      console.error("Failed to record newsletter open:", err);
    });
  }

  // Return transparent 1x1 GIF
  return new Response(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRACKING_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
