import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "~/utils/cn";
import { BRAND, CATEGORIES } from "~/utils/constants";
import { SearchModal } from "./SearchModal";
import { NavigationProgress } from "./NavigationProgress";

interface HeaderProps {
  className?: string;
}

/**
 * Site Header with utility bar and navigation
 * Follows PRD Section 6.3: Utility bar + Primary navigation
 */
export function Header({ className }: HeaderProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll position for sticky header styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl + K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

    {/* Spacer to compensate for fixed header height */}
    <div className="h-[100px]" aria-hidden="true" />

    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isScrolled 
        ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/50" 
        : "bg-white border-b border-gray-100",
      className
    )}>
      {/* Navigation Progress Bar */}
      <NavigationProgress />
      {/* Utility Bar */}
      <div className="container-blog">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Wordmark */}
          <Link 
            to="/" 
            className="flex items-center gap-2 font-semibold text-gray-900 hover:text-teal-600 transition-colors"
          >
            <img 
              src={BRAND.logo} 
              alt={BRAND.name}
              className="h-8 w-auto"
            />
            <span className="hidden sm:inline text-lg">Research</span>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <button 
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 rounded-lg transition-colors border border-gray-200"
              aria-label="Search articles"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-gray-400 bg-white border border-gray-200 rounded">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>

            {/* CTA Button */}
            <a
              href={BRAND.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-navy-700 hover:bg-navy-800 rounded-lg transition-colors"
            >
              Book a consultation
            </a>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="border-t border-gray-100 bg-white">
        <div className="container-blog">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((category) => {
              const isActive = currentPath === `/${category.slug}` || currentPath.startsWith(`/${category.slug}/`);
              return (
                <Link
                  key={category.slug}
                  to={`/${category.slug}`}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                    isActive
                      ? "text-teal-600 bg-teal-50"
                      : "text-gray-600 hover:text-teal-600 hover:bg-teal-50"
                  )}
                >
                  {category.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
    </>
  );
}
