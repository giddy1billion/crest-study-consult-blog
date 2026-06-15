import type { Route } from "./+types/market-intelligence-report";
import { data, Link, useLocation } from "react-router";
import { Header, Footer } from "~/components/layout";
import { ArticleSchema } from "~/components/seo";
import { BRAND, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { getResearchReportBySlug, getArticleBySlug } from "~/utils/queries.server";
import { parseMarkdown } from "~/utils/markdown.server";

/**
 * Research Report Meta Function
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.report) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { report } = data;
  const url = `${BRAND.url}/market-intelligence/${report.slug}`;
  const title = `${report.title}${SEO_DEFAULTS.titleSuffix}`;

  // Use the report hero as the OG image, served via the compression endpoint
  // (cropped to 1200×630, ≤150 KB JPEG) for reliable social previews.
  const version = new Date(report.updatedAt || report.publishedAt).getTime();
  const image = report.heroImage
    ? `${BRAND.url}/og/market-intelligence/${report.slug}?v=${version}`
    : BRAND.ogImage;
  const imageType = report.heroImage ? "image/jpeg" : "image/png";

  return [
    { title },
    { name: "description", content: report.excerpt },
    { property: "og:title", content: title },
    { property: "og:description", content: report.excerpt },
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imageType },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: report.heroImageAlt || report.title },
    { property: "og:url", content: url },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: BRAND.name },
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: url },
  ];
}

/**
 * Research Report Loader
 * Fetches report directly from database via Prisma
 * Falls back to regular article if no report found
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Report not found", { status: 404 });
  }

  // First try to fetch as a research report (schemaType: REPORT)
  let report = await getResearchReportBySlug(slug);

  // Fall back to regular article in market-intelligence category
  if (!report) {
    report = await getArticleBySlug("market-intelligence", slug);
  }

  if (!report) {
    throw new Response("Report not found", { status: 404 });
  }

  // Parse Markdown content to HTML
  const processedReport = {
    ...report,
    content: parseMarkdown(report.content),
  };

  return data(
    { report: processedReport },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.page,
      },
    }
  );
}

/**
 * Research Report Page
 */
export default function MarketIntelligenceReport({ loaderData }: Route.ComponentProps) {
  const { report } = loaderData;
  const location = useLocation();
  const reportUrl = `${BRAND.url}${location.pathname}`;

  // Canonical share image: the hero served through the OG endpoint
  // (1200×630, ≤150 KB JPEG), versioned so caches refresh on hero change.
  const ogImage = report.heroImage
    ? `${BRAND.url}/og/market-intelligence/${report.slug}?v=${new Date(report.updatedAt || report.publishedAt).getTime()}`
    : BRAND.ogImage;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <ArticleSchema
        title={report.title}
        description={report.excerpt}
        image={ogImage}
        publishedAt={new Date(report.publishedAt).toISOString()}
        updatedAt={new Date(report.publishedAt).toISOString()}
        url={reportUrl}
      />

      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Report Header */}
          <article>
            <header className="py-12 lg:py-16 bg-gray-50 border-b border-gray-100">
              <div className="container-blog">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                  <Link to="/" className="hover:text-teal-600 transition-colors">
                    Home
                  </Link>
                  <span>/</span>
                  <Link
                    to="/market-intelligence"
                    className="hover:text-teal-600 transition-colors"
                  >
                    Research Library
                  </Link>
                  <span>/</span>
                  <span className="text-gray-700 truncate max-w-[200px]">{report.title}</span>
                </nav>

                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full">
                      {report.category.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(report.publishedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                  </div>

                  <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight">
                    {report.title}
                  </h1>

                  <p className="mt-6 text-xl text-gray-600 leading-relaxed">{report.excerpt}</p>

                  <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                    <span>{report.readingTimeMin} min read</span>
                    <span className="text-gray-300">·</span>
                    <span>By {BRAND.name} Research Team</span>
                  </div>
                </div>
              </div>
            </header>

            {/* Report Content */}
            <div className="container-blog py-12 lg:py-16">
              <div className="max-w-3xl">
                <div
                  className="prose prose-lg prose-teal max-w-none"
                  dangerouslySetInnerHTML={{ __html: report.content }}
                />

                {/* Source Notes */}
                {report.sourceNotes && (
                  <aside className="mt-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Sources & methodology
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{report.sourceNotes}</p>
                  </aside>
                )}

                {/* Back link */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                  <Link
                    to="/market-intelligence"
                    className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
                  >
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
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Back to Research Library
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
}

/**
 * Error Boundary
 */
export function ErrorBoundary() {
  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-gray-900">Report not found</h1>
            <p className="mt-4 text-gray-600">
              The research report you're looking for doesn't exist.
            </p>
            <Link
              to="/market-intelligence"
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
            >
              Back to Research Library
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}


