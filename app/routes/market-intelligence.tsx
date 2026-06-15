import type { Route } from "./+types/market-intelligence";
import { data, Link } from "react-router";
import { Header, Footer } from "~/components/layout";
// OrganizationSchema handled by root.tsx
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { getCategoryArticles } from "~/utils/queries.server";

/**
 * Research Library Meta Function
 */
export function meta({}: Route.MetaArgs) {
  const title = `Research Library${SEO_DEFAULTS.titleSuffix}`;
  const description =
    "Data-driven study-abroad intelligence from Crest Study Consult. Destination reports, visa and tuition comparisons, and verified guidance for international students.";
  const url = `${BRAND.url}/market-intelligence`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: BRAND.ogImage },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { tagName: "link", rel: "canonical", href: url },
  ];
}

/**
 * Research Library Loader
 * Fetches all published reports in the study-intelligence category
 */
export async function loader({}: Route.LoaderArgs) {
  const { articles } = await getCategoryArticles("study-intelligence", 1, 20);

  return data(
    { reports: articles },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.page,
      },
    }
  );
}

/**
 * Research Library Page
 */
export default function MarketIntelligenceIndex({ loaderData }: Route.ComponentProps) {
  const { reports } = loaderData;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Page Header */}
          <section className="py-12 lg:py-16 bg-gray-50 border-b border-gray-100">
            <div className="container-blog">
              <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Link to="/" className="hover:text-teal-600 transition-colors">
                  Home
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Research Library</span>
              </nav>

              <div className="max-w-3xl">
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  Research Library
                </h1>
                <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                  Data-driven study-abroad research from Crest Study Consult. Destination reports,
                  visa and tuition comparisons, and verified guidance for international students.
                </p>
              </div>
            </div>
          </section>

          {/* Reports Grid */}
          <section className="py-12 lg:py-16">
            <div className="container-blog">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900">No reports yet</h3>
                  <p className="mt-2 text-gray-500">Check back soon for new research and market intelligence.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reports.map((report) => (
                    <article
                      key={report.slug}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full">
                            {report.category.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(report.publishedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-gray-900 leading-tight">
                        <Link
                          to={`/market-intelligence/${report.slug}`}
                          className="hover:text-teal-600 transition-colors"
                        >
                          {report.title}
                        </Link>
                      </h2>

                      <p className="mt-3 text-gray-600 line-clamp-3">{report.excerpt}</p>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {report.readingTimeMin || 5} min read
                        </span>
                        <Link
                          to={`/market-intelligence/${report.slug}`}
                          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1"
                        >
                          Read report
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
                </div>
              )}
            </div>
          </section>

          {/* Newsletter CTA */}
          <section className="py-12 bg-navy-700">
            <div className="container-blog">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-2xl font-bold text-white">Get research updates</h2>
                <p className="mt-3 text-teal-100">
                  Crest Study Consult intelligence delivered to your inbox. No spam. No promotion.
                </p>
                <form className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-3 text-gray-900 bg-white rounded-lg border-0"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 text-sm font-semibold text-navy-700 bg-white hover:bg-teal-50 rounded-lg transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}

/**
 * Error Boundary for Research Library
 */
export function ErrorBoundary() {
  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mt-4 text-gray-600 max-w-md mx-auto">
              We're having trouble loading the research library. Please try again.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
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
