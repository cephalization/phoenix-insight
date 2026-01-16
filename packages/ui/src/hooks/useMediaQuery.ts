/**
 * Custom hook for responding to media query changes.
 * Used for responsive design breakpoints.
 */

import { useState, useEffect } from "react";

/**
 * Hook that tracks whether a media query matches.
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns Whether the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // Check if window is available (SSR safety)
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // Return early if window is not available
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Create listener function
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    mediaQuery.addEventListener("change", handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * Hook that returns true when viewport is desktop size (>= 768px).
 * Matches Tailwind's `md` breakpoint.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/**
 * Hook that returns true when viewport is mobile size (< 768px).
 */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}
