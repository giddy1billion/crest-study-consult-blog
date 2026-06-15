import type { Route } from "./+types/home";
import { data } from "react-router";
import { Header, Footer } from "~/components/layout";
import {
  HeroSlider,
  FeaturedStories,
  CategoryNav,
  LatestArticles,
  ResearchModule,
  HomeFAQ,
  NewsletterSection,
} from "~/components/home";
import { FAQSchema } from "~/components/seo";
import { BRAND, SEO_DEFAULTS, CATEGORIES, CACHE_HEADERS } from "~/utils/constants";
import {
  getHeroSliderArticles,
  getFeaturedStories,
  getLatestArticles,
  getResearchReports,
} from "~/utils/queries.server";

/**
 * Homepage Meta Function
 * SEO-optimized meta tags following PRD Section 7.5
 */
export function meta({}: Route.MetaArgs) {
  const title = SEO_DEFAULTS.homepageTitle;
  const description = SEO_DEFAULTS.homepageDescription;
  const url = BRAND.url;

  return [
    { title },
    { name: "description", content: description },
    
    // Open Graph
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: BRAND.ogImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: SEO_DEFAULTS.ogImageAlt },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND.name },
    { property: "og:locale", content: "en_NG" },
    
    // Twitter Card
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { name: "twitter:site", content: BRAND.twitterHandle },
    { name: "twitter:creator", content: BRAND.twitterHandle },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: BRAND.ogImage },
    { name: "twitter:image:alt", content: SEO_DEFAULTS.ogImageAlt },
    
    // Canonical
    { tagName: "link", rel: "canonical", href: url },
    
    // Additional SEO
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
    { name: "googlebot", content: "index, follow" },
    { name: "author", content: BRAND.name },
    { name: "publisher", content: BRAND.legalName },
    
    // Geo
    { name: "geo.region", content: "NG-LA" },
    { name: "geo.placename", content: "Lagos" },
  ];
}

/**
 * Homepage Links Function
 * Note: Hero image is dynamically loaded based on DB data
 */
export function links() {
  return [];
}

/**
 * Homepage Loader
 * Fetch featured articles and latest content from database
 */
export async function loader({}: Route.LoaderArgs) {
  const [heroArticles, featuredStories, latestArticles, researchReports] = await Promise.all([
    getHeroSliderArticles(5), // Get up to 5 articles for hero slider
    getFeaturedStories(),
    getLatestArticles(6),
    getResearchReports(3),
  ]);

  return data(
    {
      heroArticles,
      featuredStories,
      latestArticles,
      researchReports,
    },
    {
      headers: {
        // Shorter cache for homepage to reflect newly published articles quickly
        "Cache-Control": CACHE_HEADERS.homepage,
      },
    }
  );
}

/**
 * Homepage FAQ Schema Data
 * For JSON-LD structured data
 */
const homepageFAQs = [
  {
    question: "How do I choose the right country to study abroad?",
    answer: "Compare destinations on four factors: tuition and living costs, visa requirements and difficulty, post-study work rights, and the strength of your chosen course. Crest Study Consult counsels students through this comparison based on academic profile and budget, with current guidance for the UK, US, Canada, Australia, Germany, and Ireland.",
  },
  {
    question: "What documents do I need for an international university application?",
    answer: "Most universities require academic transcripts, proof of English proficiency (such as IELTS or TOEFL), a personal statement, academic or professional references, and a copy of your passport. Specific requirements vary by country and programme, so confirm each institution's checklist before you apply.",
  },
  {
    question: "How does the student visa process work?",
    answer: "After receiving an offer and accepting a place, you typically need a letter of acceptance, proof of funds, and a valid passport to apply for a student visa. Each destination has its own route — for example, the UK Student visa, the US F-1, and the Canadian study permit — with different processing times and biometric steps.",
  },
  {
    question: "Are scholarships available for international students?",
    answer: "Yes. Funding ranges from full scholarships to partial tuition waivers offered by governments, universities, and external organisations. Eligibility usually depends on academic merit, course, and destination. Crest Study Consult helps students identify and apply for scholarships suited to their profile.",
  },
  {
    question: "How can Crest Study Consult help with my application?",
    answer: "Crest Study Consult guides students from first contact to settlement abroad — shortlisting institutions, preparing applications and documents, advising on visa requirements, and identifying scholarships. The aim is a seamless journey from dream to destination with trusted, personalized support at every step.",
  },
];

/**
 * Homepage Component
 * Full landing page with all sections as defined in PRD Section 6.3
 */
export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {/* Structured Data - OrganizationSchema handled by root.tsx */}
      <FAQSchema faqs={homepageFAQs} />
      
      {/* Page Content */}
      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1">
          {/* 1. Editorial Hero Slider */}
          <HeroSlider 
            articles={loaderData.heroArticles} 
            interval={5000}
            pauseOnHover={true}
          />
          
          {/* 2. Featured Story Cluster */}
          <FeaturedStories 
            primary={loaderData.featuredStories.primary ?? undefined}
            supporting={loaderData.featuredStories.supporting}
          />
          
          {/* 3. Category Navigation Strip */}
          <CategoryNav />
          
          {/* 4. Latest Articles Grid */}
          <LatestArticles articles={loaderData.latestArticles} />
          
          {/* 5. Research & Market Intelligence Module */}
          <ResearchModule />
          
          {/* 6. FAQ / Knowledge Centre */}
          <HomeFAQ />
          
          {/* 7. Newsletter CTA */}
          <NewsletterSection />
        </main>
        
        <Footer />
      </div>
    </>
  );
}

/**
 * Error Boundary for Homepage
 */
export function ErrorBoundary() {
  return (
    <>
      {/* OrganizationSchema handled by root.tsx */}
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mt-4 text-gray-600 max-w-md mx-auto">
              We're having trouble loading the homepage. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
            >
              Refresh page
            </button>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
