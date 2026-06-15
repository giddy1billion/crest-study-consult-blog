/**
 * Generate all required icons for Crest Study Consult blog
 * Run with: node scripts/generate-icons.mjs
 *
 * Source of truth: public/logo-image.png (the Crest Study Consult logo)
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = 'public';
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'logo-image.png');

// Brand colors (from the Crest Study Consult logo)
const BRAND_GREEN = { r: 92, g: 176, b: 49, alpha: 1 }; // #5CB031
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 255, g: 255, b: 255, alpha: 0 };

// Trim the white border around the logo so icons render larger and crisper
function loadTrimmed(inputPath) {
  return sharp(inputPath).trim({ background: '#ffffff', threshold: 12 });
}

// Crop just the emblem (globe + cap + plane), dropping the wordmark, so small
// favicons stay legible. Returns a square-ish PNG buffer of the emblem.
async function loadEmblemBuffer(inputPath) {
  const trimmed = await loadTrimmed(inputPath).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  // The wordmark occupies roughly the bottom ~30% of the trimmed lockup.
  const emblemHeight = Math.round(meta.height * 0.70);
  return sharp(trimmed)
    .extract({ left: 0, top: 0, width: meta.width, height: emblemHeight })
    .trim({ background: '#ffffff', threshold: 12 })
    .png()
    .toBuffer();
}

// Icon configurations
const FAVICON_SIZES = [16, 32, 96];
const APPLE_SIZES = [57, 60, 72, 76, 114, 120, 144, 152, 180];
const ANDROID_SIZES = [192, 512];
const MSTILE_SIZES = [70, 144, 150, 310];

async function generateIcon(inputPath, outputPath, size, options = {}) {
  const { width = size, height = size, fit = 'contain', background = TRANSPARENT } = options;

  await loadTrimmed(inputPath)
    .resize(width, height, { fit, background })
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated: ${outputPath}`);
}

async function generateMaskableIcon(inputPath, outputPath, size) {
  // Maskable icons need ~20% padding (safe zone) on a solid brand background
  const iconSize = Math.round(size * 0.8);

  await loadTrimmed(inputPath)
    .resize(iconSize, iconSize, { fit: 'contain', background: TRANSPARENT })
    .extend({
      top: Math.round((size - iconSize) / 2),
      bottom: Math.round((size - iconSize) / 2),
      left: Math.round((size - iconSize) / 2),
      right: Math.round((size - iconSize) / 2),
      background: WHITE,
    })
    .flatten({ background: WHITE })
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated (maskable): ${outputPath}`);
}

async function generateFaviconIco(inputPath, outputPath) {
  // Generate temporary PNGs for ICO (emblem only, for legibility at small sizes)
  const emblem = await loadEmblemBuffer(inputPath);
  const tempFiles = [];
  const sizes = [16, 32, 48];

  for (const size of sizes) {
    const tempPath = path.join(PUBLIC_DIR, `temp-favicon-${size}.png`);
    await sharp(emblem)
      .resize(size, size, { fit: 'contain', background: TRANSPARENT })
      .png()
      .toFile(tempPath);
    tempFiles.push(tempPath);
  }

  // Convert to ICO
  const icoBuffer = await pngToIco(tempFiles);
  await fs.writeFile(outputPath, icoBuffer);
  console.log(`✓ Generated: ${outputPath}`);

  // Clean up temp files
  for (const tempFile of tempFiles) {
    await fs.unlink(tempFile);
  }
}

async function generateFaviconPng(inputPath, outputPath, size) {
  // Emblem-only PNG favicon for legibility at small sizes
  const emblem = await loadEmblemBuffer(inputPath);
  await sharp(emblem)
    .resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile(outputPath);
  console.log(`✓ Generated: ${outputPath}`);
}

async function generateFaviconSvg(inputPath, outputPath) {
  // Embed a trimmed 128x128 PNG of the emblem inside an SVG wrapper so the
  // vector favicon stays on-brand and legible without manual path tracing.
  const emblem = await loadEmblemBuffer(inputPath);
  const pngBuffer = await sharp(emblem)
    .resize(128, 128, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();

  const base64 = pngBuffer.toString('base64');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <image width="128" height="128" href="data:image/png;base64,${base64}"/>
</svg>
`;

  await fs.writeFile(outputPath, svg, 'utf8');
  console.log(`✓ Generated: ${outputPath}`);
}

async function generateOgImage(inputPath, outputPath) {
  // 1200x630 social share image: centered logo on a clean white background
  const width = 1200;
  const height = 630;
  const logoHeight = 460;

  const logo = await loadTrimmed(inputPath)
    .resize(null, logoHeight, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();

  await sharp({
    create: { width, height, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated: ${outputPath}`);
}

async function main() {
  console.log('🎨 Generating Crest Study Consult icons...\n');

  // Check if source logo exists
  try {
    await fs.access(SOURCE_LOGO);
  } catch {
    console.error(`❌ Source logo not found: ${SOURCE_LOGO}`);
    console.error('   Place the Crest Study Consult logo at public/logo-image.png and re-run.');
    process.exit(1);
  }

  // Generate favicon.ico (multi-size)
  console.log('\n📁 Generating favicons...');
  await generateFaviconIco(SOURCE_LOGO, path.join(PUBLIC_DIR, 'favicon.ico'));
  await generateFaviconSvg(SOURCE_LOGO, path.join(PUBLIC_DIR, 'favicon.svg'));
  
  // Generate PNG favicons (emblem only)
  for (const size of FAVICON_SIZES) {
    await generateFaviconPng(SOURCE_LOGO, path.join(PUBLIC_DIR, `favicon-${size}x${size}.png`), size);
  }
  
  // Generate Apple Touch Icons
  console.log('\n🍎 Generating Apple Touch Icons...');
  await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 180);
  for (const size of APPLE_SIZES) {
    await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, `apple-touch-icon-${size}x${size}.png`), size);
  }
  
  // Generate Android Chrome Icons
  console.log('\n🤖 Generating Android Chrome Icons...');
  for (const size of ANDROID_SIZES) {
    await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, `android-chrome-${size}x${size}.png`), size);
    await generateMaskableIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, `android-chrome-maskable-${size}x${size}.png`), size);
  }
  
  // Generate Microsoft Tiles
  console.log('\n🪟 Generating Microsoft Tiles...');
  for (const size of MSTILE_SIZES) {
    if (size === 310) {
      // Wide tile (310x150)
      await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, 'mstile-310x150.png'), 150, { width: 310, height: 150 });
      // Large square tile (310x310)
      await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, 'mstile-310x310.png'), 310);
    } else {
      await generateIcon(SOURCE_LOGO, path.join(PUBLIC_DIR, `mstile-${size}x${size}.png`), size);
    }
  }
  
  // Generate social share (Open Graph) image
  console.log('\n🖼️  Generating Open Graph image...');
  await generateOgImage(SOURCE_LOGO, path.join(PUBLIC_DIR, 'og-image.png'));

  // Copy logo to public as logo.png and keep logo-source.png in sync
  console.log('\n📋 Copying logo...');
  await fs.copyFile(SOURCE_LOGO, path.join(PUBLIC_DIR, 'logo.png'));
  console.log(`✓ Copied: ${path.join(PUBLIC_DIR, 'logo.png')}`);
  await fs.copyFile(SOURCE_LOGO, path.join(PUBLIC_DIR, 'logo-source.png'));
  console.log(`✓ Copied: ${path.join(PUBLIC_DIR, 'logo-source.png')}`);

  console.log('\n✅ All icons generated successfully!');
  console.log('\nGenerated files:');
  console.log('  - favicon.ico (16x16, 32x32, 48x48)');
  console.log('  - favicon.svg');
  console.log('  - favicon-16x16.png, favicon-32x32.png, favicon-96x96.png');
  console.log('  - apple-touch-icon.png + all sizes');
  console.log('  - android-chrome-192x192.png, android-chrome-512x512.png');
  console.log('  - android-chrome-maskable-192x192.png, android-chrome-maskable-512x512.png');
  console.log('  - mstile-70x70.png, mstile-144x144.png, mstile-150x150.png');
  console.log('  - mstile-310x150.png, mstile-310x310.png');
  console.log('  - og-image.png (1200x630)');
  console.log('  - logo.png, logo-source.png');
}

main().catch(console.error);
