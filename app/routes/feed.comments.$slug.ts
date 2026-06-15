import type { Route } from "./+types/feed.comments.$slug";
import { BRAND, CACHE_HEADERS } from "~/utils/constants";
import { db } from "~/utils/db.server";

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
 * RSS Feed for Article Comments
 * Provides an RSS feed of approved comments for a specific article
 * 
 * URL: /feed/comments/{article-slug}
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;
  
  if (!slug) {
    throw new Response("Article slug is required", { status: 400 });
  }
  
  // Find the article
  const article = await db.post.findFirst({
    where: {
      slug,
      isPublished: true,
      commentsEnabled: true,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      category: { select: { slug: true } },
    },
  });
  
  if (!article) {
    throw new Response("Article not found or comments are disabled", { status: 404 });
  }
  
  const articleUrl = `${BRAND.url}/${article.category.slug}/${article.slug}`;
  const feedUrl = `${BRAND.url}/feed/comments/${article.slug}`;
  
  // Fetch approved comments
  const comments = await db.comment.findMany({
    where: {
      postId: article.id,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
    take: 50, // Last 50 comments
    select: {
      id: true,
      content: true,
      authorName: true,
      authorUrl: true,
      createdAt: true,
      parentId: true,
      parent: {
        select: { authorName: true },
      },
    },
  });
  
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Comments on "${escapeXml(article.title)}" — ${BRAND.name}</title>
    <description>Recent comments on the article "${escapeXml(article.title)}" from ${BRAND.name} readers.</description>
    <link>${articleUrl}#comments</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <lastBuildDate>${comments.length > 0 ? new Date(comments[0].createdAt).toUTCString() : new Date().toUTCString()}</lastBuildDate>
    <ttl>30</ttl>
    <managingEditor>research@creststudyconsult.com (${BRAND.name} Research Team)</managingEditor>
    <copyright>© ${new Date().getFullYear()} ${BRAND.legalName}. All rights reserved.</copyright>
    <image>
      <url>${BRAND.logo}</url>
      <title>${BRAND.name}</title>
      <link>${BRAND.url}</link>
      <width>144</width>
      <height>144</height>
    </image>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <generator>Crest Study Consult Blog Platform</generator>
${comments
  .map((comment) => {
    const isReply = comment.parentId !== null;
    const title = isReply 
      ? `${comment.authorName} replied to ${comment.parent?.authorName || "a comment"}`
      : `${comment.authorName} commented`;
    
    return `    <item>
      <title><![CDATA[${title}]]></title>
      <link>${articleUrl}#comment-${comment.id}</link>
      <guid isPermaLink="false">comment-${comment.id}</guid>
      <description><![CDATA[${comment.content}]]></description>
      <pubDate>${new Date(comment.createdAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(comment.authorName)}</dc:creator>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": CACHE_HEADERS.api, // Shorter cache for comments
      "X-Content-Type-Options": "nosniff",
    },
  });
}
