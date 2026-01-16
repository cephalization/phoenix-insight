/**
 * Tests for useMediaQuery hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery, useIsDesktop, useIsMobile } from "./useMediaQuery";

describe("useMediaQuery", () => {
  // Store original matchMedia
  const originalMatchMedia = window.matchMedia;

  // Mock matchMedia
  let mockMatches = false;
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;
  let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;

  beforeEach(() => {
    mockAddEventListener = vi.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
      if (event === "change") {
        changeHandler = handler;
      }
    });
    mockRemoveEventListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: mockMatches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    changeHandler = null;
    mockMatches = false;
  });

  it("should return initial match state", () => {
    mockMatches = true;

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect(result.current).toBe(true);
  });

  it("should return false when query does not match", () => {
    mockMatches = false;

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect(result.current).toBe(false);
  });

  it("should add event listener for changes", () => {
    renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should remove event listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should update when media query changes", () => {
    mockMatches = false;

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });

  it("should use correct query string", () => {
    renderHook(() => useMediaQuery("(max-width: 480px)"));

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 480px)");
  });
});

describe("useIsDesktop", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(min-width: 768px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("should return true when viewport >= 768px", () => {
    const { result } = renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });

  it("should use correct media query", () => {
    renderHook(() => useIsDesktop());

    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 768px)");
  });
});

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("should return true when viewport < 768px", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false, // Below 768px
      media: "(min-width: 768px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("should return false when viewport >= 768px", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true, // At or above 768px
      media: "(min-width: 768px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });
});
