# Crest Study Consult Icon Generation Guide

Icons are generated automatically from the source logo at `https://www.propx.africa/logo.png`.

## Quick Start

```bash
# Download source logo and OG image
curl -o public/logo-source.png "https://www.propx.africa/logo.png"
curl -o public/og-image.png "https://www.propx.africa/og-image.png"

# Generate all icons
npm run generate-icons
```

## Generated Icons

### Favicons
| File | Size | Format | Purpose |
|------|------|--------|---------|
| `favicon.ico` | 16x16, 32x32, 48x48 | ICO (multi-size) | Legacy browser favicon |
| `favicon.svg` | Scalable | SVG | Modern browser favicon |
| `favicon-16x16.png` | 16x16 | PNG | Small favicon |
| `favicon-32x32.png` | 32x32 | PNG | Standard favicon |
| `favicon-96x96.png` | 96x96 | PNG | High-DPI favicon |

### Apple Touch Icons
| File | Size | Purpose |
|------|------|---------|
| `apple-touch-icon.png` | 180x180 | Default Apple touch icon |
| `apple-touch-icon-57x57.png` | 57x57 | iPhone (non-Retina) |
| `apple-touch-icon-60x60.png` | 60x60 | iPhone (iOS 7+) |
| `apple-touch-icon-72x72.png` | 72x72 | iPad (non-Retina) |
| `apple-touch-icon-76x76.png` | 76x76 | iPad (iOS 7+) |
| `apple-touch-icon-114x114.png` | 114x114 | iPhone (Retina) |
| `apple-touch-icon-120x120.png` | 120x120 | iPhone (Retina, iOS 7+) |
| `apple-touch-icon-144x144.png` | 144x144 | iPad (Retina) |
| `apple-touch-icon-152x152.png` | 152x152 | iPad (Retina, iOS 7+) |
| `apple-touch-icon-180x180.png` | 180x180 | iPhone 6 Plus |

### Android Chrome Icons
| File | Size | Purpose |
|------|------|---------|
| `android-chrome-192x192.png` | 192x192 | Android homescreen |
| `android-chrome-512x512.png` | 512x512 | Android splash screen |
| `android-chrome-maskable-192x192.png` | 192x192 | Maskable icon (with safe zone) |
| `android-chrome-maskable-512x512.png` | 512x512 | Maskable icon (with safe zone) |

### Microsoft Tiles
| File | Size | Purpose |
|------|------|---------|
| `mstile-70x70.png` | 70x70 | Small tile |
| `mstile-144x144.png` | 144x144 | Medium tile |
| `mstile-150x150.png` | 150x150 | Medium tile (Win 8.1+) |
| `mstile-310x150.png` | 310x150 | Wide tile |
| `mstile-310x310.png` | 310x310 | Large tile |

### Safari Pinned Tab
| File | Format | Purpose |
|------|--------|---------|
| `safari-pinned-tab.svg` | SVG (single color) | Safari pinned tab icon |

## Generation Commands

### Using ImageMagick

```bash
# Download source logo
curl -o logo-source.png "https://www.propx.africa/logo.png"

# Generate standard favicons
convert logo-source.png -resize 16x16 public/favicon-16x16.png
convert logo-source.png -resize 32x32 public/favicon-32x32.png
convert logo-source.png -resize 96x96 public/favicon-96x96.png

# Generate multi-size ICO
convert logo-source.png -resize 16x16 favicon-16.png
convert logo-source.png -resize 32x32 favicon-32.png
convert logo-source.png -resize 48x48 favicon-48.png
convert favicon-16.png favicon-32.png favicon-48.png public/favicon.ico
rm favicon-16.png favicon-32.png favicon-48.png

# Generate Apple Touch Icons
convert logo-source.png -resize 180x180 public/apple-touch-icon.png
convert logo-source.png -resize 57x57 public/apple-touch-icon-57x57.png
convert logo-source.png -resize 60x60 public/apple-touch-icon-60x60.png
convert logo-source.png -resize 72x72 public/apple-touch-icon-72x72.png
convert logo-source.png -resize 76x76 public/apple-touch-icon-76x76.png
convert logo-source.png -resize 114x114 public/apple-touch-icon-114x114.png
convert logo-source.png -resize 120x120 public/apple-touch-icon-120x120.png
convert logo-source.png -resize 144x144 public/apple-touch-icon-144x144.png
convert logo-source.png -resize 152x152 public/apple-touch-icon-152x152.png
convert logo-source.png -resize 180x180 public/apple-touch-icon-180x180.png

# Generate Android Chrome Icons
convert logo-source.png -resize 192x192 public/android-chrome-192x192.png
convert logo-source.png -resize 512x512 public/android-chrome-512x512.png

# Generate Maskable Icons (with padding for safe zone)
convert logo-source.png -resize 153x153 -gravity center -extent 192x192 -background white public/android-chrome-maskable-192x192.png
convert logo-source.png -resize 409x409 -gravity center -extent 512x512 -background white public/android-chrome-maskable-512x512.png

# Generate Microsoft Tiles
convert logo-source.png -resize 70x70 public/mstile-70x70.png
convert logo-source.png -resize 144x144 public/mstile-144x144.png
convert logo-source.png -resize 150x150 public/mstile-150x150.png
convert logo-source.png -resize 310x150 -gravity center -background transparent -extent 310x150 public/mstile-310x150.png
convert logo-source.png -resize 310x310 public/mstile-310x310.png

# Cleanup
rm logo-source.png
```

### Using Sharp (Node.js)

```javascript
const sharp = require('sharp');
const fs = require('fs');

const sizes = {
  favicons: [16, 32, 96],
  apple: [57, 60, 72, 76, 114, 120, 144, 152, 180],
  android: [192, 512],
  mstile: [70, 144, 150, 310]
};

async function generateIcons() {
  const logo = sharp('logo-source.png');
  
  // Favicons
  for (const size of sizes.favicons) {
    await logo.clone().resize(size, size).toFile(`public/favicon-${size}x${size}.png`);
  }
  
  // Apple Touch Icons
  for (const size of sizes.apple) {
    await logo.clone().resize(size, size).toFile(`public/apple-touch-icon-${size}x${size}.png`);
  }
  await logo.clone().resize(180, 180).toFile('public/apple-touch-icon.png');
  
  // Android Chrome
  for (const size of sizes.android) {
    await logo.clone().resize(size, size).toFile(`public/android-chrome-${size}x${size}.png`);
  }
  
  // MS Tiles
  for (const size of sizes.mstile) {
    await logo.clone().resize(size, size).toFile(`public/mstile-${size}x${size}.png`);
  }
}

generateIcons();
```

### Online Tools

- [RealFaviconGenerator](https://realfavicongenerator.net/) — Comprehensive favicon generator
- [Favicon.io](https://favicon.io/) — Simple favicon generator
- [Maskable.app](https://maskable.app/) — Test and create maskable icons

## Brand Colors

- **Primary (teal):** `#069494`
- **Background:** `#ffffff`

## Notes

1. **Maskable icons** should have ~20% padding around the logo for the safe zone
2. **Safari pinned tab** must be a single-color SVG
3. **favicon.svg** should be an optimized SVG version of the logo
4. Place all generated files in the `public/` directory
