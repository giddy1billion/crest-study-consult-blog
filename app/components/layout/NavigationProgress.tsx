import { useNavigation } from "react-router";
import { useEffect, useState, useRef } from "react";
import { cn } from "~/utils/cn";

/**
 * Navigation Progress Bar
 * Displays a liquid-animated loading bar at the bottom of the header during page navigation.
 * Uses React Router's useNavigation hook to detect loading state.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";
  
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isNavigating) {
      // Start progress
      setVisible(true);
      setProgress(0);
      
      // Simulate progress with easing - fast start, slow middle, pause before complete
      let currentProgress = 0;
      intervalRef.current = setInterval(() => {
        currentProgress += Math.random() * 15;
        
        // Slow down as we approach 90%
        if (currentProgress > 60) {
          currentProgress += Math.random() * 3;
        }
        if (currentProgress > 80) {
          currentProgress += Math.random() * 1;
        }
        
        // Cap at 90% until navigation completes
        if (currentProgress >= 90) {
          currentProgress = 90;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
        
        setProgress(currentProgress);
      }, 200);
    } else if (visible) {
      // Navigation complete - finish the bar
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      setProgress(100);
      
      // Hide after animation completes
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 500);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isNavigating, visible]);

  if (!visible && progress === 0) {
    return null;
  }

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading"
    >
      {/* Background track */}
      <div className="absolute inset-0 bg-teal-100/50" />
      
      {/* Progress bar with liquid animation */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600",
          "transition-all duration-300 ease-out",
          progress === 100 && "opacity-0 transition-opacity duration-500"
        )}
        style={{ width: `${progress}%` }}
      >
        {/* Liquid shimmer effect */}
        <div 
          className={cn(
            "absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent",
            "animate-shimmer"
          )}
        />
        
        {/* Leading glow */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent to-teal-300/60 blur-sm"
        />
      </div>
    </div>
  );
}
