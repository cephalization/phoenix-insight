import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createReportTool,
  validateReportContent,
  type ReportToolResult,
} from "../../src/commands/report-tool.js";
import type { ReportCallback } from "../../src/server/session.js";

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Create a valid UITree for testing
 */
function createValidTree() {
  return {
    root: "root-1",
    elements: {
      "root-1": {
        key: "root-1",
        type: "Card" as const,
        props: { title: "Test Report" },
        children: ["heading-1", "text-1"],
      },
      "heading-1": {
        key: "heading-1",
        type: "Heading" as const,
        props: { content: "Summary", level: "2" as const },
        parentKey: "root-1",
      },
      "text-1": {
        key: "text-1",
        type: "Text" as const,
        props: { content: "This is test content" },
        parentKey: "root-1",
      },
    },
  };
}

/**
 * Create a broadcast mock and collect calls
 */
function createBroadcastMock(): {
  broadcast: ReportCallback;
  calls: Array<{ content: unknown; title?: string }>;
} {
  const calls: Array<{ content: unknown; title?: string }> = [];
  const broadcast: ReportCallback = (content, title) => {
    calls.push({ content, title });
  };
  return { broadcast, calls };
}

/**
 * Helper to execute the tool with mock options
 */
async function executeTool(
  tool: ReturnType<typeof createReportTool>,
  params: { title?: string; content: unknown }
): Promise<ReportToolResult> {
  // The tool.execute requires ToolExecutionOptions, but we can cast for testing
  // since we don't use toolCallId or messages in our implementation
  return tool.execute!(params as any, {
    toolCallId: "test-call-id",
    messages: [],
  }) as Promise<ReportToolResult>;
}

// ============================================================================
// validateReportContent Tests
// ============================================================================

describe("validateReportContent", () => {
  describe("valid trees", () => {
    it("should accept a valid simple tree", () => {
      const tree = {
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Text",
            props: { content: "Hello" },
          },
        },
      };

      const result = validateReportContent(tree);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept a valid nested tree", () => {
      const result = validateReportContent(createValidTree());
      expect(result.success).toBe(true);
    });

    it("should accept all valid component types", () => {
      const componentExamples = [
        { type: "Card", props: { title: "Title", description: "Desc" } },
        { type: "Text", props: { content: "Hello", variant: "muted" } },
        { type: "Heading", props: { content: "Title", level: "1" } },
        { type: "List", props: { items: ["a", "b"], ordered: true } },
        { type: "Table", props: { headers: ["A"], rows: [["1"]], caption: "Cap" } },
        { type: "Metric", props: { label: "Users", value: "100", change: "+5%", changeType: "positive" } },
        { type: "Badge", props: { content: "Active", variant: "secondary" } },
        { type: "Alert", props: { title: "Warning", description: "Desc", variant: "destructive" } },
        { type: "Separator", props: { orientation: "horizontal" } },
        { type: "Code", props: { content: "const x = 1;", language: "typescript" } },
      ];

      for (const example of componentExamples) {
        const tree = {
          root: "el-1",
          elements: {
            "el-1": {
              key: "el-1",
              type: example.type,
              props: example.props,
            },
          },
        };

        const result = validateReportContent(tree);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("invalid tree structure", () => {
    it("should reject non-object content", () => {
      const result = validateReportContent("not an object");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tree structure");
    });

    it("should reject null content", () => {
      const result = validateReportContent(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tree structure");
    });

    it("should reject missing root field", () => {
      const result = validateReportContent({
        elements: {},
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tree structure");
    });

    it("should reject missing elements field", () => {
      const result = validateReportContent({
        root: "el-1",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tree structure");
    });

    it("should reject root element not found in elements", () => {
      const result = validateReportContent({
        root: "missing",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Text",
            props: { content: "Hello" },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Root element "missing" not found');
    });
  });

  describe("invalid element structure", () => {
    it("should reject element missing key", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            type: "Text",
            props: { content: "Hello" },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it("should reject element missing type", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            props: { content: "Hello" },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it("should reject unknown component type", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "UnknownComponent",
            props: {},
          },
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid component props", () => {
    it("should reject Text with missing content", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Text",
            props: {},
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Text");
    });

    it("should reject Heading with invalid level", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Heading",
            props: { content: "Title", level: "7" },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Heading");
    });

    it("should reject List with non-array items", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "List",
            props: { items: "not-an-array" },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for List");
    });

    it("should reject Table with missing headers", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Table",
            props: { rows: [["a"]] },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Table");
    });

    it("should reject Metric with missing required props", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Metric",
            props: { label: "Users" }, // missing value
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Metric");
    });

    it("should reject Badge with invalid variant", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Badge",
            props: { content: "Status", variant: "invalid" },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Badge");
    });

    it("should reject Alert with missing description", () => {
      const result = validateReportContent({
        root: "el-1",
        elements: {
          "el-1": {
            key: "el-1",
            type: "Alert",
            props: { title: "Warning" },
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Alert");
    });
  });

  describe("relationship validation", () => {
    it("should reject missing child element", () => {
      const result = validateReportContent({
        root: "parent",
        elements: {
          parent: {
            key: "parent",
            type: "Card",
            props: {},
            children: ["missing-child"],
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Child element "missing-child" not found');
    });

    it("should reject missing parent element", () => {
      const result = validateReportContent({
        root: "child",
        elements: {
          child: {
            key: "child",
            type: "Text",
            props: { content: "Hello" },
            parentKey: "missing-parent",
          },
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent element "missing-parent" not found');
    });

    it("should accept valid parent-child relationships", () => {
      const result = validateReportContent(createValidTree());
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// createReportTool Tests
// ============================================================================

describe("createReportTool", () => {
  let broadcastMock: ReturnType<typeof createBroadcastMock>;
  let reportTool: ReturnType<typeof createReportTool>;

  beforeEach(() => {
    broadcastMock = createBroadcastMock();
    reportTool = createReportTool(broadcastMock.broadcast);
  });

  describe("tool definition", () => {
    it("should have a description", () => {
      expect(reportTool.description).toBeDefined();
      expect(reportTool.description).toContain("report");
    });

    it("should have input schema with title and content", () => {
      expect(reportTool.inputSchema).toBeDefined();
    });

    it("should have an execute function", () => {
      expect(reportTool.execute).toBeDefined();
      expect(typeof reportTool.execute).toBe("function");
    });
  });

  describe("execute with valid content", () => {
    it("should broadcast valid report and return success", async () => {
      const tree = createValidTree();
      
      const result = await executeTool(reportTool, {
        title: "Test Report",
        content: tree,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Test Report");
      expect(broadcastMock.calls).toHaveLength(1);
      expect(broadcastMock.calls[0].content).toEqual(tree);
      expect(broadcastMock.calls[0].title).toBe("Test Report");
    });

    it("should work without title", async () => {
      const tree = createValidTree();
      
      const result = await executeTool(reportTool, {
        content: tree,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Report generated successfully");
      expect(broadcastMock.calls).toHaveLength(1);
      expect(broadcastMock.calls[0].title).toBeUndefined();
    });

    it("should handle all component types", async () => {
      const tree = {
        root: "container",
        elements: {
          container: {
            key: "container",
            type: "Card" as const,
            props: { title: "Full Report" },
            children: ["heading", "text", "list", "table", "metrics", "badge", "alert", "sep", "code"],
          },
          heading: { key: "heading", type: "Heading" as const, props: { content: "Title", level: "1" as const }, parentKey: "container" },
          text: { key: "text", type: "Text" as const, props: { content: "Paragraph" }, parentKey: "container" },
          list: { key: "list", type: "List" as const, props: { items: ["a", "b"] }, parentKey: "container" },
          table: { key: "table", type: "Table" as const, props: { headers: ["H1"], rows: [["R1"]] }, parentKey: "container" },
          metrics: { key: "metrics", type: "Metric" as const, props: { label: "Users", value: "100" }, parentKey: "container" },
          badge: { key: "badge", type: "Badge" as const, props: { content: "Status" }, parentKey: "container" },
          alert: { key: "alert", type: "Alert" as const, props: { description: "Info" }, parentKey: "container" },
          sep: { key: "sep", type: "Separator" as const, props: {} },
          code: { key: "code", type: "Code" as const, props: { content: "x=1" }, parentKey: "container" },
        },
      };

      const result = await executeTool(reportTool, {
        title: "Complete Report",
        content: tree,
      });

      expect(result.success).toBe(true);
      expect(broadcastMock.calls).toHaveLength(1);
    });
  });

  describe("execute with invalid content", () => {
    it("should return error for invalid tree structure", async () => {
      const result = await executeTool(reportTool, {
        content: { invalid: "structure" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tree structure");
      expect(broadcastMock.calls).toHaveLength(0);
    });

    it("should return error for invalid component props", async () => {
      const result = await executeTool(reportTool, {
        content: {
          root: "el-1",
          elements: {
            "el-1": {
              key: "el-1",
              type: "Text",
              props: {}, // missing required content
            },
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid props for Text");
      expect(broadcastMock.calls).toHaveLength(0);
    });

    it("should return error for missing root element", async () => {
      const result = await executeTool(reportTool, {
        content: {
          root: "missing",
          elements: {
            "el-1": {
              key: "el-1",
              type: "Text",
              props: { content: "Hello" },
            },
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Root element");
      expect(broadcastMock.calls).toHaveLength(0);
    });

    it("should return error for broken child references", async () => {
      const result = await executeTool(reportTool, {
        content: {
          root: "card",
          elements: {
            card: {
              key: "card",
              type: "Card",
              props: {},
              children: ["nonexistent"],
            },
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Child element");
      expect(broadcastMock.calls).toHaveLength(0);
    });
  });

  describe("broadcast error handling", () => {
    it("should return error when broadcast throws", async () => {
      const errorBroadcast: ReportCallback = () => {
        throw new Error("Broadcast failed");
      };
      const errorTool = createReportTool(errorBroadcast);

      const result = await executeTool(errorTool, {
        content: createValidTree(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to broadcast report");
      expect(result.error).toContain("Broadcast failed");
    });

    it("should handle non-Error throws", async () => {
      const errorBroadcast: ReportCallback = () => {
        throw "string error";
      };
      const errorTool = createReportTool(errorBroadcast);

      const result = await executeTool(errorTool, {
        content: createValidTree(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to broadcast report");
    });
  });
});

// ============================================================================
// Integration with exports
// ============================================================================

describe("exports", () => {
  it("should export createReportTool", async () => {
    const { createReportTool } = await import("../../src/commands/index.js");
    expect(createReportTool).toBeDefined();
    expect(typeof createReportTool).toBe("function");
  });

  it("should export validateReportContent", async () => {
    const { validateReportContent } = await import("../../src/commands/index.js");
    expect(validateReportContent).toBeDefined();
    expect(typeof validateReportContent).toBe("function");
  });

  it("should export ReportToolInput type", async () => {
    // Type-only check - just verifying the module loads
    const module = await import("../../src/commands/index.js");
    expect(module).toBeDefined();
  });

  it("should export ReportToolResult type", async () => {
    // Type-only check - just verifying the module loads
    const module = await import("../../src/commands/index.js");
    expect(module).toBeDefined();
  });
});
