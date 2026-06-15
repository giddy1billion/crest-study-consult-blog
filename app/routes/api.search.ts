/**
 * Search API Route
 * 
 * GET /api/search?q={query}&category={slug}&limit={number}&unified={boolean}
 * 
 * Search articles, reports, and categories across all content
 */

import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { searchArticles, searchAll } from "~/utils/queries.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "12", 10), 50);
  const unified = url.searchParams.get("unified") === "true";

  // Require minimum query length
  if (query.length < 2) {
    return data(
      { 
        results: [], 
        query,
        message: "Search query must be at least 2 characters" 
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    // Use unified search (includes categories and comments) or article-only search
    const results = unified && !category
      ? await searchAll(query, limit)
      : await searchArticles(query, limit, category);

    // Serialize dates for JSON response
    const serializedResults = results.map((r) => {
      if ("publishedAt" in r) {
        return {
          ...r,
          publishedAt: r.publishedAt.toISOString(),
        };
      }
      if ("createdAt" in r) {
        return {
          ...r,
          createdAt: r.createdAt.toISOString(),
        };
      }
      return r;
    });

    return data(
      {
        results: serializedResults,
        query,
        total: results.length,
      },
      {
        headers: {
          // Short cache for search results
          "Cache-Control": "public, max-age=60, s-maxage=120",
        },
      }
    );
  } catch (error) {
    console.error("Search error:", error);
    return data(
      { 
        results: [], 
        query,
        error: "Search failed" 
      },
      { 
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
