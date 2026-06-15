/**
 * Markdown Editor with Toolbar
 * 
 * A textarea with formatting toolbar including image insertion.
 * Images are uploaded to Supabase and inserted as markdown.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useFetcher } from "react-router";
import type { MediaFolder } from "@prisma/client";
import { UploadProgress, useUploadProgress } from "~/components/ui";

// ============================================
// Types
// ============================================

interface MediaItem {
  id: string;
  filename: string;
  publicUrl: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  size: number;
  mimeType: string;
  folder: MediaFolder;
}

interface MarkdownEditorProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
  error?: string;
  hint?: string;
}

// ============================================
// Character Counter
// ============================================

function CharacterCounter({ current, max, min }: { current: number; max?: number; min?: number }) {
  const isOverMax = max && current > max;
  const isUnderMin = min && current < min;
  return (
    <span className={`text-xs tabular-nums ${isOverMax ? "text-red-500 font-medium" : isUnderMin ? "text-amber-500" : "text-gray-400"}`}>
      {current}{max ? `/${max}` : ""} {!isOverMax && !isUnderMin && min && current >= min && "✓"}
    </span>
  );
}

// ============================================
// Format bytes
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================
// Folder names
// ============================================

const FOLDER_NAMES: Record<MediaFolder, string> = {
  HERO_IMAGES: "Hero Images",
  CONTENT: "Content Images",
  AUTHORS: "Author Photos",
  RESEARCH: "Research Assets",
  GENERAL: "General",
};

// ============================================
// Markdown Editor Component
// ============================================

export function MarkdownEditor({
  name,
  label,
  value,
  onChange,
  required,
  placeholder = "Write your content here...",
  rows = 20,
  minLength,
  maxLength,
  error,
  hint,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  
  const libraryFetcher = useFetcher<{
    media: MediaItem[];
    pagination: { page: number; totalPages: number; hasMore: boolean };
  }>();
  const uploadFetcher = useFetcher();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadProgress = useUploadProgress();
  
  // Track the last processed upload to prevent duplicate insertions
  const lastProcessedUploadId = useRef<string | null>(null);
  // Store cursor position at time of upload for accurate insertion
  const uploadCursorPosition = useRef<number>(0);
  // Store value ref to avoid stale closure in useEffect
  const valueRef = useRef(value);
  valueRef.current = value;
  
  // ============================================
  // Toolbar Actions - Insert HTML for mixed content compatibility
  // ============================================
  
  const insertAtCursor = useCallback((before: string, after: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || placeholder;
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);
  
  // Use HTML tags for better compatibility with mixed content
  const insertBold = () => insertAtCursor("<strong>", "</strong>", "bold text");
  const insertItalic = () => insertAtCursor("<em>", "</em>", "italic text");
  const insertHeading2 = () => insertAtCursor("\n<h2>", "</h2>\n", "Heading");
  const insertHeading3 = () => insertAtCursor("\n<h3>", "</h3>\n", "Subheading");
  const insertLink = () => insertAtCursor('<a href="https://">', "</a>", "link text");
  const insertBlockquote = () => insertAtCursor("\n<blockquote><p>", "</p></blockquote>\n", "quote");
  const insertList = () => insertAtCursor("\n<ul>\n<li>", "</li>\n<li>Item 2</li>\n<li>Item 3</li>\n</ul>\n", "Item 1");
  const insertCode = () => insertAtCursor("<code>", "</code>", "code");
  
  // ============================================
  // Image Modal
  // ============================================
  
  const loadMedia = useCallback((page = 1) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (selectedFolder !== "ALL") {
      params.set("folder", selectedFolder);
    }
    if (searchQuery) {
      params.set("search", searchQuery);
    }
    
    libraryFetcher.load(`/admin/content-library?${params.toString()}`);
  }, [selectedFolder, searchQuery, libraryFetcher]);
  
  useEffect(() => {
    if (isImageModalOpen && libraryFetcher.state === "idle" && !libraryFetcher.data) {
      loadMedia();
    }
  }, [isImageModalOpen]);
  
  useEffect(() => {
    if (isImageModalOpen) {
      loadMedia();
    }
  }, [selectedFolder, isImageModalOpen]);
  
  const handleImageSelect = (media: MediaItem) => {
    const alt = media.alt || media.filename.replace(/\.[^.]+$/, "").replace(/-/g, " ");
    // Use HTML img tag for compatibility with mixed HTML content
    const imgHtml = `\n<img src="${media.publicUrl}" alt="${alt}" loading="lazy" class="rounded-xl">\n`;
    
    const textarea = textareaRef.current;
    if (textarea) {
      const pos = textarea.selectionStart;
      const newValue = value.substring(0, pos) + imgHtml + value.substring(pos);
      onChange(newValue);
    } else {
      onChange(value + imgHtml);
    }
    
    setIsImageModalOpen(false);
  };
  
  const handleUpload = (files: FileList | null) => {
    if (!files?.length) return;
    
    // Store cursor position before upload for accurate insertion later
    const textarea = textareaRef.current;
    uploadCursorPosition.current = textarea?.selectionStart ?? 0;
    
    // Start tracking upload progress
    uploadProgress.startUpload(files);
    
    const formData = new FormData();
    formData.append("folder", "CONTENT");
    Array.from(files).forEach(file => {
      formData.append("file", file);
    });
    
    uploadFetcher.submit(formData, {
      method: "POST",
      action: "/api/media",
      encType: "multipart/form-data",
    });
  };
  
  // Auto-insert after successful upload - runs only once per unique upload
  useEffect(() => {
    const mediaData = uploadFetcher.data?.media;
    
    // Only process if we have successful upload data AND haven't processed this upload yet
    if (uploadFetcher.data?.success && mediaData && lastProcessedUploadId.current !== mediaData.id) {
      // Mark this upload as processed to prevent duplicate insertions
      lastProcessedUploadId.current = mediaData.id;
      
      uploadProgress.markSuccess();
      const alt = mediaData.filename.replace(/\.[^.]+$/, "").replace(/-/g, " ");
      // Use HTML img tag for compatibility with mixed HTML content
      const imgHtml = `\n<img src="${mediaData.publicUrl}" alt="${alt}" loading="lazy" class="rounded-xl">\n`;
      
      // Use the cursor position stored when upload was initiated
      // Use valueRef to get current value without adding it to dependencies
      const currentValue = valueRef.current;
      const pos = uploadCursorPosition.current;
      const newValue = currentValue.substring(0, pos) + imgHtml + currentValue.substring(pos);
      onChange(newValue);
      
      setIsImageModalOpen(false);
    } else if (uploadFetcher.data && !uploadFetcher.data.success) {
      uploadProgress.markError(uploadFetcher.data.error || "Upload failed");
    }
  }, [uploadFetcher.data, onChange, uploadProgress]);
  
  const isLoading = libraryFetcher.state === "loading";
  const isUploading = uploadFetcher.state === "submitting";
  const media = libraryFetcher.data?.media || [];
  
  // ============================================
  // Toolbar button component
  // ============================================
  
  const ToolbarButton = ({ onClick, title, children, active = false }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        active 
          ? "bg-teal-100 text-teal-700" 
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="group">
      {/* Label */}
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <CharacterCounter current={value.length} max={maxLength} min={minLength} />
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-200 border-b-0 rounded-t-xl">
        <ToolbarButton onClick={insertBold} title="Bold (Ctrl+B)">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton onClick={insertItalic} title="Italic (Ctrl+I)">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4m-2 0l-2 16m-2 0h4" />
          </svg>
        </ToolbarButton>
        
        <div className="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton onClick={insertHeading2} title="Heading 2">
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        
        <ToolbarButton onClick={insertHeading3} title="Heading 3">
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>
        
        <div className="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton onClick={insertLink} title="Insert link">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton onClick={() => setIsImageModalOpen(true)} title="Insert image">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </ToolbarButton>
        
        <div className="w-px h-5 bg-gray-300 mx-1" />
        
        <ToolbarButton onClick={insertBlockquote} title="Blockquote">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton onClick={insertList} title="Bullet list">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </ToolbarButton>
        
        <ToolbarButton onClick={insertCode} title="Inline code">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>
      </div>
      
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        id={name}
        name={name}
        required={required}
        maxLength={maxLength}
        minLength={minLength}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-3 bg-white border border-gray-200 rounded-b-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none font-mono text-sm leading-relaxed ${
          error ? "border-red-300 bg-red-50/50" : "hover:border-gray-300"
        }`}
      />
      
      {/* Error/Hint */}
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      
      {/* Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Insert Image</h3>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Filters */}
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value as MediaFolder | "ALL")}
                className="px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="ALL">All Folders</option>
                {(Object.keys(FOLDER_NAMES) as MediaFolder[]).map(f => (
                  <option key={f} value={f}>{FOLDER_NAMES[f]}</option>
                ))}
              </select>
              
              <form onSubmit={(e) => { e.preventDefault(); loadMedia(); }} className="flex-1 flex gap-2 max-w-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="flex-1 px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  Search
                </button>
              </form>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />
            </div>
            
            {/* Upload Progress */}
            {uploadProgress.files.length > 0 && (
              <div className="px-4 pt-2">
                <UploadProgress
                  files={uploadProgress.files}
                  isUploading={uploadProgress.isUploading}
                  successMessage={uploadProgress.successMessage}
                  errorMessage={uploadProgress.errorMessage}
                  onDismiss={uploadProgress.dismiss}
                />
              </div>
            )}
            
            {/* Grid */}
            <div className="flex-1 overflow-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <svg className="w-8 h-8 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : media.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 mb-2">No images found</p>
                  <p className="text-sm text-gray-500">Upload an image to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {media.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleImageSelect(item)}
                      className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-teal-500 transition-all"
                    >
                      <img
                        src={item.publicUrl}
                        alt={item.alt || item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs truncate">{item.filename}</p>
                          <p className="text-white/70 text-xs">{formatBytes(item.size)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Pagination */}
            {libraryFetcher.data?.pagination && libraryFetcher.data.pagination.totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => loadMedia(libraryFetcher.data!.pagination.page - 1)}
                  disabled={libraryFetcher.data.pagination.page === 1}
                  className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {libraryFetcher.data.pagination.page} of {libraryFetcher.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => loadMedia(libraryFetcher.data!.pagination.page + 1)}
                  disabled={!libraryFetcher.data.pagination.hasMore}
                  className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
