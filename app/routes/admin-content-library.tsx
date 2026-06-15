import type { Route } from "./+types/admin-content-library";
import { data, useFetcher, useSearchParams, Link } from "react-router";
import { requireAdmin } from "~/utils/session.server";
import { getMediaByFolder, getStorageStats, isStorageConfigured } from "~/utils/storage.server";
import { BRAND } from "~/utils/constants";
import type { MediaFolder, Media } from "@prisma/client";
import { useState, useRef, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { UploadProgress, useUploadProgress } from "~/components/ui";

/**
 * Meta tags for Content Library
 */
export function meta() {
  return [
    { title: `Content Library — ${BRAND.name} Admin` },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/**
 * Loader - Get media list with pagination
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") as MediaFolder | null;
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || undefined;
  
  const [mediaResult, stats] = await Promise.all([
    getMediaByFolder(folder || undefined, { page, limit: 24, search }),
    getStorageStats(),
  ]);
  
  return data({
    media: mediaResult.media,
    pagination: mediaResult.pagination,
    stats,
    isConfigured: isStorageConfigured(),
    currentFolder: folder,
  });
}

// Folder display names
const FOLDER_NAMES: Record<MediaFolder, string> = {
  HERO_IMAGES: "Hero Images",
  CONTENT: "Content Images",
  AUTHORS: "Author Photos",
  RESEARCH: "Research Assets",
  GENERAL: "General",
};

// Folder icons
const FOLDER_ICONS: Record<MediaFolder, ReactNode> = {
  HERO_IMAGES: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  CONTENT: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  AUTHORS: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  RESEARCH: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  GENERAL: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
};

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date to relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Content Library Page
 */
export default function AdminContentLibrary({ loaderData }: Route.ComponentProps) {
  const { media, pagination, stats, isConfigured, currentFolder } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const uploadProgress = useUploadProgress();
  
  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<MediaFolder>(currentFolder || "GENERAL");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Clear selection on folder change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentFolder]);
  
  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    if (!files.length) return;
    
    // Start tracking upload progress
    uploadProgress.startUpload(Array.from(files));
    
    const formData = new FormData();
    formData.append("folder", uploadFolder);
    
    Array.from(files).forEach(file => {
      formData.append("file", file);
    });
    
    uploadFetcher.submit(formData, {
      method: "POST",
      action: "/api/media",
      encType: "multipart/form-data",
    });
    
    setShowUploadModal(false);
  }, [uploadFolder, uploadFetcher, uploadProgress]);
  
  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);
  
  // Handle upload result
  useEffect(() => {
    if (uploadFetcher.data?.success) {
      uploadProgress.markSuccess("Files uploaded successfully");
    } else if (uploadFetcher.data && !uploadFetcher.data.success) {
      uploadProgress.markError(uploadFetcher.data.error || "Upload failed");
    }
  }, [uploadFetcher.data]);
  
  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };
  
  const selectAll = () => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(media.map(m => m.id)));
    }
  };
  
  // Delete selected
  const deleteSelected = () => {
    if (!selectedIds.size) return;
    
    if (!confirm(`Delete ${selectedIds.size} file(s)? This cannot be undone.`)) {
      return;
    }
    
    deleteFetcher.submit(
      { ids: Array.from(selectedIds) },
      { 
        method: "DELETE", 
        action: "/api/media",
        encType: "application/json",
      }
    );
    
    setSelectedIds(new Set());
  };
  
  // Filter by folder
  const setFolder = (folder: MediaFolder | null) => {
    const params = new URLSearchParams(searchParams);
    if (folder) {
      params.set("folder", folder);
    } else {
      params.delete("folder");
    }
    params.delete("page");
    setSearchParams(params);
  };
  
  // Search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    params.delete("page");
    setSearchParams(params);
  };
  
  // Pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    setSearchParams(params);
  };
  
  // Get selected media for details modal
  const selectedMedia = showDetailsModal ? media.find(m => m.id === showDetailsModal) : null;
  
  // Check if upload is in progress
  const isUploading = uploadFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Storage Not Configured</h2>
          <p className="text-gray-600 mb-4">
            Please configure Supabase Storage by setting <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">SUPABASE_URL</code> and{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">SUPABASE_SERVICE_KEY</code> environment variables.
          </p>
          <a 
            href="https://supabase.com/docs/guides/storage" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            View Supabase Storage Docs →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-[calc(100vh-4rem)]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-teal-500/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Drop files to upload</h3>
            <p className="text-gray-500 mt-1">Files will be uploaded to {FOLDER_NAMES[uploadFolder]}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
            <p className="mt-1 text-sm text-gray-500">
              {stats.totalCount} files · {formatBytes(stats.totalSize)}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-xl hover:bg-navy-800 shadow-lg shadow-navy-700/25 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Files
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Folder tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFolder(null)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                !currentFolder
                  ? "bg-teal-100 text-teal-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              All
            </button>
            {(Object.keys(FOLDER_NAMES) as MediaFolder[]).map(folder => (
              <button
                key={folder}
                onClick={() => setFolder(folder)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  currentFolder === folder
                    ? "bg-teal-100 text-teal-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {FOLDER_ICONS[folder]}
                {FOLDER_NAMES[folder]}
                <span className="text-xs text-gray-400">
                  {stats.byFolder.find(f => f.folder === folder)?.count || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="lg:ml-auto flex gap-2">
            <input
              type="text"
              name="search"
              defaultValue={searchParams.get("search") || ""}
              placeholder="Search files..."
              className="px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all w-64"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedIds.size} selected
            </span>
            <button
              onClick={deleteSelected}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Media Grid */}
      {media.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No files yet</h3>
          <p className="text-gray-500 mb-4">
            Upload images to use in your articles and content.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            Upload your first file →
          </button>
        </div>
      ) : (
        <>
          {/* Select all checkbox */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === media.length && media.length > 0}
              onChange={selectAll}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-600">Select all</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {media.map(item => (
              <div
                key={item.id}
                className={`group relative bg-white rounded-xl border overflow-hidden transition-all ${
                  selectedIds.has(item.id)
                    ? "ring-2 ring-teal-500 border-teal-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 bg-white/80 backdrop-blur-sm"
                  />
                </div>

                {/* Image */}
                <button
                  onClick={() => setShowDetailsModal(item.id)}
                  className="block w-full aspect-square bg-gray-100"
                >
                  <img
                    src={item.publicUrl}
                    alt={item.alt || item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-900 truncate">{item.filename}</p>
                  <p className="text-xs text-gray-500">{formatBytes(item.size)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={!pagination.hasMore}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Folder selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload to folder
              </label>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value as MediaFolder)}
                className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-gray-900 focus:ring-2 focus:ring-teal-500/20"
              >
                {(Object.keys(FOLDER_NAMES) as MediaFolder[]).map(folder => (
                  <option key={folder} value={folder}>
                    {FOLDER_NAMES[folder]}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload area */}
            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isUploading 
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed" 
                  : "border-gray-200 cursor-pointer hover:border-teal-500 hover:bg-teal-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
                disabled={isUploading}
              />
              
              <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium text-teal-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PNG, JPG, WebP, GIF up to 10MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay */}
      {uploadProgress.files.length > 0 && (
        <UploadProgress
          files={uploadProgress.files}
          isUploading={uploadProgress.isUploading}
          variant="overlay"
          successMessage={uploadProgress.successMessage}
          errorMessage={uploadProgress.errorMessage}
          onDismiss={uploadProgress.dismiss}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMedia && (
        <MediaDetailsModal
          media={selectedMedia}
          onClose={() => setShowDetailsModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Media Details Modal Component
 */
function MediaDetailsModal({ 
  media, 
  onClose 
}: { 
  media: Media; 
  onClose: () => void;
}) {
  const updateFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [alt, setAlt] = useState(media.alt || "");
  const [caption, setCaption] = useState(media.caption || "");
  const [copied, setCopied] = useState(false);
  
  const copyUrl = () => {
    navigator.clipboard.writeText(media.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDelete = () => {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    
    deleteFetcher.submit(
      { id: media.id },
      { 
        method: "DELETE", 
        action: "/api/media",
        encType: "application/json",
      }
    );
  };
  
  const handleSave = () => {
    updateFetcher.submit(
      { id: media.id, alt, caption },
      { 
        method: "PATCH", 
        action: "/api/media",
        encType: "application/json",
      }
    );
  };
  
  // Close on successful delete
  useEffect(() => {
    if (deleteFetcher.data?.success) {
      onClose();
    }
  }, [deleteFetcher.data, onClose]);

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{media.filename}</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview */}
            <div>
              <div className="bg-gray-100 rounded-xl overflow-hidden">
                <img
                  src={media.publicUrl}
                  alt={media.alt || media.filename}
                  className="w-full h-auto"
                />
              </div>
              
              {/* Quick info */}
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Dimensions</dt>
                  <dd className="font-medium text-gray-900">
                    {media.width && media.height ? `${media.width}×${media.height}` : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Size</dt>
                  <dd className="font-medium text-gray-900">{formatBytes(media.size)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="font-medium text-gray-900">{media.mimeType}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Used in</dt>
                  <dd className="font-medium text-gray-900">{media.usageCount} articles</dd>
                </div>
              </dl>
            </div>
            
            {/* Metadata form */}
            <div className="space-y-4">
              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={media.publicUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm text-gray-600"
                  />
                  <button
                    onClick={copyUrl}
                    className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              
              {/* Alt text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Text
                </label>
                <input
                  type="text"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Describe the image for accessibility"
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-gray-900 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              
              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Optional caption"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-gray-900 focus:ring-2 focus:ring-teal-500/20 resize-none"
                />
              </div>
              
              {/* Tags display */}
              {media.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {media.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="pt-4 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={updateFetcher.state !== "idle"}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {updateFetcher.state !== "idle" ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteFetcher.state !== "idle"}
                  className="px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deleteFetcher.state !== "idle" ? "Deleting..." : "Delete"}
                </button>
              </div>
              
              {/* Feedback */}
              {updateFetcher.data?.success && (
                <p className="text-sm text-teal-600">Changes saved!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
