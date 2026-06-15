import type { Route } from "./+types/og.research.$slug";
import { db } from "~/utils/db.server";
import { BRAND } from "~/utils/constants";
import { generateOgImage } from "~/utils/image-optimizer.server";

/**
 * Per-report Open Graph image (research library).
 *
 * Serves the research report's cover image, cropped to the canonical
 * 1200×630 and compressed to ≤150 KB JPEG for reliable social previews.
 *
 * The URL is versioned by the caller (?v=<updatedAt>) so it can be cached
 * immutably while still refreshing whenever the cover changes.
 *
 * Usage: /og/research/:slug?v=<timestamp>
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { slug } = params;

  const report = await db.researchReport.findUnique({
    where: { slug, isPublished: true },
    select: { coverImage: true },
  });

  const coverUrl = report?.coverImage;

  // No cover image — fall back to the static brand OG image.
  if (!coverUrl) {
    return Response.redirect(BRAND.ogImage, 302);
  }

  try {
    // Bounded fetch: social scrapers time out quickly, so fail fast to the
    // static fallback rather than hanging on a slow origin.
    const res = await fetch(coverUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Cover fetch failed: ${res.status}`);
    }

    const og = await generateOgImage(await res.arrayBuffer());

    return new Response(new Uint8Array(og.buffer), {
      headers: {
        "Content-Type": og.mimeType,
        "Content-Length": String(og.size),
        // Immutable: the ?v= cache-buster changes when the cover changes.
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Research OG image generation failed:", error);
    return Response.redirect(BRAND.ogImage, 302);
  }
}
