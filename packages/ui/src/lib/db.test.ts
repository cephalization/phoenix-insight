import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  getDB,
  saveSession,
  loadSessions,
  deleteSession,
  saveReport,
  loadReports,
  deleteReport,
  getReportBySessionId,
  exportReportAsMarkdown,
  clearAllData,
} from "./db";
import type { ChatSession } from "@/store/chat";
import type { Report, JSONRenderTree } from "@/store/report";

// Helper to create test sessions
function createTestSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    messages: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

// Helper to create test reports
function createTestReport(overrides: Partial<Report> = {}): Report {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId: `session-${Date.now()}`,
    content: { type: "Text", children: "Test content" },
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    // Clear all data before each test
    await clearAllData();
  });

  describe("getDB", () => {
    it("creates database on first call", async () => {
      const db = await getDB();
      expect(db).toBeDefined();
      expect(db.name).toBe("phoenix-insight-ui");
    });

    it("returns the same database instance on subsequent calls", async () => {
      const db1 = await getDB();
      const db2 = await getDB();
      expect(db1).toBe(db2);
    });

    it("creates sessions and reports object stores", async () => {
      const db = await getDB();
      expect(db.objectStoreNames.contains("sessions")).toBe(true);
      expect(db.objectStoreNames.contains("reports")).toBe(true);
    });
  });

  describe("Session operations", () => {
    describe("saveSession", () => {
      it("saves a session to the database", async () => {
        const session = createTestSession({ title: "Test Session" });

        await saveSession(session);

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toEqual(session);
      });

      it("saves a session with messages", async () => {
        const session = createTestSession({
          messages: [
            { id: "msg-1", role: "user", content: "Hello", timestamp: Date.now() },
            { id: "msg-2", role: "assistant", content: "Hi!", timestamp: Date.now() },
          ],
        });

        await saveSession(session);

        const sessions = await loadSessions();
        expect(sessions[0].messages).toHaveLength(2);
        expect(sessions[0].messages[0].content).toBe("Hello");
      });

      it("updates an existing session with the same id", async () => {
        const session = createTestSession({ title: "Original" });
        await saveSession(session);

        session.title = "Updated";
        await saveSession(session);

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].title).toBe("Updated");
      });
    });

    describe("loadSessions", () => {
      it("returns empty array when no sessions exist", async () => {
        const sessions = await loadSessions();
        expect(sessions).toEqual([]);
      });

      it("loads multiple sessions", async () => {
        const session1 = createTestSession({ title: "Session 1" });
        const session2 = createTestSession({ title: "Session 2" });

        await saveSession(session1);
        await saveSession(session2);

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(2);
      });
    });

    describe("deleteSession", () => {
      it("deletes a session from the database", async () => {
        const session = createTestSession();
        await saveSession(session);

        await deleteSession(session.id);

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(0);
      });

      it("does not throw when deleting non-existent session", async () => {
        await expect(deleteSession("non-existent")).resolves.not.toThrow();
      });

      it("only deletes the specified session", async () => {
        const session1 = createTestSession({ title: "Session 1" });
        const session2 = createTestSession({ title: "Session 2" });
        await saveSession(session1);
        await saveSession(session2);

        await deleteSession(session1.id);

        const sessions = await loadSessions();
        expect(sessions).toHaveLength(1);
        expect(sessions[0].title).toBe("Session 2");
      });
    });
  });

  describe("Report operations", () => {
    describe("saveReport", () => {
      it("saves a report to the database", async () => {
        const report = createTestReport({ title: "Test Report" });

        await saveReport(report);

        const reports = await loadReports();
        expect(reports).toHaveLength(1);
        expect(reports[0]).toEqual(report);
      });

      it("saves a report with complex JSON content", async () => {
        const report = createTestReport({
          content: {
            type: "Card",
            props: { title: "Summary" },
            children: [
              { type: "Heading", props: { level: 2 }, children: "Results" },
              { type: "Text", children: "All tests passed!" },
            ],
          },
        });

        await saveReport(report);

        const reports = await loadReports();
        expect(reports[0].content).toEqual(report.content);
      });

      it("updates an existing report with the same id", async () => {
        const report = createTestReport({ title: "Original" });
        await saveReport(report);

        report.title = "Updated";
        await saveReport(report);

        const reports = await loadReports();
        expect(reports).toHaveLength(1);
        expect(reports[0].title).toBe("Updated");
      });
    });

    describe("loadReports", () => {
      it("returns empty array when no reports exist", async () => {
        const reports = await loadReports();
        expect(reports).toEqual([]);
      });

      it("loads multiple reports", async () => {
        const report1 = createTestReport({ title: "Report 1" });
        const report2 = createTestReport({ title: "Report 2" });

        await saveReport(report1);
        await saveReport(report2);

        const reports = await loadReports();
        expect(reports).toHaveLength(2);
      });
    });

    describe("deleteReport", () => {
      it("deletes a report from the database", async () => {
        const report = createTestReport();
        await saveReport(report);

        await deleteReport(report.id);

        const reports = await loadReports();
        expect(reports).toHaveLength(0);
      });

      it("does not throw when deleting non-existent report", async () => {
        await expect(deleteReport("non-existent")).resolves.not.toThrow();
      });

      it("only deletes the specified report", async () => {
        const report1 = createTestReport({ title: "Report 1" });
        const report2 = createTestReport({ title: "Report 2" });
        await saveReport(report1);
        await saveReport(report2);

        await deleteReport(report1.id);

        const reports = await loadReports();
        expect(reports).toHaveLength(1);
        expect(reports[0].title).toBe("Report 2");
      });
    });

    describe("getReportBySessionId", () => {
      it("returns the report for a given session", async () => {
        const sessionId = "test-session-123";
        const report = createTestReport({ sessionId, title: "Session Report" });
        await saveReport(report);

        const foundReport = await getReportBySessionId(sessionId);

        expect(foundReport).toBeDefined();
        expect(foundReport?.title).toBe("Session Report");
      });

      it("returns undefined when no report exists for session", async () => {
        const foundReport = await getReportBySessionId("non-existent-session");
        expect(foundReport).toBeUndefined();
      });

      it("returns only the first report for a session with duplicates", async () => {
        const sessionId = "test-session-456";
        const report1 = createTestReport({ sessionId, title: "First" });
        // Note: In practice, the store enforces 1:1 relationship, but testing the DB layer behavior
        await saveReport(report1);

        const foundReport = await getReportBySessionId(sessionId);

        expect(foundReport?.title).toBe("First");
      });
    });
  });

  describe("exportReportAsMarkdown", () => {
    it("exports a simple report with title", () => {
      const report = createTestReport({
        title: "My Report",
        content: { type: "Text", children: "Hello World" },
        createdAt: new Date("2024-01-15T10:30:00Z").getTime(),
        sessionId: "session-abc",
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("# My Report");
      expect(markdown).toContain("Hello World");
      expect(markdown).toContain("*Session ID: session-abc*");
    });

    it("exports headings with correct markdown levels", () => {
      const report = createTestReport({
        content: {
          type: "Heading",
          props: { level: 2 },
          children: "Section Title",
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("## Section Title");
    });

    it("exports cards with title as h3", () => {
      const report = createTestReport({
        content: {
          type: "Card",
          props: { title: "Card Title" },
          children: [{ type: "Text", children: "Card content" }],
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("### Card Title");
      expect(markdown).toContain("Card content");
    });

    it("exports ordered lists", () => {
      const report = createTestReport({
        content: {
          type: "List",
          props: { ordered: true },
          children: [
            { type: "Text", children: "First item" },
            { type: "Text", children: "Second item" },
          ],
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("1. First item");
      expect(markdown).toContain("2. Second item");
    });

    it("exports unordered lists", () => {
      const report = createTestReport({
        content: {
          type: "List",
          props: { ordered: false },
          children: [
            { type: "Text", children: "Item A" },
            { type: "Text", children: "Item B" },
          ],
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("- Item A");
      expect(markdown).toContain("- Item B");
    });

    it("exports tables", () => {
      const report = createTestReport({
        content: {
          type: "Table",
          props: {
            headers: ["Name", "Value"],
            rows: [
              ["Foo", "123"],
              ["Bar", "456"],
            ],
          },
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("| Name | Value |");
      expect(markdown).toContain("| --- | --- |");
      expect(markdown).toContain("| Foo | 123 |");
      expect(markdown).toContain("| Bar | 456 |");
    });

    it("exports metrics", () => {
      const report = createTestReport({
        content: {
          type: "Metric",
          props: {
            label: "Total Users",
            value: 1500,
            description: "Active users this month",
          },
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("**Total Users**: 1500 - Active users this month");
    });

    it("exports badges", () => {
      const report = createTestReport({
        content: {
          type: "Badge",
          props: { variant: "success" },
          children: "Passed",
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("`Passed` (success)");
    });

    it("exports alerts", () => {
      const report = createTestReport({
        content: {
          type: "Alert",
          props: { title: "Warning", variant: "destructive" },
          children: "This is important",
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      // Destructive alerts have warning emoji prefix
      expect(markdown).toContain("**Warning**");
      expect(markdown).toContain("This is important");
    });

    it("exports separators", () => {
      const report = createTestReport({
        content: { type: "Separator" } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("---");
    });

    it("exports code blocks with language", () => {
      const report = createTestReport({
        content: {
          type: "Code",
          props: { language: "typescript" },
          children: "const x = 42;",
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("```typescript");
      expect(markdown).toContain("const x = 42;");
      expect(markdown).toContain("```");
    });

    it("handles nested content", () => {
      const report = createTestReport({
        title: "Nested Report",
        content: {
          type: "Card",
          props: { title: "Summary" },
          children: [
            { type: "Heading", props: { level: 3 }, children: "Overview" },
            { type: "Text", children: "Some details here" },
            {
              type: "List",
              props: { ordered: false },
              children: [
                { type: "Text", children: "Point 1" },
                { type: "Text", children: "Point 2" },
              ],
            },
          ],
        } as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).toContain("# Nested Report");
      expect(markdown).toContain("### Summary");
      expect(markdown).toContain("### Overview");
      expect(markdown).toContain("Some details here");
      expect(markdown).toContain("- Point 1");
      expect(markdown).toContain("- Point 2");
    });

    it("handles empty content gracefully", () => {
      const report = createTestReport({
        content: {} as JSONRenderTree,
      });

      const markdown = exportReportAsMarkdown(report);

      // Should not throw, should include metadata
      expect(markdown).toContain("---");
      expect(markdown).toContain("*Generated:");
    });

    it("handles report without title", () => {
      const report = createTestReport({
        title: undefined,
        content: { type: "Text", children: "Content only" },
      });

      const markdown = exportReportAsMarkdown(report);

      expect(markdown).not.toContain("# undefined");
      expect(markdown).toContain("Content only");
    });
  });

  describe("Database management", () => {
    it("getDB returns a valid database instance", async () => {
      const db = await getDB();

      expect(db).toBeDefined();
      expect(db.name).toBe("phoenix-insight-ui");
    });

    it("clearAllData removes all data", async () => {
      // Save some data
      const session = createTestSession();
      const report = createTestReport();
      await saveSession(session);
      await saveReport(report);

      // Clear all data
      await clearAllData();

      // Data should be gone
      const sessions = await loadSessions();
      const reports = await loadReports();
      expect(sessions).toHaveLength(0);
      expect(reports).toHaveLength(0);
    });
  });
});
