/**
 * Newsletter Click Tracking Endpoint
 * 
 * Records click event and redirects to the target URL.
 * Path: /api/newsletter-click?t=trackingId&url=targetUrl
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { recordNewsletterClick } from "~/utils/email.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const trackingId = url.searchParams.get("t");
  const targetUrl = url.searchParams.get("url");

  // Validate target URL
  if (!targetUrl) {
    return redirect("https://blog.creststudyconsult.com");
  }

  // Decode the target URL
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
  } catch {
    decodedUrl = targetUrl;
  }

  // Only allow redirects to propx.africa domains for security
  const allowedDomains = ["blog.creststudyconsult.com", "propx.africa", "www.propx.africa"];
  try {
    const parsedUrl = new URL(decodedUrl);
    if (!allowedDomains.some((domain) => parsedUrl.hostname === domain)) {
      return redirect("https://blog.creststudyconsult.com");
    }
  } catch {
    // If URL parsing fails, redirect to homepage
    return redirect("https://blog.creststudyconsult.com");
  }

  // Record click event if tracking ID provided
  if (trackingId) {
    recordNewsletterClick(trackingId, decodedUrl).catch((err) => {
      console.error("Failed to record newsletter click:", err);
    });
  }

  // Redirect to target URL
  return redirect(decodedUrl);
}
