import type { Route } from "./+types/search";
import { data, Link, useSearchParams, useNavigation } from "react-router";
import { Header, Footer } from "~/components/layout";
// OrganizationSchema handled by root.tsx
import { BRAND, CATEGORIES, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { searchArticles, searchAll, type SearchResult, type CategorySearchResult, type CommentSearchResult, type UnifiedSearchResult } from "~/utils/queries.server";
import { cn } from "~/utils/cn";

// Result type badge styles
const resultTypeBadge = {
  article: { bg: "bg-teal-50", text: "text-teal-700", label: "Article", color: "teal" },
  report: { bg: "bg-navy-50", text: "text-navy-700", label: "Research", color: "navy" },
  faq: { bg: "bg-gray-100", text: "text-gray-700", label: "FAQ", color: "gray" },
  category: { bg: "bg-gray-100", text: "text-gray-700", label: "Category", color: "gray" },
  comment: { bg: "bg-gray-100", text: "text-gray-700", label: "Comment", color: "gray" },
};

/**
 * Search Page Meta Function
 */
export function meta({ location }: Route.MetaArgs) {
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get("q") || "";
  
  const title = query 
    ? `Search results for "${query}"${SEO_DEFAULTS.titleSuffix}`
    : `Search${SEO_DEFAULTS.titleSuffix}`;

  return [
    { title },
    { name: "description", content: `Search ${BRAND.name} for articles, research, and guides on studying abroad — destinations, admissions, visas, and scholarships.` },
    { name: "robots", content: "noindex, follow" }, // Don't index search pages
    { property: "og:title", content: title },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
  ];
}

/**
 * Search Page Loader
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || undefined;

  let results: UnifiedSearchResult[] = [];
  
  if (query.length >= 2) {
    // Use unified search when no category filter, otherwise just search articles
    results = category 
      ? await searchArticles(query, 20, category)
      : await searchAll(query, 20);
  }

  // Serialize dates for JSON response
  const serializedResults = results.map((r) => {
    if ("publishedAt" in r) {
      return {
        ...r,
        publishedAt: r.publishedAt.toISOString(),
      };
    }
    if ("createdAt" in r) {
      return {
        ...r,
        createdAt: r.createdAt.toISOString(),
      };
    }
    return r;
  });

  return data(
    {
      query,
      category,
      results: serializedResults,
    },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.api,
      },
    }
  );
}

/**
 * Search Results Page
 */
export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { query, category, results } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching = navigation.state === "loading" && navigation.location?.pathname === "/search";

  const handleCategoryChange = (slug: string) => {
    const params = new URLSearchParams(searchParams);
    if (slug) {
      params.set("category", slug);
    } else {
      params.delete("category");
    }
    setSearchParams(params);
  };

  // Group results by type
  const categoryResults = results.filter((r: any) => r.resultType === "category");
  const commentResults = results.filter((r: any) => r.resultType === "comment");
  const articleResults = results.filter((r: any) => 
    r.resultType === "article" || r.resultType === "report" || r.resultType === "faq"
  );

  // Count by type for summary
  const articleCount = articleResults.filter((r: any) => r.resultType === "article").length;
  const reportCount = articleResults.filter((r: any) => r.resultType === "report").length;
  const faqCount = articleResults.filter((r: any) => r.resultType === "faq").length;

  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 py-12 lg:py-16">
          <div className="container-blog">
            {/* Search Header */}
            <div className="max-w-2xl mb-10">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {query ? (
                  <>
                    Search results for{" "}
                    <span className="text-teal-600">"{query}"</span>
                  </>
                ) : (
                  "Search"
                )}
              </h1>
              {results.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <span>Found {results.length} result{results.length !== 1 ? "s" : ""}</span>
                  {category && (
                    <span className="text-gray-400">
                      in {CATEGORIES.find((c) => c.slug === category)?.name}
                    </span>
                  )}
                  <div className="flex items-center gap-2 ml-2">
                    {categoryResults.length > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        {categoryResults.length} category
                      </span>
                    )}
                    {articleCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                        {articleCount} article{articleCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {reportCount > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-navy-50 text-navy-700 rounded text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-navy-400"></span>
                        {reportCount} report{reportCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {commentResults.length > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        {commentResults.length} comment{commentResults.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search Form */}
            <form method="get" className="mb-8">
              <div className="flex gap-3 max-w-2xl">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="search"
                    name="q"
                    defaultValue={query}
                    placeholder="Search articles..."
                    className="w-full pl-12 pr-4 py-3 text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    autoComplete="off"
                  />
                </div>
                <input type="hidden" name="category" value={category || ""} />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-6 py-3 bg-navy-700 text-white font-medium rounded-xl hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Searching...
                    </>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </form>

            {/* Category Filter */}
            <div className="flex items-center gap-2 mb-10 overflow-x-auto scrollbar-hide pb-2">
              <button
                type="button"
                onClick={() => handleCategoryChange("")}
                className={cn(
                  "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors",
                  !category
                    ? "bg-navy-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                All categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                    category === cat.slug
                      ? "bg-navy-700 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Results */}
            {!query ? (
              <div className="text-center py-16">
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-xl text-gray-500 mb-2">Start your search</p>
                <p className="text-gray-400">
                  Enter a keyword to find articles, research, and guides
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16">
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xl text-gray-500 mb-2">No results found</p>
                <p className="text-gray-400 mb-6">
                  Try different keywords or check your spelling
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.slice(0, 3).map((cat) => (
                    <Link
                      key={cat.slug}
                      to={`/${cat.slug}`}
                      className="px-4 py-2 text-sm text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      Browse {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Category Results */}
                {categoryResults.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Categories
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryResults.map((result: any) => (
                        <Link
                          key={`category-${result.slug}`}
                          to={`/${result.slug}`}
                          className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-lg transition-all"
                        >
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                              {result.name}
                            </h3>
                            {result.description && (
                              <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                                {result.description}
                              </p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Article/Report/FAQ Results */}
                {articleResults.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      Content
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {articleResults.map((result: any) => {
                        const badge = resultTypeBadge[result.resultType as keyof typeof resultTypeBadge];
                        const url = result.resultType === "report" && result.category.slug === "market-intelligence"
                          ? `/market-intelligence/${result.slug}`
                          : `/${result.category.slug}/${result.slug}`;
                        
                        return (
                          <Link
                            key={`${result.resultType}-${result.category.slug}-${result.slug}`}
                            to={url}
                            className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-teal-200 transition-all"
                          >
                            {result.heroImage ? (
                              <div className="aspect-[16/9] overflow-hidden">
                                <img
                                  src={result.heroImage}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            ) : (
                              <div className={cn(
                                "aspect-[16/9] flex items-center justify-center",
                                result.resultType === "report" ? "bg-navy-50" :
                                result.resultType === "faq" ? "bg-gray-100" :
                                "bg-teal-50"
                              )}>
                                {result.resultType === "report" && (
                                  <svg className="w-12 h-12 text-navy-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                )}
                                {result.resultType === "faq" && (
                                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                                {result.resultType === "article" && (
                                  <svg className="w-12 h-12 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div className="p-5">
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span className={cn(
                                  "text-xs font-medium px-2 py-1 rounded",
                                  badge.bg,
                                  badge.text
                                )}>
                                  {badge.label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {result.category.name}
                                </span>
                                {result.matchType === "title" && (
                                  <span className="text-xs text-teal-500 font-medium">
                                    Best match
                                  </span>
                                )}
                              </div>
                              <h2 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors line-clamp-2 mb-2">
                                {result.title}
                              </h2>
                              <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                {result.excerpt}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-400">
                                {result.readingTimeMin && (
                                  <>
                                    <span>{result.readingTimeMin} min read</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>
                                  {new Date(result.publishedAt).toLocaleDateString("en-GB", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Comment Results */}
                {commentResults.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Comments
                    </h2>
                    <div className="space-y-4">
                      {commentResults.map((result: any) => (
                        <Link
                          key={`comment-${result.id}`}
                          to={`/${result.post.category.slug}/${result.post.slug}#comments`}
                          className="group flex gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 text-xs">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                Comment
                              </span>
                              <span className="text-gray-400">
                                on <span className="text-gray-600">{result.post.title}</span>
                              </span>
                            </div>
                            <p className="text-gray-700 line-clamp-2 mb-2">
                              "{result.content}"
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>by {result.authorName}</span>
                              <span>•</span>
                              <span>
                                {new Date(result.createdAt).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 flex-shrink-0 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
