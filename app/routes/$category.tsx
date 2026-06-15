import type { Route } from "./+types/$category";
import { data, Link } from "react-router";
import { Header, Footer } from "~/components/layout";
import { ArticleCard, CategoryPill } from "~/components/blog";
import { FAQSchema } from "~/components/seo";
import { BRAND, CATEGORIES, SEO_DEFAULTS, CACHE_HEADERS } from "~/utils/constants";
import { getCategoryBySlug as getCategoryFromDb, getCategoryArticles } from "~/utils/queries.server";
import type { ArticleListItem, Category, FAQItem } from "~/types";

/**
 * Get category data from slug
 */
function getCategoryBySlug(slug: string): Category | undefined {
  const categoryMeta = CATEGORIES.find((c) => c.slug === slug);
  if (!categoryMeta) return undefined;

  // Map to full category object
  const categoryDescriptions: Record<string, string> = {
    "study-destinations":
      "Country and university guides for studying abroad in the UK, US, Canada, Australia, Germany, and Ireland.",
    "admissions":
      "Admission requirements, application steps, and entry pathways for international students.",
    "visa-immigration":
      "Student visa processes, documentation, and immigration guidance for each study destination.",
    "scholarships":
      "Scholarships, funding options, and financial aid for students studying abroad.",
    "study-intelligence":
      "Data-driven intelligence on destinations, visa difficulty, tuition, and scholarship availability.",
  };

  return {
    id: categoryMeta.slug,
    slug: categoryMeta.slug,
    name: categoryMeta.name,
    description: categoryDescriptions[categoryMeta.slug] || null,
    metaTitle: `${categoryMeta.name}${SEO_DEFAULTS.titleSuffix}`,
    metaDesc: categoryDescriptions[categoryMeta.slug] || null,
    faqBlock: null,
    updatedAt: new Date(),
  };
}

/**
 * Validate category exists
 */
function isValidCategory(slug: string): boolean {
  return CATEGORIES.some((c) => c.slug === slug);
}

/**
 * Category Meta Function
 */
export function meta({ data, params }: Route.MetaArgs) {
  if (!data?.category) {
    return [
      { title: SEO_DEFAULTS.notFoundTitle },
      { name: "robots", content: "noindex" },
    ];
  }

  const { category } = data;
  const url = `${BRAND.url}/${category.slug}`;

  return [
    { title: category.metaTitle || `${category.name}${SEO_DEFAULTS.titleSuffix}` },
    { name: "description", content: category.description || "" },

    // Open Graph
    { property: "og:title", content: category.metaTitle || category.name },
    { property: "og:description", content: category.description || "" },
    { property: "og:image", content: BRAND.ogImage },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: "en_NG" },

    // Twitter
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:title", content: category.metaTitle || category.name },
    { name: "twitter:description", content: category.description || "" },
    { name: "twitter:image", content: BRAND.ogImage },

    // Canonical
    { tagName: "link", rel: "canonical", href: url },

    // Additional
    { name: "robots", content: "index, follow" },
  ];
}

/**
 * Category Loader
 * Fetches category and articles directly from database via Prisma
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { category: categorySlug } = params;

  // Validate category exists in constants
  if (!categorySlug || !isValidCategory(categorySlug)) {
    throw new Response("Category not found", { status: 404 });
  }

  // Fetch category from database (includes article count)
  const categoryFromDb = await getCategoryFromDb(categorySlug);
  
  // Fall back to constants if not in database yet
  const category = categoryFromDb 
    ? {
        id: categoryFromDb.id,
        slug: categoryFromDb.slug,
        name: categoryFromDb.name,
        description: categoryFromDb.description,
        metaTitle: categoryFromDb.metaTitle,
        metaDesc: categoryFromDb.metaDesc,
        faqBlock: categoryFromDb.faqBlock,
        updatedAt: categoryFromDb.updatedAt,
      }
    : getCategoryBySlug(categorySlug);

  if (!category) {
    throw new Response("Category not found", { status: 404 });
  }

  // Fetch articles from database
  const { articles, total } = await getCategoryArticles(categorySlug, 1, 12);

  return data(
    {
      category,
      articles,
      totalCount: total,
    },
    {
      headers: {
        "Cache-Control": CACHE_HEADERS.page,
      },
    }
  );
}

/**
 * Category Page Component
 */
export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, articles, totalCount } = loaderData;

  // Parse category FAQ if exists
  const categoryFaqs: FAQItem[] = category.faqBlock
    ? (category.faqBlock as FAQItem[])
    : [];

  return (
    <>
      {/* Structured Data - OrganizationSchema handled by root.tsx */}
      {categoryFaqs.length > 0 && <FAQSchema faqs={categoryFaqs} />}

      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Category Header */}
          <section className="py-12 lg:py-16 bg-gray-50 border-b border-gray-100">
            <div className="container-blog">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <Link to="/" className="hover:text-teal-600 transition-colors">
                  Home
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">{category.name}</span>
              </nav>

              <div className="max-w-3xl">
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  {category.name}
                </h1>
                {category.description && (
                  <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                    {category.description}
                  </p>
                )}
                <p className="mt-4 text-sm text-gray-500">
                  {totalCount} {totalCount === 1 ? "article" : "articles"}
                </p>
              </div>
            </div>
          </section>

          {/* Articles Grid */}
          <section className="py-12 lg:py-16">
            <div className="container-blog">
              {articles.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-500">No articles published yet in this category.</p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 mt-4 text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to homepage
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map((article) => (
                    <ArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Category Navigation */}
          <section className="py-8 border-t border-gray-100 bg-gray-50">
            <div className="container-blog">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Explore other categories
              </h2>
              <div className="flex flex-wrap gap-3">
                {CATEGORIES.filter((c) => c.slug !== category.slug).map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/${cat.slug}`}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:border-teal-300 hover:text-teal-600 transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
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
 * Error Boundary for Category Page
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-gray-900">Category not found</h1>
            <p className="mt-4 text-gray-600 max-w-md mx-auto">
              The category you're looking for doesn't exist or may have been moved.
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


