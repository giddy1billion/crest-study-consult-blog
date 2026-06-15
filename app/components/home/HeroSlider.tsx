/**
 * Hero Slider Component
 * 
 * Fully animated hero carousel for featured articles with:
 * - Auto-rotation at 5-second intervals
 * - Pause on hover
 * - Smooth crossfade transitions
 * - Navigation dots
 * - Previous/Next arrows
 * - Touch/swipe support
 * - Keyboard navigation (arrow keys)
 * - Image preloading
 */

import { Link } from "react-router";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "~/utils/cn";
import type { ArticleListItem } from "~/types";

// ============================================
// Types
// ============================================

interface HeroSliderProps {
  articles: ArticleListItem[];
  /** Auto-rotation interval in milliseconds (default: 5000) */
  interval?: number;
  /** Pause rotation on hover (default: true) */
  pauseOnHover?: boolean;
  className?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_INTERVAL = 5000; // 5 seconds
const TRANSITION_DURATION = 700; // 700ms crossfade

// ============================================
// Hook: Use Slider Logic
// ============================================

function useSlider(
  totalSlides: number,
  interval: number,
  pauseOnHover: boolean
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Navigate to specific slide
  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex) return;
    
    setIsTransitioning(true);
    setCurrentIndex(index);
    
    // Reset transitioning state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, TRANSITION_DURATION);
  }, [currentIndex, isTransitioning]);

  // Navigate to next slide
  const nextSlide = useCallback(() => {
    const next = (currentIndex + 1) % totalSlides;
    goToSlide(next);
  }, [currentIndex, totalSlides, goToSlide]);

  // Navigate to previous slide
  const prevSlide = useCallback(() => {
    const prev = (currentIndex - 1 + totalSlides) % totalSlides;
    goToSlide(prev);
  }, [currentIndex, totalSlides, goToSlide]);

  // Auto-rotation effect
  useEffect(() => {
    if (totalSlides <= 1) return;
    
    const startTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (!isPaused) {
        timeoutRef.current = setTimeout(() => {
          nextSlide();
        }, interval);
      }
    };

    startTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentIndex, isPaused, interval, totalSlides, nextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide]);

  return {
    currentIndex,
    isPaused,
    isTransitioning,
    goToSlide,
    nextSlide,
    prevSlide,
    setIsPaused: pauseOnHover ? setIsPaused : () => {},
  };
}

// ============================================
// Hook: Touch/Swipe Support
// ============================================

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onSwipeLeft();
    } else if (isRightSwipe) {
      onSwipeRight();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}

// ============================================
// Navigation Arrow Button
// ============================================

function NavArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
}) {
  const isPrev = direction === "prev";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "Previous slide" : "Next slide"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20",
        "w-12 h-12 flex items-center justify-center",
        "bg-white/10 backdrop-blur-sm rounded-full",
        "text-white hover:bg-white/20 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-teal-400/50",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        "opacity-0 group-hover:opacity-100",
        isPrev ? "left-4 lg:left-8" : "right-4 lg:right-8"
      )}
    >
      <svg 
        className={cn("w-6 h-6", isPrev && "rotate-180")} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M17 8l4 4m0 0l-4 4m4-4H3" 
        />
      </svg>
    </button>
  );
}

// ============================================
// Navigation Dots
// ============================================

function NavDots({
  total,
  current,
  onSelect,
}: {
  total: number;
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          onClick={() => onSelect(index)}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={index === current ? "true" : "false"}
          className={cn(
            "transition-all duration-300 ease-out rounded-full",
            "focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 focus:ring-offset-gray-900",
            index === current
              ? "w-8 h-2 bg-teal-500"
              : "w-2 h-2 bg-white/40 hover:bg-white/60"
          )}
        />
      ))}
    </div>
  );
}

// ============================================
// Progress Bar (auto-rotation indicator)
// ============================================

function ProgressBar({
  duration,
  isPaused,
  currentIndex,
}: {
  duration: number;
  isPaused: boolean;
  currentIndex: number;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
      <div
        key={currentIndex}
        className={cn(
          "h-full bg-gradient-to-r from-teal-500 to-teal-500",
          isPaused ? "animate-none" : "animate-progress"
        )}
        style={{
          animationDuration: `${duration}ms`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      />
    </div>
  );
}

// ============================================
// Single Slide
// ============================================

function Slide({
  article,
  isActive,
  isPrev,
  isNext,
  isFirst,
}: {
  article: ArticleListItem;
  isActive: boolean;
  isPrev: boolean;
  isNext: boolean;
  isFirst: boolean;
}) {
  // First slide is always eagerly loaded for LCP optimization
  const isLCPImage = isFirst;
  return (
    <div
      className={cn(
        "absolute inset-0 transition-all ease-out",
        isActive
          ? "opacity-100 z-10 duration-700"
          : "opacity-0 z-0 duration-500"
      )}
      aria-hidden={!isActive}
    >
      {/* Background Image - LCP Optimized */}
      <img
        src={article.heroImage || ""}
        srcSet={article.heroImage ? `
          ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=640&fit=crop 640w,
          ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=1024&fit=crop 1024w,
          ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=1200&fit=crop 1200w,
          ${article.heroImage}${article.heroImage.includes('?') ? '&' : '?'}w=1920&fit=crop 1920w
        ` : undefined}
        sizes="100vw"
        width={1200}
        height={630}
        alt={article.heroImageAlt || article.title}
        fetchPriority={isLCPImage ? "high" : "auto"}
        decoding={isLCPImage ? "sync" : "async"}
        loading={isLCPImage ? "eager" : "lazy"}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          "transition-transform duration-[8000ms] ease-out",
          isActive ? "scale-105" : "scale-100"
        )}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-gray-900/20" />
      
      {/* Content */}
      <div className="absolute inset-0 flex items-end">
        <div className="container-blog pb-20 lg:pb-24">
          <div className="max-w-3xl">
            {/* Category Label */}
            <div
              className={cn(
                "transform transition-all duration-700 delay-100",
                isActive
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
            >
              <Link
                to={`/${article.category.slug}`}
                className="group/badge inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-teal-600/90 rounded-full ring-1 ring-white/25 shadow-lg shadow-black/20 backdrop-blur-sm hover:bg-teal-600 hover:ring-white/40 transition-all"
                tabIndex={isActive ? 0 : -1}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(224,160,42,0.8)]" />
                {article.category.name}
              </Link>
            </div>

            {/* Headline */}
            <h1
              className={cn(
                "mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight text-balance",
                "transform transition-all duration-700 delay-200",
                isActive
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
            >
              <Link
                to={`/${article.category.slug}/${article.slug}`}
                className="hover:text-teal-300 transition-colors"
                tabIndex={isActive ? 0 : -1}
              >
                {article.title}
              </Link>
            </h1>

            {/* Excerpt */}
            <p
              className={cn(
                "mt-4 text-lg text-gray-300 leading-relaxed max-w-2xl",
                "transform transition-all duration-700 delay-300",
                isActive
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
            >
              {article.excerpt}
            </p>

            {/* Meta */}
            <div
              className={cn(
                "mt-6 flex items-center gap-4",
                "transform transition-all duration-700 delay-[400ms]",
                isActive
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              )}
            >
              <span className="text-sm text-gray-400">
                {article.readingTimeMin} min read
              </span>
              <span className="text-gray-600">·</span>
              <Link
                to={`/${article.category.slug}/${article.slug}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors group/link"
                tabIndex={isActive ? 0 : -1}
              >
                Read article
                <svg 
                  className="w-4 h-4 transform group-hover/link:translate-x-1 transition-transform" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17 8l4 4m0 0l-4 4m4-4H3" 
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function HeroSlider({
  articles,
  interval = DEFAULT_INTERVAL,
  pauseOnHover = true,
  className,
}: HeroSliderProps) {
  // Fallback for no articles
  if (!articles.length) {
    return (
      <section className={cn("relative h-[500px] sm:h-[600px] lg:h-[700px] bg-gray-900", className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-400">No featured articles available</p>
        </div>
      </section>
    );
  }

  // Single article - no slider needed
  if (articles.length === 1) {
    return (
      <section className={cn("relative h-[500px] sm:h-[600px] lg:h-[700px]", className)}>
        <Slide
          article={articles[0]}
          isActive={true}
          isPrev={false}
          isNext={false}
          isFirst={true}
        />
      </section>
    );
  }

  const {
    currentIndex,
    isPaused,
    goToSlide,
    nextSlide,
    prevSlide,
    setIsPaused,
  } = useSlider(articles.length, interval, pauseOnHover);

  const swipeHandlers = useSwipe(nextSlide, prevSlide);

  // Preload adjacent images
  const preloadIndexes = useMemo(() => {
    const prev = (currentIndex - 1 + articles.length) % articles.length;
    const next = (currentIndex + 1) % articles.length;
    return { prev, next };
  }, [currentIndex, articles.length]);

  return (
    <section
      className={cn(
        "relative h-[500px] sm:h-[600px] lg:h-[700px] overflow-hidden group",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      {...swipeHandlers}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured articles"
    >
      {/* Slides */}
      {articles.map((article, index) => (
        <Slide
          key={article.slug}
          article={article}
          isActive={index === currentIndex}
          isPrev={index === preloadIndexes.prev}
          isNext={index === preloadIndexes.next}
          isFirst={index === 0}
        />
      ))}

      {/* Navigation Arrows */}
      <NavArrow direction="prev" onClick={prevSlide} />
      <NavArrow direction="next" onClick={nextSlide} />

      {/* Bottom Bar: Dots + Progress */}
      <div className="absolute bottom-4 left-0 right-0 z-20">
        <div className="container-blog">
          <div className="flex items-center justify-between">
            <NavDots
              total={articles.length}
              current={currentIndex}
              onSelect={goToSlide}
            />
            
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span className="font-mono">{String(currentIndex + 1).padStart(2, '0')}</span>
              <span>/</span>
              <span className="font-mono">{String(articles.length).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar
        duration={interval}
        isPaused={isPaused}
        currentIndex={currentIndex}
      />

      {/* Preload adjacent images */}
      <div className="hidden">
        {[preloadIndexes.prev, preloadIndexes.next].map((idx) => (
          <img
            key={`preload-${idx}`}
            src={articles[idx]?.heroImage || ""}
            alt=""
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}
