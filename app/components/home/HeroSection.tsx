import { Link } from "react-router";
import { cn } from "~/utils/cn";
import type { ArticleListItem } from "~/types";

interface HeroSectionProps {
  featuredArticle?: ArticleListItem;
  className?: string;
}

/**
 * Editorial Hero Section
 * PRD Section 6.3: Full-width image, category label, headline, excerpt, read time, CTA link
 * No rotating carousel - one curated story
 */
export function HeroSection({ featuredArticle, className }: HeroSectionProps) {
  // Placeholder data for initial build
  const article = featuredArticle || {
    slug: "study-in-the-uk-guide",
    title: "How to study in the UK: a complete guide for international students",
    excerpt: "From choosing a course to securing a Student visa, this guide walks you through UK admissions, tuition, scholarships, and post-study work routes — step by step.",
    heroImage: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=630&fit=crop",
    heroImageAlt: "International students walking on a UK university campus",
    readingTimeMin: 8,
    publishedAt: "2026-06-10T09:00:00.000Z",
    category: { slug: "study-destinations", name: "Study Destinations" },
  };

  return (
    <section className={cn("relative", className)}>
      {/* Background Image */}
      <div className="relative h-[500px] sm:h-[600px] lg:h-[700px] overflow-hidden">
        <img
          src={article.heroImage || ""}
          alt={article.heroImageAlt || article.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="container-blog pb-12 lg:pb-16">
            <div className="max-w-3xl">
              {/* Category Label */}
              <Link
                to={`/${article.category.slug}`}
                prefetch="intent"
                className="inline-flex items-center px-3 py-1 text-xs font-semibold text-teal-400 bg-teal-400/10 border border-teal-400/30 rounded-full hover:bg-teal-400/20 transition-colors"
              >
                {article.category.name}
              </Link>

              {/* Headline */}
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight text-balance">
                <Link 
                  to={`/${article.category.slug}/${article.slug}`}
                  prefetch="intent"
                  className="hover:text-teal-300 transition-colors"
                >
                  {article.title}
                </Link>
              </h1>

              {/* Excerpt */}
              <p className="mt-4 text-lg text-gray-300 leading-relaxed max-w-2xl">
                {article.excerpt}
              </p>

              {/* Meta */}
              <div className="mt-6 flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  {article.readingTimeMin} min read
                </span>
                <span className="text-gray-600">·</span>
                <Link
                  to={`/${article.category.slug}/${article.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Read article
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
