import type { Route } from "./+types/research.$slug";
import { data, Form, Link, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
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
 * Report Detail Meta
 */
export function meta({ data }: Route.MetaArgs) {
  if (!data?.report) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { report } = data;
  const url = `${BRAND.url}/research/${report.slug}`;
  const title = report.metaTitle || `${report.title}${SEO_DEFAULTS.titleSuffix}`;
  const description = report.metaDescription || report.description;

  // Use the report cover as the OG image, served via the compression endpoint
  // (cropped to 1200×630, ≤150 KB JPEG) for reliable social previews.
  // Version by updatedAt so social caches refresh when the cover changes.
  const image = report.coverImage
    ? `${BRAND.url}/og/research/${report.slug}?v=${new Date(report.updatedAt).getTime()}`
    : BRAND.ogImage;
  const imageType = report.coverImage ? "image/jpeg" : "image/png";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:type", content: imageType },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: report.coverAlt || report.title },
    { property: "og:url", content: url },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: BRAND.name },
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:image", content: image },
    { tagName: "link", rel: "canonical", href: url },
    { name: "robots", content: "index, follow" },
  ];
}

/**
 * Report Detail Loader
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Report not found", { status: 404 });
  }

  const report = await db.researchReport.findUnique({
    where: { slug, isPublished: true },
    include: {
      city: { select: { slug: true, name: true } },
      _count: { select: { downloads: true } },
    },
  });

  if (!report) {
    throw new Response("Report not found", { status: 404 });
  }

  // Get related reports (same type or city)
  const relatedReports = await db.researchReport.findMany({
    where: {
      isPublished: true,
      id: { not: report.id },
      OR: [
        { reportType: report.reportType },
        ...(report.cityId ? [{ cityId: report.cityId }] : []),
      ],
    },
    take: 3,
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      reportType: true,
      coverImage: true,
    },
  });

  return data(
    { report, relatedReports },
    { headers: { "Cache-Control": CACHE_HEADERS.page } }
  );
}

/**
 * Report Download Action
 */
export async function action({ request, params }: Route.ActionArgs) {
  const { slug } = params;
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return data({ error: "Valid email is required", success: false, downloadUrl: null }, { status: 400 });
  }

  const report = await db.researchReport.findUnique({
    where: { slug },
    select: { id: true, fileUrl: true, isGated: true },
  });

  if (!report) {
    return data({ error: "Report not found", success: false, downloadUrl: null }, { status: 404 });
  }

  // Track download
  await db.reportDownload.create({
    data: {
      reportId: report.id,
      email: email.toLowerCase().trim(),
      name: name || null,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    },
  });

  return data({ success: true, downloadUrl: report.fileUrl, error: null });
}

/**
 * Report Detail Page
 */
export default function ReportDetail({ loaderData }: Route.ComponentProps) {
  const { report, relatedReports } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Close modal and trigger download on success
  useEffect(() => {
    if (actionData?.success && actionData.downloadUrl) {
      setShowDownloadModal(false);
      // Trigger download
      window.open(actionData.downloadUrl, "_blank");
    }
  }, [actionData]);

  const handleDownload = () => {
    if (report.isGated) {
      setShowDownloadModal(true);
    } else {
      window.open(report.fileUrl, "_blank");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Breadcrumb */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="container-blog py-4">
              <nav className="flex items-center gap-2 text-sm text-gray-500">
                <Link to="/" className="hover:text-teal-600 transition-colors">Home</Link>
                <span>/</span>
                <Link to="/research" className="hover:text-teal-600 transition-colors">Research</Link>
                <span>/</span>
                <span className="text-gray-700 truncate">{report.title}</span>
              </nav>
            </div>
          </div>

          {/* Report Header */}
          <section className="py-12 lg:py-16">
            <div className="container-blog">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Content */}
                <div className="lg:col-span-2">
                  {/* Type Badge */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 text-sm font-medium bg-teal-100 text-teal-700 rounded-full">
                      {REPORT_TYPE_LABELS[report.reportType] || report.reportType}
                    </span>
                    {report.city && (
                      <Link
                        to={`/cities/${report.city.slug}`}
                        className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        {report.city.name}
                      </Link>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                    {report.title}
                  </h1>

                  {/* Description */}
                  <p className="mt-4 text-xl text-gray-600 leading-relaxed">
                    {report.description}
                  </p>

                  {/* Meta */}
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>
                      Published {new Date(report.publishedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {report.pageCount && (
                      <>
                        <span>·</span>
                        <span>{report.pageCount} pages</span>
                      </>
                    )}
                    {report.fileSize && (
                      <>
                        <span>·</span>
                        <span>PDF {formatFileSize(report.fileSize)}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{report._count.downloads} downloads</span>
                  </div>

                  {/* Excerpt */}
                  {report.excerpt && (
                    <div className="mt-8 prose prose-lg prose-teal max-w-none">
                      <h2>Overview</h2>
                      <p>{report.excerpt}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {report.tags.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {report.tags.map((tag: string) => (
                          <span key={tag} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar - Download Card */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24">
                    {/* Cover Image */}
                    {report.coverImage && (
                      <div className="mb-6 rounded-xl overflow-hidden shadow-lg">
                        <img
                          src={report.coverImage}
                          alt={report.coverAlt || report.title}
                          className="w-full aspect-[3/4] object-cover"
                        />
                      </div>
                    )}

                    {/* Download Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                      <h3 className="font-semibold text-gray-900 mb-4">Download report</h3>

                      {report.isGated ? (
                        <>
                          <p className="text-sm text-gray-600 mb-4">
                            Enter your email to receive the download link. We'll also send you updates on new research.
                          </p>
                          <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download PDF
                          </button>
                        </>
                      ) : (
                        <a
                          href={report.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Related Reports */}
          {relatedReports.length > 0 && (
            <section className="py-12 bg-gray-50 border-t border-gray-200">
              <div className="container-blog">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Related reports</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedReports.map((rel: typeof relatedReports[number]) => (
                    <Link
                      key={rel.slug}
                      to={`/research/${rel.slug}`}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow"
                    >
                      <span className="text-xs font-medium text-teal-600">
                        {REPORT_TYPE_LABELS[rel.reportType]}
                      </span>
                      <h3 className="mt-2 font-semibold text-gray-900 line-clamp-2">{rel.title}</h3>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <Footer />
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Download report</h3>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {actionData?.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {actionData.error}
              </div>
            )}

            <Form method="post">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <p className="text-xs text-gray-500">
                  By downloading, you agree to receive occasional research updates from Crest Study Consult. 
                  You can unsubscribe anytime.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Get download link
                    </>
                  )}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </>
  );
}
