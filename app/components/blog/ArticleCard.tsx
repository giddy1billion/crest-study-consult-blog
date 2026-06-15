import { Link } from "react-router";
import { cn } from "~/utils/cn";
import { Card, CardContent } from "~/components/ui";
import { CategoryPill } from "./CategoryPill";
import type { ArticleListItem } from "~/types";

export interface ArticleCardProps {
  article: ArticleListItem;
  variant?: "default" | "featured" | "compact";
  className?: string;
}

/**
 * Article card for grid displays
 * Three variants for different contexts:
 * - default: standard grid item
 * - featured: larger hero-style card
 * - compact: minimal version for sidebars
 */
export function ArticleCard({
  article,
  variant = "default",
  className,
}: ArticleCardProps) {
  const articleUrl = `/${article.category.slug}/${article.slug}`;

  if (variant === "compact") {
    return (
      <Link to={articleUrl} className={cn("group block", className)}>
        <div className="flex gap-4">
          {article.heroImage && (
            <img
              src={article.heroImage}
              srcSet={`
                ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=80&fit=crop 1x,
                ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=160&fit=crop 2x
              `}
              width={80}
              height={80}
              alt={article.heroImageAlt || article.title}
              loading="lazy"
              decoding="async"
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            />
          )}
          <div>
            <h3 className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-2">
              {article.title}
            </h3>
            {article.readingTimeMin && (
              <p className="text-sm text-gray-500 mt-1">
                {article.readingTimeMin} min read
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link to={articleUrl} className={cn("group block", className)}>
        <Card variant="elevated" className="overflow-hidden h-full transition-shadow group-hover:shadow-lg">
          {article.heroImage && (
            <img
              src={article.heroImage}
              srcSet={`
                ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=400&fit=crop 400w,
                ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=600&fit=crop 600w,
                ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=800&fit=crop 800w
              `}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px"
              width={600}
              height={256}
              alt={article.heroImageAlt || article.title}
              loading="lazy"
              decoding="async"
              className="w-full h-64 object-cover"
            />
          )}
          <CardContent className="pt-4">
            <CategoryPill category={article.category} size="sm" />
            <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-teal-600 transition-colors mt-3">
              {article.title}
            </h2>
            <p className="text-gray-600 mt-2 line-clamp-3">{article.excerpt}</p>
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
              {article.readingTimeMin && (
                <span>{article.readingTimeMin} min read</span>
              )}
              <span>
                {new Date(article.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Default variant
  return (
    <Link to={articleUrl} className={cn("group block", className)}>
      <Card variant="bordered" className="overflow-hidden h-full transition-shadow group-hover:shadow-md">
        {article.heroImage && (
          <img
            src={article.heroImage}
            srcSet={`
              ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=320&fit=crop 320w,
              ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=480&fit=crop 480w,
              ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=640&fit=crop 640w
            `}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            width={480}
            height={192}
            alt={article.heroImageAlt || article.title}
            loading="lazy"
            decoding="async"
            className="w-full h-48 object-cover"
          />
        )}
        <CardContent className="pt-4">
          <CategoryPill category={article.category} size="sm" />
          <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-2 mt-2">
            {article.title}
          </h3>
          <p className="text-gray-600 text-sm mt-2 line-clamp-2">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            {article.readingTimeMin && (
              <span>{article.readingTimeMin} min read</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
