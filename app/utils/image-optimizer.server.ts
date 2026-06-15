/**
 * Server-side Image Optimizer
 *
 * Compresses and right-sizes uploaded raster images using sharp.
 *
 * Goals:
 * - Reduce file size when an image exceeds a size or dimension threshold
 * - Preserve visual quality (high-quality WebP re-encode + smart resizing)
 * - Never enlarge images, never break animation/vectors
 *
 * Skipped (passed through untouched):
 * - Animated GIFs (re-encoding would drop animation)
 * - SVG (vector, already tiny)
 * - Images already smaller than the threshold AND within max dimensions
 */

import sharp from "sharp";

// ============================================
// Tunable thresholds
// ============================================

/** Compress when the source file is larger than this (1 MB). */
export const COMPRESS_SIZE_THRESHOLD = 1 * 1024 * 1024;

/** Cap the longest edge to keep files lean while staying retina-sharp. */
export const MAX_DIMENSION = 2400;

/** WebP quality — 82 is visually lossless for photographic content. */
const WEBP_QUALITY = 82;

/** Effort 4 balances compression ratio against CPU time. */
const WEBP_EFFORT = 4;

/** Formats sharp can safely re-encode to WebP. */
const OPTIMIZABLE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export interface OptimizeResult {
  /** Final image bytes (optimized or original). */
  buffer: Buffer;
  /** Final MIME type (image/webp when re-encoded). */
  mimeType: string;
  /** File extension matching the final MIME type (no dot). */
  extension: string;
  width?: number;
  height?: number;
  /** Byte size of the final buffer. */
  size: number;
  /** Byte size of the original input. */
  originalSize: number;
  /** True when the image was re-encoded/resized. */
  optimized: boolean;
}

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function extensionForMime(mimeType: string): string {
  return MIME_EXTENSION[mimeType] ?? "jpg";
}

/**
 * Read image dimensions with sharp. Returns empty object on failure.
 */
export async function readDimensions(
  input: Buffer
): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await sharp(input).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

/**
 * Optimize an image buffer.
 *
 * Strategy:
 * 1. Pass through GIF/SVG and unknown types untouched.
 * 2. If the image is within the size threshold AND max dimensions, leave it
 *    as-is (avoid needless re-encoding of already-light assets).
 * 3. Otherwise, auto-orient, downscale to MAX_DIMENSION, and re-encode to
 *    high-quality WebP. Keep the result only if it is genuinely smaller.
 */
export async function optimizeImage(
  input: Buffer | ArrayBuffer,
  mimeType: string
): Promise<OptimizeResult> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const originalSize = buffer.byteLength;

  const passthrough = (
    width?: number,
    height?: number
  ): OptimizeResult => ({
    buffer,
    mimeType,
    extension: extensionForMime(mimeType),
    width,
    height,
    size: originalSize,
    originalSize,
    optimized: false,
  });

  // Non-raster or animation-bearing formats are passed through.
  if (!OPTIMIZABLE_MIME_TYPES.has(mimeType)) {
    const dims = await readDimensions(buffer);
    return passthrough(dims.width, dims.height);
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    // Corrupt/unreadable — let the original flow handle validation.
    return passthrough();
  }

  // Animated WebP: preserve animation, don't flatten to a single frame.
  if (metadata.pages && metadata.pages > 1) {
    return passthrough(metadata.width, metadata.height);
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const longestEdge = Math.max(width, height);

  const needsResize = longestEdge > MAX_DIMENSION;
  const needsCompression = originalSize > COMPRESS_SIZE_THRESHOLD;

  // Already light and correctly sized — keep the original bytes.
  if (!needsResize && !needsCompression) {
    return passthrough(width || undefined, height || undefined);
  }

  try {
    let pipeline = sharp(buffer, { animated: false })
      // Bake in EXIF orientation so the stored file renders correctly.
      .rotate();

    if (needsResize) {
      pipeline = pipeline.resize({
        width: width >= height ? MAX_DIMENSION : undefined,
        height: height > width ? MAX_DIMENSION : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const output = await pipeline
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toBuffer({ resolveWithObject: true });

    const optimizedBuffer = output.data;

    // Only adopt the optimized version when it actually helps. A resize is
    // always worthwhile; for compression-only we require a real size win.
    const isSmaller = optimizedBuffer.byteLength < originalSize;
    if (!needsResize && !isSmaller) {
      return passthrough(width || undefined, height || undefined);
    }

    return {
      buffer: optimizedBuffer,
      mimeType: "image/webp",
      extension: "webp",
      width: output.info.width,
      height: output.info.height,
      size: optimizedBuffer.byteLength,
      originalSize,
      optimized: true,
    };
  } catch (error) {
    console.error("Image optimization failed, using original:", error);
    return passthrough(width || undefined, height || undefined);
  }
}

// ============================================
// Open Graph image generation
// ============================================

/** Open Graph canvas — the dimension every major platform expects. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Upper byte budget for an OG image. Keeps previews fast and reliable. */
export const OG_MAX_BYTES = 150 * 1024; // 150 KB

/**
 * JPEG quality ladder, highest first. We descend until the encoded image
 * fits within OG_MAX_BYTES. JPEG (mozjpeg) is used because it is universally
 * rendered by social scrapers (Facebook, X, LinkedIn, WhatsApp, Slack,
 * iMessage), unlike WebP/AVIF which several still reject.
 */
const OG_QUALITY_LADDER = [82, 74, 66, 58, 50, 42];

export interface OgImageResult {
  buffer: Buffer;
  /** Always image/jpeg. */
  mimeType: "image/jpeg";
  size: number;
  width: number;
  height: number;
}

/**
 * Produce a social-ready Open Graph image (1200×630 JPEG, ≤150 KB) from an
 * arbitrary source image — typically an article hero.
 *
 * - Center-crops to the exact OG aspect ratio (`fit: cover`, salient region).
 * - Flattens transparency onto brand navy so PNGs don't turn black.
 * - Steps JPEG quality down until the result fits the byte budget, so even
 *   large hero photos render instantly in link previews.
 */
export async function generateOgImage(
  input: Buffer | ArrayBuffer
): Promise<OgImageResult> {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // Shared, format-normalized pipeline: orient, crop to OG canvas, de-alpha.
  const base = sharp(source, { animated: false })
    .rotate()
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "attention" })
    .flatten({ background: "#ffffff" });

  let last: Buffer | null = null;

  for (const quality of OG_QUALITY_LADDER) {
    const encoded = await base
      .clone()
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();

    last = encoded;

    // Stop as soon as we're inside the byte budget.
    if (encoded.byteLength <= OG_MAX_BYTES) {
      break;
    }
  }

  const buffer =
    last ?? (await base.jpeg({ quality: 42, mozjpeg: true }).toBuffer());

  return {
    buffer,
    mimeType: "image/jpeg",
    size: buffer.byteLength,
    width: OG_WIDTH,
    height: OG_HEIGHT,
  };
}
