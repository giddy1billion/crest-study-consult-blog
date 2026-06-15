import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { cn } from "~/utils/cn";
import { useDebounce } from "~/hooks";
import { CATEGORIES } from "~/utils/constants";

// Result type for articles/reports/FAQs
interface ArticleResult {
  slug: string;
  title: string;
  excerpt: string;
  heroImage: string | null;
  readingTimeMin: number | null;
  publishedAt: string;
  category: {
    slug: string;
    name: string;
  };
  schemaType?: string;
  matchType: "title" | "content" | "excerpt";
  resultType: "article" | "report" | "faq";
}

// Result type for categories
interface CategoryResult {
  slug: string;
  name: string;
  description: string | null;
  resultType: "category";
}

// Result type for comments
interface CommentResult {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  post: {
    slug: string;
    title: string;
    category: {
      slug: string;
      name: string;
    };
  };
  resultType: "comment";
}

type SearchResult = ArticleResult | CategoryResult | CommentResult;

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon components for different result types
function ArticleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ReportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function FAQIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CategoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

// Result type badge styles
const resultTypeBadge = {
  article: { bg: "bg-teal-50", text: "text-teal-700", label: "Article" },
  report: { bg: "bg-navy-50", text: "text-navy-700", label: "Research" },
  faq: { bg: "bg-gray-100", text: "text-gray-700", label: "FAQ" },
  category: { bg: "bg-gray-100", text: "text-gray-700", label: "Category" },
  comment: { bg: "bg-gray-100", text: "text-gray-700", label: "Comment" },
};

// Helper to check if result is a category
function isCategoryResult(result: SearchResult): result is CategoryResult {
  return result.resultType === "category";
}

// Helper to check if result is a comment
function isCommentResult(result: SearchResult): result is CommentResult {
  return result.resultType === "comment";
}

// Get URL for a result
function getResultUrl(result: SearchResult): string {
  if (isCategoryResult(result)) {
    return `/${result.slug}`;
  }
  if (isCommentResult(result)) {
    // Link to the article with a hash to the comments section
    return `/${result.post.category.slug}/${result.post.slug}#comments`;
  }
  // Reports live under their category (e.g. study-intelligence)
  return `/${result.category.slug}/${result.slug}`;
}

/**
 * Full-screen search modal with real-time search
 * Supports articles, research reports, FAQs, and categories
 * Keyboard accessible with arrow key navigation
 */
export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const debouncedQuery = useDebounce(query, 300);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state when closed
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
      setSelectedCategory("");
    }
  }, [isOpen]);

  // Fetch search results
  useEffect(() => {
    async function fetchResults() {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({ 
          q: debouncedQuery, 
          limit: "12",
          unified: selectedCategory ? "false" : "true",
        });
        if (selectedCategory) {
          params.set("category", selectedCategory);
        }
        
        const response = await fetch(`/api/search?${params}`);
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [debouncedQuery, selectedCategory]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            const result = results[selectedIndex];
            navigate(getResultUrl(result));
            onClose();
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    },
    [results, selectedIndex, navigate, onClose]
  );

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const children = resultsRef.current.querySelectorAll('[data-result]');
      const selected = children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group results by type for better UX
  const categoryResults = results.filter(isCategoryResult);
  const commentResults = results.filter(isCommentResult);
  const articleResults = results.filter((r): r is ArticleResult => 
    !isCategoryResult(r) && !isCommentResult(r)
  );

  return (
    <div
      className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Search articles"
    >
      <div className="flex flex-col w-full max-w-2xl mx-auto mt-[10vh] bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles, topics, research..."
            className="flex-1 text-lg text-gray-900 placeholder-gray-400 outline-none bg-transparent"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {isLoading && (
            <svg
              className="w-5 h-5 text-teal-500 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCategory("")}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
              selectedCategory === ""
                ? "bg-teal-100 text-teal-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.slug}
              onClick={() => setSelectedCategory(category.slug)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                selectedCategory === category.slug
                  ? "bg-teal-100 text-teal-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto" ref={resultsRef}>
          {query.length < 2 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-gray-500">Type at least 2 characters to search</p>
              <div className="mt-6">
                <p className="text-sm text-gray-400 mb-3">Quick links</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.slice(0, 3).map((category) => (
                    <Link
                      key={category.slug}
                      to={`/${category.slug}`}
                      onClick={onClose}
                      className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-colors"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="px-5 py-12 text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 mb-4"
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
              <p className="text-gray-500">No results found for "{query}"</p>
              <p className="text-sm text-gray-400 mt-2">
                Try different keywords or check your spelling
              </p>
            </div>
          ) : (
            <div>
              {/* Category Results Section */}
              {categoryResults.length > 0 && (
                <div className="border-b border-gray-100">
                  <div className="px-5 py-2 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Categories
                    </span>
                  </div>
                  {categoryResults.map((result, index) => (
                    <Link
                      key={`category-${result.slug}`}
                      data-result
                      to={getResultUrl(result)}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3 transition-colors",
                        selectedIndex === index
                          ? "bg-gray-50"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <CategoryIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">
                            {result.name}
                          </h3>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            resultTypeBadge.category.bg,
                            resultTypeBadge.category.text
                          )}>
                            {resultTypeBadge.category.label}
                          </span>
                        </div>
                        {result.description && (
                          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}

              {/* Article Results Section */}
              {articleResults.length > 0 && (
                <div className={commentResults.length > 0 ? "border-b border-gray-100" : ""}>
                  {categoryResults.length > 0 && (
                    <div className="px-5 py-2 bg-gray-50">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Content
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {articleResults.map((result, idx) => {
                      const index = categoryResults.length + idx;
                      const badge = resultTypeBadge[result.resultType];
                      
                      return (
                        <Link
                          key={`${result.resultType}-${result.category.slug}-${result.slug}`}
                          data-result
                          to={getResultUrl(result)}
                          onClick={onClose}
                          className={cn(
                            "flex gap-4 px-5 py-4 transition-colors",
                            selectedIndex === index
                              ? "bg-teal-50"
                              : "hover:bg-gray-50"
                          )}
                        >
                          {/* Thumbnail or Icon */}
                          {result.heroImage ? (
                            <img
                              src={result.heroImage}
                              alt=""
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <div className={cn(
                              "w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0",
                              result.resultType === "report" ? "bg-navy-100" :
                              result.resultType === "faq" ? "bg-gray-100" :
                              "bg-teal-100"
                            )}>
                              {result.resultType === "report" && (
                                <ReportIcon className="w-7 h-7 text-navy-700" />
                              )}
                              {result.resultType === "faq" && (
                                <FAQIcon className="w-7 h-7 text-gray-600" />
                              )}
                              {result.resultType === "article" && (
                                <ArticleIcon className="w-7 h-7 text-teal-600" />
                              )}
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
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
                            
                            {/* Title */}
                            <h3 className="font-medium text-gray-900 line-clamp-1">
                              {result.title}
                            </h3>
                            
                            {/* Excerpt */}
                            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                              {result.excerpt}
                            </p>
                            
                            {/* Meta */}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
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
                </div>
              )}

              {/* Comment Results Section */}
              {commentResults.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Comments
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {commentResults.map((result, idx) => {
                      const index = categoryResults.length + articleResults.length + idx;
                      
                      return (
                        <Link
                          key={`comment-${result.id}`}
                          data-result
                          to={getResultUrl(result)}
                          onClick={onClose}
                          className={cn(
                            "flex gap-4 px-5 py-4 transition-colors",
                            selectedIndex === index
                              ? "bg-gray-100"
                              : "hover:bg-gray-50"
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <CommentIcon className="w-5 h-5 text-gray-500" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                "text-xs font-medium px-2 py-0.5 rounded",
                                resultTypeBadge.comment.bg,
                                resultTypeBadge.comment.text
                              )}>
                                {resultTypeBadge.comment.label}
                              </span>
                              <span className="text-xs text-gray-400">
                                on {result.post.title.slice(0, 40)}{result.post.title.length > 40 ? "..." : ""}
                              </span>
                            </div>
                            
                            {/* Comment content */}
                            <p className="text-sm text-gray-700 line-clamp-2">
                              "{result.content}"
                            </p>
                            
                            {/* Meta */}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
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
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Enter</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Esc</kbd>
              to close
            </span>
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-3">
              {categoryResults.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  {categoryResults.length} category
                </span>
              )}
              {articleResults.filter(r => r.resultType === "article").length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  {articleResults.filter(r => r.resultType === "article").length} article{articleResults.filter(r => r.resultType === "article").length !== 1 ? "s" : ""}
                </span>
              )}
              {articleResults.filter(r => r.resultType === "report").length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-navy-400"></span>
                  {articleResults.filter(r => r.resultType === "report").length} report{articleResults.filter(r => r.resultType === "report").length !== 1 ? "s" : ""}
                </span>
              )}
              {commentResults.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  {commentResults.length} comment{commentResults.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
