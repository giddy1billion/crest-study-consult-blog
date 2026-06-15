import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Homepage
  index("routes/home.tsx"),
  
  // Static pages
  route("sitemap.xml", "routes/sitemap.ts"),
  route("feed.xml", "routes/feed.ts"),
  route("robots.txt", "routes/robots.ts"),
  
  // API routes
  route("api/newsletter", "routes/api.newsletter.ts"),
  route("api/newsletter-track/:trackingId", "routes/api.newsletter-track.$trackingId.ts"),
  route("api/newsletter-click", "routes/api.newsletter-click.ts"),
  route("api/newsletter-unsubscribe/:trackingId", "routes/api.newsletter-unsubscribe.$trackingId.ts"),
  route("api/newsletter-preview/:id", "routes/api.newsletter-preview.$id.ts"),
  route("api/email-debug", "routes/api.email-debug.ts"),
  route("api/search", "routes/api.search.ts"),
  route("api/comments", "routes/api.comments.ts"),
  route("api/health", "routes/api.health.ts"),
  route("api/article-stats", "routes/api.article-stats.ts"),
  route("api/media", "routes/api.media.ts"),
  
  // Super Admin API (external access only)
  route("api/super/users", "routes/api.super.users.ts"),
  route("api/super/authors", "routes/api.super.authors.ts"),
  route("api/super/deletions", "routes/api.super.deletions.ts"),
  route("api/super/audit", "routes/api.super.audit.ts"),
  
  // Research library
  route("market-intelligence", "routes/market-intelligence.tsx"),
  route("market-intelligence/:slug", "routes/market-intelligence-report.tsx"),
  
  // Search page
  route("search", "routes/search.tsx"),
  
  // Comment RSS feeds
  route("feed/comments/:slug", "routes/feed.comments.$slug.ts"),
  
  // OG Image generation
  route("og-image", "routes/og-image.ts"),
  route("og/research/:slug", "routes/og.research.$slug.ts"),
  route("og/:category/:slug", "routes/og.$category.$slug.ts"),
  
  // Author and Tag pages
  route("author/:slug", "routes/author.$slug.tsx"),
  route("tag/:slug", "routes/tag.$slug.tsx"),
  
  // Research Library (Phase 5)
  route("research", "routes/research-library.tsx"),
  route("research/:slug", "routes/research.$slug.tsx"),
  route("cities/:slug", "routes/cities.$slug.tsx"),
  
  // Admin routes (Phase 3)
  route("admin/login", "routes/admin-login.tsx"),
  layout("routes/admin-layout.tsx", [
    route("admin", "routes/admin-dashboard.tsx"),
    route("admin/articles", "routes/admin-articles.tsx"),
    route("admin/articles/new", "routes/admin-article-new.tsx"),
    route("admin/articles/:id/edit", "routes/admin-article-edit.tsx"),
    route("admin/content-library", "routes/admin-content-library.tsx"),
    route("admin/comments", "routes/admin-comments.tsx"),
    route("admin/newsletters", "routes/admin-newsletters.tsx"),
    route("admin/newsletter/:id", "routes/admin-newsletter.$id.tsx"),
    route("admin/logout", "routes/admin-logout.tsx"),
    // Admin 404 catch-all (must be last in layout)
    route("admin/*", "routes/admin-not-found.tsx"),
  ]),
  
  // Dynamic routes - Category and Article pages
  // IMPORTANT: These must come LAST to avoid matching static routes
  route(":category", "routes/$category.tsx"),
  route(":category/:slug", "routes/$category.$slug.tsx"),
] satisfies RouteConfig;
