import "@testing-library/jest-dom/vitest";

// Mock scrollIntoView for jsdom (not implemented)
Element.prototype.scrollIntoView = () => {};
