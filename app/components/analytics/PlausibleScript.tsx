/**
 * Plausible Analytics Script Component
 * 
 * Privacy-focused analytics for Crest Study Consult blog.
 * - No cookies
 * - GDPR compliant
 * - Lightweight (<1KB)
 * - EU-hosted data
 */

import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SCRIPT_URL_EXTENDED } from "~/utils/analytics";

/**
 * Plausible analytics script for head injection
 * Only loads in production to avoid polluting development analytics
 */
export function PlausibleScript() {
  // Only render in production
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <script
      defer
      data-domain={PLAUSIBLE_DOMAIN}
      src={PLAUSIBLE_SCRIPT_URL_EXTENDED}
    />
  );
}

/**
 * Plausible event tracking hook for React components
 * 
 * Usage:
 * ```tsx
 * const trackEvent = usePlausible();
 * trackEvent("Newsletter Signup", { source: "homepage" });
 * ```
 */
export function usePlausible() {
  return (
    event: string,
    props?: Record<string, string | number | boolean>,
    callback?: () => void
  ) => {
    if (typeof window !== "undefined" && window.plausible) {
      window.plausible(event, { props, callback });
    } else if (callback) {
      callback();
    }
  };
}

export default PlausibleScript;
