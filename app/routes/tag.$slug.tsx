import type { Route } from "./+types/tag.$slug";
import { data, Link } from "react-router";
import { Header, Footer } from "~/components/layout";
import { ArticleCard } from "~/components/blog";
// OrganizationSchema handled by root.tsx
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { db } from "~/utils/db.server";
import type { ArticleListItem } from "~/types";

/**
 * Tag Page Meta
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.tag) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { tag, articleCount } = data;
  const url = `${BRAND.url}/tag/${tag.slug}`;
  const title = `${tag.name}${SEO_DEFAULTS.titleSuffix}`;
  const description = `${articleCount} article${articleCount !== 1 ? "s" : ""} tagged with "${tag.name}" on ${BRAND.name}. Research and guidance about ${tag.name.toLowerCase()} for international students.`;

  return [
    { title },
    { name: "description", content: description },

    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: BRAND.ogImage },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: "en" },

    // Twitter
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: BRAND.ogImage },

    // Canonical
    { tagName: "link", rel: "canonical", href: url },

    // Additional
    { name: "robots", content: "index, follow" },
  ];
}

/**
 * Tag Page Loader
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Tag not found", { status: 404 });
  }

  const tag = await db.tag.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { isPublished: true },
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
            select: { slug: true, name: true },
          },
        },
      },
    },
  });

  if (!tag) {
    throw new Response("Tag not found", { status: 404 });
  }

  // Get related tags (tags that appear on the same articles)
  const relatedTagIds = await db.tag.findMany({
    where: {
      posts: {
        some: {
          tags: { some: { id: tag.id } },
          isPublished: true,
        },
      },
      id: { not: tag.id },
    },
    take: 10,
    select: { id: true, slug: true, name: true },
  });

  return data(
    { tag, articleCount: tag.posts.length, relatedTags: relatedTagIds },
    { headers: { "Cache-Control": CACHE_HEADERS.page } }
  );
}

/**
 * Tag Page Component
 */
export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { tag, articleCount, relatedTags } = loaderData;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Tag Header */}
          <section className="pt-12 pb-10 bg-gradient-to-b from-teal-50 to-white">
            <div className="container-blog">
              <div className="max-w-3xl">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                  <Link to="/" className="hover:text-teal-600 transition-colors">
                    Home
                  </Link>
                  <span>/</span>
                  <span className="text-gray-700">Tags</span>
                  <span>/</span>
                  <span className="text-gray-700">{tag.name}</span>
                </nav>

                {/* Tag badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Tag
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  {tag.name}
                </h1>

                <p className="mt-4 text-lg text-gray-600">
                  {articleCount} {articleCount === 1 ? "article" : "articles"} tagged with "{tag.name}"
                </p>

                {/* Related Tags */}
                {relatedTags.length > 0 && (
                  <div className="mt-6">
                    <span className="text-sm text-gray-500 mr-3">Related tags:</span>
                    <div className="inline-flex flex-wrap gap-2">
                      {relatedTags.map((relTag: typeof relatedTags[number]) => (
                        <Link
                          key={relTag.id}
                          to={`/tag/${relTag.slug}`}
                          className="px-3 py-1 bg-gray-100 hover:bg-teal-100 text-gray-700 hover:text-teal-700 text-sm rounded-full transition-colors"
                        >
                          {relTag.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Articles */}
          <section className="py-12">
            <div className="container-blog">
              {articleCount > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tag.posts.map((article: ArticleListItem) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-2xl">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <p className="mt-4 text-gray-500">No articles with this tag yet</p>
                  <Link
                    to="/"
                    className="mt-4 inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to homepage
                  </Link>
                </div>
              )}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
