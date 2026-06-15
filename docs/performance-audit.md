# Crest Study Consult Performance Audit

**Date:** 2026-06-11  
**Baseline Source:** PageSpeed Insights Mobile  
**Domain:** https://blog.creststudyconsult.com/

---

## Executive Summary

| Metric | Current | Target | Gap | Priority |
|--------|---------|--------|-----|----------|
| Performance | 73 | ≥90 | -17 | 🔴 Critical |
| FCP | 3.6s | ≤1.8s | -1.8s | 🔴 Critical |
| LCP | 5.0s | ≤2.5s | -2.5s | 🔴 Critical |
| TBT | 0ms | ≤200ms | ✅ | ✅ Passing |
| CLS | 0.029 | ≤0.1 | ✅ | ✅ Passing |
| Speed Index | 4.1s | ≤3.0s | -1.1s | 🟡 High |
| Accessibility | 93 | ≥95 | -2 | 🟡 High |
| SEO | 100 | 100 | ✅ | ✅ Passing |

---

## Phase 1: LCP Element Analysis

### Identified LCP Element

**Component:** `HeroSlider` → `<img>` element  
**Location:** [app/components/home/HeroSlider.tsx](../app/components/home/HeroSlider.tsx#L308)

**Current Implementation:**
```tsx
<img
  src={article.heroImage || ""}
  alt={article.heroImageAlt || article.title}
  className="absolute inset-0 w-full h-full object-cover ..."
  loading={isActive ? "eager" : "lazy"}
/>
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| Missing `fetchpriority="high"` | 🔴 Critical | Delays LCP discovery |
| Missing `width` and `height` attributes | 🔴 Critical | Causes layout shift |
| No `srcset` for responsive images | 🟡 High | Oversized images on mobile |
| No WebP/AVIF format | 🟡 High | Larger file sizes |
| No `<link rel="preload">` | 🟡 High | Late resource discovery |
| Images served from Unsplash (external) | 🟢 Low | CDN optimized already |

### Recommended LCP Fix

```tsx
<img
  src={article.heroImage || ""}
  srcSet={`
    ${article.heroImage}?w=640 640w,
    ${article.heroImage}?w=1024 1024w,
    ${article.heroImage}?w=1200 1200w
  `}
  sizes="100vw"
  width={1200}
  height={630}
  alt={article.heroImageAlt || article.title}
  fetchpriority={isActive ? "high" : "auto"}
  loading={isActive ? "eager" : "lazy"}
  decoding={isActive ? "sync" : "async"}
  className="absolute inset-0 w-full h-full object-cover"
/>
```

---

## Phase 2: Render-Blocking Resources

### CSS Analysis

**Current:** Tailwind CSS via Vite plugin (inlined during build) ✅  
**Issue:** None - CSS is properly bundled

### JavaScript Analysis

| Bundle | Size (raw) | Size (gzip) | Purpose |
|--------|------------|-------------|---------|
| entry.client | 186.5 KB | 58.9 KB | React + React Router |
| jsx-runtime | 130.1 KB | 43.0 KB | React JSX runtime |
| home | 31.9 KB | 8.6 KB | Homepage components |
| layout | 22.2 KB | 5.5 KB | Header/Footer |
| cn | 27.3 KB | 8.7 KB | tailwind-merge |

**Total Initial Load:** ~398 KB raw / ~125 KB gzipped

### Font Loading Analysis

**Current Implementation (root.tsx):**
```tsx
{ rel: "preconnect", href: "https://fonts.googleapis.com" },
{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:..." },
```

**Issues:**
| Issue | Severity | Impact |
|-------|----------|--------|
| Stylesheet is render-blocking | 🟡 High | Delays FCP |
| No `font-display: swap` in CSS request | 🟡 High | FOIT risk |
| Loading all weights (100-900) | 🟢 Low | Extra bytes |

**Recommendation:** Add `&display=swap` to Google Fonts URL

---

## Phase 3: Third-Party Script Audit

| Script | Classification | Load Strategy | Impact |
|--------|----------------|---------------|--------|
| Plausible Analytics | Critical | Async ✅ | Minimal |
| Google Fonts | Important | Preconnect ✅ | ~50ms |

**No problematic third-party scripts detected.**

---

## Phase 4: Image Optimization Audit

### Homepage Images

| Image Type | Current Format | Recommended | Savings Est. |
|------------|----------------|-------------|--------------|
| Hero Slider | JPEG via Unsplash | WebP with srcset | 30-50% |
| Article Cards | JPEG via Unsplash | WebP, lazy loaded | 30-50% |
| Featured Stories | JPEG via Unsplash | WebP with srcset | 30-50% |

### Missing Optimizations

- [ ] No `<picture>` element with format fallbacks
- [ ] No explicit width/height on most images
- [ ] No blur placeholder/LQIP implementation
- [ ] No image CDN transformation for PropX-hosted images

---

## Phase 5: Caching Analysis

**Current Headers (via Cloudflare):**

| Resource | Cache-Control | Status |
|----------|---------------|--------|
| HTML | `s-maxage=60, stale-while-revalidate=3600` | ✅ Good |
| JS/CSS | `max-age=31536000, immutable` | ✅ Excellent |
| Images | CDN default | 🟡 Check |

---

## Remediation Priority

### Sprint 1: Critical (Target: +10 points)

1. **LCP Image Optimization**
   - Add `fetchpriority="high"` to active slide
   - Add `width` and `height` attributes
   - Implement `srcset` for responsive images
   - Add `<link rel="preload">` for first hero image

2. **Font Loading Optimization**
   - Add `&display=swap` to Google Fonts URL
   - Preload critical font files

### Sprint 2: High Priority (Target: +5 points)

3. **Image srcset Implementation**
   - Generate responsive variants for all article cards
   - Implement native lazy loading consistently

4. **Bundle Optimization**
   - Audit for unused exports in shared modules
   - Consider dynamic imports for admin routes

### Sprint 3: Maintenance

5. **Monitoring**
   - Add Lighthouse CI to build pipeline
   - Set performance budgets

---

## Success Metrics

After implementing Sprint 1:

| Metric | Expected |
|--------|----------|
| LCP | ≤3.0s |
| FCP | ≤2.5s |
| Performance Score | ≥85 |

After implementing Sprint 2:

| Metric | Expected |
|--------|----------|
| LCP | ≤2.5s |
| FCP | ≤1.8s |
| Performance Score | ≥90 |
