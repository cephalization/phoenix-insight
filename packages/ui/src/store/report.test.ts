import { describe, it, expect, beforeEach } from "vitest";
import { useReportStore, type JSONRenderTree } from "./report";

describe("useReportStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useReportStore.setState({
      reports: [],
      currentReportId: null,
      isManuallySelected: false,
      isGeneratingReport: false,
    });
  });

  describe("setReport", () => {
    it("creates a new report with generated id and timestamp", () => {
      const content: JSONRenderTree = { type: "text", text: "Hello" };
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content,
      });

      expect(report.id).toBeDefined();
      expect(report.id.length).toBeGreaterThan(0);
      expect(report.sessionId).toBe("session-1");
      expect(report.content).toEqual(content);
      expect(report.createdAt).toBeGreaterThan(0);
      expect(report.title).toBeUndefined();
    });

    it("creates a report with a title when provided", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
        title: "My Report",
      });

      expect(report.title).toBe("My Report");
    });

    it("adds the report to the reports array", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(useReportStore.getState().reports[0]).toEqual(report);
    });

    it("sets the new report as current", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      expect(useReportStore.getState().currentReportId).toBe(report.id);
    });

    it("caches previous reports when creating for different sessions", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
        title: "Report 1",
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
        title: "Report 2",
      });

      expect(useReportStore.getState().reports).toHaveLength(2);
      expect(useReportStore.getState().currentReportId).toBe(report2.id);
    });

    it("replaces content for existing session report", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Initial" },
      });

      const report2 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Updated" },
      });

      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(report2.id).toBe(report1.id);
      expect(report2.content).toEqual({ type: "text", text: "Updated" });
    });

    it("preserves original createdAt when updating existing report", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Initial" },
      });

      const originalCreatedAt = report1.createdAt;

      // Small delay to ensure different timestamp
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Updated" },
      });

      expect(report2.createdAt).toBe(originalCreatedAt);
    });

    it("updates title when updating existing report with new title", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Initial" },
        title: "Original Title",
      });

      const report2 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Updated" },
        title: "New Title",
      });

      expect(report2.title).toBe("New Title");
    });

    it("preserves existing title when updating without new title", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Initial" },
        title: "Original Title",
      });

      const report2 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Updated" },
      });

      expect(report2.title).toBe("Original Title");
    });
  });

  describe("getReportBySession", () => {
    it("returns the report for the specified session", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      const found = useReportStore.getState().getReportBySession("session-1");

      expect(found).toEqual(report);
    });

    it("returns null for non-existent session", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      const found = useReportStore
        .getState()
        .getReportBySession("non-existent");

      expect(found).toBeNull();
    });

    it("returns null when no reports exist", () => {
      const found = useReportStore.getState().getReportBySession("session-1");

      expect(found).toBeNull();
    });

    it("returns correct report when multiple sessions exist", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
        title: "Report 1",
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
        title: "Report 2",
      });

      const found = useReportStore.getState().getReportBySession("session-2");

      expect(found).toEqual(report2);
    });
  });

  describe("deleteReport", () => {
    it("removes the report from the reports array", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      useReportStore.getState().deleteReport(report.id);

      expect(useReportStore.getState().reports).toHaveLength(0);
    });

    it("sets currentReportId to the last remaining report when deleting current", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      // report2 is current
      useReportStore.getState().deleteReport(report2.id);

      expect(useReportStore.getState().currentReportId).toBe(report1.id);
    });

    it("sets currentReportId to null when deleting the only report", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      useReportStore.getState().deleteReport(report.id);

      expect(useReportStore.getState().currentReportId).toBeNull();
    });

    it("does not change currentReportId when deleting a non-current report", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      useReportStore.getState().deleteReport(report1.id);

      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(useReportStore.getState().currentReportId).toBe(report2.id);
    });

    it("does nothing when deleting non-existent report", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      useReportStore.getState().deleteReport("non-existent");

      expect(useReportStore.getState().reports).toHaveLength(1);
      expect(useReportStore.getState().currentReportId).toBe(report.id);
    });
  });

  describe("listReports", () => {
    it("returns empty array when no reports exist", () => {
      const reports = useReportStore.getState().listReports();

      expect(reports).toEqual([]);
    });

    it("returns all reports", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      const reports = useReportStore.getState().listReports();

      expect(reports).toHaveLength(2);
      expect(reports).toContainEqual(report1);
      expect(reports).toContainEqual(report2);
    });

    it("returns reports in insertion order", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "First" },
      });
      useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Second" },
      });
      useReportStore.getState().setReport({
        sessionId: "session-3",
        content: { type: "text", text: "Third" },
      });

      const reports = useReportStore.getState().listReports();

      expect(reports[0].sessionId).toBe("session-1");
      expect(reports[1].sessionId).toBe("session-2");
      expect(reports[2].sessionId).toBe("session-3");
    });
  });

  describe("getCurrentReport", () => {
    it("returns the current report when one exists", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      const current = useReportStore.getState().getCurrentReport();

      expect(current).toEqual(report);
    });

    it("returns null when no current report is set", () => {
      useReportStore.setState({ currentReportId: null });

      const current = useReportStore.getState().getCurrentReport();

      expect(current).toBeNull();
    });

    it("returns null when currentReportId points to non-existent report", () => {
      useReportStore.setState({ currentReportId: "non-existent-id" });

      const current = useReportStore.getState().getCurrentReport();

      expect(current).toBeNull();
    });

    it("returns the most recently set report after multiple setReport calls", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      const current = useReportStore.getState().getCurrentReport();

      expect(current).toEqual(report2);
    });
  });

  describe("isGeneratingReport", () => {
    it("defaults to false", () => {
      expect(useReportStore.getState().isGeneratingReport).toBe(false);
    });

    it("can be set to true via setIsGeneratingReport", () => {
      useReportStore.getState().setIsGeneratingReport(true);

      expect(useReportStore.getState().isGeneratingReport).toBe(true);
    });

    it("can be set to false via setIsGeneratingReport", () => {
      useReportStore.getState().setIsGeneratingReport(true);
      useReportStore.getState().setIsGeneratingReport(false);

      expect(useReportStore.getState().isGeneratingReport).toBe(false);
    });

    it("does not affect other state when toggled", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });
      const reportsBefore = useReportStore.getState().reports;
      const currentIdBefore = useReportStore.getState().currentReportId;

      useReportStore.getState().setIsGeneratingReport(true);

      expect(useReportStore.getState().reports).toEqual(reportsBefore);
      expect(useReportStore.getState().currentReportId).toBe(currentIdBefore);
    });
  });

  describe("isManuallySelected", () => {
    it("defaults to false", () => {
      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });

    it("does not affect other state when accessed", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      const state = useReportStore.getState();
      expect(state.isManuallySelected).toBe(false);
      expect(state.reports).toHaveLength(1);
      expect(state.currentReportId).toBeDefined();
    });
  });

  describe("setCurrentReportManual", () => {
    it("sets currentReportId to the specified report", () => {
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      // report2 is current after creation
      expect(useReportStore.getState().currentReportId).toBe(report2.id);

      useReportStore.getState().setCurrentReportManual(report1.id);

      expect(useReportStore.getState().currentReportId).toBe(report1.id);
    });

    it("sets isManuallySelected to true", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      // Initially false after setReport
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      useReportStore.getState().setCurrentReportManual(report.id);

      expect(useReportStore.getState().isManuallySelected).toBe(true);
    });

    it("sets both currentReportId and isManuallySelected together", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      // Clear current to test setting it
      useReportStore.setState({ currentReportId: null, isManuallySelected: false });

      useReportStore.getState().setCurrentReportManual(report.id);

      expect(useReportStore.getState().currentReportId).toBe(report.id);
      expect(useReportStore.getState().isManuallySelected).toBe(true);
    });

    it("does not affect reports array", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });
      const reportsBefore = [...useReportStore.getState().reports];

      useReportStore.getState().setCurrentReportManual(report.id);

      expect(useReportStore.getState().reports).toEqual(reportsBefore);
    });
  });

  describe("clearManualSelection", () => {
    it("sets isManuallySelected to false", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      // Set manual selection first
      useReportStore.getState().setCurrentReportManual(report.id);
      expect(useReportStore.getState().isManuallySelected).toBe(true);

      useReportStore.getState().clearManualSelection();

      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });

    it("does not affect currentReportId", () => {
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      useReportStore.getState().setCurrentReportManual(report.id);
      useReportStore.getState().clearManualSelection();

      expect(useReportStore.getState().currentReportId).toBe(report.id);
    });

    it("does not affect reports array", () => {
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });
      const reportsBefore = [...useReportStore.getState().reports];

      useReportStore.setState({ isManuallySelected: true });
      useReportStore.getState().clearManualSelection();

      expect(useReportStore.getState().reports).toEqual(reportsBefore);
    });

    it("is idempotent when already false", () => {
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      useReportStore.getState().clearManualSelection();

      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });
  });

  describe("setReport clears manual selection", () => {
    it("clears isManuallySelected when creating a new report", () => {
      // Set manual selection first
      useReportStore.setState({ isManuallySelected: true });
      expect(useReportStore.getState().isManuallySelected).toBe(true);

      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Content" },
      });

      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });

    it("clears isManuallySelected when updating an existing report", () => {
      // Create a report first
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Initial" },
      });

      // Set manual selection
      useReportStore.setState({ isManuallySelected: true });
      expect(useReportStore.getState().isManuallySelected).toBe(true);

      // Update the same session's report
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Updated" },
      });

      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });

    it("clears manual selection even when manually selected a different report", () => {
      // Create two reports
      const report1 = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      // Manually select report1
      useReportStore.getState().setCurrentReportManual(report1.id);
      expect(useReportStore.getState().isManuallySelected).toBe(true);
      expect(useReportStore.getState().currentReportId).toBe(report1.id);

      // Generate a new report (different session)
      useReportStore.getState().setReport({
        sessionId: "session-3",
        content: { type: "text", text: "Report 3" },
      });

      // Manual selection should be cleared, current should be the new report
      expect(useReportStore.getState().isManuallySelected).toBe(false);
      expect(useReportStore.getState().reports).toHaveLength(3);
    });
  });
});
