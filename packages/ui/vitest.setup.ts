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
