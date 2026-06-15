/**
 * Newsletter Subscription Component
 * 
 * Reusable newsletter signup form with multiple variants.
 */

import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { trackNewsletterSignup } from "~/utils/analytics";

type NewsletterVariant = "inline" | "card" | "footer" | "hero";

interface NewsletterFormProps {
  variant?: NewsletterVariant;
  title?: string;
  description?: string;
  showFirstName?: boolean;
  source?: string;
  className?: string;
}

export function NewsletterForm({
  variant = "card",
  title = "Stay informed",
  description = "Get weekly market insights, verification guides, and policy updates delivered to your inbox.",
  showFirstName = false,
  source = "newsletter_form",
  className = "",
}: NewsletterFormProps) {
  const fetcher = useFetcher<{ success: boolean; message?: string; error?: string }>();
  const [submitted, setSubmitted] = useState(false);

  const isSubmitting = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success;
  const error = fetcher.data?.error;

  useEffect(() => {
    if (isSuccess && !submitted) {
      setSubmitted(true);
      trackNewsletterSignup("newsletter_form");
    }
  }, [isSuccess, submitted]);

  // Success state
  if (submitted && isSuccess) {
    return (
      <div className={getContainerClasses(variant, className)}>
        <div className="flex items-center gap-3 text-teal-600">
          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">You're subscribed</p>
            <p className="text-sm text-gray-600">{fetcher.data?.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={getContainerClasses(variant, className)}>
      {variant !== "inline" && (
        <div className="mb-4">
          <h3 className={getTitleClasses(variant)}>{title}</h3>
          <p className={getDescriptionClasses(variant)}>{description}</p>
        </div>
      )}

      <fetcher.Form method="post" action="/api/newsletter" className={getFormClasses(variant)}>
        <input type="hidden" name="source" value={source} />
        {showFirstName && (
          <input
            type="text"
            name="firstName"
            placeholder="First name"
            className={getInputClasses(variant)}
            disabled={isSubmitting}
          />
        )}
        
        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          required
          className={getInputClasses(variant)}
          disabled={isSubmitting}
        />
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={getButtonClasses(variant)}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Subscribing...
            </>
          ) : (
            getButtonText(variant)
          )}
        </button>
      </fetcher.Form>

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {variant !== "inline" && (
        <p className="mt-3 text-xs text-gray-500">
          No spam, unsubscribe anytime. We respect your privacy.
        </p>
      )}
    </div>
  );
}

// Variant-specific styling helpers
function getContainerClasses(variant: NewsletterVariant, className: string): string {
  const base = {
    inline: "",
    card: "bg-white rounded-2xl border border-gray-100 p-6 shadow-sm",
    footer: "bg-gray-800 rounded-2xl p-6",
    hero: "bg-gradient-to-br from-teal-50 to-teal-50 rounded-2xl p-8 border border-teal-100",
  };
  return `${base[variant]} ${className}`;
}

function getTitleClasses(variant: NewsletterVariant): string {
  const base = {
    inline: "text-lg font-semibold text-gray-900",
    card: "text-lg font-semibold text-gray-900",
    footer: "text-lg font-semibold text-white",
    hero: "text-xl font-bold text-gray-900",
  };
  return base[variant];
}

function getDescriptionClasses(variant: NewsletterVariant): string {
  const base = {
    inline: "text-sm text-gray-600",
    card: "mt-1 text-sm text-gray-600",
    footer: "mt-1 text-sm text-gray-400",
    hero: "mt-2 text-gray-600",
  };
  return base[variant];
}

function getFormClasses(variant: NewsletterVariant): string {
  const base = {
    inline: "flex gap-2",
    card: "flex flex-col sm:flex-row gap-2",
    footer: "flex flex-col sm:flex-row gap-2",
    hero: "flex flex-col sm:flex-row gap-3",
  };
  return base[variant];
}

function getInputClasses(variant: NewsletterVariant): string {
  const base = {
    inline: "flex-1 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all disabled:opacity-50",
    card: "flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all disabled:opacity-50",
    footer: "flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all disabled:opacity-50",
    hero: "flex-1 px-5 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all disabled:opacity-50",
  };
  return base[variant];
}

function getButtonClasses(variant: NewsletterVariant): string {
  const base = {
    inline: "inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50",
    card: "inline-flex items-center justify-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50",
    footer: "inline-flex items-center justify-center px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50",
    hero: "inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-medium rounded-xl shadow-lg shadow-green-600/25 hover:bg-green-700 transition-all disabled:opacity-50",
  };
  return base[variant];
}

function getButtonText(variant: NewsletterVariant): string {
  const text = {
    inline: "Subscribe",
    card: "Subscribe",
    footer: "Subscribe",
    hero: "Subscribe for free →",
  };
  return text[variant];
}

/**
 * Compact newsletter CTA for article pages
 */
export function NewsletterCTA() {
  return (
    <div className="my-8 p-6 bg-gradient-to-br from-teal-50 to-teal-50 rounded-2xl border border-teal-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">Crest Study Consult Research</h4>
          <p className="mt-1 text-sm text-gray-600">
            Verified study abroad guidance on admissions, visas, and scholarships.
          </p>
          <NewsletterForm variant="inline" source="article_cta" className="mt-4" />
        </div>
      </div>
    </div>
  );
}
