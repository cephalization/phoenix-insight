import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportPanel } from "./ReportPanel";
import { useReportStore, type Report } from "@/store/report";

// Mock the ReportRenderer component
vi.mock("./ReportRenderer", () => ({
  ReportRenderer: ({
    report,
    isStreaming,
  }: {
    report: unknown;
    isStreaming?: boolean;
  }) => (
    <div data-testid="report-renderer" data-streaming={isStreaming}>
      {report ? (
        <span data-testid="has-report">Report content</span>
      ) : (
        <span data-testid="no-report">No report</span>
      )}
    </div>
  ),
}));

// Mock exportReportAsMarkdown
vi.mock("@/lib/db", () => ({
  exportReportAsMarkdown: vi.fn((report: Report) => `# ${report.title ?? "Report"}\n\nContent`),
}));

// Helper to create a test report
function createReport(overrides: Partial<Report> = {}): Report {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId: `session-${Date.now()}`,
    content: { type: "Card", props: { title: "Test" } },
    createdAt: Date.now(),
    title: "Test Report",
    ...overrides,
  };
}

describe("ReportPanel", () => {
  // Reset the store before each test
  beforeEach(() => {
    useReportStore.setState({
      reports: [],
      currentReportId: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("renders with no report message when no current report", () => {
      render(<ReportPanel />);

      expect(screen.getByText("No Report")).toBeInTheDocument();
    });

    it("renders ReportRenderer component", () => {
      render(<ReportPanel />);

      expect(screen.getByTestId("report-renderer")).toBeInTheDocument();
    });

    it("shows download button disabled when no report", () => {
      render(<ReportPanel />);

      const downloadButton = screen.getByRole("button", {
        name: /download as markdown/i,
      });
      expect(downloadButton).toBeDisabled();
    });

    it("shows history button", () => {
      render(<ReportPanel />);

      expect(
        screen.getByRole("button", { name: /report history/i })
      ).toBeInTheDocument();
    });
  });

  describe("with current report", () => {
    it("displays report title in header", () => {
      const report = createReport({ title: "My Custom Report" });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      expect(screen.getByText("My Custom Report")).toBeInTheDocument();
    });

    it("enables download button when report exists", () => {
      const report = createReport();
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      const downloadButton = screen.getByRole("button", {
        name: /download as markdown/i,
      });
      expect(downloadButton).not.toBeDisabled();
    });

    it("passes report content to ReportRenderer", () => {
      const report = createReport();
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      expect(screen.getByTestId("has-report")).toBeInTheDocument();
    });

    it("passes isStreaming prop to ReportRenderer", () => {
      const report = createReport();
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel isStreaming={true} />);

      const renderer = screen.getByTestId("report-renderer");
      expect(renderer).toHaveAttribute("data-streaming", "true");
    });

    it("displays formatted date when no title", () => {
      const createdAt = new Date("2024-01-15T10:30:00").getTime();
      const report = createReport({ title: undefined, createdAt });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      // Should show something like "Report Jan 15, 10:30 AM"
      expect(screen.getByText(/Report Jan/i)).toBeInTheDocument();
    });
  });

  describe("download functionality", () => {
    it("downloads report as markdown when download button clicked", async () => {
      const user = userEvent.setup();
      const report = createReport({ title: "Download Test" });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      // Mock URL.createObjectURL and related APIs
      const createObjectURLMock = vi.fn(() => "blob:test-url");
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      // Mock document.createElement for link
      const linkClickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") {
          const link = originalCreateElement(tag);
          link.click = linkClickMock;
          return link;
        }
        return originalCreateElement(tag);
      });

      render(<ReportPanel />);

      const downloadButton = screen.getByRole("button", {
        name: /download as markdown/i,
      });
      await user.click(downloadButton);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(linkClickMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });

  describe("history dialog", () => {
    it("opens history dialog when history button clicked", async () => {
      const user = userEvent.setup();
      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Report History")).toBeInTheDocument();
    });

    it("shows empty state in history dialog when no reports", async () => {
      const user = userEvent.setup();
      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      expect(screen.getByText("No reports yet")).toBeInTheDocument();
    });

    it("lists all reports in history dialog", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
        createReport({ id: "report-3", title: "Third Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: reports[0].id,
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      // Use within dialog to find reports (header also shows current report title)
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("First Report")).toBeInTheDocument();
      expect(within(dialog).getByText("Second Report")).toBeInTheDocument();
      expect(within(dialog).getByText("Third Report")).toBeInTheDocument();
    });

    it("highlights current report in history", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      // Find the report items
      const dialog = screen.getByRole("dialog");
      const firstReportItem = dialog.querySelector(".border-primary");
      expect(firstReportItem).toBeInTheDocument();
    });

    it("shows session ID preview for each report", async () => {
      const user = userEvent.setup();
      const report = createReport({
        id: "report-1",
        title: "Test Report",
        sessionId: "session-12345678-abcd",
      });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      const dialog = screen.getByRole("dialog");
      // Should show truncated session ID (first 8 chars of sessionId)
      expect(within(dialog).getByText(/Session: session-/i)).toBeInTheDocument();
    });
  });

  describe("history dialog actions", () => {
    it("switches to selected report when view button clicked", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(<ReportPanel />);

      // Open history
      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      // Click view on second report
      const viewButton = screen.getByRole("button", {
        name: /view second report/i,
      });
      await user.click(viewButton);

      // Dialog should close and current report should change
      expect(useReportStore.getState().currentReportId).toBe("report-2");
    });

    it("closes dialog after viewing a report", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      const viewButton = screen.getByRole("button", {
        name: /view second report/i,
      });
      await user.click(viewButton);

      // Dialog should be closed
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("deletes report when delete button clicked", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(<ReportPanel />);

      // Open history
      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      // Click delete on second report
      const deleteButton = screen.getByRole("button", {
        name: /delete second report/i,
      });
      await user.click(deleteButton);

      // Report should be removed from store
      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(
        useReportStore.getState().reports.find((r) => r.id === "report-2")
      ).toBeUndefined();
    });

    it("downloads report from history", async () => {
      const user = userEvent.setup();
      const report = createReport({ id: "report-1", title: "Download From History" });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      // Mock URL.createObjectURL
      const createObjectURLMock = vi.fn(() => "blob:test-url");
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = vi.fn();

      const linkClickMock = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") {
          const link = originalCreateElement(tag);
          link.click = linkClickMock;
          return link;
        }
        return originalCreateElement(tag);
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      // Find and click download button in history
      const downloadButton = screen.getByRole("button", {
        name: /download download from history/i,
      });
      await user.click(downloadButton);

      expect(linkClickMock).toHaveBeenCalled();
    });
  });

  describe("sorting", () => {
    it("sorts reports by date (newest first) in history", async () => {
      const user = userEvent.setup();
      const reports = [
        createReport({
          id: "old",
          title: "Old Report",
          createdAt: new Date("2024-01-01").getTime(),
        }),
        createReport({
          id: "new",
          title: "New Report",
          createdAt: new Date("2024-03-01").getTime(),
        }),
        createReport({
          id: "mid",
          title: "Middle Report",
          createdAt: new Date("2024-02-01").getTime(),
        }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: reports[0].id,
      });

      render(<ReportPanel />);

      const historyButton = screen.getByRole("button", {
        name: /report history/i,
      });
      await user.click(historyButton);

      const dialog = screen.getByRole("dialog");
      const reportTitles = within(dialog)
        .getAllByText(/Report/i)
        .filter((el) => el.classList.contains("font-medium"));

      // Should be ordered: New, Middle, Old
      expect(reportTitles[0]).toHaveTextContent("New Report");
      expect(reportTitles[1]).toHaveTextContent("Middle Report");
      expect(reportTitles[2]).toHaveTextContent("Old Report");
    });
  });

  describe("className prop", () => {
    it("applies custom className to container", () => {
      const { container } = render(<ReportPanel className="custom-class" />);

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass("custom-class");
    });

    it("preserves default classes when adding custom className", () => {
      const { container } = render(<ReportPanel className="custom-class" />);

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass("flex", "h-full", "flex-col", "custom-class");
    });
  });

  describe("isStreaming prop", () => {
    it("defaults isStreaming to false", () => {
      const report = createReport();
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel />);

      const renderer = screen.getByTestId("report-renderer");
      expect(renderer).toHaveAttribute("data-streaming", "false");
    });

    it("passes isStreaming=true to ReportRenderer", () => {
      const report = createReport();
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(<ReportPanel isStreaming={true} />);

      const renderer = screen.getByTestId("report-renderer");
      expect(renderer).toHaveAttribute("data-streaming", "true");
    });
  });
});
