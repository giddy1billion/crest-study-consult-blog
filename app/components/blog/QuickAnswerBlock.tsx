import { cn } from "~/utils/cn";

export interface QuickAnswerBlockProps {
  question?: string;
  answer: string;
  source?: string;
  className?: string;
}

/**
 * Quick Answer Block for AEO optimization
 * Displays a self-contained, extractable answer
 * Position: immediately below H1, before article body
 */
export function QuickAnswerBlock({
  question,
  answer,
  source = "Crest Study Consult Research",
  className,
}: QuickAnswerBlockProps) {
  return (
    <div
      className={cn(
        "border-l-4 border-teal-500 bg-teal-50 p-6 rounded-r-xl",
        className
      )}
      role="region"
      aria-label="Quick answer"
    >
      {question && (
        <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-2">
          Quick answer
        </p>
      )}
      {question && (
        <p className="text-lg font-medium text-gray-900 mb-3">{question}</p>
      )}
      <p className="text-gray-700 leading-relaxed">{answer}</p>
      <p className="text-sm text-gray-500 mt-4 italic">Source: {source}</p>
    </div>
  );
}
