# Crest Study Consult — Project Instructions

You are working on **blog.creststudyconsult.com**, the international education
intelligence layer for **Crest Study Consult LTD** — an international education
consultancy that guides students from first contact to full settlement in their
chosen institution and destination. The blog establishes Crest Study Consult as a
trusted authority while supporting the consultancy's admissions, visa, and
scholarship guidance.

## Brand Identity

- **Tagline:** Study abroad dreams made reality.
- **Positioning:** Empowering Dreams, Connecting Destinations.
- **Mission:** Empower individuals with access to global education and travel
  opportunities through trusted guidance, expert counselling, and personalized
  support — a seamless journey from dream to destination.
- **Vision:** Become Africa's most trusted and student-centred education
  consultancy, bridging the gap between dreams and global opportunities.
- **Values:** Empathy · Integrity · Excellence · Collaboration · Customer Experience
- **Regions of focus:** United Kingdom, United States, Australia, Germany, Canada, Ireland
- **Brand personality:** Friendly · Approachable · Firm · Inspirational

Reuse the canonical values via `~/utils/constants` (`BRAND`, `MISSION`, `VISION`,
`OBJECTIVE`, `VALUES`, `BRAND_PERSONALITY`, `REGIONS_OF_FOCUS`) — never hardcode them.

## Identity Rules (non-negotiable)

- Brand name: **Crest Study Consult** — always the full name, never "Crest" alone
- Legal entity in all schema markup: **Crest Study Consult LTD**
- Canonical domain: `https://blog.creststudyconsult.com`
- Editorial identity for authored content: **Crest Study Consult Research Team**

## Voice & Tone (dual model)

Two registers, applied by surface — never mix them:

**Brand surfaces** (homepage hero, CTAs, About, newsletter, navigation copy):
- Friendly, approachable, firm, inspirational
- Warm and encouraging; motivate students with confidence
- Light, purposeful enthusiasm is allowed; avoid hollow hype

**Editorial surfaces** (article bodies, quick answers, FAQs, study-intelligence reports):
- Academic, advisory, structured, neutral
- Every claim verifiable; no emotional persuasion inside factual content
- No exclamation marks in editorial content
- Sentence case on all headings below H1

## Content Rules

- Every claim must be verifiable
- Never invent statistics, rankings, tuition figures, or visa/policy facts
- No vague statements (`many students`, `experts say`) — attribute specifically
- Quick answer block: 40–60 words, self-contained, no reference to the article body
- FAQ answers: 40–80 words, factual, self-contained
- Internal links use descriptive keyword-rich anchor text — never `click here`

## Engineering Rules

- TypeScript strict mode
- Prisma for all content queries — no external API calls for content retrieval
- Server loaders for initial data; throw proper 404/500 Responses
- `Cache-Control` headers on every loader response
- JSON-LD: `Organization` on every page; `Article`, `FAQPage`, or `Report` on content pages
- No duplicate schema blocks on a page

## Publishing Gate (hard rules)

`isPublished: true` may only be set when ALL are true:
- `status === READY`
- `metaTitle` exists (≤60 chars)
- `metaDescription` exists (150–360 chars)
- `heroImage` exists (1200×630)
- `canonicalURL` exists
- `slug` is valid, unique, hyphenated, ≤6 words

Every published article must include a **quick answer block** and a **FAQ block** (3+ pairs).

## Category Slugs (fixed set)

- `study-destinations` — country and university guides
- `admissions` — admission requirements and applications
- `visa-immigration` — visa and immigration processes
- `scholarships` — scholarships and funding
- `study-intelligence` — data intelligence module (highest authority)

## Workflow State Machine

```
idea → draft → editorial-review → seo-review → fact-check → aeo-review → ready → live → archived
```

Transitions are enforced server-side and may only advance.
