import type { Route } from "./+types/cities.$slug";
import { data, Link } from "react-router";
import { Header, Footer } from "~/components/layout";
// OrganizationSchema handled by root.tsx
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { db } from "~/utils/db.server";

const REPORT_TYPE_LABELS: Record<string, string> = {
  MARKET_REPORT: "Market Report",
  CITY_SNAPSHOT: "City Snapshot",
  TREND_ANALYSIS: "Trend Analysis",
  POLICY_BRIEF: "Policy Brief",
  INVESTMENT_GUIDE: "Investment Guide",
};

/**
 * City Page Meta
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.city) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { city } = data;
  const url = `${BRAND.url}/cities/${city.slug}`;
  const title = city.metaTitle || `${city.name} Real Estate Market${SEO_DEFAULTS.titleSuffix}`;
  const description = city.metaDescription || city.description || 
    `Real estate market data for ${city.name}, ${city.state}. Property prices, rental yields, and market trends from Crest Study Consult Research.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: city.heroImage || BRAND.ogImage },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { tagName: "link", rel: "canonical", href: url },
    { name: "robots", content: "index, follow" },
  ];
}

/**
 * City Page Loader
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("City not found", { status: 404 });
  }

  const city = await db.city.findUnique({
    where: { slug },
    include: {
      reports: {
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: 6,
        select: {
          slug: true,
          title: true,
          description: true,
          reportType: true,
          coverImage: true,
          publishedAt: true,
        },
      },
    },
  });

  if (!city) {
    throw new Response("City not found", { status: 404 });
  }

  // Get related market intelligence articles
  const articles = await db.post.findMany({
    where: {
      isPublished: true,
      category: { slug: "market-intelligence" },
      OR: [
        { title: { contains: city.name, mode: "insensitive" } },
        { content: { contains: city.name, mode: "insensitive" } },
        { tags: { some: { name: { contains: city.name, mode: "insensitive" } } } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 4,
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

  // Get other cities for navigation
  const otherCities = await db.city.findMany({
    where: { slug: { not: slug } },
    orderBy: { name: "asc" },
    take: 5,
    select: { slug: true, name: true, state: true },
  });

  return data(
    { city, articles, otherCities },
    { headers: { "Cache-Control": CACHE_HEADERS.page } }
  );
}

/**
 * Format currency
 */
function formatNaira(amount: number | null): string {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage
 */
function formatPercent(value: number | null, showSign = false): string {
  if (value === null || value === undefined) return "—";
  const prefix = showSign && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

/**
 * City Page Component
 */
export default function CityPage({ loaderData }: Route.ComponentProps) {
  const { city, articles, otherCities } = loaderData;
  const keyInsights = city.keyInsights as string[] | null;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Hero */}
          <section 
            className="relative py-16 lg:py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 text-white overflow-hidden"
            style={city.heroImage ? { backgroundImage: `url(${city.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
          >
            {city.heroImage && <div className="absolute inset-0 bg-black/60" />}
            
            <div className="container-blog relative z-10">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-white/70 mb-6">
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
                <span>/</span>
                <Link to="/research" className="hover:text-white transition-colors">Research</Link>
                <span>/</span>
                <span className="text-white">Cities</span>
                <span>/</span>
                <span className="text-white">{city.name}</span>
              </nav>

              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-sm font-medium mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {city.state}, Nigeria
                </span>

                <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                  {city.name} real estate market
                </h1>

                {city.description && (
                  <p className="mt-6 text-xl text-white/80 leading-relaxed">
                    {city.description}
                  </p>
                )}

                {city.lastUpdated && (
                  <p className="mt-4 text-sm text-white/60">
                    Data last updated: {new Date(city.lastUpdated).toLocaleDateString("en-GB", { 
                      day: "numeric", month: "long", year: "numeric" 
                    })}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Market Stats */}
          <section className="py-12 bg-white border-b border-gray-200">
            <div className="container-blog">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Market snapshot</h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Avg. price per m²</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNaira(city.avgPricePerSqm)}
                  </p>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Rental yield</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatPercent(city.avgRentalYield)}
                  </p>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Price change (YoY)</p>
                  <p className={`text-2xl font-bold ${
                    city.priceChangeYoY && city.priceChangeYoY > 0 ? "text-teal-600" : 
                    city.priceChangeYoY && city.priceChangeYoY < 0 ? "text-red-600" : "text-gray-900"
                  }`}>
                    {formatPercent(city.priceChangeYoY, true)}
                  </p>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Transaction volume</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {city.transactionVolume?.toLocaleString() || "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Market Summary & Insights */}
          {(city.marketSummary || keyInsights) && (
            <section className="py-12 lg:py-16">
              <div className="container-blog">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {city.marketSummary && (
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Market overview</h2>
                      <p className="text-gray-600 leading-relaxed">{city.marketSummary}</p>
                    </div>
                  )}

                  {keyInsights && keyInsights.length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Key insights</h2>
                      <ul className="space-y-3">
                        {keyInsights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-gray-600">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Reports for this city */}
          {city.reports.length > 0 && (
            <section className="py-12 lg:py-16 bg-gray-50">
              <div className="container-blog">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-gray-900">Research reports for {city.name}</h2>
                  <Link
                    to={`/research?city=${city.slug}`}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
                  >
                    View all
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {city.reports.map((report) => (
                    <Link
                      key={report.slug}
                      to={`/research/${report.slug}`}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-teal-200 transition-all"
                    >
                      <span className="text-xs font-medium text-teal-600">
                        {REPORT_TYPE_LABELS[report.reportType]}
                      </span>
                      <h3 className="mt-2 font-semibold text-gray-900 line-clamp-2">{report.title}</h3>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{report.description}</p>
                      <p className="mt-3 text-xs text-gray-500">
                        {new Date(report.publishedAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </p>
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
                <h2 className="text-xl font-bold text-gray-900 mb-8">Articles about {city.name}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {articles.map((article) => (
                    <article key={article.slug} className="flex gap-4 bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                      {article.heroImage && (
                        <div className="w-32 flex-shrink-0">
                          <img src={article.heroImage} alt={article.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 p-4">
                        <h3 className="font-semibold text-gray-900 line-clamp-2">
                          <Link to={`/${article.category.slug}/${article.slug}`} className="hover:text-teal-600 transition-colors">
                            {article.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">{article.excerpt}</p>
                        <p className="mt-2 text-xs text-gray-500">{article.readingTimeMin || 5} min read</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Other Cities */}
          {otherCities.length > 0 && (
            <section className="py-12 bg-gray-50 border-t border-gray-200">
              <div className="container-blog">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Explore other cities</h2>
                <div className="flex flex-wrap gap-3">
                  {otherCities.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/cities/${c.slug}`}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-gray-700 hover:border-teal-300 hover:text-teal-600 transition-all"
                    >
                      {c.name}
                    </Link>
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
