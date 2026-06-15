import { Link } from "react-router";
import { useState } from "react";
import { cn } from "~/utils/cn";

interface ResearchModuleProps {
  className?: string;
}

// Destination data for study-intelligence snapshots.
// Figures are indicative — confirm current official rules before relying on them.
const CITY_DATA = {
  "united-kingdom": {
    name: "United Kingdom",
    trends: [
      { stat: "Moderate", description: "Student visa difficulty (indicative)", source: "Crest Study Consult — confirm current rules" },
      { stat: "Post-study", description: "Graduate Route work rights available", source: "UK Home Office" },
      { stat: "Varies", description: "Tuition by course and university", source: "Crest Study Consult" },
    ],
    report: {
      slug: "study-in-the-uk-guide",
      title: "Studying in the UK: admissions, visas, and post-study work",
      excerpt: "A structured overview of UK universities, the Student visa route, tuition ranges, and the Graduate Route for international students.",
      category: "Destination Report",
      readingTimeMin: 16,
      publishedAt: "June 2026",
    },
  },
  canada: {
    name: "Canada",
    trends: [
      { stat: "Moderate", description: "Study permit difficulty (indicative)", source: "Crest Study Consult — confirm current rules" },
      { stat: "PGWP", description: "Post-graduation work permit pathway", source: "IRCC" },
      { stat: "Varies", description: "Tuition by province and institution", source: "Crest Study Consult" },
    ],
    report: {
      slug: "canada-study-permit-requirements",
      title: "Canada study permit: requirements, funds, and processing",
      excerpt: "What international students need for a Canadian study permit, from letters of acceptance and proof of funds to biometrics and timelines.",
      category: "Destination Report",
      readingTimeMin: 15,
      publishedAt: "June 2026",
    },
  },
  germany: {
    name: "Germany",
    trends: [
      { stat: "Moderate", description: "Student visa difficulty (indicative)", source: "Crest Study Consult — confirm current rules" },
      { stat: "18 months", description: "Job-seeking residence after graduation", source: "German Federal Foreign Office" },
      { stat: "Often €0", description: "Tuition at many public universities", source: "Crest Study Consult" },
    ],
    report: {
      slug: "germany-public-university-tuition",
      title: "Studying in Germany: tuition-free public universities explained",
      excerpt: "How Germany's tuition-free public universities work for international students, and the living costs you still need to budget for.",
      category: "Destination Report",
      readingTimeMin: 14,
      publishedAt: "June 2026",
    },
  },
} as const;

type CityKey = keyof typeof CITY_DATA;

/**
 * Research & Market Intelligence Module
 * PRD Section 6.3: 2-column. Left: city selector + trend snapshot. Right: latest research report preview
 */
export function ResearchModule({ className }: ResearchModuleProps) {
  const [activeCity, setActiveCity] = useState<CityKey>("united-kingdom");
  
  const cityData = CITY_DATA[activeCity];
  const { trends, report } = cityData;

  return (
    <section className={cn("py-12 lg:py-16 bg-gray-50", className)}>
      <div className="container-blog">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Study intelligence
            </h2>
            <p className="mt-1 text-gray-600">
              Destination insights from Crest Study Consult
            </p>
          </div>
          <Link
            to="/study-intelligence"
            prefetch="intent"
            className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-teal-600 border border-teal-200 bg-white hover:bg-teal-50 rounded-lg transition-colors"
          >
            Research library
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Trend Snapshots */}
          <div className="lg:col-span-2 space-y-6">
            {/* City Selector */}
            <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-gray-200 w-fit">
              {(Object.keys(CITY_DATA) as CityKey[]).map((cityKey) => (
                <button
                  key={cityKey}
                  onClick={() => setActiveCity(cityKey)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    activeCity === cityKey
                      ? "text-white bg-green-600"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  {CITY_DATA[cityKey].name}
                </button>
              ))}
            </div>

            {/* Trend Stats */}
            <div className="space-y-4">
              {trends.map((trend, index) => (
                <div 
                  key={`${activeCity}-${index}`}
                  className="p-4 bg-white rounded-xl border border-gray-200 transition-all"
                >
                  <div className="text-3xl font-bold text-teal-600">
                    {trend.stat}
                  </div>
                  <p className="mt-1 text-gray-900 font-medium">
                    {trend.description}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Source: {trend.source}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Latest Research Report */}
          <div className="lg:col-span-3">
            <Link 
              to={`/study-intelligence/${report.slug}`}
              prefetch="intent"
              className="group block h-full bg-white rounded-2xl border border-gray-200 overflow-hidden transition-shadow hover:shadow-lg"
            >
              {/* Report Header */}
              <div className="p-6 lg:p-8 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-100 rounded-full">
                    {report.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    {report.publishedAt}
                  </span>
                </div>
                
                <h3 className="mt-4 text-xl lg:text-2xl font-bold text-gray-900 leading-tight group-hover:text-teal-600 transition-colors">
                  {report.title}
                </h3>
                
                <p className="mt-3 text-gray-600 leading-relaxed">
                  {report.excerpt}
                </p>
              </div>

              {/* Report Footer */}
              <div className="p-6 lg:p-8 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {report.readingTimeMin} min read
                  </span>
                  <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 group-hover:bg-teal-700 rounded-lg transition-colors">
                    Read report
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
