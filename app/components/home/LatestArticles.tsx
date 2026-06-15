import { Link } from "react-router";
import { cn } from "~/utils/cn";
import { ArticleCard } from "~/components/blog/ArticleCard";
import type { ArticleListItem } from "~/types";

interface LatestArticlesProps {
  articles?: ArticleListItem[];
  className?: string;
}

/**
 * Latest Articles Grid
 * PRD Section 6.3: 6 cards, 3-column desktop, 1-column mobile
 * Sorted by publishedAt DESC
 */
export function LatestArticles({ articles, className }: LatestArticlesProps) {
  // Placeholder data for initial build
  const latestArticles: ArticleListItem[] = articles || [
    {
      slug: "us-f1-student-visa-process",
      title: "The US F-1 student visa process explained step by step",
      excerpt: "From I-20 issuance to the visa interview, here is how international students secure an F-1 visa to study in the United States.",
      heroImage: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=400&fit=crop",
      heroImageAlt: "Student reviewing US university application materials",
      readingTimeMin: 9,
      publishedAt: new Date("2026-06-06T09:00:00.000Z"),
      category: { slug: "visa-immigration", name: "Visa & Immigration" },
    },
    {
      slug: "university-application-checklist",
      title: "The complete university application checklist for international students",
      excerpt: "A step-by-step checklist covering transcripts, references, personal statements, and deadlines for studying abroad.",
      heroImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=400&fit=crop",
      heroImageAlt: "Student completing a university application on a laptop",
      readingTimeMin: 6,
      publishedAt: new Date("2026-06-05T09:00:00.000Z"),
      category: { slug: "admissions", name: "Admissions" },
    },
    {
      slug: "cheapest-countries-to-study-abroad",
      title: "The most affordable countries to study abroad in 2026",
      excerpt: "A comparison of tuition and living costs across Germany, Ireland, and other affordable study destinations.",
      heroImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
      heroImageAlt: "Cost comparison chart for studying abroad",
      readingTimeMin: 12,
      publishedAt: new Date("2026-06-04T09:00:00.000Z"),
      category: { slug: "study-intelligence", name: "Study Intelligence" },
    },
    {
      slug: "germany-public-university-tuition",
      title: "Studying in Germany: tuition-free public universities explained",
      excerpt: "How Germany's tuition-free public universities work for international students, and the costs you still need to budget for.",
      heroImage: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=600&h=400&fit=crop",
      heroImageAlt: "University campus building in Germany",
      readingTimeMin: 7,
      publishedAt: new Date("2026-06-03T09:00:00.000Z"),
      category: { slug: "study-destinations", name: "Study Destinations" },
    },
    {
      slug: "proof-of-funds-for-student-visa",
      title: "Proof of funds for a student visa: what you need to show",
      excerpt: "A guide to bank statements, sponsorship letters, and financial requirements across major study destinations.",
      heroImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop",
      heroImageAlt: "Bank statements and financial documents for a visa application",
      readingTimeMin: 8,
      publishedAt: new Date("2026-06-02T09:00:00.000Z"),
      category: { slug: "visa-immigration", name: "Visa & Immigration" },
    },
    {
      slug: "writing-a-strong-personal-statement",
      title: "How to write a strong personal statement for university",
      excerpt: "A structured approach to writing a compelling personal statement that strengthens your international university application.",
      heroImage: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=400&fit=crop",
      heroImageAlt: "Student writing a university personal statement",
      readingTimeMin: 6,
      publishedAt: new Date("2026-06-01T09:00:00.000Z"),
      category: { slug: "admissions", name: "Admissions" },
    },
  ];

  return (
    <section className={cn("py-12 lg:py-16", className)}>
      <div className="container-blog">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Latest research
          </h2>
          <Link
            to="/study-intelligence"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1"
          >
            View all
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestArticles.map((article) => (
            <ArticleCard
              key={article.slug}
              article={article}
              variant="default"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
