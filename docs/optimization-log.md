# Crest Study Consult Performance Optimization Log

## Session: 2026-06-11

### Phase 1: Discovery Complete ✅

**Bundle Analysis Results:**

| Bundle | Raw Size | Est. Gzip |
|--------|----------|-----------|
| entry.client | 186.5 KB | ~59 KB |
| jsx-runtime | 130.1 KB | ~43 KB |
| home | 31.9 KB | ~9 KB |
| cn (tailwind-merge) | 27.3 KB | ~9 KB |
| layout | 22.2 KB | ~6 KB |

**Total Initial Load:** ~398 KB raw / ~126 KB gzipped

**LCP Element Identified:** Hero slider `<img>` in [HeroSlider.tsx](../app/components/home/HeroSlider.tsx#L306)

---

### Optimizations Implemented

#### 1. LCP Image Optimization (Phase 2) ✅

**File:** [app/components/home/HeroSlider.tsx](../app/components/home/HeroSlider.tsx#L295-L320)

**Changes:**
- Added `fetchPriority="high"` to active slide
- Added `width={1200}` and `height={630}` attributes
- Added `decoding="sync"` for active slide, `decoding="async"` for others
- Implemented `srcSet` with responsive breakpoints (640w, 1024w, 1200w, 1920w)
- Added `sizes="100vw"` for proper image selection

**Expected Impact:** LCP improvement of 1-2 seconds

```tsx
// Before
<img
  src={article.heroImage || ""}
  loading={isActive ? "eager" : "lazy"}
/>

// After
<img
  src={article.heroImage || ""}
  srcSet={`${article.heroImage}?w=640&fit=crop 640w, ...`}
  sizes="100vw"
  width={1200}
  height={630}
  fetchPriority={isActive ? "high" : "auto"}
  decoding={isActive ? "sync" : "async"}
  loading={isActive ? "eager" : "lazy"}
/>
```

---

#### 2. ArticleCard Image Optimization (Phase 4) ✅

**File:** [app/components/blog/ArticleCard.tsx](../app/components/blog/ArticleCard.tsx)

**Changes:**
- All 3 variants (compact, featured, default) now have:
  - `srcSet` with responsive breakpoints
  - `sizes` attribute for viewport-appropriate selection
  - Explicit `width` and `height` to prevent CLS
  - `loading="lazy"` and `decoding="async"`

| Variant | Breakpoints | Dimensions |
|---------|-------------|------------|
| compact | 80w, 160w (1x/2x) | 80×80 |
| featured | 400w, 600w, 800w | 600×256 |
| default | 320w, 480w, 640w | 480×192 |

---

#### 3. FeaturedStories Image Optimization (Phase 4) ✅

**File:** [app/components/home/FeaturedStories.tsx](../app/components/home/FeaturedStories.tsx)

**Changes:**
- Primary card: srcSet 640w-1200w, sizes for 2-column layout
- Supporting cards: srcSet 400w-800w, sizes for 1-column layout
- All images have width/height and lazy loading

---

#### 4. Font Loading Optimization (Phase 5) ✅

**File:** [app/root.tsx](../app/root.tsx)

**Changes:**
- Added `&display=swap` to Google Fonts URL (already had it, confirmed)
- Reduced font weights from all (100-900) to only used weights (400, 500, 600, 700)
- Added `rel="preload"` for critical Inter font file (woff2)

**Expected Impact:** FCP improvement, reduced FOIT risk, faster font rendering

```tsx
// Added font preload
{
  rel: "preload",
  href: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous",
}
```

---

#### 5. Performance Tooling Added ✅

**New Scripts in package.json:**

| Script | Purpose |
|--------|---------|
| `npm run perf:audit` | Run Lighthouse locally |
| `npm run perf:audit:prod` | Run Lighthouse against production |
| `npm run perf:budget` | Check bundle sizes |
| `postbuild` | Auto-runs bundle budget check after build |

**New Files:**
- [scripts/performance-audit.mjs](../scripts/performance-audit.mjs) - Lighthouse runner with budgets
- [scripts/bundle-budget.mjs](../scripts/bundle-budget.mjs) - Bundle size validator

---

#### 6. Documentation Created ✅

**New Files:**
- [docs/performance-audit.md](./performance-audit.md) - Full audit findings
- [.github/instructions/images.instructions.md](../.github/instructions/images.instructions.md) - Image optimization patterns

---

### Phase 3: Critical CSS Assessment

**Current State:**
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- CSS bundled to 106KB (16KB gzipped)
- SSR delivers HTML with linked stylesheet

**Analysis:**
| Technique | Benefit | Effort | Recommendation |
|-----------|---------|--------|----------------|
| Inline critical CSS | -100ms FCP | High | Defer (requires critters/vite-plugin-critical) |
| Font preload | -200ms FCP | Low | ✅ Implemented |
| Reduce font weights | -50ms | Low | ✅ Implemented |
| Defer Google Fonts | -150ms FCP | Medium | Optional (may cause FOIT) |

**Conclusion:** Font optimizations provide best ROI. Full critical CSS extraction deferred pending performance validation post-deployment.

---

### Pending Optimizations

#### Optional: Critical CSS Extraction
- [ ] Install `vite-plugin-critical` or `critters` for automated extraction
- [ ] Extract above-fold CSS for homepage, category, article pages
- [ ] Defer non-critical styles with `media="print" onload`

#### Optional: LQIP (Low Quality Image Placeholders)
- [ ] Generate blur hash placeholders for hero images
- [ ] Implement progressive loading UX

#### Phase 7: Bundle Optimization
- [ ] Analyze code splitting opportunities for admin routes
- [ ] Review dynamic imports for modals/overlays
- [ ] Consider lazy loading SearchModal component

---

### Verification

Run after deployment:
```bash
npm run perf:audit:prod
```

**Expected Results After Current Optimizations:**
| Metric | Baseline | Expected | Target |
|--------|----------|----------|--------|
| Performance | 73 | 83-88 | ≥90 |
| LCP | 5.0s | 3.0-3.5s | ≤2.5s |
| FCP | 3.6s | 2.2-2.8s | ≤1.8s |
| CLS | 0.029 | 0.01-0.02 | ≤0.1 |
