import type { Route } from "./+types/og.$category.$slug";
import { db } from "~/utils/db.server";
import { BRAND } from "~/utils/constants";
import { generateOgImage } from "~/utils/image-optimizer.server";

/**
 * Per-article Open Graph image.
 *
 * Serves the article's hero image, cropped to the canonical 1200×630 and
 * compressed to ≤150 KB JPEG so it renders instantly and reliably in social
 * link previews (Facebook, X, LinkedIn, WhatsApp, Slack, iMessage).
 *
 * The URL is versioned by the caller (?v=<updatedAt>) so it can be cached
 * immutably while still refreshing whenever the hero changes.
 *
 * Usage: /og/:category/:slug?v=<timestamp>
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { category, slug } = params;

  // Primary lookup: an article in the given category.
  let article = await db.post.findFirst({
    where: { slug, category: { slug: category } },
    select: { heroImage: true },
  });

  // Fallback: REPORT-type posts (e.g. /market-intelligence/:slug) whose
  // stored category may differ from the URL segment they render under.
  if (!article) {
    article = await db.post.findFirst({
      where: { slug, schemaType: "REPORT" },
      select: { heroImage: true },
    });
  }

  const heroUrl = article?.heroImage;

  // No hero on this article — fall back to the static brand OG image.
  if (!heroUrl) {
    return Response.redirect(BRAND.ogImage, 302);
  }

  try {
    // Bounded fetch: social scrapers time out quickly, so fail fast to the
    // static fallback rather than hanging on a slow origin.
    const res = await fetch(heroUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Hero fetch failed: ${res.status}`);
    }

    const og = await generateOgImage(await res.arrayBuffer());

    return new Response(new Uint8Array(og.buffer), {
      headers: {
        "Content-Type": og.mimeType,
        "Content-Length": String(og.size),
        // Immutable: the ?v= cache-buster changes when the hero changes.
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("OG image generation failed:", error);
    return Response.redirect(BRAND.ogImage, 302);
  }
}
