import type { Route } from "./+types/robots";
import { BRAND } from "~/utils/constants";

/**
 * Robots.txt Generator
 * PRD Section 7.5: Search engine crawling instructions
 */
export async function loader({}: Route.LoaderArgs) {
  const baseUrl = BRAND.url;

  const robotsTxt = `# Robots.txt for ${BRAND.name}
# ${baseUrl}

User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Block admin routes
Disallow: /admin
Disallow: /admin/*

# Block API routes
Disallow: /api/*

# Allow all major crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /

User-agent: DuckDuckBot
Allow: /
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
