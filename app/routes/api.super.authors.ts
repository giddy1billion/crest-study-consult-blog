/**
 * Super Admin API: Authors
 * 
 * Secure endpoints for managing authors.
 * Accessed externally via API key authentication.
 * 
 * Endpoints:
 * GET    /api/super/authors       - List all authors
 * POST   /api/super/authors       - Create new author
 * PATCH  /api/super/authors       - Update author (with id in body)
 * DELETE /api/super/authors       - Delete author (with id in body)
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";
import {
  requireApiAuth,
  parseJsonBody,
  apiError,
  apiSuccess,
  logAuditEvent,
} from "~/utils/api-auth.server";
import { generateSlug } from "~/utils/helpers";

// ============================================
// GET /api/super/authors - List all authors
// ============================================
export async function loader({ request }: LoaderFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const withStats = url.searchParams.get("withStats") === "true";

    const authors = await db.author.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        image: true,
        ...(withStats && {
          _count: {
            select: { posts: true },
          },
        }),
      },
      orderBy: { name: "asc" },
    });

    await logAuditEvent({
      action: "LIST_AUTHORS",
      resource: "authors",
      request,
    });

    return apiSuccess({ authors, count: authors.length });
  } catch (error) {
    console.error("Error listing authors:", error);
    return apiError("Failed to list authors", 500);
  }
}

// ============================================
// POST /api/super/authors - Create new author
// PATCH /api/super/authors - Update author
// DELETE /api/super/authors - Delete author
// ============================================
export async function action({ request }: ActionFunctionArgs) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const method = request.method.toUpperCase();

  // ---- CREATE AUTHOR ----
  if (method === "POST") {
    const { data: body, error: parseError } = await parseJsonBody<{
      name: string;
      slug?: string;
      bio?: string;
      image?: string;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { name, slug, bio, image } = body;

    // Validation
    if (!name || name.trim().length < 2) {
      return apiError("Name must be at least 2 characters");
    }

    // Generate slug if not provided
    const authorSlug = slug || generateSlug(name);

    // Check slug uniqueness
    const existing = await db.author.findUnique({ where: { slug: authorSlug } });
    if (existing) {
      return apiError("Author with this slug already exists");
    }

    try {
      const author = await db.author.create({
        data: {
          name: name.trim(),
          slug: authorSlug,
          bio: bio || null,
          image: image || null,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          bio: true,
          image: true,
        },
      });

      await logAuditEvent({
        action: "CREATE_AUTHOR",
        resource: "authors",
        resourceId: author.id,
        details: { name, slug: authorSlug },
        request,
      });

      return apiSuccess({ author }, 201);
    } catch (error) {
      console.error("Error creating author:", error);
      return apiError("Failed to create author", 500);
    }
  }

  // ---- UPDATE AUTHOR ----
  if (method === "PATCH") {
    const { data: body, error: parseError } = await parseJsonBody<{
      id: string;
      name?: string;
      slug?: string;
      bio?: string;
      image?: string;
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { id, name, slug, bio, image } = body;

    if (!id) {
      return apiError("Missing required field: id");
    }

    // Check author exists
    const existing = await db.author.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Author not found", 404);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (name.trim().length < 2) {
        return apiError("Name must be at least 2 characters");
      }
      updateData.name = name.trim();
    }

    if (slug !== undefined) {
      // Check slug uniqueness
      const slugTaken = await db.author.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugTaken) {
        return apiError("Slug already in use");
      }
      updateData.slug = slug;
    }

    if (bio !== undefined) {
      updateData.bio = bio || null;
    }

    if (image !== undefined) {
      updateData.image = image || null;
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("No fields to update");
    }

    try {
      const author = await db.author.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          slug: true,
          name: true,
          bio: true,
          image: true,
        },
      });

      await logAuditEvent({
        action: "UPDATE_AUTHOR",
        resource: "authors",
        resourceId: id,
        details: { fields: Object.keys(updateData) },
        request,
      });

      return apiSuccess({ author });
    } catch (error) {
      console.error("Error updating author:", error);
      return apiError("Failed to update author", 500);
    }
  }

  // ---- DELETE AUTHOR ----
  if (method === "DELETE") {
    const { data: body, error: parseError } = await parseJsonBody<{
      id: string;
      reassignTo?: string; // Author ID to reassign posts to
    }>(request);

    if (parseError || !body) {
      return apiError(parseError || "Invalid request body");
    }

    const { id, reassignTo } = body;

    if (!id) {
      return apiError("Missing required field: id");
    }

    const existing = await db.author.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (!existing) {
      return apiError("Author not found", 404);
    }

    // Check if author has posts
    if (existing._count.posts > 0) {
      if (!reassignTo) {
        return apiError(
          `Author has ${existing._count.posts} posts. Provide 'reassignTo' author ID to reassign them.`
        );
      }

      // Verify reassign target exists
      const targetAuthor = await db.author.findUnique({ where: { id: reassignTo } });
      if (!targetAuthor) {
        return apiError("Reassign target author not found", 404);
      }

      // Reassign all posts
      await db.post.updateMany({
        where: { authorId: id },
        data: { authorId: reassignTo },
      });
    }

    try {
      await db.author.delete({ where: { id } });

      await logAuditEvent({
        action: "DELETE_AUTHOR",
        resource: "authors",
        resourceId: id,
        details: {
          name: existing.name,
          postsReassigned: existing._count.posts,
          reassignedTo: reassignTo,
        },
        request,
      });

      return apiSuccess({ message: "Author deleted", postsReassigned: existing._count.posts });
    } catch (error) {
      console.error("Error deleting author:", error);
      return apiError("Failed to delete author", 500);
    }
  }

  return apiError("Method not allowed", 405);
}
