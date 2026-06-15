import { marked } from "marked";

/**
 * Markdown to HTML utility
 * Server-side only - converts Markdown content to sanitized HTML
 */

// Configure marked with custom image renderer for v18+
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    image(token) {
      const { href, title, text } = token;
      const alt = text || "";
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${href}" alt="${alt}"${titleAttr} loading="lazy" class="rounded-xl">`;
    },
  },
});

/**
 * Check if content appears to be HTML
 * Simple heuristic: if it starts with a tag or contains common HTML elements
 */
function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  // Check if starts with HTML doctype or tag
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return true;
  }
  // Check for common block-level HTML tags at the start
  const htmlBlockTags = /^<(div|p|h[1-6]|article|section|header|footer|main|aside|nav|ul|ol|table|blockquote|figure|pre)/i;
  if (htmlBlockTags.test(trimmed)) {
    return true;
  }
  // Check if content has significant HTML structure (but not markdown image syntax)
  // Filter out markdown image patterns before counting
  const contentWithoutMdImages = content.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  const htmlDensity = (contentWithoutMdImages.match(/<[a-zA-Z][^>]*>/g) || []).length;
  const mdHeadingsDensity = (content.match(/^#{1,6}\s/gm) || []).length;
  const mdImageDensity = (content.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  
  // If there are many HTML tags and few markdown elements, probably HTML
  if (htmlDensity > 5 && mdHeadingsDensity === 0 && mdImageDensity === 0) {
    return true;
  }
  
  return false;
}

/**
 * Convert Markdown content to HTML
 * If content is already HTML, returns it as-is but still processes markdown images
 * 
 * @param content - Raw content (Markdown or HTML)
 * @returns HTML string ready for rendering
 */
export function parseMarkdown(content: string): string {
  if (!content) {
    return "";
  }

  // Check for markdown images: ![alt](url) or ![alt](url "title")
  const markdownImagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;
  const hasMarkdownImages = markdownImagePattern.test(content);
  
  // Helper to convert markdown images to HTML
  const convertMarkdownImages = (text: string) => {
    return text.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, alt, src, title) => {
        const titleAttr = title ? ` title="${title}"` : "";
        return `<img src="${src}" alt="${alt || ""}"${titleAttr} loading="lazy" class="rounded-xl">`;
      }
    );
  };
  
  // ALWAYS check for markdown images first and convert them
  // This handles mixed HTML + markdown content
  if (hasMarkdownImages) {
    content = convertMarkdownImages(content);
  }
  
  // If content is already HTML, return (now with images converted)
  if (isHtmlContent(content)) {
    return content;
  }

  // Parse full Markdown to HTML
  const html = marked.parse(content, { async: false }) as string;
  
  return html;
}

/**
 * Parse Markdown content in the loader and return processed HTML
 * Use this in route loaders to prepare content for rendering
 */
export function processArticleContent(article: {
  content: string;
  sourceNotes?: string | null;
}): {
  content: string;
  sourceNotes?: string | null;
} {
  return {
    ...article,
    content: parseMarkdown(article.content),
    sourceNotes: article.sourceNotes || null,
  };
}
