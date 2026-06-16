import { Link } from "react-router";
import { cn } from "~/utils/cn";

export interface CategoryPillProps {
  category: {
    slug: string;
    name: string;
  };
  isActive?: boolean;
  size?: "sm" | "md";
  className?: string;
  /**
   * Render as a plain span instead of a link. Use when the pill is nested
   * inside another anchor (e.g. a card-wide link) to avoid invalid nested
   * <a> elements, which break hydration.
   */
  asLink?: boolean;
}

const sizes = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

/**
 * Category navigation pill
 * Used in nav bars and article cards
 */
export function CategoryPill({
  category,
  isActive = false,
  size = "md",
  className,
  asLink = true,
}: CategoryPillProps) {
  const classes = cn(
    "rounded-full font-medium transition-colors whitespace-nowrap",
    sizes[size],
    isActive
      ? "bg-green-600 text-white"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
    className
  );

  if (!asLink) {
    return <span className={cn("inline-block", classes)}>{category.name}</span>;
  }

  return (
    <Link to={`/${category.slug}`} className={classes}>
      {category.name}
    </Link>
  );
}
