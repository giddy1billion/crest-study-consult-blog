---
applyTo: "app/**/*.tsx,app/components/**"
description: "Crest Study Consult UI/UX design patterns and standards. Use when: creating any user interface, form, admin panel, dashboard, or interactive component for blog.creststudyconsult.com. STRICT ADHERENCE REQUIRED."
---

# Crest Study Consult UI/UX Standards

These standards must be followed when implementing any interface for `blog.creststudyconsult.com`.
The platform is an academic intelligence system — the aesthetic is calm, credible, and structured.

## Core Design Philosophy

- Establish clear hierarchy with size, weight, and color
- Group related elements with consistent spacing (4, 6, 8 scale)
- Use whitespace to reduce cognitive load
- Calm and institutional over flashy — no marketing-style embellishment

## Component Patterns

### Cards & Containers

```tsx
className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
```

### Form Inputs

```tsx
className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 hover:border-gray-300"
```

### Buttons

```tsx
// Primary
className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-sm transition-all"

// Secondary
className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
```

## Status Badges (CMS workflow)

- idea / draft: `bg-gray-100 text-gray-700`
- review states (editorial/seo/fact-check/aeo): `bg-amber-50 text-amber-700`
- ready: `bg-green-50 text-green-700`
- live: `bg-teal-50 text-teal-700`
- archived: `bg-gray-200 text-gray-600`

## Layout Patterns

- **Admin pages:** breadcrumb → page header → content + metadata sidebar → sticky save/cancel
- **Form pages:** tabbed (Content, SEO, Settings), character counters, real-time validation, SEO preview
- **Dashboards:** stat cards, recent activity, quick actions

## Accessibility

- Proper heading hierarchy (h1 → h2 → h3)
- `focus:ring-2 focus:ring-teal-500/20` on interactive elements
- Text contrast meets WCAG AA: primary `text-gray-900`, secondary `text-gray-600`, muted `text-gray-400`
- `aria-label` on icon-only buttons; `<nav>` and `<main>` landmarks

## Responsive Design

Mobile-first. Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

## Brand Integration

- Primary color: teal (`teal-600`)
- Headings: `font-bold text-gray-900`; body: `text-gray-700`; captions: `text-sm text-gray-500`
- Monospace (`font-mono`) for slugs, URLs, and code

## Prohibited

- No harsh borders (`border-gray-400`+ on light backgrounds)
- No `rounded-none`/`rounded-sm` on cards
- No buttons without hover/disabled states
- No forms without validation feedback
- No async actions without loading indicators
- No marketing tone, hype, or exclamation marks in UI copy

## Always

- Disabled states on buttons; character counts on limited fields
- Visual feedback for all interactions; toast notifications for actions
- Breadcrumbs on nested pages; consistent spacing
