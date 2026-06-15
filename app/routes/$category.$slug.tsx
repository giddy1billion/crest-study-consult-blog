import type { Route } from "./+types/$category.$slug";
import { data, Link, useLocation } from "react-router";
import { Header, Footer } from "~/components/layout";
import { 
  ArticleCard, 
  FAQBlock, 
  QuickAnswerBlock, 
  CategoryPill,
  TableOfContents,
  ReadingProgress,
  ImageLightbox,
  ShareButton
} from "~/components/blog";
import { CommentsSection } from "~/components/comments";
import { NewsletterForm } from "~/components/forms";
import { ArticleSchema, FAQSchema, BreadcrumbSchema } from "~/components/seo";
import { BRAND, CATEGORIES, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { getArticleBySlug, getRelatedArticles as getRelatedArticlesFromDb } from "~/utils/queries.server";
import { parseMarkdown } from "~/utils/markdown.server";
import { useArticleStats } from "~/hooks";
import type { PostWithRelations, ArticleListItem, FAQItem } from "~/types";
import { cn } from "~/utils/cn";

/**
 * Validate category exists
 */
function isValidCategory(slug: string): boolean {
  return CATEGORIES.some((c) => c.slug === slug);
}

/**
 * Article Meta Function
 * Full SEO optimization following PRD Section 7.5
 */
export function meta({ data, params }: Route.MetaArgs) {
  if (!data?.article) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { article } = data;
  const url = article.canonicalURL || `${BRAND.url}/${article.category.slug}/${article.slug}`;
  const title = article.metaTitle || `${article.title}${SEO_DEFAULTS.titleSuffix}`;
  const description = article.metaDescription || article.excerpt;

  // Use the article hero as the OG image, served via the compression endpoint
  // (cropped to 1200×630, ≤150 KB JPEG) for reliable social previews.
  // Version by updatedAt so social caches refresh when the hero changes.
  const heroVersion = article.updatedAt
    ? new Date(article.updatedAt).getTime()
    : "";
  const image = article.heroImage
    ? `${BRAND.url}/og/${article.category.slug}/${article.slug}?v=${heroVersion}`
    : BRAND.ogImage;
  const imageType = article.heroImage ? "image/jpeg" : "image/png";

  return [
    { title },
    { name: "description", content: description },

    // Open Graph - Article
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imageType },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: article.heroImageAlt || article.title },
    { property: "og:url", content: url },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: "en" },
    
    // Article metadata
    { property: "article:published_time", content: article.publishedAt },
    { property: "article:modified_time", content: article.updatedAt },
    { property: "article:author", content: BRAND.name },
    { property: "article:section", content: article.category.name },

    // Twitter Card
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:label1", content: "Reading time" },
    { name: "twitter:data1", content: `${article.readingTimeMin} min read` },

    // Canonical
    { tagName: "link", rel: "canonical", href: url },

    // Additional SEO
    { name: "robots", content: "index, follow, max-image-preview:large" },
    { name: "author", content: article.author.name },
    { name: "publisher", content: BRAND.legalName },
  ];
}

/**
 * Article Loader
 * Fetches article and related content directly from database via Prisma
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { category: categorySlug, slug } = params;

  // Validate category
  if (!categorySlug || !isValidCategory(categorySlug)) {
    throw new Response("Category not found", { status: 404 });
  }

  if (!slug) {
    throw new Response("Article not found", { status: 404 });
  }

  // Fetch article from database
  const article = await getArticleBySlug(categorySlug, slug);

  if (!article) {
    throw new Response("Article not found", { status: 404 });
  }

  // Parse Markdown content to HTML
  const processedArticle = {
    ...article,
    content: parseMarkdown(article.content),
  };

  // Fetch related articles from database (same category, different slug)
  const relatedArticles = await getRelatedArticlesFromDb(slug, categorySlug, 3);

  return data(
    {
      article: processedArticle,
      relatedArticles,
    },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.page,
      },
    }
  );
}

/**
 * Article Page Component
 */
export default function ArticlePage({ loaderData }: Route.ComponentProps) {
  const { article, relatedArticles } = loaderData;
  const location = useLocation();
  const articleUrl = `${BRAND.url}${location.pathname}`;

  // Track article view on mount
  useArticleStats({ slug: article.slug });

  // Parse FAQ block if exists (safely cast from Prisma Json type)
  const faqs: FAQItem[] = article.faqBlock 
    ? (article.faqBlock as unknown as FAQItem[]) 
    : [];

  // Breadcrumb data for schema
  const breadcrumbs = [
    { name: "Home", url: BRAND.url },
    { name: article.category.name, url: `${BRAND.url}/${article.category.slug}` },
    { name: article.title, url: articleUrl },
  ];

  // Canonical share image: the hero served through the OG endpoint
  // (1200×630, ≤150 KB JPEG), versioned so caches refresh on hero change.
  // Falls back to the static brand image when no hero is set.
  const ogImage = article.heroImage
    ? `${BRAND.url}/og/${article.category.slug}/${article.slug}?v=${new Date(article.updatedAt).getTime()}`
    : BRAND.ogImage;

  return (
    <>
      {/* Structured Data */}
      {/* OrganizationSchema handled by root.tsx */}
      <BreadcrumbSchema items={breadcrumbs} />
      <ArticleSchema
        title={article.title}
        description={article.metaDescription || article.excerpt}
        image={ogImage}
        publishedAt={new Date(article.publishedAt).toISOString()}
        updatedAt={new Date(article.updatedAt).toISOString()}
        url={articleUrl}
      />
      {faqs.length > 0 && <FAQSchema faqs={faqs} />}

      {/* Skip to main content - accessibility */}
      <a
        href="#article-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-navy-700 focus:text-white focus:rounded-lg"
      >
        Skip to article
      </a>

      {/* Reading Progress Bar */}
      <ReadingProgress targetSelector="#article-content" />

      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Article Header */}
          <article>
            <header className="pt-8 pb-12 lg:pt-12 lg:pb-16">
              <div className="container-blog">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                  <Link to="/" className="hover:text-teal-600 transition-colors">
                    Home
                  </Link>
                  <span>/</span>
                  <Link
                    to={`/${article.category.slug}`}
                    className="hover:text-teal-600 transition-colors"
                  >
                    {article.category.name}
                  </Link>
                  <span>/</span>
                  <span className="text-gray-700 truncate max-w-[200px]">{article.title}</span>
                </nav>

                <div className="max-w-3xl">
                  {/* Category */}
                  <CategoryPill category={article.category} size="md" />

                  {/* Title */}
                  <h1 className="mt-4 text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight text-balance">
                    {article.title}
                  </h1>

                  {/* Excerpt */}
                  <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                    {article.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {article.readingTimeMin} min read
                    </span>
                    <span className="hidden sm:inline text-gray-300">·</span>
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {article.updatedAt !== article.publishedAt && (
                      <>
                        <span className="hidden sm:inline text-gray-300">·</span>
                        <span className="text-gray-400">
                          Updated{" "}
                          {new Date(article.updatedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Hero Image */}
            {article.heroImage && (
              <div className="relative mt-8">
                <div className="container-blog">
                  <figure>
                    <img
                      src={article.heroImage}
                      alt={article.heroImageAlt || article.title}
                      loading="eager"
                      decoding="async"
                      className="w-full h-auto aspect-[16/9] object-cover rounded-2xl"
                    />
                    {article.heroImageAlt && (
                      <figcaption className="mt-3 text-sm text-gray-400 text-center">
                        {article.heroImageAlt}
                      </figcaption>
                    )}
                  </figure>
                </div>
              </div>
            )}

            {/* Quick Answer Block */}
            {article.targetKeyword && (
              <div className="container-blog mt-10">
                <QuickAnswerBlock
                  question={`${article.targetKeyword}?`}
                  answer={article.excerpt}
                />
              </div>
            )}

            {/* Article Content */}
            <div className="container-blog mt-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Main Content */}
                <div id="article-content" className="lg:col-span-8">
                  <div
                    className="prose prose-lg prose-teal max-w-none
                      prose-headings:scroll-mt-24
                      prose-headings:font-bold
                      prose-headings:text-navy-700
                      prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                      prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                      prose-p:text-gray-800 prose-p:leading-relaxed prose-p:mb-6
                      prose-a:text-teal-600 prose-a:no-underline hover:prose-a:text-navy-700 hover:prose-a:underline
                      prose-strong:text-navy-700
                      prose-ul:my-6 prose-li:my-1
                      prose-ol:my-6
                      prose-blockquote:border-l-teal-500 prose-blockquote:bg-gray-50 prose-blockquote:text-navy-700 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                      prose-pre:bg-navy-700 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:overflow-x-auto
                      prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-teal-700 prose-code:before:content-none prose-code:after:content-none
                      prose-img:rounded-xl prose-img:my-8
                      prose-table:border-collapse prose-th:bg-gray-50 prose-th:p-3 prose-td:p-3 prose-td:border prose-td:border-gray-200
                      prose-hr:border-gray-200 prose-hr:my-12
                      prose-figure:my-8"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                  />

                  {/* FAQ Section */}
                  {faqs.length > 0 && (
                    <section className="mt-16 pt-10 border-t border-gray-200">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Frequently asked questions
                      </h2>
                      <FAQBlock faqs={faqs} showHeading={false} />
                    </section>
                  )}

                  {/* CTA Block */}
                  {article.ctaBlock && (
                    <div className="mt-12 p-8 bg-teal-50 rounded-2xl border border-teal-100">
                      <h3 className="text-xl font-bold text-gray-900">
                        {(article.ctaBlock as { headline: string }).headline}
                      </h3>
                      <a
                        href={(article.ctaBlock as { ctaLink: string }).ctaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        {(article.ctaBlock as { ctaText: string }).ctaText}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}

                  {/* Source Notes */}
                  {article.sourceNotes && (
                    <aside className="mt-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Sources & methodology
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {article.sourceNotes}
                      </p>
                    </aside>
                  )}

                  {/* Author & Share */}
                  <footer className="mt-12 pt-8 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center overflow-hidden">
                          <img
                            src={BRAND.logo}
                            alt={article.author.name}
                            className="w-7 h-7 object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{article.author.name}</p>
                          {article.author.bio && (
                            <p className="text-sm text-gray-500">{article.author.bio}</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Share buttons */}
                      <ShareButton url={articleUrl} title={article.title} slug={article.slug} />
                    </div>
                  </footer>

                  {/* Comments Section */}
                  <CommentsSection 
                    postId={article.id}
                    postSlug={article.slug}
                    commentsEnabled={article.commentsEnabled}
                  />
                </div>

                {/* Sidebar */}
                <aside className="lg:col-span-4">
                  <div className="sticky top-24 space-y-8">
                    {/* Dynamic Table of Contents */}
                    <TableOfContents contentSelector="#article-content" />

                    {/* Related Articles */}
                    {relatedArticles.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                          Related articles
                        </h3>
                        <div className="space-y-4">
                          {relatedArticles.map((related) => (
                            <ArticleCard
                              key={related.slug}
                              article={related}
                              variant="compact"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Newsletter CTA */}
                    <div className="p-6 bg-teal-50 rounded-xl border border-teal-100">
                      <h3 className="font-semibold text-gray-900">
                        Get research updates
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Crest Study Consult intelligence delivered to your inbox.
                      </p>
                      <div className="mt-4">
                        <NewsletterForm variant="compact" source="article_sidebar" />
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </article>

          {/* More from category */}
          {relatedArticles.length > 0 && (
            <section className="py-16 mt-16 border-t border-gray-200 bg-gray-50">
              <div className="container-blog">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">
                    More from {article.category.name}
                  </h2>
                  <Link
                    to={`/${article.category.slug}`}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1"
                  >
                    View all
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedArticles.slice(0, 3).map((related) => (
                    <ArticleCard key={related.slug} article={related} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <Footer />
      </div>

      {/* Image Lightbox for article images */}
      <ImageLightbox contentSelector="#article-content" />
    </>
  );
}

/**
 * Error Boundary for Article Page
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-gray-900">Article not found</h1>
            <p className="mt-4 text-gray-600 max-w-md mx-auto">
              The article you're looking for doesn't exist or may have been moved.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to homepage
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}


