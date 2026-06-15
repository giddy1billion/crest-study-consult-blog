/**
 * Crest Study Consult Blog - Shared Helper Utilities
 * 
 * Pure functions that can be used on both client and server.
 * No database or server-only imports allowed here.
 */

/**
 * Generate a URL-safe slug from a title
 * Max 6 words per PRD requirements
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
}

/**
 * Validate slug format
 * Must be lowercase alphanumeric with hyphens, max 6 words
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const wordCount = slug.split("-").length;
  return slugRegex.test(slug) && wordCount <= 6;
}

/**
 * Calculate estimated reading time in minutes
 * Based on average reading speed of 200 words per minute
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}
