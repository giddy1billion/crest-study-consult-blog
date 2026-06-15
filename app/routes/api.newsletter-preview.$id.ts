/**
 * Newsletter Preview API Route
 * 
 * Returns the HTML preview of a newsletter for rendering in the admin UI.
 * Protected by admin authentication.
 */

import type { Route } from "./+types/api.newsletter-preview.$id";
import { requireAdmin } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { getNewsletterHtml } from "~/utils/email.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);

  const newsletter = await db.newsletter.findUnique({
    where: { id: params.id },
    include: {
      post: {
        select: {
          title: true,
          slug: true,
          excerpt: true,
          heroImage: true,
          heroImageAlt: true,
          metaTitle: true,
          metaDescription: true,
          readingTimeMin: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (!newsletter) {
    return new Response("Newsletter not found", { status: 404 });
  }

  // Generate preview HTML (no tracking)
  const html = getNewsletterHtml({
    post: newsletter.post,
    trackingId: null,
    preheader: newsletter.preheader || undefined,
  });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-cache",
    },
  });
}
