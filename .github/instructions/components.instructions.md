---
applyTo: "app/components/**,app/**/*.tsx"
description: "Crest Study Consult component architecture patterns. Use when: creating React components, UI elements, or reusable modules for blog.creststudyconsult.com. Ensures scalable, maintainable code."
---

# Crest Study Consult Component Architecture

## Directory Structure

```
app/
├── components/
│   ├── ui/              # Base primitives (Button, Input, Card)
│   ├── layout/          # Header, Footer, Container
│   ├── blog/            # ArticleCard, CategoryPill, QuickAnswer, FAQBlock
│   ├── seo/             # JsonLd, MetaTags, OgImage
│   └── forms/           # NewsletterForm, SearchForm
├── hooks/
├── utils/
└── routes/
```

## Base Component Template

```tsx
import { type ReactNode } from "react";
import { cn } from "~/utils/cn";

interface ComponentNameProps {
  children?: ReactNode;
  className?: string;
}

export function ComponentName({ children, className, ...props }: ComponentNameProps) {
  return (
    <div className={cn("base-classes", className)} {...props}>
      {children}
    </div>
  );
}
```

## QuickAnswerBlock

Feeds AEO extraction. 40–60 words, visually distinct, attributed to Crest Study Consult Research.

```tsx
interface QuickAnswerProps {
  answer: string;
  source?: string;
}

export function QuickAnswerBlock({ answer, source = "Crest Study Consult Research" }: QuickAnswerProps) {
  return (
    <div className="border-l-4 border-teal-500 bg-gray-50 p-6 my-6">
      <p className="text-gray-800 leading-relaxed">{answer}</p>
      <p className="text-sm text-gray-500 mt-3 italic">Source: {source}</p>
    </div>
  );
}
```

## FAQBlock

Rendered as `<details>/<summary>` and mirrored exactly by `FAQPage` JSON-LD.

```tsx
interface FAQItem { question: string; answer: string; }

export function FAQBlock({ faqs }: { faqs: FAQItem[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
      {faqs.map((faq, i) => (
        <details key={i} className="group border-b border-gray-200 pb-4">
          <summary className="cursor-pointer font-medium text-gray-900 list-none">
            {faq.question}
          </summary>
          <p className="mt-3 text-gray-600 leading-relaxed">{faq.answer}</p>
        </details>
      ))}
    </section>
  );
}
```

## ArticleCard

```tsx
interface ArticleCardProps {
  article: {
    slug: string;
    title: string;
    excerpt: string;
    heroImage?: string;
    heroImageAlt?: string;
    readingTimeMin?: number;
    publishedAt: string;
    category: { slug: string; name: string };
  };
  variant?: "default" | "featured" | "compact";
}
```

## Conventions

- All interactive elements need hover and focus states
- Use `cn()` for class merging; never inline styles
- Co-locate component-only types in the component file
- Keep copy academic and neutral — never marketing tone
