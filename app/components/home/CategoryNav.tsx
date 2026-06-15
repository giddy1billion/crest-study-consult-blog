import { Link } from "react-router";
import { cn } from "~/utils/cn";
import { CATEGORIES } from "~/utils/constants";

interface CategoryNavProps {
  activeCategory?: string;
  className?: string;
}

/**
 * Category Navigation Strip
 * PRD Section 6.3: 5 category pills, horizontally scrollable on mobile
 */
export function CategoryNav({ activeCategory, className }: CategoryNavProps) {
  return (
    <section className={cn("py-8 border-y border-gray-100 bg-gray-50", className)}>
      <div className="container-blog">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2 -mb-2">
          <span className="flex-shrink-0 text-sm font-medium text-gray-500">
            Explore:
          </span>
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              to={`/${category.slug}`}
              className={cn(
                "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
                activeCategory === category.slug
                  ? "bg-navy-700 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-teal-300 hover:text-teal-600"
              )}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
