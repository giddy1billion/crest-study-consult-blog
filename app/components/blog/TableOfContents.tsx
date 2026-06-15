import { useEffect, useState } from "react";
import { cn } from "~/utils/cn";

export interface TOCHeading {
  id: string;
  text: string;
  level: number;
}

export interface TableOfContentsProps {
  contentSelector?: string;
  className?: string;
}

/**
 * Dynamic Table of Contents
 * Parses H2/H3 headings from article content
 * Highlights active section based on scroll position
 */
export function TableOfContents({
  contentSelector = "#article-content",
  className,
}: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TOCHeading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Parse headings from content
  useEffect(() => {
    const content = document.querySelector(contentSelector);
    if (!content) return;

    const elements = content.querySelectorAll("h2, h3");
    const parsed: TOCHeading[] = [];

    elements.forEach((el, index) => {
      // Generate ID if not present
      if (!el.id) {
        el.id = `heading-${index}-${el.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 50)}`;
      }

      parsed.push({
        id: el.id,
        text: el.textContent || "",
        level: el.tagName === "H2" ? 2 : 3,
      });
    });

    setHeadings(parsed);
  }, [contentSelector]);

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-80px 0px -80% 0px",
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn("p-6 bg-gray-50 rounded-xl border border-gray-200", className)}
      aria-label="Table of contents"
    >
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        In this article
      </h3>
      <ul className="space-y-2">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={cn(heading.level === 3 && "ml-4")}
          >
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(heading.id);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                  // Update URL without triggering scroll
                  window.history.pushState(null, "", `#${heading.id}`);
                }
              }}
              className={cn(
                "block text-sm py-1 transition-colors duration-150",
                activeId === heading.id
                  ? "text-teal-600 font-medium"
                  : "text-gray-600 hover:text-teal-600"
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
