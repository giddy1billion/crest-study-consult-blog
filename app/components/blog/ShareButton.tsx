import { useCallback, useState } from "react";
import { cn } from "~/utils/cn";
import { trackArticleShare } from "~/hooks";

export interface ShareButtonProps {
  url: string;
  title: string;
  slug?: string; // Article slug for tracking
  className?: string;
}

/**
 * Share Button with copy feedback
 * Provides share options: Twitter, LinkedIn, Copy Link
 * Tracks shares to database and Plausible analytics
 */
export function ShareButton({ url, title, slug, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  // Extract slug from URL if not provided
  const articleSlug = slug || url.split("/").pop() || "";

  const handleTwitterClick = useCallback(() => {
    if (articleSlug) {
      trackArticleShare(articleSlug, "twitter");
    }
  }, [articleSlug]);

  const handleLinkedInClick = useCallback(() => {
    if (articleSlug) {
      trackArticleShare(articleSlug, "linkedin");
    }
  }, [articleSlug]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (articleSlug) {
        trackArticleShare(articleSlug, "copy");
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      if (articleSlug) {
        trackArticleShare(articleSlug, "copy");
      }
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url, articleSlug]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm text-gray-500">Share:</span>
      
      {/* Twitter/X */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleTwitterClick}
        className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Share on Twitter"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      {/* LinkedIn */}
      <a
        href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkedInClick}
        className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Share on LinkedIn"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </a>

      {/* Copy Link */}
      <button
        onClick={handleCopy}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          copied
            ? "text-teal-600 bg-teal-50"
            : "text-gray-500 hover:text-teal-600 hover:bg-gray-100"
        )}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        {copied ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        )}
        
        {/* Tooltip */}
        {copied && (
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap">
            Link copied!
          </span>
        )}
      </button>
    </div>
  );
}
