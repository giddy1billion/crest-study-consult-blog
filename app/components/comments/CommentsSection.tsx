import { useState, useEffect, useCallback } from "react";
import { useFetcher } from "react-router";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";
import type { Comment, CommentsData } from "./types";

interface CommentsSectionProps {
  postId: string;
  postSlug: string;
  commentsEnabled: boolean;
}

/**
 * Comments Section Component
 * Main container for article comments with form and list
 */
export function CommentsSection({ postId, postSlug, commentsEnabled }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const fetcher = useFetcher<CommentsData>();

  // Load comments
  const loadComments = useCallback(() => {
    if (commentsEnabled) {
      fetcher.load(`/api/comments?postId=${postId}&includeReplies=true`);
    }
  }, [postId, commentsEnabled]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (fetcher.data && !fetcher.data.error) {
      setComments(fetcher.data.comments || []);
      setTotalCount(fetcher.data.totalCount || 0);
      setIsLoading(false);
    } else if (fetcher.data?.error) {
      setIsLoading(false);
    }
  }, [fetcher.data]);

  const handleCommentSubmitted = () => {
    setReplyingTo(null);
    // Reload comments after a delay to allow for moderation
    setTimeout(loadComments, 1000);
  };

  if (!commentsEnabled) {
    return null;
  }

  return (
    <section id="comments" className="mt-16 pt-10 border-t border-gray-200">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Discussion
          {totalCount > 0 && (
            <span className="ml-2 text-lg font-normal text-gray-500">
              ({totalCount} {totalCount === 1 ? "comment" : "comments"})
            </span>
          )}
        </h2>
        
        {/* RSS Feed Link */}
        <a
          href={`/feed/comments/${postSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600 transition-colors"
          title="Subscribe to comments RSS feed"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36m0-6a8.21 8.21 0 0 1 8.18 8.21h-2.73a5.48 5.48 0 0 0-5.45-5.48v-2.73M6.18 4a14 14 0 0 1 14 14h-2.73a11.27 11.27 0 0 0-11.27-11.27V4z" />
          </svg>
          <span className="hidden sm:inline">RSS</span>
        </a>
      </div>

      {/* Comment Form */}
      <div className="mb-10">
        <CommentForm 
          postId={postId} 
          onSuccess={handleCommentSubmitted}
        />
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : comments.length > 0 ? (
        <CommentList 
          comments={comments}
          replyingTo={replyingTo}
          onReply={(commentId) => setReplyingTo(commentId)}
          onCancelReply={() => setReplyingTo(null)}
          postId={postId}
          onReplySubmitted={handleCommentSubmitted}
        />
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No comments yet</h3>
          <p className="mt-2 text-gray-500">Be the first to share your thoughts on this article.</p>
        </div>
      )}
    </section>
  );
}
