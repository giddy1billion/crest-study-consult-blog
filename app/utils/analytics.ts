/**
 * Crest Study Consult Analytics Configuration
 * 
 * Plausible Analytics integration for privacy-focused tracking.
 * No cookies, GDPR compliant, hosted on EU servers.
 */

// Plausible domain configuration
export const PLAUSIBLE_DOMAIN = "blog.creststudyconsult.com";
export const PLAUSIBLE_SCRIPT_URL = "https://plausible.io/js/script.js";

// Extended Plausible with outbound links, file downloads, and custom events
export const PLAUSIBLE_SCRIPT_URL_EXTENDED = 
  "https://plausible.io/js/script.tagged-events.outbound-links.file-downloads.js";

/**
 * Custom event types for Crest Study Consult blog
 */
export type AnalyticsEvent = 
  | "Newsletter Signup"
  | "Article Share"
  | "Contact Form Submit"
  | "PDF Download"
  | "External Link Click"
  | "Search Query"
  | "Category Filter"
  | "Article Read Complete"
  | "CTA Click";

/**
 * Event properties interface
 */
export interface EventProps {
  [key: string]: string | number | boolean;
}

/**
 * Plausible window interface
 */
declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: EventProps; callback?: () => void }
    ) => void;
  }
}

/**
 * Track a custom event with Plausible
 * 
 * @param event - Event name
 * @param props - Optional event properties
 * @param callback - Optional callback after tracking
 */
export function trackEvent(
  event: AnalyticsEvent | string,
  props?: EventProps,
  callback?: () => void
): void {
  // Check if Plausible is loaded
  if (typeof window !== "undefined" && window.plausible) {
    window.plausible(event, { props, callback });
  } else if (callback) {
    // If Plausible isn't loaded, still call the callback
    callback();
  }
}

/**
 * Track newsletter signup
 */
export function trackNewsletterSignup(source: string = "footer"): void {
  trackEvent("Newsletter Signup", { source });
}

/**
 * Track article share
 */
export function trackArticleShare(
  articleSlug: string,
  platform: "twitter" | "linkedin" | "facebook" | "whatsapp" | "copy"
): void {
  trackEvent("Article Share", { article: articleSlug, platform });
}

/**
 * Track PDF or report download
 */
export function trackDownload(filename: string, type: "pdf" | "report" | "guide"): void {
  trackEvent("PDF Download", { filename, type });
}

/**
 * Track search query
 */
export function trackSearch(query: string, resultsCount: number): void {
  trackEvent("Search Query", { query, results: resultsCount });
}

/**
 * Track category filter
 */
export function trackCategoryFilter(category: string): void {
  trackEvent("Category Filter", { category });
}

/**
 * Track article read completion (e.g., scrolled to bottom)
 */
export function trackArticleReadComplete(articleSlug: string): void {
  trackEvent("Article Read Complete", { article: articleSlug });
}

/**
 * Track CTA button clicks
 */
export function trackCTAClick(ctaName: string, location: string): void {
  trackEvent("CTA Click", { cta: ctaName, location });
}
