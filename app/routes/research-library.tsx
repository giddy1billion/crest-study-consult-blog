import type { Route } from "./+types/research-library";
import { data, Link, useSearchParams } from "react-router";
import { Header, Footer } from "~/components/layout";
// OrganizationSchema handled by root.tsx
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { db } from "~/utils/db.server";

/**
 * Research Library Meta Function
 */
export function meta({}: Route.MetaArgs) {
  const title = `Research Library${SEO_DEFAULTS.titleSuffix}`;
  const description =
    "Data-driven real estate intelligence from PropX. Market reports, trend analysis, city snapshots, and verified data on African property markets from Crest Study Consult.";
  const url = `${BRAND.url}/research`;

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
    { name: "robots", content: "index, follow" },
  ];
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  MARKET_REPORT: "Market Report",
  CITY_SNAPSHOT: "City Snapshot",
  TREND_ANALYSIS: "Trend Analysis",
  POLICY_BRIEF: "Policy Brief",
  INVESTMENT_GUIDE: "Investment Guide",
};

/**
 * Research Library Loader
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type");
  const cityFilter = url.searchParams.get("city");

  // Fetch reports with filters
  const reports = await db.researchReport.findMany({
    where: {
      isPublished: true,
      ...(typeFilter ? { reportType: typeFilter as any } : {}),
      ...(cityFilter ? { city: { slug: cityFilter } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    include: {
      city: { select: { slug: true, name: true } },
    },
  });

  // Fetch cities for filter dropdown
  const cities = await db.city.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  // Fetch market intelligence articles as well
  const articles = await db.post.findMany({
    where: {
      isPublished: true,
      category: { slug: "market-intelligence" },
    },
    orderBy: { publishedAt: "desc" },
    take: 6,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImage: true,
      readingTimeMin: true,
      publishedAt: true,
      category: { select: { slug: true, name: true } },
    },
  });

  // Get report type counts for filters
  const typeCounts = await db.researchReport.groupBy({
    by: ["reportType"],
    where: { isPublished: true },
    _count: true,
  });

  return data(
    { reports, cities, articles, typeCounts, typeFilter, cityFilter },
    { headers: { "Cache-Control": CACHE_HEADERS.page } }
  );
}

/**
 * Report Card Component
 */
function ReportCard({ report }: { report: any }) {
  return (
    <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-teal-200 transition-all group">
      {/* Cover Image */}
      {report.coverImage && (
        <div className="aspect-[16/10] overflow-hidden bg-gray-100">
          <img
            src={report.coverImage}
            alt={report.coverAlt || report.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div className="p-6">
        {/* Type & City badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2.5 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-full">
            {REPORT_TYPE_LABELS[report.reportType] || report.reportType}
          </span>
          {report.city && (
            <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {report.city.name}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug group-hover:text-teal-600 transition-colors">
          <Link to={`/research/${report.slug}`}>{report.title}</Link>
        </h3>

        {/* Description */}
        <p className="mt-2 text-gray-600 text-sm line-clamp-2">{report.description}</p>

        {/* Meta */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-3">
            {report.pageCount && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {report.pageCount} pages
              </span>
            )}
            <span>
              {new Date(report.publishedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </span>
          </div>

          {report.isGated ? (
            <span className="flex items-center gap-1 text-amber-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Email required
            </span>
          ) : (
            <span className="flex items-center gap-1 text-teal-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Free download
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Research Library Page
 */
export default function ResearchLibrary({ loaderData }: Route.ComponentProps) {
  const { reports, cities, articles, typeCounts, typeFilter, cityFilter } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="py-16 lg:py-20 bg-gradient-to-br from-teal-50 via-white to-teal-50">
            <div className="container-blog">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-100 text-teal-700 text-sm font-medium rounded-full mb-6">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Research & Data
                </span>

                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Research Library
                </h1>

                <p className="mt-6 text-xl text-gray-600 leading-relaxed">
                  Data-driven real estate intelligence from Crest Study Consult. Access market reports, 
                  city snapshots, trend analyses, and investment guides for Nigerian property markets.
                </p>

                {/* Quick Stats */}
                <div className="mt-8 flex flex-wrap gap-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-2xl font-bold text-teal-600">{reports.length}</span>
                    <span>Research reports</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-2xl font-bold text-teal-600">{cities.length}</span>
                    <span>Cities covered</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Filters */}
          <section className="py-6 bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="container-blog">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-gray-500">Filter by:</span>

                {/* Report Type Filter */}
                <select
                  value={typeFilter || ""}
                  onChange={(e) => updateFilter("type", e.target.value || null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">All types</option>
                  {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                {/* City Filter */}
                <select
                  value={cityFilter || ""}
                  onChange={(e) => updateFilter("city", e.target.value || null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">All cities</option>
                  {cities.map((city: { slug: string; name: string }) => (
                    <option key={city.slug} value={city.slug}>{city.name}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(typeFilter || cityFilter) && (
                  <button
                    onClick={() => setSearchParams(new URLSearchParams())}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Reports Grid */}
          <section className="py-12 lg:py-16">
            <div className="container-blog">
              {reports.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {reports.map((report: typeof reports[number]) => (
                    <ReportCard key={report.id} report={report} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-2xl">
                  <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No reports found</h3>
                  <p className="mt-2 text-gray-500">
                    {typeFilter || cityFilter
                      ? "Try adjusting your filters"
                      : "Check back soon for new research reports"}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* City Markets Section */}
          {cities.length > 0 && (
            <section className="py-12 lg:py-16 bg-gray-50">
              <div className="container-blog">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">City market data</h2>
                    <p className="mt-2 text-gray-600">Explore real estate data for Nigerian cities</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cities.map((city: { slug: string; name: string }) => (
                    <Link
                      key={city.slug}
                      to={`/cities/${city.slug}`}
                      className="p-4 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
                    >
                      <span className="font-medium text-gray-900 group-hover:text-teal-600 transition-colors">
                        {city.name}
                      </span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-500 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Related Articles */}
          {articles.length > 0 && (
            <section className="py-12 lg:py-16">
              <div className="container-blog">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Latest market intelligence</h2>
                  <Link
                    to="/market-intelligence"
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
                  >
                    View all
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map((article: typeof articles[number]) => (
                    <article key={article.slug} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                      {article.heroImage && (
                        <div className="aspect-[16/9] overflow-hidden">
                          <img src={article.heroImage} alt={article.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-bold text-gray-900 line-clamp-2">
                          <Link to={`/market-intelligence/${article.slug}`} className="hover:text-teal-600 transition-colors">
                            {article.title}
                          </Link>
                        </h3>
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{article.excerpt}</p>
                        <div className="mt-3 text-xs text-gray-500">{article.readingTimeMin || 5} min read</div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
