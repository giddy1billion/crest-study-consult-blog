---
applyTo: "app/**/*.ts,app/**/*.tsx,app/routes/**"
description: "Crest Study Consult React Router 7 architecture patterns. Use when: creating routes, loaders, actions, or structuring the application for blog.creststudyconsult.com."
---

# Crest Study Consult React Router 7 Architecture

## CRITICAL: File Naming Rules

> Do NOT use `[.]` bracket syntax, `._index` suffix, or `.$param` in filenames.
> React Router 7's explicit `route()` config in `routes.ts` does not use Remix flat-routes conventions.
>
> ❌ WRONG: `sitemap[.]xml.ts`, `study-intelligence._index.tsx`, `study-intelligence.$slug.tsx`
> ✅ CORRECT: `sitemap.ts`, `study-intelligence.tsx`, `study-intelligence-report.tsx`
>
> URL paths and dynamic segments are defined in `routes.ts`, not in the filename.

## routes.ts Configuration

```tsx
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("sitemap.xml", "routes/sitemap.ts"),
  route("feed.xml", "routes/feed.ts"),
  route("robots.txt", "routes/robots.ts"),

  route("study-intelligence", "routes/study-intelligence.tsx"),
  route("study-intelligence/:slug", "routes/study-intelligence-report.tsx"),

  // Dynamic routes LAST so they don't shadow static routes
  route(":category", "routes/$category.tsx"),
  route(":category/:slug", "routes/$category.$slug.tsx"),
] satisfies RouteConfig;
```

## Loader Pattern

```tsx
import type { Route } from "./+types/$category.$slug";
import { data } from "react-router";
import { db } from "~/utils/db.server";

export async function loader({ params }: Route.LoaderArgs) {
  const post = await db.post.findFirst({
    where: { slug: params.slug, category: { slug: params.category }, isPublished: true },
    include: { category: true, tags: true },
  });

  if (!post) throw new Response("Not Found", { status: 404 });

  return data(
    { post },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
```

## Meta Function Pattern

> Brand titles follow `"{Primary keyword phrase} — Crest Study Consult"`.
> Reference brand constants from `~/utils/constants` (`BRAND`, `SEO_DEFAULTS`) rather than hardcoding.

```tsx
import type { Route } from "./+types/$category.$slug";
import { BRAND, SEO_DEFAULTS } from "~/utils/constants";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.post) return [{ title: SEO_DEFAULTS.notFoundTitle }];
  const { post } = data;
  const base = BRAND.url; // https://blog.creststudyconsult.com
  return [
    { title: post.metaTitle || `${post.title}${SEO_DEFAULTS.titleSuffix}` },
    { name: "description", content: post.metaDescription ?? "" },
    { property: "og:title", content: post.metaTitle || post.title },
    { property: "og:description", content: post.metaDescription ?? "" },
    { property: "og:image", content: post.heroImage ?? BRAND.ogImage },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: BRAND.name }, // Crest Study Consult
    { name: "twitter:card", content: SEO_DEFAULTS.twitterCard },
    { tagName: "link", rel: "canonical", href: post.canonicalURL ?? `${base}/${post.category.slug}/${post.slug}` },
  ];
}
```

## Sitemap Resource Route

```tsx
// app/routes/sitemap.ts → URL /sitemap.xml
import type { Route } from "./+types/sitemap";
import { db } from "~/utils/db.server";

export async function loader({}: Route.LoaderArgs) {
  const posts = await db.post.findMany({
    where: { isPublished: true },
    select: { slug: true, category: { select: { slug: true } }, updatedAt: true, schemaType: true },
    orderBy: { publishedAt: "desc" },
  });
  const categories = await db.category.findMany({ select: { slug: true, updatedAt: true } });
  const base = "https://blog.creststudyconsult.com";

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>
  ${categories.map(c => `<url><loc>${base}/${c.slug}</loc><lastmod>${new Date(c.updatedAt).toISOString()}</lastmod><priority>0.9</priority><changefreq>weekly</changefreq></url>`).join("")}
  ${posts.map(p => `<url><loc>${base}/${p.category.slug}/${p.slug}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod><priority>${p.schemaType === "REPORT" ? "0.85" : "0.8"}</priority><changefreq>monthly</changefreq></url>`).join("")}
</urlset>`;

  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600, s-maxage=14400" },
  });
}
```

## Rules

- Throw proper HTTP Responses (404/500) — never render error states as 200
- Set `Cache-Control` on every loader response
- Use `*.server.ts` for all DB and secret access
