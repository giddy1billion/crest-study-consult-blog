/**
 * Media Upload API Route
 * 
 * Handles file uploads to Supabase Storage.
 * Supports single and multiple file uploads.
 */

import type { Route } from "./+types/api.media";
import { data } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { 
  uploadFile, 
  uploadFiles, 
  deleteFile, 
  deleteFiles,
  updateMedia,
  isStorageConfigured,
} from "~/utils/storage.server";
import type { MediaFolder } from "@prisma/client";

// Valid folders for upload
const VALID_FOLDERS: MediaFolder[] = [
  "HERO_IMAGES",
  "CONTENT",
  "AUTHORS",
  "RESEARCH",
  "GENERAL",
];

/**
 * POST - Upload file(s)
 * DELETE - Delete file(s)
 * PATCH - Update metadata
 */
export async function action({ request }: Route.ActionArgs) {
  // Require authentication
  const user = await requireAdmin(request);
  
  // Check if storage is configured
  if (!isStorageConfigured()) {
    return data(
      { error: "Storage not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY." },
      { status: 503 }
    );
  }
  
  const method = request.method.toUpperCase();
  
  // ============================================
  // UPLOAD
  // ============================================
  if (method === "POST") {
    try {
      const formData = await request.formData();
      
      // Get upload options
      const folder = formData.get("folder") as MediaFolder;
      const alt = formData.get("alt") as string | null;
      const caption = formData.get("caption") as string | null;
      const tagsRaw = formData.get("tags") as string | null;
      const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
      
      // Validate folder
      if (!folder || !VALID_FOLDERS.includes(folder)) {
        return data(
          { error: `Invalid folder. Must be one of: ${VALID_FOLDERS.join(", ")}` },
          { status: 400 }
        );
      }
      
      // Get files
      const files = formData.getAll("file") as File[];
      
      if (!files.length || !(files[0] instanceof File) || !files[0].size) {
        return data({ error: "No file provided" }, { status: 400 });
      }
      
      const uploadOptions = {
        folder,
        alt: alt || undefined,
        caption: caption || undefined,
        tags,
        uploadedBy: user.id,
      };
      
      // Single or multiple upload
      if (files.length === 1) {
        const result = await uploadFile(files[0], uploadOptions);
        
        if (!result.success) {
          return data({ error: result.error }, { status: 400 });
        }
        
        return data({ 
          success: true, 
          media: result.media,
          message: "File uploaded successfully",
        });
      }
      
      // Multiple files
      const results = await uploadFiles(files, uploadOptions);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      return data({
        success: failed.length === 0,
        uploaded: successful.map(r => r.media),
        failed: failed.map(r => r.error),
        message: `${successful.length} of ${results.length} files uploaded`,
      });
      
    } catch (error) {
      console.error("Upload API error:", error);
      return data(
        { error: error instanceof Error ? error.message : "Upload failed" },
        { status: 500 }
      );
    }
  }
  
  // ============================================
  // DELETE
  // ============================================
  if (method === "DELETE") {
    try {
      const body = await request.json();
      const mediaIds = Array.isArray(body.ids) ? body.ids : [body.id];
      
      if (!mediaIds.length || !mediaIds.every((id: unknown) => typeof id === "string")) {
        return data({ error: "Invalid media ID(s)" }, { status: 400 });
      }
      
      if (mediaIds.length === 1) {
        const result = await deleteFile(mediaIds[0]);
        
        if (!result.success) {
          return data({ error: result.error }, { status: 400 });
        }
        
        return data({ success: true, message: "File deleted" });
      }
      
      // Multiple deletes
      const results = await deleteFiles(mediaIds);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      return data({
        success: failed.length === 0,
        deleted: successful.length,
        failed: failed.length,
        message: `${successful.length} of ${results.length} files deleted`,
      });
      
    } catch (error) {
      console.error("Delete API error:", error);
      return data(
        { error: error instanceof Error ? error.message : "Delete failed" },
        { status: 500 }
      );
    }
  }
  
  // ============================================
  // UPDATE METADATA
  // ============================================
  if (method === "PATCH") {
    try {
      const body = await request.json();
      const { id, alt, caption, tags } = body;
      
      if (!id || typeof id !== "string") {
        return data({ error: "Invalid media ID" }, { status: 400 });
      }
      
      const updated = await updateMedia(id, {
        alt: alt || undefined,
        caption: caption || undefined,
        tags: tags || undefined,
      });
      
      return data({ 
        success: true, 
        media: updated,
        message: "Metadata updated",
      });
      
    } catch (error) {
      console.error("Update API error:", error);
      return data(
        { error: error instanceof Error ? error.message : "Update failed" },
        { status: 500 }
      );
    }
  }
  
  return data({ error: "Method not allowed" }, { status: 405 });
}
