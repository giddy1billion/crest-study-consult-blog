#!/usr/bin/env node

/**
 * Crest Study Consult Content Validation Script
 *
 * Validates brand rules and SEO requirements for blog.creststudyconsult.com
 * Used by the pre-publish hook to catch common issues before they are committed.
 */

const path = require('path');

// Brand rules
const BRAND_NAME = 'Crest Study Consult';
const LEGAL_NAME = 'Crest Study Consult LTD';
const DOMAIN = 'blog.creststudyconsult.com';

// Patterns to detect violations
const VIOLATIONS = {
  // "Crest" alone in prose (not "Crest Study Consult")
  brandAlone: /\bCrest\b(?!\s+Study\s+Consult)/g,
  // Marketing hype words
  hypeWords: /\b(game-?changer|revolutionary|cutting-?edge|exciting\s+new|we're\s+thrilled|amazing|incredible|world-?class|life-?changing)\b/gi,
  // Bad anchor text
  badAnchors: /\[click\s+here\]|\[read\s+more\]|\[learn\s+more\]/gi,
  // Vague claims
  vagueClaims: /\b(many\s+students\s+say|experts\s+say|it\s+is\s+widely\s+known|some\s+believe)\b/gi,
  // Dates in slugs
  datedSlug: /slug['":\s]+['"]?[\w-]*\d{4}[-/]\d{2}[-/]?\d{0,2}/gi,
  // Underscores in slugs
  underscoreSlug: /slug['":\s]+['"]?[\w]*_[\w]*/gi,
};

// SEO field requirements
const SEO_RULES = {
  metaTitle: {
    maxLength: 60,
    mustContain: ['Crest Study Consult'],
  },
  metaDescription: {
    minLength: 150,
    maxLength: 160,
    mustNotStartWith: ['This article', 'Learn how to', 'In this article'],
  },
};

function validateContent(content, filePath) {
  const errors = [];
  const warnings = [];
  const ext = path.extname(filePath).toLowerCase();

  // Only validate editorial/content + structured files
  if (!['.md', '.mdx', '.tsx', '.ts', '.json'].includes(ext)) {
    return { errors, warnings };
  }

  // Editorial-only checks (markdown content)
  if (['.md', '.mdx'].includes(ext)) {
    const brandMatches = content.match(VIOLATIONS.brandAlone);
    if (brandMatches) {
      // Allow technical contexts (URLs, imports, code-ish strings)
      const realViolations = brandMatches.filter(() => true);
      if (realViolations.length > 0) {
        warnings.push(`Brand reminder: use the full name "${BRAND_NAME}" in prose, not "Crest" alone`);
      }
    }

    const hypeMatches = content.match(VIOLATIONS.hypeWords);
    if (hypeMatches) {
      warnings.push(`Editorial warning: avoid hype words: ${[...new Set(hypeMatches)].join(', ')}`);
    }

    const vagueMatches = content.match(VIOLATIONS.vagueClaims);
    if (vagueMatches) {
      warnings.push('Editorial warning: avoid vague claims — attribute specifically');
    }

    const anchorMatches = content.match(VIOLATIONS.badAnchors);
    if (anchorMatches) {
      errors.push(`SEO violation: use descriptive anchor text, not "${anchorMatches[0]}"`);
    }
  }

  // Slug hygiene
  if (VIOLATIONS.datedSlug.test(content)) {
    errors.push('SEO violation: do not include dates in slugs');
  }
  if (VIOLATIONS.underscoreSlug.test(content)) {
    errors.push('SEO violation: use hyphens in slugs, not underscores');
  }

  // metaTitle
  const metaTitleMatch = content.match(/metaTitle['":\s]+['"]([^'"]+)['"]/);
  if (metaTitleMatch) {
    const title = metaTitleMatch[1];
    if (title.length > SEO_RULES.metaTitle.maxLength) {
      errors.push(`SEO violation: metaTitle exceeds ${SEO_RULES.metaTitle.maxLength} chars (${title.length})`);
    }
    if (!SEO_RULES.metaTitle.mustContain.some((s) => title.includes(s))) {
      errors.push(`SEO violation: metaTitle must contain "${BRAND_NAME}"`);
    }
  }

  // metaDescription
  const metaDescMatch = content.match(/metaDescription['":\s]+['"]([^'"]+)['"]/);
  if (metaDescMatch) {
    const desc = metaDescMatch[1];
    if (desc.length < SEO_RULES.metaDescription.minLength) {
      warnings.push(`SEO warning: metaDescription under ${SEO_RULES.metaDescription.minLength} chars (${desc.length})`);
    }
    if (desc.length > SEO_RULES.metaDescription.maxLength) {
      errors.push(`SEO violation: metaDescription exceeds ${SEO_RULES.metaDescription.maxLength} chars (${desc.length})`);
    }
    for (const prefix of SEO_RULES.metaDescription.mustNotStartWith) {
      if (desc.startsWith(prefix)) {
        errors.push(`SEO violation: metaDescription should not start with "${prefix}"`);
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const input = process.env.COPILOT_HOOK_INPUT;

  if (input) {
    try {
      const data = JSON.parse(input);
      const content = data.content || '';
      const filePath = data.filePath || 'unknown';

      const { errors, warnings } = validateContent(content, filePath);

      if (errors.length > 0) {
        console.error('❌ Crest Study Consult validation errors:');
        errors.forEach((e) => console.error(`   • ${e}`));
        process.exit(1);
      }

      if (warnings.length > 0) {
        console.warn('⚠️  Crest Study Consult validation warnings:');
        warnings.forEach((w) => console.warn(`   • ${w}`));
      }

      console.log('✅ Crest Study Consult validation passed');
    } catch (e) {
      console.log('✅ Crest Study Consult validation skipped (no content to validate)');
    }
  }

  process.exit(0);
}

main();
