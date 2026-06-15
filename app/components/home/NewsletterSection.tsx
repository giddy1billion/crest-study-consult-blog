import { useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { cn } from "~/utils/cn";
import { trackNewsletterSignup } from "~/utils/analytics";

interface NewsletterSectionProps {
  className?: string;
}

/**
 * Newsletter CTA Section
 * PRD Section 6.3 & 9.4: Editorial newsletter signup with Resend
 */
export function NewsletterSection({ className }: NewsletterSectionProps) {
  const fetcher = useFetcher<{ success: boolean; message?: string; error?: string }>();
  const [tracked, setTracked] = useState(false);
  const isSubmitting = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success;
  const error = fetcher.data?.error;

  useEffect(() => {
    if (isSuccess && !tracked) {
      trackNewsletterSignup("homepage_section");
      setTracked(true);
    }
  }, [isSuccess, tracked]);

  return (
    <section className={cn("py-16 lg:py-20 bg-navy-700", className)}>
      <div className="container-blog">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          {/* Success State */}
          {isSuccess ? (
            <div className="text-white">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-full mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold">You're subscribed</h2>
              <p className="mt-4 text-teal-100 text-lg">
                {fetcher.data?.message || "Check your inbox for a welcome email."}
              </p>
            </div>
          ) : (
            <>
              {/* Heading */}
              <h2 className="text-2xl lg:text-3xl font-bold text-white">
                Real education insights, not confusion
              </h2>
              
              <p className="mt-4 text-teal-100 text-lg leading-relaxed">
                Verified study abroad guidance from Crest Study Consult delivered to
                your inbox. No spam. Unsubscribe anytime.
              </p>

              {/* Form */}
              <div className="mt-8">
                <fetcher.Form 
                  method="post" 
                  action="/api/newsletter"
                  className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                >
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 text-gray-900 bg-white rounded-lg border-0 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-300 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 text-sm font-semibold text-navy-700 bg-white hover:bg-teal-50 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Subscribing...
                      </>
                    ) : (
                      "Subscribe"
                    )}
                  </button>
                </fetcher.Form>
                
                {error && (
                  <p className="mt-3 text-sm text-red-200 flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                )}

                <p className="mt-4 text-sm text-teal-200">
                  Your data is never shared. Unsubscribe any time.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
