import type { Route } from "./+types/sitemap";
import { BRAND, CATEGORIES, CACHE_HEADERS } from "~/utils/constants";
import { 
  getAllPublishedPosts, 
  getAllCategories,
  getAllAuthorsWithPosts,
  getAllTagsWithPosts,
} from "~/utils/queries.server";

/**
 * Dynamic Sitemap Generator
 * PRD Section 7.5: XML sitemap with all published content
 */
export async function loader({}: Route.LoaderArgs) {
  const baseUrl = BRAND.url;

  // Fetch all data from database
  const [posts, categories, authors, tags] = await Promise.all([
    getAllPublishedPosts(),
    getAllCategories(),
    getAllAuthorsWithPosts(),
    getAllTagsWithPosts(),
  ]);

  // Static pages
  const staticPages = [
    { url: baseUrl, lastmod: new Date().toISOString(), priority: "1.0", changefreq: "daily" },
    { url: `${baseUrl}/study-intelligence`, lastmod: new Date().toISOString(), priority: "0.9", changefreq: "weekly" },
  ];

  // Category pages from database
  const categoryPages = categories.map((cat) => ({
    url: `${baseUrl}/${cat.slug}`,
    lastmod: cat.updatedAt.toISOString(),
    priority: "0.8",
    changefreq: "weekly",
  }));

  // Article pages from database
  const articlePages = posts.map((post) => ({
    url: `${baseUrl}/${post.category.slug}/${post.slug}`,
    lastmod: post.updatedAt.toISOString(),
    priority: "0.7",
    changefreq: "monthly",
  }));

  // Author pages
  const authorPages = authors.map((author) => ({
    url: `${baseUrl}/author/${author.slug}`,
    lastmod: new Date().toISOString(),
    priority: "0.5",
    changefreq: "monthly",
  }));

  // Tag pages
  const tagPages = tags.map((tag) => ({
    url: `${baseUrl}/tag/${tag.slug}`,
    lastmod: new Date().toISOString(),
    priority: "0.4",
    changefreq: "monthly",
  }));

  const allPages = [
    ...staticPages, 
    ...categoryPages, 
    ...articlePages,
    ...authorPages,
    ...tagPages,
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastmod.split("T")[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": CACHE_HEADERS.sitemap,
    },
  });
}
