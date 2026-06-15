---
applyTo: "**/*.prisma,**/schema.prisma,**/db.server.ts,**/prisma/**"
description: "Crest Study Consult Prisma schema patterns. Use when: writing Prisma queries, models, or database operations for blog.creststudyconsult.com."
---

# Crest Study Consult Prisma Schema Patterns

## Post Model

```prisma
model Post {
  id              String     @id @default(uuid())
  slug            String     @unique  // lowercase, hyphens, ≤6 words
  title           String              // sentence case, ≤80 chars
  metaTitle       String?             // ≤60 chars
  metaDescription String?             // 150–160 chars
  targetKeyword   String?
  excerpt         String              // 50–80 words
  content         String              // Markdown body
  category        Category   @relation(fields: [categoryId], references: [id])
  categoryId      String
  subcategory     String?
  tags            Tag[]
  heroImage       String?             // 1200×630 minimum
  heroImageAlt    String?
  canonicalURL    String?
  schemaType      SchemaType @default(ARTICLE)
  faqBlock        Json?               // [{ q: "...", a: "..." }]
  ctaBlock        Json?
  relatedSlugs    String[]
  sourceNotes     String?
  researchNotes   String?
  status          PostStatus @default(IDEA)
  isPublished     Boolean    @default(false)
  isFeatured      Boolean    @default(false)
  readingTimeMin  Int?
  publishedAt     DateTime?
  updatedAt       DateTime   @updatedAt
  viewCount       Int        @default(0)

  @@index([categoryId])
  @@index([isPublished, publishedAt])
}

model Category {
  id        String   @id @default(uuid())
  slug      String   @unique
  name      String
  description String?
  faqBlock  Json?
  updatedAt DateTime @updatedAt
  posts     Post[]
}

model Tag {
  id    String @id @default(uuid())
  slug  String @unique
  name  String
  posts Post[]
}

enum PostStatus {
  IDEA
  DRAFT
  EDITORIAL_REVIEW
  SEO_REVIEW
  FACT_CHECK
  AEO_REVIEW
  READY
  LIVE
  ARCHIVED
  DELETE_REQUESTED
}

enum SchemaType {
  ARTICLE
  FAQ_PAGE
  REPORT
}
```

## Category Slugs (fixed set)

- `study-destinations`
- `admissions`
- `visa-immigration`
- `scholarships`
- `study-intelligence`

## Query Patterns

### Fetch article by slug (with 404 handling)

```typescript
const post = await db.post.findFirst({
  where: { slug: params.slug, category: { slug: params.category }, isPublished: true },
  include: { category: true, tags: true },
});
if (!post) throw new Response("Not Found", { status: 404 });
```

### Sitemap query

```typescript
await db.post.findMany({
  where: { isPublished: true },
  select: { slug: true, category: { select: { slug: true } }, updatedAt: true, schemaType: true },
  orderBy: { publishedAt: "desc" },
});
```

## Publishing Validation

Before `isPublished: true`, verify:

- `status === 'READY'`
- `metaTitle` set and ≤60 chars
- `metaDescription` set and 150–160 chars
- `heroImage` set
- `canonicalURL` set
- `faqBlock` has ≥3 items

## Editorial Deletion Workflow

Editorial staff cannot delete articles — they request deletion.

```typescript
// ❌ FORBIDDEN for editorial
await db.post.delete({ where: { id } });

// ✅ CORRECT — request deletion
await db.post.update({
  where: { id },
  data: { isPublished: false, status: "DELETE_REQUESTED" },
});
```

## Mandatory Architecture

- Use direct Prisma queries in server loaders — no external API calls for content
- No `fetch()`/`axios` for content retrieval; no client `useEffect` initial-content fetching
- Server-only code lives in `*.server.ts`; client components never import it
- Mutations go through React Router actions

This is non-negotiable. Any change introducing external API calls for content is rejected.
