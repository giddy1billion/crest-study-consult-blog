import { useEffect, useState } from "react";
import { cn } from "~/utils/cn";

export interface ReadingProgressProps {
  targetSelector?: string;
  className?: string;
}

/**
 * Reading Progress Bar
 * Shows scroll progress through article content
 * Fixed at top of viewport
 */
export function ReadingProgress({
  targetSelector = "#article-content",
  className,
}: ReadingProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    const handleScroll = () => {
      const targetRect = target.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how much of the target has been scrolled past
      const targetTop = targetRect.top;
      const targetHeight = targetRect.height;
      
      // Start showing when target is in view
      if (targetTop < windowHeight && targetRect.bottom > 0) {
        setIsVisible(true);
        
        // Calculate progress
        const scrolled = windowHeight - targetTop;
        const total = targetHeight + windowHeight;
        const percentage = Math.min(Math.max((scrolled / total) * 100, 0), 100);
        
        setProgress(percentage);
      } else if (targetRect.bottom <= 0) {
        // Finished reading
        setProgress(100);
      } else {
        // Not yet at content
        setIsVisible(false);
        setProgress(0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [targetSelector]);

  if (!isVisible && progress === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 h-1 z-50 bg-gray-200/50",
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="h-full bg-teal-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
