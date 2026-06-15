import { CommentForm } from "./CommentForm";
import type { Comment } from "./types";

interface CommentListProps {
  comments: Comment[];
  replyingTo: string | null;
  onReply: (commentId: string) => void;
  onCancelReply: () => void;
  postId: string;
  onReplySubmitted: () => void;
}

/**
 * Comment List Component
 * Displays comments with threading support
 */
export function CommentList({ 
  comments, 
  replyingTo, 
  onReply, 
  onCancelReply,
  postId,
  onReplySubmitted
}: CommentListProps) {
  return (
    <div className="space-y-6">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isReplying={replyingTo === comment.id}
          onReply={() => onReply(comment.id)}
          onCancelReply={onCancelReply}
          postId={postId}
          onReplySubmitted={onReplySubmitted}
        />
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  isReplying: boolean;
  onReply: () => void;
  onCancelReply: () => void;
  postId: string;
  onReplySubmitted: () => void;
  isNested?: boolean;
}

function CommentItem({ 
  comment, 
  isReplying, 
  onReply, 
  onCancelReply,
  postId,
  onReplySubmitted,
  isNested = false
}: CommentItemProps) {
  const initials = comment.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formattedDate = new Date(comment.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div 
      id={`comment-${comment.id}`} 
      className={`${isNested ? "ml-12 mt-4" : ""}`}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isNested ? "w-8 h-8" : "w-10 h-10"} bg-teal-100 rounded-full flex items-center justify-center`}>
          <span className={`${isNested ? "text-xs" : "text-sm"} font-semibold text-teal-700`}>
            {initials}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            {comment.authorUrl ? (
              <a 
                href={comment.authorUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-semibold text-gray-900 hover:text-teal-600 transition-colors"
              >
                {comment.authorName}
              </a>
            ) : (
              <span className="font-semibold text-gray-900">{comment.authorName}</span>
            )}
            
            <span className="text-gray-400">·</span>
            
            <time 
              dateTime={new Date(comment.createdAt).toISOString()}
              className="text-sm text-gray-500"
            >
              {formattedDate}
            </time>
            
            {comment.isEdited && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-xs text-gray-400 italic">edited</span>
              </>
            )}
          </div>

          {/* Comment text */}
          <div className="mt-2 text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </div>

          {/* Actions */}
          {!isNested && (
            <div className="mt-3">
              <button
                onClick={onReply}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Reply
              </button>
            </div>
          )}

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-4">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onSuccess={onReplySubmitted}
                onCancel={onCancelReply}
                compact
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-l-2 border-gray-100 ml-5 mt-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReplying={false}
              onReply={() => {}}
              onCancelReply={() => {}}
              postId={postId}
              onReplySubmitted={() => {}}
              isNested
            />
          ))}
        </div>
      )}
    </div>
  );
}
