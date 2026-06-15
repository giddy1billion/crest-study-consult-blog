import { useEffect, useState, useCallback } from "react";
import { cn } from "~/utils/cn";

export interface ImageLightboxProps {
  contentSelector?: string;
}

/**
 * Image Lightbox
 * Click-to-expand for images in article content
 * Supports keyboard navigation and zoom
 */
export function ImageLightbox({
  contentSelector = "#article-content",
}: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const openLightbox = useCallback((src: string, alt: string) => {
    setCurrentImage({ src, alt });
    setIsOpen(true);
    setIsZoomed(false);
    document.body.style.overflow = "hidden";
  }, []);

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    setCurrentImage(null);
    setIsZoomed(false);
    document.body.style.overflow = "";
  }, []);

  const toggleZoom = useCallback(() => {
    setIsZoomed((prev) => !prev);
  }, []);

  // Attach click handlers to images
  useEffect(() => {
    const content = document.querySelector(contentSelector);
    if (!content) return;

    const images = content.querySelectorAll("img");

    const handleClick = (e: Event) => {
      const img = e.currentTarget as HTMLImageElement;
      openLightbox(img.src, img.alt);
    };

    images.forEach((img) => {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", handleClick);
    });

    return () => {
      images.forEach((img) => {
        img.style.cursor = "";
        img.removeEventListener("click", handleClick);
      });
    };
  }, [contentSelector, openLightbox]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          toggleZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeLightbox, toggleZoom]);

  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={closeLightbox}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={toggleZoom}
          className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          aria-label={isZoomed ? "Zoom out" : "Zoom in"}
        >
          {isZoomed ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          )}
        </button>
        <button
          onClick={closeLightbox}
          className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image */}
      <div
        className={cn(
          "relative max-h-[90vh] max-w-[90vw] transition-transform duration-300",
          isZoomed ? "cursor-zoom-out scale-150" : "cursor-zoom-in"
        )}
        onClick={toggleZoom}
      >
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        />
      </div>

      {/* Caption */}
      {currentImage.alt && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-sm rounded-lg max-w-xl text-center">
          {currentImage.alt}
        </div>
      )}

      {/* Keyboard hint */}
      <div className="absolute bottom-4 right-4 text-white/50 text-xs">
        Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Esc</kbd> to close,{" "}
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Space</kbd> to zoom
      </div>
    </div>
  );
}
