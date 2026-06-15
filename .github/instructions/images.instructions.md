---
applyTo: "app/components/**/*.tsx,app/routes/**/*.tsx"
description: "Image optimization patterns for Crest Study Consult. Use when: adding images to components, hero sections, article cards, or any visual content. Ensures LCP optimization and responsive images."
---

# Image Optimization Standards

## LCP Images (Hero, Above-fold)

```tsx
<img
  src={imageUrl}
  srcSet={`${imageUrl}?w=640 640w, ${imageUrl}?w=1024 1024w, ${imageUrl}?w=1200 1200w`}
  sizes="100vw"
  width={1200}
  height={630}
  alt={descriptiveAlt}
  fetchPriority="high"
  decoding="sync"
  loading="eager"
/>
```

## Below-fold Images (Cards, Grids)

```tsx
<img
  src={imageUrl}
  srcSet={`${imageUrl}?w=320 320w, ${imageUrl}?w=640 640w, ${imageUrl}?w=800 800w`}
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
  width={600}
  height={400}
  alt={descriptiveAlt}
  loading="lazy"
  decoding="async"
/>
```

## Required Attributes

| Attribute | LCP Image | Lazy Image |
|-----------|-----------|------------|
| `src` | Required | Required |
| `alt` | Required | Required |
| `width` / `height` | Required | Required |
| `loading` | `eager` | `lazy` |
| `decoding` | `sync` | `async` |
| `fetchPriority` | `high` | Omit |

## Alt Text Rules

- Hero alt: describe content + include the primary keyword
  - Good: `alt="International student reviewing UK university admission requirements"`
  - Bad: `alt="image"` or `alt="Crest Study Consult blog"`
- Decorative images use `alt=""`; content images must never have blank alt
- OG image must be 1200×630, branded with the Crest Study Consult wordmark

## Anti-patterns

```tsx
<img src={url} alt="..." />            // ❌ missing dimensions → CLS
<img src={url} />                      // ❌ no alt
<img src="big.jpg" width={1920} />     // ❌ no srcset
```
