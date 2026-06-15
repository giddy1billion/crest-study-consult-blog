import { useState, useEffect } from "react";

/**
 * Track scroll position for sticky headers, progress bars, etc.
 */
export function useScrollPosition() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrollY;
}

/**
 * Check if scrolled past a threshold
 */
export function useScrolledPast(threshold: number) {
  const scrollY = useScrollPosition();
  return scrollY > threshold;
}
