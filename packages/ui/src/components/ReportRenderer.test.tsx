import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportRenderer } from "./ReportRenderer";
import type { UITree } from "@json-render/core";

// Mock the json-render Renderer component
vi.mock("@json-render/react", () => ({
  Renderer: ({
    tree,
    loading,
  }: {
    tree: UITree | null;
    loading?: boolean;
  }) => (
    <div data-testid="json-renderer" data-loading={loading}>
      {tree && <span data-testid="tree-root">{tree.root}</span>}
    </div>
  ),
}));

// Mock the registry
vi.mock("@/lib/json-render/registry", () => ({
  registry: {},
}));

// Helper to create a minimal UITree
function createUITree(overrides: Partial<UITree> = {}): UITree {
  return {
    root: "root-element",
    elements: {
      "root-element": {
        key: "root-element",
        type: "Card",
        props: { title: "Test Report" },
      },
    },
    ...overrides,
  };
}

describe("ReportRenderer", () => {
  describe("empty state", () => {
    it("shows empty state when no report and not streaming", () => {
      render(<ReportRenderer report={null} />);

      expect(screen.getByText("No Report Yet")).toBeInTheDocument();
      expect(
        screen.getByText(/Start a conversation in the chat panel/i)
      ).toBeInTheDocument();
    });

    it("shows file icon in empty state", () => {
      const { container } = render(<ReportRenderer report={null} />);

      // The FileText icon from lucide-react should be present
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("does not show empty state when streaming", () => {
      render(<ReportRenderer report={null} isStreaming={true} />);

      expect(screen.queryByText("No Report Yet")).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton when streaming without report", () => {
      render(<ReportRenderer report={null} isStreaming={true} />);

      expect(screen.getByTestId("report-loading-skeleton")).toBeInTheDocument();
    });

    it("loading skeleton has multiple skeleton elements", () => {
      const { container } = render(
        <ReportRenderer report={null} isStreaming={true} />
      );

      // Check for skeleton elements (they have the skeleton class)
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(5);
    });

    it("does not show loading skeleton when report exists", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={true} />);

      expect(
        screen.queryByTestId("report-loading-skeleton")
      ).not.toBeInTheDocument();
    });
  });

  describe("report rendering", () => {
    it("renders report using json-render Renderer", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();
      expect(screen.getByTestId("tree-root")).toHaveTextContent("root-element");
    });

    it("passes loading prop to Renderer when streaming", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={true} />);

      const renderer = screen.getByTestId("json-renderer");
      expect(renderer).toHaveAttribute("data-loading", "true");
    });

    it("passes loading as false to Renderer when not streaming", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={false} />);

      const renderer = screen.getByTestId("json-renderer");
      expect(renderer).toHaveAttribute("data-loading", "false");
    });

    it("renders different tree structures", () => {
      const tree = createUITree({
        root: "custom-root",
        elements: {
          "custom-root": {
            key: "custom-root",
            type: "Heading",
            props: { content: "Custom Report", level: "1" },
          },
        },
      });

      render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("tree-root")).toHaveTextContent("custom-root");
    });
  });

  describe("streaming indicator", () => {
    it("shows streaming indicator when streaming with report", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={true} />);

      expect(
        screen.getByTestId("report-streaming-indicator")
      ).toBeInTheDocument();
      expect(screen.getByText("Updating report...")).toBeInTheDocument();
    });

    it("does not show streaming indicator when not streaming", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={false} />);

      expect(
        screen.queryByTestId("report-streaming-indicator")
      ).not.toBeInTheDocument();
    });

    it("does not show streaming indicator with empty state", () => {
      render(<ReportRenderer report={null} isStreaming={false} />);

      expect(
        screen.queryByTestId("report-streaming-indicator")
      ).not.toBeInTheDocument();
    });

    it("streaming indicator has animated dots", () => {
      const tree = createUITree();

      const { container } = render(
        <ReportRenderer report={tree} isStreaming={true} />
      );

      const indicator = container.querySelector(
        '[data-testid="report-streaming-indicator"]'
      );
      const dots = indicator?.querySelectorAll(".animate-bounce");
      expect(dots?.length).toBe(3);
    });
  });

  describe("isStreaming prop", () => {
    it("defaults isStreaming to false", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} />);

      // Should not show streaming indicator
      expect(
        screen.queryByTestId("report-streaming-indicator")
      ).not.toBeInTheDocument();
      // Renderer should have loading=false
      const renderer = screen.getByTestId("json-renderer");
      expect(renderer).toHaveAttribute("data-loading", "false");
    });

    it("handles explicit isStreaming=true", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={true} />);

      expect(
        screen.getByTestId("report-streaming-indicator")
      ).toBeInTheDocument();
    });

    it("handles explicit isStreaming=false", () => {
      const tree = createUITree();

      render(<ReportRenderer report={tree} isStreaming={false} />);

      expect(
        screen.queryByTestId("report-streaming-indicator")
      ).not.toBeInTheDocument();
    });
  });

  describe("layout and styling", () => {
    it("report content is in a flex container", () => {
      const tree = createUITree();

      const { container } = render(<ReportRenderer report={tree} />);

      const flexContainer = container.firstChild as HTMLElement;
      expect(flexContainer).toHaveClass("flex", "flex-col");
    });

    it("empty state is centered", () => {
      const { container } = render(<ReportRenderer report={null} />);

      const emptyState = container.querySelector(".items-center.justify-center");
      expect(emptyState).toBeInTheDocument();
    });

    it("report content has overflow scroll", () => {
      const tree = createUITree();

      const { container } = render(<ReportRenderer report={tree} />);

      const scrollContainer = container.querySelector(".overflow-auto");
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe("complex report trees", () => {
    it("handles tree with nested elements", () => {
      const tree: UITree = {
        root: "card-1",
        elements: {
          "card-1": {
            key: "card-1",
            type: "Card",
            props: { title: "Parent Card" },
            children: ["text-1", "text-2"],
          },
          "text-1": {
            key: "text-1",
            type: "Text",
            props: { content: "First paragraph" },
            parentKey: "card-1",
          },
          "text-2": {
            key: "text-2",
            type: "Text",
            props: { content: "Second paragraph" },
            parentKey: "card-1",
          },
        },
      };

      render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();
    });

    it("handles tree with multiple root-level siblings via wrapper", () => {
      const tree: UITree = {
        root: "wrapper",
        elements: {
          wrapper: {
            key: "wrapper",
            type: "Card",
            props: {},
            children: ["heading-1", "text-1"],
          },
          "heading-1": {
            key: "heading-1",
            type: "Heading",
            props: { content: "Report Title", level: "1" },
            parentKey: "wrapper",
          },
          "text-1": {
            key: "text-1",
            type: "Text",
            props: { content: "Report body" },
            parentKey: "wrapper",
          },
        },
      };

      render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();
    });

    it("handles empty elements object", () => {
      const tree: UITree = {
        root: "",
        elements: {},
      };

      render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles rapid streaming state changes", () => {
      const tree = createUITree();

      const { rerender } = render(
        <ReportRenderer report={tree} isStreaming={true} />
      );

      expect(
        screen.getByTestId("report-streaming-indicator")
      ).toBeInTheDocument();

      rerender(<ReportRenderer report={tree} isStreaming={false} />);

      expect(
        screen.queryByTestId("report-streaming-indicator")
      ).not.toBeInTheDocument();

      rerender(<ReportRenderer report={tree} isStreaming={true} />);

      expect(
        screen.getByTestId("report-streaming-indicator")
      ).toBeInTheDocument();
    });

    it("handles null to report transition", () => {
      const { rerender } = render(<ReportRenderer report={null} />);

      expect(screen.getByText("No Report Yet")).toBeInTheDocument();

      const tree = createUITree();
      rerender(<ReportRenderer report={tree} />);

      expect(screen.queryByText("No Report Yet")).not.toBeInTheDocument();
      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();
    });

    it("handles report to null transition", () => {
      const tree = createUITree();
      const { rerender } = render(<ReportRenderer report={tree} />);

      expect(screen.getByTestId("json-renderer")).toBeInTheDocument();

      rerender(<ReportRenderer report={null} />);

      expect(screen.queryByTestId("json-renderer")).not.toBeInTheDocument();
      expect(screen.getByText("No Report Yet")).toBeInTheDocument();
    });

    it("handles report update while streaming", () => {
      const tree1 = createUITree({ root: "v1" });
      const { rerender } = render(
        <ReportRenderer report={tree1} isStreaming={true} />
      );

      expect(screen.getByTestId("tree-root")).toHaveTextContent("v1");

      const tree2 = createUITree({ root: "v2" });
      rerender(<ReportRenderer report={tree2} isStreaming={true} />);

      expect(screen.getByTestId("tree-root")).toHaveTextContent("v2");
    });
  });
});
