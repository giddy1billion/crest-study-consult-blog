/**
 * Article Stats Hook
 * 
 * Client-side hook for tracking article views and shares.
 * Automatically tracks view on mount and provides share tracking function.
 */

import { useEffect, useRef, useCallback } from "react";
import { trackArticleShare as trackPlausibleShare } from "~/utils/analytics";

interface UseArticleStatsOptions {
  slug: string;
  trackView?: boolean;
}

type SharePlatform = "twitter" | "linkedin" | "facebook" | "whatsapp" | "copy" | "email";
type PlausibleSharePlatform = "twitter" | "linkedin" | "facebook" | "whatsapp" | "copy";

interface ShareOptions {
  platform: SharePlatform;
}

/**
 * Hook for tracking article statistics
 * 
 * @param options - Configuration options
 * @returns Object with trackShare function
 * 
 * @example
 * ```tsx
 * const { trackShare } = useArticleStats({ slug: "my-article" });
 * 
 * // When user shares
 * trackShare({ platform: "twitter" });
 * ```
 */
export function useArticleStats({ slug, trackView = true }: UseArticleStatsOptions) {
  const viewTracked = useRef(false);

  // Track view on mount (only once)
  useEffect(() => {
    if (!trackView || viewTracked.current) return;

    // Don't track in SSR
    if (typeof window === "undefined") return;

    // Small delay to ensure page is fully loaded and to avoid duplicate tracking
    const timer = setTimeout(async () => {
      if (viewTracked.current) return;
      viewTracked.current = true;

      try {
        await fetch("/api/article-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "view",
            slug,
            referer: document.referrer || undefined,
          }),
        });
      } catch {
        // Silently fail - don't break the page for analytics
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, trackView]);

  // Track share
  const trackShare = useCallback(
    async ({ platform }: ShareOptions) => {
      // Map platform names to API format
      const platformMap: Record<string, string> = {
        twitter: "TWITTER",
        linkedin: "LINKEDIN",
        facebook: "FACEBOOK",
        whatsapp: "WHATSAPP",
        copy: "COPY_LINK",
        email: "EMAIL",
      };

      // Track with Plausible (privacy-first analytics) - only for supported platforms
      if (platform !== "email") {
        trackPlausibleShare(slug, platform as PlausibleSharePlatform);
      }

      // Track in our database
      try {
        await fetch("/api/article-stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "share",
            slug,
            platform: platformMap[platform] || platform.toUpperCase(),
          }),
        });
      } catch {
        // Silently fail
      }
    },
    [slug]
  );

  return { trackShare };
}

/**
 * Standalone function to track a share without the hook
 * Useful for one-off tracking
 */
export async function trackArticleShare(
  slug: string,
  platform: SharePlatform
): Promise<void> {
  const platformMap: Record<string, string> = {
    twitter: "TWITTER",
    linkedin: "LINKEDIN",
    facebook: "FACEBOOK",
    whatsapp: "WHATSAPP",
    copy: "COPY_LINK",
    email: "EMAIL",
  };

  // Track with Plausible (only for supported platforms)
  if (platform !== "email") {
    trackPlausibleShare(slug, platform as PlausibleSharePlatform);
  }

  // Track in database
  try {
    await fetch("/api/article-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "share",
        slug,
        platform: platformMap[platform] || platform.toUpperCase(),
      }),
    });
  } catch {
    // Silently fail
  }
}
