import { Link } from "react-router";
import { cn } from "~/utils/cn";
import { BRAND, CATEGORIES } from "~/utils/constants";

interface FooterProps {
  className?: string;
}

/**
 * Site Footer
 * Follows PRD Section 6.3: Trust strip + Footer
 */
export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("bg-gray-900 text-white", className)}>
      {/* Main Footer Content */}
      <div className="container-blog py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <Link to="/" prefetch="intent" className="inline-block">
              <img 
                src={BRAND.logo} 
                alt={BRAND.name}
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>
            <p className="mt-4 text-sm text-gray-300 leading-relaxed">
              {BRAND.tagline}
            </p>
            <p className="mt-4 text-xs text-gray-400 italic">
              {BRAND.footerNote}
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Categories
            </h3>
            <ul className="space-y-3">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    to={`/${category.slug}`}
                    prefetch="intent"
                    className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/study-intelligence"
                  prefetch="intent"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                >
                  Research Library
                </Link>
              </li>
              <li>
                <a
                  href={BRAND.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                >
                  Book a consultation
                </a>
              </li>
              <li>
                <Link
                  to="/feed.xml"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                >
                  RSS Feed
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/privacy"
                  prefetch="intent"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  prefetch="intent"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors"
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <a
                  href={BRAND.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-300 hover:text-teal-400 transition-colors inline-flex items-center gap-1"
                >
                  LinkedIn
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              © {currentYear} {BRAND.legalName}. All rights reserved.
            </p>
            <p className="text-sm text-gray-400">
              {BRAND.domain}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
