/**
 * Comment Types
 * Type definitions for the commenting system
 */

export interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorUrl?: string | null;
  parentId?: string | null;
  createdAt: string | Date;
  isEdited: boolean;
  replies?: Comment[];
}

export interface CommentsData {
  comments?: Comment[];
  totalCount?: number;
  commentsEnabled?: boolean;
  error?: string;
}

export interface CommentSubmitResponse {
  success: boolean;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
  comment?: {
    id: string;
    authorName: string;
    createdAt: Date;
  };
}
