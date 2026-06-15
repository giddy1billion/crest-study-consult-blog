import type { Route } from "./+types/og-image";
import { BRAND } from "~/utils/constants";
import { db } from "~/utils/db.server";

/**
 * OG Image Generator
 * Generates dynamic Open Graph images for articles
 * 
 * Usage: /og-image?slug=article-slug&category=category-slug
 * or: /og-image?title=Custom%20Title
 * 
 * Returns an SVG image that can be used as og:image
 * Note: For production, consider using @vercel/og or similar
 * for PNG generation with more styling options
 */

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate text to fit in image
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Wrap text into multiple lines
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
    
    // Max 3 lines
    if (lines.length >= 2 && currentLine.length > 0) {
      lines.push(truncate(currentLine + " " + words.slice(words.indexOf(word) + 1).join(" "), maxCharsPerLine));
      break;
    }
  }
  
  if (currentLine && lines.length < 3) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const categorySlug = url.searchParams.get("category");
  const customTitle = url.searchParams.get("title");
  const customSubtitle = url.searchParams.get("subtitle");

  let title = customTitle || BRAND.shortName;
  let subtitle = customSubtitle || BRAND.positioning;
  let categoryName = "";

  // If slug provided, fetch article details
  if (slug && categorySlug) {
    const article = await db.post.findFirst({
      where: { slug, category: { slug: categorySlug } },
      select: { 
        title: true, 
        category: { select: { name: true } },
        readingTimeMin: true,
      },
    });

    if (article) {
      title = article.title;
      categoryName = article.category.name;
      subtitle = `${article.readingTimeMin || 5} min read · ${categoryName}`;
    }
  }

  // Wrap title for multi-line display
  const titleLines = wrapText(escapeXml(title), 35);
  const titleY = titleLines.length === 1 ? 320 : titleLines.length === 2 ? 290 : 260;
  const lineHeight = 65;

  // Generate SVG
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3a464f;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#2e383f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1E3563;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#5cb031;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4f9a2a;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Pattern overlay -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Accent bar -->
  <rect x="0" y="0" width="8" height="630" fill="url(#accent)"/>
  
  <!-- Content container -->
  <g transform="translate(80, 80)">
    <!-- Category badge (if present) -->
    ${categoryName ? `
    <rect x="0" y="0" width="${categoryName.length * 12 + 40}" height="40" rx="20" fill="rgba(255,255,255,0.15)"/>
    <text x="20" y="27" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.9)">${escapeXml(categoryName)}</text>
    ` : ""}
    
    <!-- Title -->
    ${titleLines.map((line, i) => `
    <text x="0" y="${titleY + i * lineHeight}" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="white">${line}</text>
    `).join("")}
    
    <!-- Subtitle -->
    <text x="0" y="${titleY + titleLines.length * lineHeight + 30}" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="rgba(255,255,255,0.7)">${escapeXml(truncate(subtitle, 60))}</text>
  </g>
  
  <!-- Brand -->
  <g transform="translate(80, 530)">
    <rect x="0" y="0" width="36" height="36" rx="8" fill="url(#accent)"/>
    <text x="18" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="white" text-anchor="middle">P</text>
    <text x="50" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="white">Crest Study Consult</text>
  </g>
  
  <!-- Domain -->
  <text x="1120" y="556" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="rgba(255,255,255,0.5)" text-anchor="end">blog.creststudyconsult.com</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=604800", // 1 day client, 7 days edge
    },
  });
}
