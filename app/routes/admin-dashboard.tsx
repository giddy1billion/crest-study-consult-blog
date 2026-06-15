import type { Route } from "./+types/admin-dashboard";
import { data, Link } from "react-router";
import { db } from "~/utils/db.server";
import { BRAND } from "~/utils/constants";

/**
 * Admin Dashboard Meta
 */
export function meta() {
  return [
    { title: `Dashboard — ${BRAND.name} Admin` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Dashboard Loader - Fetch stats with optimized queries
 */
export async function loader({}: Route.LoaderArgs) {
  // Use a single transaction for better connection reuse
  const [
    totalArticles,
    publishedArticles,
    draftArticles,
    viewsAndShares,
    recentArticles,
    pendingCommentsCount,
    totalCategories,
  ] = await db.$transaction([
    db.post.count(),
    db.post.count({ where: { isPublished: true } }),
    db.post.count({ where: { status: "DRAFT" } }),
    db.post.aggregate({ _sum: { viewCount: true, shareCount: true } }),
    db.post.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        isPublished: true,
        updatedAt: true,
        viewCount: true,
        shareCount: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    db.comment.count({ where: { status: "PENDING" } }),
    db.category.count(),
  ]);

  return data(
    {
      stats: {
        totalArticles,
        publishedArticles,
        draftArticles,
        totalCategories,
        totalViews: viewsAndShares._sum.viewCount ?? 0,
        totalShares: viewsAndShares._sum.shareCount ?? 0,
        pendingComments: pendingCommentsCount,
      },
      recentArticles,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30", // Cache dashboard for 30s
      },
    }
  );
}

/**
 * Stat Card Component
 */
function StatCard({ 
  label, 
  value, 
  icon, 
  trend, 
  gradient 
}: { 
  label: string; 
  value: number | string; 
  icon: React.ReactNode;
  trend?: { value: number; up: boolean };
  gradient: string;
}) {
  return (
    <div className="relative group h-full">
      {/* Glow effect */}
      <div className={`absolute inset-0 ${gradient} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
      
      <div className="relative bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 h-full min-h-[130px]">
        {/* Icon positioned at top right */}
        <div className={`absolute top-4 right-4 w-10 h-10 ${gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        
        {/* Content stacked vertically with room for icon */}
        <div className="pr-12">
          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2 leading-tight">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? 'text-teal-600' : 'text-red-500'}`}>
              <svg className={`w-3 h-3 flex-shrink-0 ${trend.up ? '' : 'rotate-180'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Admin Dashboard Component
 */
export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { stats, recentArticles } = loaderData;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}</h1>
          <p className="mt-1 text-gray-500">
            Here's what's happening with your content today.
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

      {/* Pending Comments Alert */}
      {stats.pendingComments > 0 && (
        <Link
          to="/admin/comments?status=PENDING"
          className="block p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                {stats.pendingComments} comment{stats.pendingComments !== 1 ? "s" : ""} pending moderation
              </p>
              <p className="text-sm text-amber-600">Click to review</p>
            </div>
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Stats Grid - 2 cols on mobile, 3 on tablet, 5 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Articles"
          value={stats.totalArticles}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          }
        />
        <StatCard
          label="Published"
          value={stats.publishedArticles}
          gradient="bg-gradient-to-br from-teal-500 to-teal-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="In Progress"
          value={stats.draftArticles}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <StatCard
          label="Total Views"
          value={stats.totalViews.toLocaleString()}
          gradient="bg-gradient-to-br from-purple-500 to-pink-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          label="Total Shares"
          value={stats.totalShares.toLocaleString()}
          gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          }
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Articles */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Articles</h2>
              <p className="text-sm text-gray-500">Your latest content</p>
            </div>
            <Link
              to="/admin/articles"
              className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          {recentArticles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No articles yet</h3>
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
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentArticles.map((article) => (
                <Link
                  key={article.id}
                  to={`/admin/articles/${article.id}/edit`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{article.category.name}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">
                        {new Date(article.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{article.viewCount} views</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{article.shareCount} shares</span>
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        article.isPublished
                          ? "bg-teal-50 text-teal-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {article.isPublished ? "Published" : article.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/admin/articles/new"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">New Article</p>
                  <p className="text-xs text-gray-500">Start writing</p>
                </div>
              </Link>

              <Link
                to="/admin/articles?status=DRAFT"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Review Drafts</p>
                  <p className="text-xs text-gray-500">{stats.draftArticles} pending</p>
                </div>
              </Link>

              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">View Blog</p>
                  <p className="text-xs text-gray-500">Open in new tab</p>
                </div>
              </a>
            </div>
          </div>

          {/* Editorial Status */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Content Status</h3>
                <p className="text-sm text-teal-100">All systems operational</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-teal-100">Published rate</span>
                <span className="font-medium">
                  {stats.totalArticles > 0 
                    ? Math.round((stats.publishedArticles / stats.totalArticles) * 100) 
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ 
                    width: stats.totalArticles > 0 
                      ? `${(stats.publishedArticles / stats.totalArticles) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
