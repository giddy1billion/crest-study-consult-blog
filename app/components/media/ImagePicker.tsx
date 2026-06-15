/**
 * Image Picker Component
 * 
 * A reusable component for selecting images from the Content Library
 * or uploading new files. Used in article editor for hero images
 * and inline content images.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useFetcher } from "react-router";
import type { MediaFolder } from "@prisma/client";
import { UploadProgress, useUploadProgress } from "~/components/ui";

// ============================================
// Types
// ============================================

export interface MediaItem {
  id: string;
  filename: string;
  publicUrl: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  size: number;
  mimeType: string;
  folder: MediaFolder;
  createdAt: string;
}

export interface ImagePickerProps {
  /** Currently selected image URL */
  value?: string;
  /** Callback when image is selected */
  onChange: (url: string, alt?: string) => void;
  /** Default folder for uploads */
  folder?: MediaFolder;
  /** Placeholder text */
  placeholder?: string;
  /** Show recommended dimensions hint */
  recommendedSize?: { width: number; height: number };
  /** Custom class name */
  className?: string;
  /** Whether to show alt text input */
  showAltInput?: boolean;
  /** Current alt text value */
  altValue?: string;
  /** Alt text change handler */
  onAltChange?: (alt: string) => void;
}

// ============================================
// Folder names for display
// ============================================

const FOLDER_NAMES: Record<MediaFolder, string> = {
  HERO_IMAGES: "Hero Images",
  CONTENT: "Content Images",
  AUTHORS: "Author Photos",
  RESEARCH: "Research Assets",
  GENERAL: "General",
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
 * Image Picker Component
 */
export function ImagePicker({
  value,
  onChange,
  folder = "GENERAL",
  placeholder = "Select or upload an image",
  recommendedSize,
  className = "",
  showAltInput = false,
  altValue = "",
  onAltChange,
}: ImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | "ALL">("ALL");
  
  const libraryFetcher = useFetcher<{
    media: MediaItem[];
    pagination: { page: number; totalPages: number; hasMore: boolean };
  }>();
  const uploadFetcher = useFetcher();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadProgress = useUploadProgress();
  
  // Load media when modal opens
  useEffect(() => {
    if (isOpen && libraryFetcher.state === "idle" && !libraryFetcher.data) {
      loadMedia();
    }
  }, [isOpen]);
  
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
  
  // Reload when filter changes
  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [selectedFolder, isOpen]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMedia();
  };
  
  const handleSelect = (media: MediaItem) => {
    onChange(media.publicUrl, media.alt || undefined);
    setIsOpen(false);
  };
  
  const handleUpload = (files: FileList | null) => {
    if (!files?.length) return;
    
    // Start tracking upload progress
    uploadProgress.startUpload(files);
    
    const formData = new FormData();
    formData.append("folder", folder);
    Array.from(files).forEach(file => {
      formData.append("file", file);
    });
    
    uploadFetcher.submit(formData, {
      method: "POST",
      action: "/api/media",
      encType: "multipart/form-data",
    });
  };
  
  // Auto-select after successful upload
  useEffect(() => {
    if (uploadFetcher.data?.success && uploadFetcher.data?.media) {
      uploadProgress.markSuccess();
      onChange(uploadFetcher.data.media.publicUrl);
      setIsOpen(false);
    } else if (uploadFetcher.data && !uploadFetcher.data.success) {
      uploadProgress.markError(uploadFetcher.data.error || "Upload failed");
    }
  }, [uploadFetcher.data, onChange]);
  
  const isLoading = libraryFetcher.state === "loading";
  const isUploading = uploadFetcher.state === "submitting";
  const media = libraryFetcher.data?.media || [];

  return (
    <div className={className}>
      {/* Preview / Trigger */}
      <div 
        onClick={() => setIsOpen(true)}
        className="group cursor-pointer"
      >
        {value ? (
          <div className="relative rounded-xl overflow-hidden border border-gray-200 hover:border-teal-500 transition-colors">
            <img
              src={value}
              alt={altValue || "Selected image"}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Change image</span>
            </div>
            {recommendedSize && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                {recommendedSize.width}×{recommendedSize.height} recommended
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-200 rounded-xl hover:border-teal-500 hover:bg-teal-50/50 transition-colors">
            <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600">{placeholder}</span>
            {recommendedSize && (
              <span className="text-xs text-gray-400 mt-1">
                {recommendedSize.width}×{recommendedSize.height} recommended
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alt text input */}
      {showAltInput && value && (
        <div className="mt-2">
          <input
            type="text"
            value={altValue}
            onChange={(e) => onAltChange?.(e.target.value)}
            placeholder="Alt text (describe the image)"
            className="w-full px-3 py-2 text-sm bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      )}

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
            onAltChange?.("");
          }}
          className="mt-2 text-sm text-gray-500 hover:text-red-600"
        >
          Remove image
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-gray-900">Select Image</h3>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab("library")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "library"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Library
                  </button>
                  <button
                    onClick={() => setActiveTab("upload")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      activeTab === "upload"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Upload
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "library" ? (
                <div className="h-full flex flex-col">
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
                    
                    <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-sm">
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
                  </div>

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
                        <button
                          onClick={() => setActiveTab("upload")}
                          className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                        >
                          Upload an image →
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {media.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              value === item.publicUrl
                                ? "border-teal-500 ring-2 ring-teal-500/20"
                                : "border-transparent hover:border-teal-300"
                            }`}
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
                            {value === item.publicUrl && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {libraryFetcher.data?.pagination && libraryFetcher.data.pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                      <button
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
                        onClick={() => loadMedia(libraryFetcher.data!.pagination.page + 1)}
                        disabled={!libraryFetcher.data.pagination.hasMore}
                        className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Upload Tab */
                <div className="p-6">
                  {/* Upload Progress */}
                  {uploadProgress.files.length > 0 && (
                    <div className="mb-4">
                      <UploadProgress
                        files={uploadProgress.files}
                        isUploading={uploadProgress.isUploading}
                        successMessage={uploadProgress.successMessage}
                        errorMessage={uploadProgress.errorMessage}
                        onDismiss={uploadProgress.dismiss}
                      />
                    </div>
                  )}

                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
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
                      onChange={(e) => handleUpload(e.target.files)}
                      className="hidden"
                      disabled={isUploading}
                    />
                    
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 mb-2">
                      <span className="font-medium text-teal-600">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-sm text-gray-500">PNG, JPG, WebP, GIF up to 10MB</p>
                    {recommendedSize && (
                      <p className="text-sm text-gray-400 mt-2">
                        Recommended: {recommendedSize.width}×{recommendedSize.height}px
                      </p>
                    )}
                  </div>

                  <p className="mt-4 text-sm text-gray-500">
                    Files will be uploaded to: <strong>{FOLDER_NAMES[folder]}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImagePicker;
