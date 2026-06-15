import { cn } from "~/utils/cn";
import type { FAQItem } from "~/types";

export interface FAQBlockProps {
  faqs: FAQItem[];
  showHeading?: boolean;
  className?: string;
}

/**
 * FAQ Block with accordion behavior
 * Renders as details/summary for native accessibility
 * Schema: FAQPage JSON-LD should accompany this component
 */
export function FAQBlock({ faqs, showHeading = true, className }: FAQBlockProps) {
  if (faqs.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {showHeading && (
        <h2 className="text-2xl font-semibold text-gray-900">
          Frequently asked questions
        </h2>
      )}
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="group border border-gray-200 rounded-lg"
          >
            <summary className="cursor-pointer p-4 font-medium text-gray-900 list-none flex justify-between items-center hover:bg-gray-50 rounded-lg">
              <span>{faq.question}</span>
              <svg
                className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-0">
              <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
