import { useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { cn } from "~/utils/cn";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { trackNewsletterSignup } from "~/utils/analytics";
import type { NewsletterResponse } from "~/types";

export interface NewsletterFormProps {
  className?: string;
  variant?: "default" | "compact";
  source?: string;
}

/**
 * Newsletter signup form
 * Submits to /api/newsletter with Resend integration
 * Copy follows PRD Section 9.4
 */
export function NewsletterForm({
  className,
  variant = "default",
  source = "newsletter_form",
}: NewsletterFormProps) {
  const fetcher = useFetcher<NewsletterResponse>();
  const [tracked, setTracked] = useState(false);
  const isLoading = fetcher.state !== "idle";
  const isSuccess = fetcher.data?.success === true;
  const error = fetcher.data?.error;

  // Track successful signup
  useEffect(() => {
    if (isSuccess && !tracked) {
      trackNewsletterSignup(source);
      setTracked(true);
    }
  }, [isSuccess, tracked, source]);

  if (isSuccess) {
    return (
      <div className={cn("text-center p-6 bg-teal-50 rounded-lg", className)}>
        <p className="text-teal-700 font-medium">
          You're subscribed to Crest Study Consult Research
        </p>
        <p className="text-teal-600 text-sm mt-1">
          Check your inbox to confirm your subscription.
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <fetcher.Form
        method="post"
        action="/api/newsletter"
        className={cn("flex gap-2", className)}
      >
        <Input
          type="email"
          name="email"
          placeholder="Email address"
          required
          className="flex-1"
          error={error}
        />
        <Button type="submit" isLoading={isLoading}>
          Subscribe
        </Button>
      </fetcher.Form>
    );
  }

  return (
    <div className={cn("bg-gray-50 rounded-lg p-8", className)}>
      <h3 className="text-xl font-semibold text-gray-900">
        Real education insights, not confusion.
      </h3>
      <p className="text-gray-600 mt-2">
        Verified study abroad guidance from Crest Study Consult delivered to your
        inbox. No spam. Unsubscribe anytime.
      </p>

      <fetcher.Form
        method="post"
        action="/api/newsletter"
        className="mt-6 flex flex-col sm:flex-row gap-3"
      >
        <Input
          type="email"
          name="email"
          placeholder="Email address"
          required
          className="flex-1"
          error={error}
        />
        <Button type="submit" isLoading={isLoading} className="sm:w-auto">
          Subscribe to Crest Study Consult Research
        </Button>
      </fetcher.Form>

      <p className="text-xs text-gray-500 mt-4">
        Your data is never shared. Unsubscribe any time.
      </p>
    </div>
  );
}
