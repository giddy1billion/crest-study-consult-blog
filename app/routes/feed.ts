import type { Route } from "./+types/feed";
import { BRAND, CACHE_HEADERS } from "~/utils/constants";
import { getPostsForFeed } from "~/utils/queries.server";

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
 * RSS Feed Generator
 * PRD Section 7.5: RSS feed for content syndication
 * 
 * Implements RSS 2.0 with:
 * - atom:link for self-reference
 * - content:encoded for full article content
 * - media:content for hero images
 * - category tags per article
 */
export async function loader({}: Route.LoaderArgs) {
  const baseUrl = BRAND.url;

  // Fetch latest published articles with content
  const articles = await getPostsForFeed(20);

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${BRAND.name} Research</title>
    <description>Crest Study Consult — international education intelligence. Research and guides on study destinations, admissions, student visas, and scholarships.</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <managingEditor>research@creststudyconsult.com (${BRAND.name} Research Team)</managingEditor>
    <webMaster>tech@creststudyconsult.com (${BRAND.name} Tech Team)</webMaster>
    <copyright>© ${new Date().getFullYear()} ${BRAND.legalName}. All rights reserved.</copyright>
    <image>
      <url>${BRAND.logo}</url>
      <title>${BRAND.name}</title>
      <link>${baseUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <generator>Crest Study Consult Blog Platform</generator>
${articles
  .map(
    (article) => `    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${baseUrl}/${article.category.slug}/${article.slug}</link>
      <guid isPermaLink="true">${baseUrl}/${article.category.slug}/${article.slug}</guid>
      <description><![CDATA[${article.excerpt}]]></description>
      <content:encoded><![CDATA[${article.content}]]></content:encoded>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(article.author.name)}</dc:creator>
      <category>${escapeXml(article.category.name)}</category>${article.heroImage ? `
      <media:content url="${escapeXml(article.heroImage)}" medium="image" type="image/jpeg"/>
      <enclosure url="${escapeXml(article.heroImage)}" type="image/jpeg" length="0"/>` : ''}
    </item>`
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": CACHE_HEADERS.sitemap,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
