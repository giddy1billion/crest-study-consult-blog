/**
 * Crest Study Consult — Brand Constants
 * Single source of truth for brand-related values.
 *
 * Crest Study Consult is an international education consultancy that guides
 * students from first contact to full settlement in their chosen institution
 * and destination. The blog at blog.creststudyconsult.com is the education
 * intelligence layer of the brand.
 *
 * NOTE: Values marked `// TODO: confirm` are placeholders — confirm the real
 * social handles and head-office location before launch.
 */
export const BRAND = {
  /** Full brand name — always used in full, never "Crest" alone */
  name: "Crest Study Consult",
  /** Short brand mark — kept as the full name to satisfy brand rules */
  shortName: "Crest Study Consult",
  /** Brand positioning statement used across titles and schema */
  positioning: "Empowering Dreams, Connecting Destinations",
  /** Registered legal entity used in all schema markup */
  legalName: "Crest Study Consult LTD",
  /** Recognized alternate names for entity disambiguation */
  alternateNames: [
    "Crest Study Consult",
    "Crest Study Consult LTD",
    "Crest Study Consult Blog",
  ],
  domain: "blog.creststudyconsult.com",
  url: "https://blog.creststudyconsult.com",
  productUrl: "https://creststudyconsult.com",
  location: "Lagos, Nigeria", // TODO: confirm head-office location
  linkedin: "https://www.linkedin.com/company/crest-study-consult", // TODO: confirm
  twitter: "https://x.com/creststudyconsult", // TODO: confirm
  twitterHandle: "@creststudyconsult", // TODO: confirm
  tagline: "Study abroad dreams made reality.",
  description:
    "Crest Study Consult is an international education consultancy guiding students from first contact to full settlement abroad — with trusted guidance, expert counselling, and personalized support across admissions, visas, and scholarships.",
  footerNote: "Empowering dreams, connecting destinations.",
  logo: "https://blog.creststudyconsult.com/logo.png",
  favicon: "https://blog.creststudyconsult.com/favicon.svg",
  ogImage: "https://blog.creststudyconsult.com/og-image.png",
} as const;

/**
 * Mission, Vision & Objective
 * Reusable across the About page, footer, and Organization schema description.
 */
export const MISSION =
  "To empower individuals with access to global education and travel opportunities by providing trusted guidance, expert counselling, and personalized support that ensure a seamless and fulfilling journey from dream to destination.";

export const VISION =
  "To become Africa's most trusted and student-centred education consultancy, transforming lives by bridging the gap between dreams and global opportunities.";

export const OBJECTIVE =
  "To ensure a seamless process by delivering trusted, transparent, and professional education consultancy services that connect students to their desired study destinations.";

/**
 * Core Values
 */
export const VALUES = [
  { name: "Empathy", statement: "Every client's dream matters." },
  { name: "Integrity", statement: "We act with honesty and transparency." },
  { name: "Excellence", statement: "We deliver professional and quality service." },
  { name: "Collaboration", statement: "Together, we achieve more." },
  {
    name: "Customer Experience",
    statement: "Every client should feel valued at each point.",
  },
] as const;

/**
 * Brand Personality
 * Guides voice on brand/marketing surfaces (hero, CTAs, about, newsletter).
 * Article bodies remain factual and verifiable for SEO/AEO credibility.
 */
export const BRAND_PERSONALITY = [
  { trait: "Friendly", note: "Warm, encouraging, and always ready to help." },
  { trait: "Approachable", note: "We make every client feel understood and valued." },
  { trait: "Firm", note: "Professional and reliable in our guidance." },
  {
    trait: "Inspirational",
    note: "We motivate clients to pursue their global ambitions with confidence.",
  },
] as const;

/**
 * Regions of Focus
 * Destinations Crest Study Consult actively supports through accredited
 * partner programs, scholarships, and admissions.
 */
export const REGIONS_OF_FOCUS = [
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", slug: "united-kingdom" },
  { code: "US", flag: "🇺🇸", name: "United States", slug: "united-states" },
  { code: "AU", flag: "🇦🇺", name: "Australia", slug: "australia" },
  { code: "DE", flag: "🇩🇪", name: "Germany", slug: "germany" },
  { code: "CA", flag: "🇨🇦", name: "Canada", slug: "canada" },
  { code: "IE", flag: "🇮🇪", name: "Ireland", slug: "ireland" },
] as const;

export type RegionSlug = (typeof REGIONS_OF_FOCUS)[number]["slug"];

/**
 * Blog Categories
 * Fixed set aligned with the education intelligence platform.
 */
export const CATEGORIES = [
  { slug: "study-destinations", name: "Study Destinations" },
  { slug: "admissions", name: "Admissions" },
  { slug: "visa-immigration", name: "Visa & Immigration" },
  { slug: "scholarships", name: "Scholarships" },
  { slug: "study-intelligence", name: "Study Intelligence" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

/**
 * Cache-Control Headers
 * 
 * Strategy for real-time publishing:
 * - Public pages: short s-maxage with stale-while-revalidate for background refresh
 * - Admin: no caching to ensure fresh data
 * - Sitemap/feed: longer cache since they're regenerated periodically
 */
export const CACHE_HEADERS = {
  // Public pages: 60s edge cache, revalidate in background for 1 hour
  // This ensures new articles appear within 60 seconds of publishing
  page: "public, s-maxage=60, stale-while-revalidate=3600",
  // Homepage: shorter cache for real-time featured content
  homepage: "public, s-maxage=30, stale-while-revalidate=300",
  sitemap: "public, max-age=3600, s-maxage=14400",
  static: "public, max-age=31536000, immutable",
  api: "private, no-cache, no-store, must-revalidate",
  // Admin pages: never cache, always fresh
  admin: "private, no-cache, no-store, must-revalidate",
} as const;

/**
 * SEO Defaults
 *
 * Title convention: "<Primary keyword phrase> — Crest Study Consult"
 * Homepage uses the brand positioning string.
 */
export const SEO_DEFAULTS = {
  titleSuffix: " | Crest Study Consult",
  homepageTitle: "Crest Study Consult | Study Abroad Intelligence",
  homepageDescription:
    "Crest Study Consult is an international education consultancy guiding students to the UK, US, Canada, Australia, Germany, and Ireland — with trusted guidance on admissions, visas, and scholarships.",
  defaultDescription:
    "International education intelligence from Crest Study Consult — verified guidance on study destinations, admissions, visas, and scholarships abroad.",
  notFoundTitle: "Page not found — Crest Study Consult",
  ogImageDefault: "https://blog.creststudyconsult.com/og-image.png",
  ogImageAlt: "Crest Study Consult — Empowering Dreams, Connecting Destinations",
  twitterCard: "summary_large_image" as const,
} as const;

/**
 * Reading Time Calculation
 * Average reading speed: 200 words per minute
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Slug Validation
 */
export function isValidSlug(slug: string): boolean {
  // Lowercase, hyphens only, max 6 words, no dates
  const slugRegex = /^[a-z]+(-[a-z]+){0,5}$/;
  const hasDate = /\d{4}/.test(slug);
  return slugRegex.test(slug) && !hasDate;
}

/**
 * Admin Roles
 *
 * SYSTEMS_ADMIN is the highest in-app role. It can manage every other admin
 * account and the entire blog. The canonical systems administrator is
 * `admin@creststudyconsult.com` (seeded as SYSTEMS_ADMIN).
 */
export const SYSTEMS_ADMIN_EMAIL = "admin@creststudyconsult.com";

export type AdminRole =
  | "SYSTEMS_ADMIN"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "EDITOR"
  | "WRITER"
  | "SEO_LEAD"
  | "RESEARCHER"
  | "CONSULTANT"
  | "OPERATIONS";

export interface AdminRoleMeta {
  value: AdminRole;
  label: string;
  description: string;
  /** Whether SYSTEMS_ADMIN may assign this role when creating/editing users */
  assignable: boolean;
}

export const ADMIN_ROLES: readonly AdminRoleMeta[] = [
  {
    value: "SYSTEMS_ADMIN",
    label: "Systems Admin",
    description: "Full control: manage all admins and the entire blog.",
    assignable: true,
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Manage content, authors, and day-to-day operations.",
    assignable: true,
  },
  {
    value: "EDITOR",
    label: "Editorial",
    description: "Manage the article workflow and publishing.",
    assignable: true,
  },
  {
    value: "WRITER",
    label: "Writer",
    description: "Create and draft article content.",
    assignable: true,
  },
  {
    value: "SEO_LEAD",
    label: "SEO Lead",
    description: "Review titles, meta, slugs, and keywords.",
    assignable: true,
  },
  {
    value: "RESEARCHER",
    label: "Researcher",
    description: "Produce research reports and study intelligence.",
    assignable: true,
  },
  {
    value: "CONSULTANT",
    label: "Consultant",
    description: "Education consultancy team member.",
    assignable: true,
  },
  {
    value: "OPERATIONS",
    label: "Operations",
    description: "Operations and support team member.",
    assignable: true,
  },
  {
    value: "SUPER_ADMIN",
    label: "Super Admin (API)",
    description: "Reserved for external API access only.",
    assignable: false,
  },
] as const;

/** Roles a SYSTEMS_ADMIN is allowed to assign through the dashboard. */
export const ASSIGNABLE_ROLES = ADMIN_ROLES.filter((r) => r.assignable);

/** Human-readable label for a role value. */
export function roleLabel(role: string): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** Whether a role grants admin-user management (systems administration). */
export function canManageAdmins(role: string): boolean {
  return role === "SYSTEMS_ADMIN";
}
