import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

interface ActionData {
  success?: boolean;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
}

/**
 * Comment Form Component
 * Form for submitting new comments or replies
 */
export function CommentForm({ 
  postId, 
  parentId, 
  onSuccess, 
  onCancel,
  compact = false 
}: CommentFormProps) {
  const fetcher = useFetcher<ActionData>();
  const formRef = useRef<HTMLFormElement>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isSubmitting = fetcher.state === "submitting";
  const errors = fetcher.data?.errors;
  const hasError = fetcher.data?.error;

  useEffect(() => {
    if (fetcher.data?.success) {
      setShowSuccess(true);
      formRef.current?.reset();
      onSuccess?.();
      
      // Hide success message after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.data, onSuccess]);

  return (
    <div className={compact ? "pl-12" : ""}>
      {showSuccess && (
        <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-teal-800">Comment submitted</p>
            <p className="text-sm text-teal-700">{fetcher.data?.message}</p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{fetcher.data?.error}</p>
        </div>
      )}

      <fetcher.Form 
        ref={formRef}
        method="post" 
        action="/api/comments"
        className={`bg-white rounded-xl border border-gray-200 p-5 ${compact ? "shadow-sm" : ""}`}
      >
        <input type="hidden" name="postId" value={postId} />
        {parentId && <input type="hidden" name="parentId" value={parentId} />}
        
        {/* Comment content */}
        <div className="mb-4">
          <label htmlFor={`content-${parentId || "main"}`} className="block text-sm font-medium text-gray-700 mb-1">
            {parentId ? "Your reply" : "Your comment"}
          </label>
          <textarea
            id={`content-${parentId || "main"}`}
            name="content"
            rows={compact ? 3 : 4}
            required
            minLength={5}
            maxLength={2000}
            placeholder={parentId ? "Write your reply..." : "Share your thoughts on this article..."}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all ${
              errors?.content ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
            }`}
          />
          {errors?.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Comments are moderated before appearing. Be respectful and constructive.
          </p>
        </div>

        {/* Author details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor={`authorName-${parentId || "main"}`} className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id={`authorName-${parentId || "main"}`}
              name="authorName"
              required
              minLength={2}
              maxLength={100}
              placeholder="Your name"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${
                errors?.authorName ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
              }`}
            />
            {errors?.authorName && (
              <p className="mt-1 text-sm text-red-600">{errors.authorName}</p>
            )}
          </div>

          <div>
            <label htmlFor={`authorEmail-${parentId || "main"}`} className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id={`authorEmail-${parentId || "main"}`}
              name="authorEmail"
              required
              placeholder="your@email.com"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${
                errors?.authorEmail ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
              }`}
            />
            {errors?.authorEmail && (
              <p className="mt-1 text-sm text-red-600">{errors.authorEmail}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Never displayed publicly</p>
          </div>
        </div>

        {/* Optional website */}
        {!compact && (
          <div className="mb-4">
            <label htmlFor={`authorUrl-${parentId || "main"}`} className="block text-sm font-medium text-gray-700 mb-1">
              Website <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="url"
              id={`authorUrl-${parentId || "main"}`}
              name="authorUrl"
              placeholder="https://yourwebsite.com"
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${
                errors?.authorUrl ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
              }`}
            />
            {errors?.authorUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.authorUrl}</p>
            )}
          </div>
        )}

        {/* Submit buttons */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-700 text-white font-medium rounded-xl hover:bg-navy-800 focus:ring-4 focus:ring-navy-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {parentId ? "Post reply" : "Post comment"}
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-gray-600 font-medium hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </fetcher.Form>
    </div>
  );
}
