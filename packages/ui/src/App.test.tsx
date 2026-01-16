/**
 * Tests for App component responsive layout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// Mock the useIsDesktop hook to control responsive behavior
let mockIsDesktop = true;
vi.mock("@/hooks/useMediaQuery", () => ({
  useIsDesktop: () => mockIsDesktop,
  useIsMobile: () => !mockIsDesktop,
  useMediaQuery: (query: string) => query === "(min-width: 768px)" ? mockIsDesktop : !mockIsDesktop,
}));

// Mock the useWebSocket hook
vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    isConnected: true,
    isStreaming: false,
    sendQuery: vi.fn(),
    cancel: vi.fn(),
  }),
}));

// Mock the chat store
vi.mock("@/store/chat", () => ({
  useChatStore: vi.fn((selector) => {
    const state = {
      sessions: [],
      currentSessionId: null,
      isConnected: true,
      isStreaming: false,
      getCurrentSession: () => null,
      createSession: vi.fn(),
      setCurrentSession: vi.fn(),
      deleteSession: vi.fn(),
    };
    return selector(state);
  }),
}));

// Mock the report store
vi.mock("@/store/report", () => ({
  useReportStore: vi.fn((selector) => {
    const state = {
      reports: [],
      currentReportId: null,
      getCurrentReport: () => null,
    };
    return selector(state);
  }),
}));

// Mock db exports for ReportPanel
vi.mock("@/lib/db", () => ({
  exportReportAsMarkdown: vi.fn(() => "# Report"),
}));

describe("App responsive layout", () => {
  afterEach(() => {
    // Reset to desktop after each test
    mockIsDesktop = true;
  });

  describe("Desktop layout (>= 768px)", () => {
    beforeEach(() => {
      mockIsDesktop = true;
    });

    it("should render header with app title", () => {
      render(<App />);

      expect(screen.getByText("Phoenix Insight")).toBeInTheDocument();
    });

    it("should render resizable panels on desktop", () => {
      render(<App />);

      // Desktop should show resizable handle (side-by-side panels)
      const handle = document.querySelector('[data-slot="resizable-handle"]');
      expect(handle).toBeInTheDocument();
    });

    it("should not render tabs on desktop", () => {
      render(<App />);

      // Tabs should not be visible on desktop
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("should render both ChatPanel and ReportPanel side by side", () => {
      render(<App />);

      // Both panels should be visible (empty states)
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
      expect(screen.getByText("No Report")).toBeInTheDocument();
    });
  });

  describe("Mobile layout (< 768px)", () => {
    beforeEach(() => {
      mockIsDesktop = false;
    });

    it("should render header with app title", () => {
      render(<App />);

      expect(screen.getByText("Phoenix Insight")).toBeInTheDocument();
    });

    it("should render tabs navigation on mobile", () => {
      render(<App />);

      // Mobile should show tab list
      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });

    it("should render Chat and Report tab triggers", () => {
      render(<App />);

      expect(screen.getByRole("tab", { name: /chat/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /report/i })).toBeInTheDocument();
    });

    it("should not render resizable handle on mobile", () => {
      render(<App />);

      // Mobile should not have resizable panels
      const handle = document.querySelector('[data-slot="resizable-handle"]');
      expect(handle).not.toBeInTheDocument();
    });

    it("should show Chat panel by default", () => {
      render(<App />);

      // Chat tab should be active
      const chatTab = screen.getByRole("tab", { name: /chat/i });
      expect(chatTab).toHaveAttribute("data-state", "active");

      // Chat content should be visible
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
    });

    it("should switch to Report panel when Report tab is clicked", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Click on Report tab
      const reportTab = screen.getByRole("tab", { name: /report/i });
      await user.click(reportTab);

      // Report tab should be active
      expect(reportTab).toHaveAttribute("data-state", "active");

      // Report content should be visible (No Report text comes from ReportPanel header)
      expect(screen.getByText("No Report")).toBeInTheDocument();
    });

    it("should have touch-friendly tap targets (min 44px)", () => {
      render(<App />);

      const chatTab = screen.getByRole("tab", { name: /chat/i });
      const reportTab = screen.getByRole("tab", { name: /report/i });

      // Check that tabs have min-h-[44px] class applied
      expect(chatTab.className).toContain("min-h-[44px]");
      expect(reportTab.className).toContain("min-h-[44px]");
    });
  });

  describe("Responsive transition", () => {
    it("should render desktop layout when isDesktop is true", () => {
      mockIsDesktop = true;
      render(<App />);

      // Should show resizable panels on desktop
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      const handle = document.querySelector('[data-slot="resizable-handle"]');
      expect(handle).toBeInTheDocument();
    });

    it("should render mobile layout when isDesktop is false", () => {
      mockIsDesktop = false;
      render(<App />);

      // Should show tabs on mobile
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      const handle = document.querySelector('[data-slot="resizable-handle"]');
      expect(handle).not.toBeInTheDocument();
    });
  });
});
