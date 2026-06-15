/**
 * Crest Study Consult Database Queries
 * 
 * Centralized Prisma queries for routes and components.
 * All queries follow PRD specifications for data fetching.
 */

import { db, calculateReadingTime } from "./db.server";
import type { Post, Category, Author, Tag, PostStatus, SchemaType, Prisma } from "@prisma/client";

// ============================================
// Type Definitions
// ============================================

export type PostWithRelations = Post & {
  category: Category;
  author: Author;
  tags: Tag[];
};

export type ArticleListItem = {
  slug: string;
  title: string;
  excerpt: string;
  heroImage: string | null;
  heroImageAlt: string | null;
  readingTimeMin: number | null;
  publishedAt: Date;
  category: {
    slug: string;
    name: string;
  };
};

// ============================================
// Homepage Queries
// ============================================

/**
 * Get featured article for homepage hero
 * Returns the most recent featured + published article
 */
export async function getFeaturedArticle(): Promise<ArticleListItem | null> {
  const post = await db.post.findFirst({
    where: {
      isPublished: true,
      isFeatured: true,
    },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  return post;
}

/**
 * Get multiple featured articles for homepage hero slider
 * Returns up to `count` featured articles for animated carousel
 */
export async function getHeroSliderArticles(count: number = 5): Promise<ArticleListItem[]> {
  const posts = await db.post.findMany({
    where: {
      isPublished: true,
      isFeatured: true,
    },
    orderBy: { publishedAt: "desc" },
    take: count,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  return posts;
}

/**
 * Get featured stories cluster (1 primary + 2 supporting)
 * For homepage PRD Section 6.3.4
 */
export async function getFeaturedStories(): Promise<{
  primary: ArticleListItem | null;
  supporting: ArticleListItem[];
}> {
  const posts = await db.post.findMany({
    where: {
      isPublished: true,
      isFeatured: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  return {
    primary: posts[0] || null,
    supporting: posts.slice(1),
  };
}

/**
 * Get latest articles for homepage grid
 * PRD Section 6.3.6 - 6 cards, sorted by publishedAt DESC
 */
export async function getLatestArticles(limit = 6): Promise<ArticleListItem[]> {
  return db.post.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });
}

// ============================================
// Category Page Queries
// ============================================

/**
 * Get category by slug with article count
 */
export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { posts: { where: { isPublished: true } } },
      },
    },
  });
}

/**
 * Get articles for category page
 * PRD Section 6.5 - paginated, 9 per page
 */
export async function getCategoryArticles(
  categorySlug: string,
  page = 1,
  perPage = 9,
  sortBy: "latest" | "popular" = "latest"
): Promise<{ articles: ArticleListItem[]; total: number }> {
  const skip = (page - 1) * perPage;
  
  const orderBy = sortBy === "popular" 
    ? { viewCount: "desc" as const } 
    : { publishedAt: "desc" as const };

  const [articles, total] = await Promise.all([
    db.post.findMany({
      where: {
        isPublished: true,
        category: { slug: categorySlug },
      },
      orderBy,
      skip,
      take: perPage,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        heroImage: true,
        heroImageAlt: true,
        readingTimeMin: true,
        publishedAt: true,
        category: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    }),
    db.post.count({
      where: {
        isPublished: true,
        category: { slug: categorySlug },
      },
    }),
  ]);

  return { articles, total };
}

/**
 * Get featured article for category page
 */
export async function getCategoryFeaturedArticle(categorySlug: string): Promise<ArticleListItem | null> {
  return db.post.findFirst({
    where: {
      isPublished: true,
      isFeatured: true,
      category: { slug: categorySlug },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });
}

// ============================================
// Article Page Queries
// ============================================

/**
 * Get single article by category and slug
 */
export async function getArticleBySlug(
  categorySlug: string,
  slug: string
): Promise<PostWithRelations | null> {
  return db.post.findFirst({
    where: {
      slug,
      isPublished: true,
      category: { slug: categorySlug },
    },
    include: {
      category: true,
      author: true,
      tags: true,
    },
  });
}

/**
 * Get related articles for sidebar
 * PRD Section 6.4.10 - same category first, then cross-category
 */
export async function getRelatedArticles(
  currentSlug: string,
  categorySlug: string,
  limit = 3
): Promise<ArticleListItem[]> {
  // First, try to get from same category
  const sameCategory = await db.post.findMany({
    where: {
      isPublished: true,
      slug: { not: currentSlug },
      category: { slug: categorySlug },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  // If we need more, get from other categories
  if (sameCategory.length < limit) {
    const remaining = limit - sameCategory.length;
    const crossCategory = await db.post.findMany({
      where: {
        isPublished: true,
        slug: { not: currentSlug },
        category: { slug: { not: categorySlug } },
      },
      orderBy: { publishedAt: "desc" },
      take: remaining,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        heroImage: true,
        heroImageAlt: true,
        readingTimeMin: true,
        publishedAt: true,
        category: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });
    return [...sameCategory, ...crossCategory];
  }

  return sameCategory;
}

/**
 * Increment article view count
 */
export async function incrementViewCount(slug: string): Promise<void> {
  await db.post.update({
    where: { slug },
    data: { viewCount: { increment: 1 } },
  });
}

// ============================================
// Sitemap & RSS Queries
// ============================================

/**
 * Get all published posts for sitemap
 */
export async function getAllPublishedPosts() {
  return db.post.findMany({
    where: { isPublished: true },
    select: {
      slug: true,
      updatedAt: true,
      category: { select: { slug: true } },
    },
    orderBy: { publishedAt: "desc" },
  });
}

/**
 * Get all categories for sitemap
 */
export async function getAllCategories() {
  return db.category.findMany({
    select: {
      slug: true,
      name: true,
      updatedAt: true,
    },
  });
}

/**
 * Get latest posts for RSS feed
 * Includes full content and hero image for rich feed items
 */
export async function getPostsForFeed(limit = 20) {
  return db.post.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      heroImage: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
      author: { select: { name: true } },
    },
  });
}

// ============================================
// Research / Market Intelligence Queries
// ============================================

/**
 * Get research reports (schemaType = REPORT)
 */
export async function getResearchReports(limit = 10) {
  return db.post.findMany({
    where: {
      isPublished: true,
      schemaType: "REPORT",
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      heroImageAlt: true,
      readingTimeMin: true,
      publishedAt: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get single research report by slug
 */
export async function getResearchReportBySlug(slug: string): Promise<PostWithRelations | null> {
  return db.post.findFirst({
    where: {
      slug,
      isPublished: true,
      schemaType: "REPORT",
    },
    include: {
      category: true,
      author: true,
      tags: true,
    },
  });
}

// ============================================
// Search Queries
// ============================================

export type SearchResult = {
  slug: string;
  title: string;
  excerpt: string;
  heroImage: string | null;
  readingTimeMin: number | null;
  publishedAt: Date;
  category: {
    slug: string;
    name: string;
  };
  schemaType: SchemaType;
  matchType: "title" | "content" | "excerpt";
  resultType: "article" | "report" | "faq" | "category";
};

export type CategorySearchResult = {
  slug: string;
  name: string;
  description: string | null;
  resultType: "category";
};

export type CommentSearchResult = {
  id: string;
  content: string;
  authorName: string;
  createdAt: Date;
  post: {
    slug: string;
    title: string;
    category: {
      slug: string;
      name: string;
    };
  };
  resultType: "comment";
};

export type UnifiedSearchResult = SearchResult | CategorySearchResult | CommentSearchResult;

/**
 * Search articles by query string
 * Searches title, excerpt, and content
 * Returns results ranked by relevance (title > excerpt > content)
 */
export async function searchArticles(
  query: string,
  limit = 10,
  categorySlug?: string
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();
  
  // Build where clause
  const where: Prisma.PostWhereInput = {
    isPublished: true,
    OR: [
      { title: { contains: searchTerm, mode: "insensitive" } },
      { excerpt: { contains: searchTerm, mode: "insensitive" } },
      { content: { contains: searchTerm, mode: "insensitive" } },
    ],
  };

  // Filter by category if provided
  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  const posts = await db.post.findMany({
    where,
    take: limit * 2, // Fetch more to allow for ranking
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      heroImage: true,
      readingTimeMin: true,
      publishedAt: true,
      schemaType: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  });

  // Rank results by match type
  const results: SearchResult[] = posts.map((post) => {
    const titleLower = post.title.toLowerCase();
    const excerptLower = post.excerpt.toLowerCase();
    
    let matchType: "title" | "content" | "excerpt" = "content";
    if (titleLower.includes(searchTerm)) {
      matchType = "title";
    } else if (excerptLower.includes(searchTerm)) {
      matchType = "excerpt";
    }

    // Determine result type based on schemaType
    let resultType: "article" | "report" | "faq" = "article";
    if (post.schemaType === "REPORT") {
      resultType = "report";
    } else if (post.schemaType === "FAQ_PAGE") {
      resultType = "faq";
    }

    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      heroImage: post.heroImage,
      readingTimeMin: post.readingTimeMin,
      publishedAt: post.publishedAt,
      schemaType: post.schemaType,
      category: post.category,
      matchType,
      resultType,
    };
  });

  // Sort by match type priority and then by date
  results.sort((a, b) => {
    const priority = { title: 0, excerpt: 1, content: 2 };
    if (priority[a.matchType] !== priority[b.matchType]) {
      return priority[a.matchType] - priority[b.matchType];
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return results.slice(0, limit);
}

/**
 * Search categories by name
 */
export async function searchCategories(query: string): Promise<CategorySearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const categories = await db.category.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ],
    },
    select: {
      slug: true,
      name: true,
      description: true,
    },
  });

  return categories.map((cat) => ({
    ...cat,
    resultType: "category" as const,
  }));
}

/**
 * Search comments by content
 * Only searches comments on posts with commentsEnabled: true
 * Only returns APPROVED comments
 */
export async function searchComments(
  query: string,
  limit = 5
): Promise<CommentSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim().toLowerCase();

  const comments = await db.comment.findMany({
    where: {
      content: { contains: searchTerm, mode: "insensitive" },
      status: "APPROVED",
      post: {
        isPublished: true,
        commentsEnabled: true,
      },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      authorName: true,
      createdAt: true,
      post: {
        select: {
          slug: true,
          title: true,
          category: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content.length > 150 
      ? comment.content.slice(0, 150) + "..." 
      : comment.content,
    authorName: comment.authorName,
    createdAt: comment.createdAt,
    post: comment.post,
    resultType: "comment" as const,
  }));
}

/**
 * Unified search across all content types
 */
export async function searchAll(
  query: string,
  limit = 12
): Promise<UnifiedSearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const [articles, categories, comments] = await Promise.all([
    searchArticles(query, limit),
    searchCategories(query),
    searchComments(query, 5),
  ]);

  // Combine and prioritize: categories first, then articles, then comments
  const results: UnifiedSearchResult[] = [
    ...categories,
    ...articles,
    ...comments,
  ];

  return results.slice(0, limit);
}

// ============================================
// Sitemap Query Functions
// ============================================

/**
 * Get all published research reports for sitemap
 */
export async function getAllResearchReports() {
  return db.researchReport.findMany({
    where: { isPublished: true },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: { publishedAt: "desc" },
  });
}

/**
 * Get all cities for sitemap
 */
export async function getAllCities() {
  return db.city.findMany({
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Get all authors with published posts for sitemap
 */
export async function getAllAuthorsWithPosts() {
  return db.author.findMany({
    where: {
      posts: {
        some: { isPublished: true },
      },
    },
    select: {
      slug: true,
      name: true,
    },
  });
}

/**
 * Get all tags with published posts for sitemap
 */
export async function getAllTagsWithPosts() {
  return db.tag.findMany({
    where: {
      posts: {
        some: { isPublished: true },
      },
    },
    select: {
      slug: true,
      name: true,
    },
  });
}
