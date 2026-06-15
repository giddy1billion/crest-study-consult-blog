import type { Route } from "./+types/admin-articles";
import { data, Link, useSearchParams } from "react-router";
import { db } from "~/utils/db.server";
import { BRAND, CATEGORIES } from "~/utils/constants";
import type { PostStatus, Prisma } from "@prisma/client";

/**
 * Admin Articles Meta
 */
export function meta() {
  return [
    { title: `Articles — ${BRAND.name} Admin` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Articles List Loader - Optimized with transaction
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const status = url.searchParams.get("status") as PostStatus | null;
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const perPage = 20;

  // Build where clause
  const where: Prisma.PostWhereInput = {};
  
  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = { slug: category };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  // Use transaction for connection reuse
  const [articles, total, categories] = await db.$transaction([
    db.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        isPublished: true,
        isFeatured: true,
        publishedAt: true,
        updatedAt: true,
        viewCount: true,
        shareCount: true,
        category: { select: { slug: true, name: true } },
        author: { select: { name: true } },
      },
    }),
    db.post.count({ where }),
    db.category.findMany({ select: { slug: true, name: true } }),
  ]);

  return data(
    {
      articles,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      categories,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=10", // Short cache for article list
      },
    }
  );
}

/**
 * Status badge component with modern styling
 */
function StatusBadge({ status, isPublished }: { status: string; isPublished: boolean }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
        Published
      </span>
    );
  }

  const styles: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
    IDEA: { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-500/20", dot: "bg-gray-400" },
    DRAFT: { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-500/20", dot: "bg-amber-500" },
    EDITORIAL_REVIEW: { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-500/20", dot: "bg-blue-500" },
    SEO_REVIEW: { bg: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-500/20", dot: "bg-purple-500" },
    FACT_CHECK: { bg: "bg-orange-50", text: "text-orange-600", ring: "ring-orange-500/20", dot: "bg-orange-500" },
    AEO_REVIEW: { bg: "bg-pink-50", text: "text-pink-600", ring: "ring-pink-500/20", dot: "bg-pink-500" },
    READY: { bg: "bg-teal-50", text: "text-teal-600", ring: "ring-teal-500/20", dot: "bg-teal-500" },
    ARCHIVED: { bg: "bg-red-50", text: "text-red-600", ring: "ring-red-500/20", dot: "bg-red-500" },
  };

  const style = styles[status] || styles.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

/**
 * Admin Articles List Component
 */
export default function AdminArticles({ loaderData }: Route.ComponentProps) {
  const { articles, total, page, totalPages, categories } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status");
  const currentCategory = searchParams.get("category");
  const currentSearch = searchParams.get("search") || "";

  const statuses = [
    "IDEA",
    "DRAFT",
    "EDITORIAL_REVIEW",
    "SEO_REVIEW",
    "FACT_CHECK",
    "AEO_REVIEW",
    "READY",
    "LIVE",
    "ARCHIVED",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="mt-1 text-gray-500">
            Manage your {total} articles
          </p>
        </div>
        <Link
          to="/admin/articles/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-xl hover:bg-navy-800 hover:shadow-lg hover:shadow-navy-700/25 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Article
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search articles..."
                value={currentSearch}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    params.set("search", e.target.value);
                  } else {
                    params.delete("search");
                  }
                  params.delete("page");
                  setSearchParams(params);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={currentStatus || ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set("status", e.target.value);
              } else {
                params.delete("status");
              }
              params.delete("page");
              setSearchParams(params);
            }}
            className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={currentCategory || ""}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set("category", e.target.value);
              } else {
                params.delete("category");
              }
              params.delete("page");
              setSearchParams(params);
            }}
            className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(currentStatus || currentCategory || currentSearch) && (
            <button
              onClick={() => setSearchParams({})}
              className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Articles Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">No articles found</h3>
                    <p className="text-sm text-gray-500 mb-4">Get started by creating your first article.</p>
                    <Link
                      to="/admin/articles/new"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-600 text-sm font-medium rounded-xl hover:bg-teal-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Article
                    </Link>
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/admin/articles/${article.id}/edit`}
                              className="text-sm font-medium text-gray-900 hover:text-teal-600 truncate"
                            >
                              {article.title}
                            </Link>
                            {article.isFeatured && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded">
                                Featured
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            /{article.category.slug}/{article.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{article.category.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={article.status} isPublished={article.isPublished} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{article.viewCount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{article.shareCount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {new Date(article.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/admin/articles/${article.id}/edit`}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        {article.isPublished && (
                          <a
                            href={`/${article.category.slug}/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            title="View"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-900">{(page - 1) * 20 + 1}</span> to{" "}
              <span className="font-medium text-gray-900">{Math.min(page * 20, total)}</span> of{" "}
              <span className="font-medium text-gray-900">{total}</span> articles
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}`}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-xl ring-1 ring-inset ring-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </Link>
              )}
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  to={`?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}`}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-xl ring-1 ring-inset ring-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
