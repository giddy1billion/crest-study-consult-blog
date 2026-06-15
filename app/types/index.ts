/**
 * Base types - will be replaced by Prisma types when schema is generated
 * Run `npx prisma generate` after setting up schema.prisma
 */

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  metaTitle?: string | null;
  metaDesc?: string | null;
  faqBlock?: unknown;
  updatedAt: Date;
}

export interface Author {
  id: string;
  name: string;
  bio?: string | null;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  targetKeyword?: string | null;
  excerpt: string;
  content: string;
  categoryId: string;
  subcategory?: string | null;
  authorId: string;
  editor?: string | null;
  publishedAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  isFeatured: boolean;
  readingTimeMin?: number | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  canonicalURL?: string | null;
  schemaType: SchemaType;
  faqBlock?: unknown;
  ctaBlock?: unknown;
  relatedSlugs: string[];
  sourceNotes?: string | null;
  researchNotes?: string | null;
  status: PostStatus;
  viewCount: number;
}

/**
 * Post with all relations loaded
 */
export type PostWithRelations = Post & {
  category: Category;
  author: Author;
  tags: Tag[];
};

/**
 * Minimal article data for list views
 */
export type ArticleListItem = Pick<
  Post,
  | "slug"
  | "title"
  | "excerpt"
  | "heroImage"
  | "heroImageAlt"
  | "readingTimeMin"
  | "publishedAt"
> & {
  category: Pick<Category, "slug" | "name">;
};

/**
 * FAQ item structure
 */
export interface FAQItem {
  question: string;
  answer: string;
}

/**
 * CTA block structure
 */
export interface CTABlock {
  headline: string;
  ctaText: string;
  ctaLink: string;
}

/**
 * Trend snapshot for research library
 */
export interface TrendCallout {
  stat: string;
  description: string;
  source: string;
  date: string;
}

/**
 * Newsletter subscription response
 */
export interface NewsletterResponse {
  success: boolean;
  error?: string;
}

/**
 * Schema types matching Prisma enum
 */
export type SchemaType = "ARTICLE" | "FAQ_PAGE" | "REPORT";

/**
 * Post status matching Prisma enum
 */
export type PostStatus =
  | "IDEA"
  | "DRAFT"
  | "EDITORIAL_REVIEW"
  | "SEO_REVIEW"
  | "FACT_CHECK"
  | "AEO_REVIEW"
  | "READY"
  | "LIVE"
  | "ARCHIVED";
