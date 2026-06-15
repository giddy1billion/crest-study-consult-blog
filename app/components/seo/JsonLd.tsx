import { BRAND } from "~/utils/constants";

export interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * Generic JSON-LD script injector
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Organization schema - include on every page
 * Includes logo for Google Search favicon display and alternate
 * names so search engines associate "PropX", "propX" and "propx"
 * with the Crest Study Consult entity.
 */
export function OrganizationSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BRAND.url}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    alternateName: BRAND.alternateNames,
    url: BRAND.url,
    slogan: BRAND.positioning,
    logo: {
      "@type": "ImageObject",
      url: BRAND.logo,
      width: 512,
      height: 512,
    },
    image: BRAND.logo,
    description: BRAND.description,
    foundingLocation: {
      "@type": "Place",
      name: BRAND.location,
    },
    areaServed: {
      "@type": "Place",
      name: "Africa",
    },
    sameAs: [BRAND.linkedin, BRAND.twitter, BRAND.productUrl],
  };

  return <JsonLd data={data} />;
}

/**
 * WebSite schema - helps Google understand site structure
 * Important for search appearance including favicon
 */
export function WebSiteSchema() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BRAND.url}/#website`,
    name: BRAND.name,
    alternateName: BRAND.alternateNames,
    url: BRAND.url,
    description: BRAND.description,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      "@id": `${BRAND.url}/#organization`,
      name: BRAND.name,
      logo: {
        "@type": "ImageObject",
        url: BRAND.logo,
        width: 512,
        height: 512,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BRAND.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return <JsonLd data={data} />;
}

export interface ArticleSchemaProps {
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  updatedAt: string;
  url: string;
}

/**
 * Article schema for article pages
 */
export function ArticleSchema({
  title,
  description,
  image,
  publishedAt,
  updatedAt,
  url,
}: ArticleSchemaProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image,
    datePublished: publishedAt,
    dateModified: updatedAt,
    url,
    author: {
      "@type": "Organization",
      name: "Crest Study Consult Research Team",
      url: BRAND.url,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${BRAND.url}/#organization`,
      name: BRAND.name,
      legalName: BRAND.legalName,
      logo: {
        "@type": "ImageObject",
        url: BRAND.logo,
      },
    },
  };

  return <JsonLd data={data} />;
}

export interface FAQSchemaProps {
  faqs: Array<{ question: string; answer: string }>;
}

/**
 * FAQPage schema for articles with FAQ blocks
 */
export function FAQSchema({ faqs }: FAQSchemaProps) {
  if (faqs.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return <JsonLd data={data} />;
}

export interface BreadcrumbSchemaProps {
  items: Array<{ name: string; url: string }>;
}

/**
 * BreadcrumbList schema for article navigation
 */
export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLd data={data} />;
}
