import "@testing-library/jest-dom/vitest";

// Mock scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = () => {};

// Mock ResizeObserver for jsdom (not implemented, required by radix-ui)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock matchMedia for jsdom (not implemented, required by Sonner and media queries)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
