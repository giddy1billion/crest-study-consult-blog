---
description: "Generate a Crest Study Consult article brief. Use when: planning new content, creating briefs for the writer or autonomous generator, or structuring article outlines for blog.creststudyconsult.com."
---

# Article Brief Generator — Crest Study Consult

Generate a complete article brief following Crest Study Consult editorial standards. The brief
can be handed to `@crest-writer` (manual) or `@crest-content-generator` (automated).

## Input Required

- **Target keyword**: {{keyword}}
- **Category**: {{category}}
- **Audience**: {{audience}}
- **Country focus**: {{country}}

## Brief Template

```markdown
## Article Brief — Crest Study Consult

**Target keyword:** {{keyword}}
**Search intent:** [informational / navigational / transactional]
**Target audience:** {{audience}}
**Country focus:** {{country}}
**Category:** {{category}}
**Target word count:** [1000–1500 standard / 2000–3000 report]
**Schema type:** [ARTICLE / FAQ_PAGE / REPORT]

---

### Proposed H1
[Keyword-optimised, sentence case, ≤80 chars]

### Proposed slug
[≤6 words, lowercase, hyphens, contains keyword]

### Proposed metaTitle
[≤60 chars, contains primary keyword, ends with "— Crest Study Consult"]

### Proposed metaDescription
[150–160 chars, contains keyword]

### canonicalURL
https://blog.creststudyconsult.com/{{category}}/{slug}

---

### Quick answer draft (40–60 words)
[Direct, self-contained answer to the primary query. No preamble. Extractable verbatim by AI.]

---

### Proposed H2 outline
1. [Complete question or declarative statement]
2. [Complete question or declarative statement]
3. [Complete question or declarative statement]
4. FAQ block
   - [Question matching a real search query]
   - [Question matching a real search query]
   - [Question matching a real search query]

---

### Data sources required
- [Source 1 with expected data point]
- [Source 2 with expected data point]

### Internal links to include
- [Target slug]: [anchor text context]
- [Target slug]: [anchor text context]
```

## Valid Categories

- `study-destinations` — country and university guides
- `admissions` — admission requirements and applications
- `visa-immigration` — visa and immigration processes
- `scholarships` — scholarships and funding
- `study-intelligence` — data intelligence module

## Audience Types

- Prospective student — applicants choosing destinations/programs
- Parent — funding and decision support
- Diaspora — students/families abroad
- Researcher — institutional or data audiences

## Priority Content Queue

1. `study in the UK guide`
2. `study in Canada requirements`
3. `US student visa process breakdown`
4. `scholarships for Nigerians studying abroad`
5. `cheapest countries to study abroad`

## Rules

- H1 keyword-optimised, sentence case, never a fragment
- H2s are complete questions or statements, never fragments
- Quick answer is self-contained (no "this article explains...")
- Meta description must not start with "This article..." or "Learn how to..."
- Identify minimum 2 internal link opportunities
- Never invent statistics — every data point must be citable
