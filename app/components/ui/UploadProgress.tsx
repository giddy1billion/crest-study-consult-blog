/**
 * Upload Progress Component
 * 
 * Provides visual feedback during file uploads with:
 * - File list with names and sizes
 * - Animated progress bar
 * - Status indicators (uploading, success, error)
 */

import { useEffect, useState } from "react";

// ============================================
// Types
// ============================================

export interface UploadFile {
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  errorMessage?: string;
}

export interface UploadProgressProps {
  /** Files being uploaded */
  files: UploadFile[];
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Variant: inline (in form) or overlay (modal) */
  variant?: "inline" | "overlay";
  /** Custom class name */
  className?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Success message */
  successMessage?: string;
  /** Error message */
  errorMessage?: string;
}

// ============================================
// Helpers
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================
// Animated Progress Bar
// ============================================

function AnimatedProgressBar({ isActive }: { isActive: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(100);
      return;
    }

    // Simulate progress that slows down as it approaches 90%
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        // Slower as we get higher
        const increment = Math.max(1, (90 - prev) / 10);
        return Math.min(90, prev + increment);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ease-out ${
          isActive
            ? "bg-gradient-to-r from-teal-500 to-teal-500"
            : "bg-teal-500"
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ============================================
// File Item
// ============================================

function FileItem({ file }: { file: UploadFile }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Status icon */}
      <div className="flex-shrink-0">
        {file.status === "pending" && (
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {file.status === "uploading" && (
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
        {file.status === "success" && (
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {file.status === "error" && (
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
        <p className="text-xs text-gray-500">
          {formatBytes(file.size)}
          {file.errorMessage && (
            <span className="text-red-500 ml-2">{file.errorMessage}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function UploadProgress({
  files,
  isUploading,
  variant = "inline",
  className = "",
  onDismiss,
  successMessage,
  errorMessage,
}: UploadProgressProps) {
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const uploadingCount = files.filter(f => f.status === "uploading").length;
  const successCount = files.filter(f => f.status === "success").length;
  const errorCount = files.filter(f => f.status === "error").length;
  const allComplete = !isUploading && files.length > 0;

  if (files.length === 0 && !successMessage && !errorMessage) {
    return null;
  }

  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isUploading ? (
            <>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Uploading {files.length} file{files.length > 1 ? "s" : ""}...
                </p>
                <p className="text-xs text-gray-500">{formatBytes(totalSize)} total</p>
              </div>
            </>
          ) : allComplete ? (
            <>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                errorCount > 0 ? "bg-amber-100" : "bg-teal-100"
              }`}>
                {errorCount > 0 ? (
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {successCount} uploaded{errorCount > 0 ? `, ${errorCount} failed` : ""}
                </p>
                <p className="text-xs text-gray-500">
                  {successMessage || (errorCount > 0 ? "Some files failed to upload" : "Upload complete")}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {onDismiss && allComplete && (
          <button
            onClick={onDismiss}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isUploading && (
        <div className="px-4 pt-2">
          <AnimatedProgressBar isActive={isUploading} />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="px-4 py-2 max-h-48 overflow-auto">
          {files.map((file, index) => (
            <FileItem key={`${file.name}-${index}`} file={file} />
          ))}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-4">
        {content}
      </div>
    );
  }

  return content;
}

// ============================================
// Hook for managing upload state
// ============================================

export interface UseUploadProgressOptions {
  onUploadComplete?: () => void;
}

export function useUploadProgress(options: UseUploadProgressOptions = {}) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const startUpload = (fileList: FileList | File[]) => {
    const newFiles: UploadFile[] = Array.from(fileList).map(file => ({
      name: file.name,
      size: file.size,
      status: "uploading" as const,
    }));
    setFiles(newFiles);
    setIsUploading(true);
    setSuccessMessage(undefined);
    setErrorMessage(undefined);
  };

  const markSuccess = (message?: string) => {
    setFiles(prev => prev.map(f => ({ ...f, status: "success" as const })));
    setIsUploading(false);
    setSuccessMessage(message || "Upload complete");
    options.onUploadComplete?.();
  };

  const markError = (message: string) => {
    setFiles(prev => prev.map(f => ({ ...f, status: "error" as const })));
    setIsUploading(false);
    setErrorMessage(message);
  };

  const reset = () => {
    setFiles([]);
    setIsUploading(false);
    setSuccessMessage(undefined);
    setErrorMessage(undefined);
  };

  const dismiss = () => {
    if (!isUploading) {
      reset();
    }
  };

  return {
    files,
    isUploading,
    successMessage,
    errorMessage,
    startUpload,
    markSuccess,
    markError,
    reset,
    dismiss,
  };
}
