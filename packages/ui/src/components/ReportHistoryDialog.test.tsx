import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportHistoryDialog } from "./ReportHistoryDialog";
import { useReportStore, type Report } from "@/store/report";

// Mock exportReportAsMarkdown
vi.mock("@/lib/db", () => ({
  exportReportAsMarkdown: vi.fn(
    (report: Report) => `# ${report.title ?? "Report"}\n\nContent`
  ),
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

describe("ReportHistoryDialog", () => {
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

  describe("controlled mode (no trigger)", () => {
    it("renders dialog when open is true", () => {
      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Report History")).toBeInTheDocument();
    });

    it("does not render dialog when open is false", () => {
      render(
        <ReportHistoryDialog open={false} onOpenChange={vi.fn()} />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows description text in dialog", () => {
      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      expect(
        screen.getByText("View, download, or delete your previous reports.")
      ).toBeInTheDocument();
    });
  });

  describe("with trigger", () => {
    it("opens dialog when trigger is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <ReportHistoryDialog
          open={false}
          onOpenChange={onOpenChange}
          trigger={<button>Open History</button>}
        />
      );

      await user.click(screen.getByRole("button", { name: /open history/i }));

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("renders trigger element", () => {
      render(
        <ReportHistoryDialog
          open={false}
          onOpenChange={vi.fn()}
          trigger={<button>Open History</button>}
        />
      );

      expect(
        screen.getByRole("button", { name: /open history/i })
      ).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty state when no reports", () => {
      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      expect(screen.getByText("No reports yet")).toBeInTheDocument();
    });
  });

  describe("with reports", () => {
    it("lists all reports", () => {
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
        createReport({ id: "report-3", title: "Third Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: reports[0].id,
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("First Report")).toBeInTheDocument();
      expect(within(dialog).getByText("Second Report")).toBeInTheDocument();
      expect(within(dialog).getByText("Third Report")).toBeInTheDocument();
    });

    it("highlights current report", () => {
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      const dialog = screen.getByRole("dialog");
      const highlightedItem = dialog.querySelector(".border-primary");
      expect(highlightedItem).toBeInTheDocument();
    });

    it("shows session ID preview for each report", () => {
      const report = createReport({
        id: "report-1",
        title: "Test Report",
        sessionId: "session-12345678-abcd",
      });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      const dialog = screen.getByRole("dialog");
      // Text is split by React rendering, so use a function matcher
      expect(
        within(dialog).getByText((_content, element) => {
          return element?.tagName.toLowerCase() === "span" &&
                 element?.textContent?.includes("Session:") === true;
        })
      ).toBeInTheDocument();
    });

    it("displays formatted date when no title", () => {
      const createdAt = new Date("2024-01-15T10:30:00").getTime();
      const report = createReport({ title: undefined, createdAt });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      // Should show something like "Report Jan 15, 10:30 AM"
      expect(screen.getByText(/Report Jan/i)).toBeInTheDocument();
    });

    it("sorts reports by date (newest first)", () => {
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

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

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

  describe("view action", () => {
    it("switches to selected report when view button clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={onOpenChange} />
      );

      const viewButton = screen.getByRole("button", {
        name: /view second report/i,
      });
      await user.click(viewButton);

      expect(useReportStore.getState().currentReportId).toBe("report-2");
    });

    it("closes dialog after viewing a report", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={onOpenChange} />
      );

      const viewButton = screen.getByRole("button", {
        name: /view second report/i,
      });
      await user.click(viewButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("delete action", () => {
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

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      const deleteButton = screen.getByRole("button", {
        name: /delete second report/i,
      });
      await user.click(deleteButton);

      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(
        useReportStore.getState().reports.find((r) => r.id === "report-2")
      ).toBeUndefined();
    });

    it("does not close dialog after deleting", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const reports = [
        createReport({ id: "report-1", title: "First Report" }),
        createReport({ id: "report-2", title: "Second Report" }),
      ];
      useReportStore.setState({
        reports,
        currentReportId: "report-1",
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={onOpenChange} />
      );

      const deleteButton = screen.getByRole("button", {
        name: /delete second report/i,
      });
      await user.click(deleteButton);

      // onOpenChange should not have been called with false
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("download action", () => {
    it("downloads report when download button clicked", async () => {
      const user = userEvent.setup();
      const report = createReport({
        id: "report-1",
        title: "Download Test",
      });
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

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      const downloadButton = screen.getByRole("button", {
        name: /download download test/i,
      });
      await user.click(downloadButton);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(linkClickMock).toHaveBeenCalled();
    });
  });

  describe("action buttons presence", () => {
    it("renders view, download, and delete buttons for each report", () => {
      const report = createReport({ id: "report-1", title: "Test Report" });
      useReportStore.setState({
        reports: [report],
        currentReportId: report.id,
      });

      render(
        <ReportHistoryDialog open={true} onOpenChange={vi.fn()} />
      );

      expect(
        screen.getByRole("button", { name: /view test report/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /download test report/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /delete test report/i })
      ).toBeInTheDocument();
    });
  });
});
