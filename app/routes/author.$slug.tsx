import type { Route } from "./+types/author.$slug";
import { data, Link } from "react-router";
import { Header, Footer } from "~/components/layout";
import { ArticleCard } from "~/components/blog";
// OrganizationSchema handled by root.tsx
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { db } from "~/utils/db.server";
import type { ArticleListItem } from "~/types";

/**
 * Author Page Meta
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.author) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { author } = data;
  const url = `${BRAND.url}/author/${author.slug}`;
  const title = `${author.name}${SEO_DEFAULTS.titleSuffix}`;
  const description = author.bio || `Articles by ${author.name} on ${BRAND.name}`;

  return [
    { title },
    { name: "description", content: description },

    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: author.image || BRAND.ogImage },
    { property: "og:url", content: url },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: "en" },

    // Twitter
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: author.image || BRAND.ogImage },

    // Canonical
    { tagName: "link", rel: "canonical", href: url },

    // Additional
    { name: "robots", content: "index, follow" },
  ];
}

/**
 * Author Page Loader
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Author not found", { status: 404 });
  }

  const author = await db.author.findUnique({
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

  if (!author) {
    throw new Response("Author not found", { status: 404 });
  }

  return data(
    { author },
    { headers: { "Cache-Control": CACHE_HEADERS.page } }
  );
}

/**
 * Author Page Component
 */
export default function AuthorPage({ loaderData }: Route.ComponentProps) {
  const { author } = loaderData;
  const articleCount = author.posts.length;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Author Header */}
          <section className="pt-12 pb-16 bg-gradient-to-b from-gray-50 to-white">
            <div className="container-blog">
              <div className="max-w-3xl mx-auto text-center">
                {/* Avatar */}
                <div className="mb-6">
                  {author.image ? (
                    <img
                      src={author.image}
                      alt={author.name}
                      className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto bg-teal-100 flex items-center justify-center border-4 border-white shadow-lg">
                      <span className="text-3xl font-bold text-teal-700">
                        {author.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name */}
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  {author.name}
                </h1>

                {/* Bio */}
                {author.bio && (
                  <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                    {author.bio}
                  </p>
                )}

                {/* Stats */}
                <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500">
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    {articleCount} {articleCount === 1 ? "article" : "articles"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Articles */}
          <section className="py-12">
            <div className="container-blog">
              <h2 className="text-xl font-bold text-gray-900 mb-8">
                Articles by {author.name}
              </h2>

              {articleCount > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {author.posts.map((article: ArticleListItem) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-2xl">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-4 text-gray-500">No published articles yet</p>
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
