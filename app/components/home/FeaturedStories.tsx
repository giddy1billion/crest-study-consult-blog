import { Link } from "react-router";
import { cn } from "~/utils/cn";
import type { ArticleListItem } from "~/types";

interface FeaturedStoriesProps {
  primary?: ArticleListItem;
  supporting?: ArticleListItem[];
  className?: string;
}

/**
 * Featured Story Cluster
 * PRD Section 6.3: 1 primary card (large) + 2 supporting cards (medium)
 * Desktop: 3-column, Mobile: stacked
 */
export function FeaturedStories({ primary, supporting = [], className }: FeaturedStoriesProps) {
  // Placeholder data for initial build
  const primaryArticle = primary || {
    slug: "canada-study-permit-requirements",
    title: "Canada study permit: requirements and application steps",
    excerpt: "What international students need for a Canadian study permit — from a letter of acceptance and proof of funds to biometrics and processing times.",
    heroImage: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&h=600&fit=crop",
    heroImageAlt: "Student preparing study permit documents for Canada",
    readingTimeMin: 10,
    publishedAt: "2026-06-09T09:00:00.000Z",
    category: { slug: "visa-immigration", name: "Visa & Immigration" },
  };

  const supportingArticles = supporting.length > 0 ? supporting : [
    {
      slug: "scholarships-for-nigerians-abroad",
      title: "Scholarships for Nigerian students studying abroad",
      excerpt: "A practical overview of fully funded and partial scholarships available to Nigerian students across the UK, US, and Canada.",
      heroImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&h=400&fit=crop",
      heroImageAlt: "Graduates celebrating at a university commencement",
      readingTimeMin: 9,
      publishedAt: "2026-06-08T09:00:00.000Z",
      category: { slug: "scholarships", name: "Scholarships" },
    },
    {
      slug: "uk-vs-canada-for-study",
      title: "UK vs Canada: which destination fits your study goals?",
      excerpt: "A side-by-side look at tuition, visa difficulty, work rights, and post-study pathways for the UK and Canada.",
      heroImage: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop",
      heroImageAlt: "University library reading room",
      readingTimeMin: 11,
      publishedAt: "2026-06-07T09:00:00.000Z",
      category: { slug: "study-intelligence", name: "Study Intelligence" },
    },
  ];

  return (
    <section className={cn("py-12 lg:py-16", className)}>
      <div className="container-blog">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary Card - Large */}
          <div className="lg:col-span-2">
            <Link 
              to={`/${primaryArticle.category.slug}/${primaryArticle.slug}`}
              prefetch="intent"
              className="group block relative h-full min-h-[400px] rounded-2xl overflow-hidden bg-gray-100"
            >
              <img
                src={primaryArticle.heroImage || ""}
                srcSet={primaryArticle.heroImage ? `
                  ${primaryArticle.heroImage}${primaryArticle.heroImage.includes('?') ? '&' : '?'}w=640&fit=crop 640w,
                  ${primaryArticle.heroImage}${primaryArticle.heroImage.includes('?') ? '&' : '?'}w=800&fit=crop 800w,
                  ${primaryArticle.heroImage}${primaryArticle.heroImage.includes('?') ? '&' : '?'}w=1024&fit=crop 1024w,
                  ${primaryArticle.heroImage}${primaryArticle.heroImage.includes('?') ? '&' : '?'}w=1200&fit=crop 1200w
                ` : undefined}
                sizes="(max-width: 1024px) 100vw, 66vw"
                width={800}
                height={400}
                alt={primaryArticle.heroImageAlt || primaryArticle.title}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
              
              <div className="absolute inset-0 flex items-end p-6 lg:p-8">
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white bg-teal-600/90 rounded-full ring-1 ring-white/25 shadow-lg shadow-black/20 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(224,160,42,0.8)]" />
                    {primaryArticle.category.name}
                  </span>
                  
                  <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-white leading-tight group-hover:text-teal-300 transition-colors">
                    {primaryArticle.title}
                  </h2>
                  
                  <p className="mt-3 text-gray-300 line-clamp-2 max-w-xl">
                    {primaryArticle.excerpt}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
                    <span>{primaryArticle.readingTimeMin} min read</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Supporting Cards - Stacked */}
          <div className="flex flex-col gap-6">
            {supportingArticles.slice(0, 2).map((article) => (
              <Link 
                key={article.slug}
                to={`/${article.category.slug}/${article.slug}`}
                prefetch="intent"
                className="group relative flex-1 min-h-[180px] rounded-xl overflow-hidden bg-gray-100"
              >
                <img
                  src={article.heroImage || ""}
                  srcSet={article.heroImage ? `
                    ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=400&fit=crop 400w,
                    ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=600&fit=crop 600w,
                    ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=800&fit=crop 800w
                  ` : undefined}
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  width={400}
                  height={180}
                  alt={article.heroImageAlt || article.title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
                
                <div className="absolute inset-0 flex items-end p-5">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-teal-400 bg-teal-400/10 rounded-full">
                      {article.category.name}
                    </span>
                    
                    <h3 className="mt-2 text-lg font-semibold text-white leading-snug group-hover:text-teal-300 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    
                    <span className="mt-2 text-xs text-gray-400">
                      {article.readingTimeMin} min read
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
