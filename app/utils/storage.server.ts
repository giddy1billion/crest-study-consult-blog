/**
 * Supabase Storage Integration
 * 
 * Handles all file uploads to Supabase Storage buckets.
 * Used for hero images, content images, and research assets.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db.server";
import { optimizeImage } from "./image-optimizer.server";
import type { MediaFolder } from "@prisma/client";

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET_NAME = "csc-media";

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn("⚠️ Supabase credentials not configured. File uploads will fail.");
}

// Create Supabase client (server-side only with service key)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase credentials not configured");
  }
  
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
      realtime: {
        params: {
          eventsPerSecond: 0,
        },
      },
      // Disable realtime - we only use storage
      global: {
        headers: { "X-Client-Info": "crest-study-consult-blog/storage" },
      },
    });
  }
  
  return supabase;
}

// ============================================
// Types
// ============================================

export interface UploadOptions {
  folder: MediaFolder;
  alt?: string;
  caption?: string;
  tags?: string[];
  uploadedBy?: string;
}

export interface UploadResult {
  success: boolean;
  media?: {
    id: string;
    publicUrl: string;
    filename: string;
    storagePath: string;
    width?: number;
    height?: number;
    size: number;
    mimeType: string;
  };
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// ============================================
// Allowed file types and limits
// ============================================

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const RECOMMENDED_HERO_WIDTH = 1200;
const RECOMMENDED_HERO_HEIGHT = 630;

// Folder path mapping
const FOLDER_PATHS: Record<MediaFolder, string> = {
  HERO_IMAGES: "hero",
  CONTENT: "content",
  AUTHORS: "authors",
  RESEARCH: "research",
  GENERAL: "general",
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique filename with timestamp and random suffix.
 * Pass `overrideExtension` when the file is re-encoded (e.g. to "webp").
 */
function generateUniqueFilename(
  originalFilename: string,
  overrideExtension?: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension =
    overrideExtension ||
    originalFilename.split(".").pop()?.toLowerCase() ||
    "jpg";
  const baseName = originalFilename
    .replace(/\.[^.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9-]/g, "-") // Replace special chars with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .toLowerCase()
    .substring(0, 50); // Limit length
  
  return `${baseName}-${timestamp}-${randomSuffix}.${extension}`;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  
  return { valid: true };
}

// ============================================
// Main Upload Function
// ============================================

/**
 * Upload a file to Supabase Storage and create a Media record
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<UploadResult> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const client = getSupabaseClient();
    
    // Read the raw upload, then optimize (compress/resize) before storing.
    // Large or oversized images are re-encoded to high-quality WebP; small,
    // already-light images pass through untouched.
    const arrayBuffer = await file.arrayBuffer();
    const optimized = await optimizeImage(arrayBuffer, file.type);

    if (optimized.optimized) {
      const saved = optimized.originalSize - optimized.size;
      const pct = ((saved / optimized.originalSize) * 100).toFixed(0);
      console.log(
        `🗜️  Optimized ${file.name}: ${(optimized.originalSize / 1024).toFixed(0)}KB → ${(optimized.size / 1024).toFixed(0)}KB (-${pct}%)`
      );
    }

    // Generate storage path. When re-encoded, the extension follows the new
    // format so the stored object and its content type stay consistent.
    const folderPath = FOLDER_PATHS[options.folder];
    const uniqueFilename = generateUniqueFilename(
      file.name,
      optimized.optimized ? optimized.extension : undefined
    );
    const storagePath = `${folderPath}/${uniqueFilename}`;
    
    // Upload optimized bytes to Supabase Storage
    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(storagePath, optimized.buffer, {
        contentType: optimized.mimeType,
        cacheControl: "31536000", // 1 year cache
        upsert: false,
      });
    
    if (error) {
      console.error("Supabase upload error:", error);
      return { success: false, error: error.message };
    }
    
    // Get public URL
    const { data: urlData } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);
    
    // Create Media record in database
    const media = await db.media.create({
      data: {
        filename: file.name,
        storagePath: data.path,
        publicUrl: urlData.publicUrl,
        mimeType: optimized.mimeType,
        size: optimized.size,
        width: optimized.width,
        height: optimized.height,
        folder: options.folder,
        alt: options.alt,
        caption: options.caption,
        tags: options.tags || [],
        uploadedBy: options.uploadedBy,
      },
    });
    
    return {
      success: true,
      media: {
        id: media.id,
        publicUrl: media.publicUrl,
        filename: media.filename,
        storagePath: media.storagePath,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
        size: media.size,
        mimeType: media.mimeType,
      },
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload multiple files at once
 */
export async function uploadFiles(
  files: File[],
  options: UploadOptions
): Promise<UploadResult[]> {
  const results = await Promise.all(
    files.map(file => uploadFile(file, options))
  );
  return results;
}

// ============================================
// Delete Function
// ============================================

/**
 * Delete a file from Supabase Storage and remove Media record
 */
export async function deleteFile(mediaId: string): Promise<DeleteResult> {
  try {
    // Get media record
    const media = await db.media.findUnique({
      where: { id: mediaId },
    });
    
    if (!media) {
      return { success: false, error: "Media not found" };
    }
    
    // Delete from Supabase Storage
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(BUCKET_NAME)
      .remove([media.storagePath]);
    
    if (error) {
      console.error("Supabase delete error:", error);
      // Continue to delete DB record even if storage delete fails
    }
    
    // Delete Media record
    await db.media.delete({
      where: { id: mediaId },
    });
    
    return { success: true };
  } catch (error) {
    console.error("Delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Delete multiple files at once
 */
export async function deleteFiles(mediaIds: string[]): Promise<DeleteResult[]> {
  const results = await Promise.all(
    mediaIds.map(id => deleteFile(id))
  );
  return results;
}

// ============================================
// Query Functions
// ============================================

/**
 * Get media by folder with pagination
 */
export async function getMediaByFolder(
  folder?: MediaFolder,
  options?: { page?: number; limit?: number; search?: string }
) {
  const page = options?.page || 1;
  const limit = options?.limit || 24;
  const skip = (page - 1) * limit;
  
  const where = {
    ...(folder && { folder }),
    ...(options?.search && {
      OR: [
        { filename: { contains: options.search, mode: "insensitive" as const } },
        { alt: { contains: options.search, mode: "insensitive" as const } },
        { tags: { has: options.search } },
      ],
    }),
  };
  
  const [media, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.media.count({ where }),
  ]);
  
  return {
    media,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + media.length < total,
    },
  };
}

/**
 * Update media metadata
 */
export async function updateMedia(
  mediaId: string,
  data: { alt?: string; caption?: string; tags?: string[] }
) {
  return db.media.update({
    where: { id: mediaId },
    data,
  });
}

/**
 * Increment usage count when media is used in an article
 */
export async function incrementUsageCount(mediaId: string) {
  return db.media.update({
    where: { id: mediaId },
    data: { usageCount: { increment: 1 } },
  });
}

/**
 * Decrement usage count when media is removed from an article
 */
export async function decrementUsageCount(mediaId: string) {
  return db.media.update({
    where: { id: mediaId },
    data: { usageCount: { decrement: 1 } },
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get Supabase image transformation URL
 * Useful for generating thumbnails and optimized versions
 */
export function getTransformedUrl(
  publicUrl: string,
  options: { width?: number; height?: number; quality?: number }
): string {
  const url = new URL(publicUrl);
  
  // Supabase image transformation parameters
  const params = new URLSearchParams();
  if (options.width) params.set("width", options.width.toString());
  if (options.height) params.set("height", options.height.toString());
  if (options.quality) params.set("quality", options.quality.toString());
  
  // Add /render/image to the path for transformations
  const pathParts = url.pathname.split("/storage/v1/object/public/");
  if (pathParts.length === 2) {
    url.pathname = `/storage/v1/render/image/public/${pathParts[1]}`;
    url.search = params.toString();
  }
  
  return url.toString();
}

/**
 * Check if Supabase is properly configured
 */
export function isStorageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  const [totalCount, totalSize, byFolder] = await Promise.all([
    db.media.count(),
    db.media.aggregate({ _sum: { size: true } }),
    db.media.groupBy({
      by: ["folder"],
      _count: { id: true },
      _sum: { size: true },
    }),
  ]);
  
  return {
    totalCount,
    totalSize: totalSize._sum.size || 0,
    byFolder: byFolder.map(f => ({
      folder: f.folder,
      count: f._count.id,
      size: f._sum.size || 0,
    })),
  };
}
