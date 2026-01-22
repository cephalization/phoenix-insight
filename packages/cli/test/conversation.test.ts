import { describe, it, expect } from "vitest";
import type {
  ModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
} from "ai";
import {
  toModelMessages,
  toModelMessage,
  truncateReportToolCalls,
  extractMessagesFromResponse,
  compactConversation,
  createUserMessage,
  createAssistantMessage,
  createAssistantMessageWithParts,
  createToolMessage,
  type ConversationMessage,
  type ConversationAssistantContentPart,
  type ConversationToolResultPart,
  type JSONValue,
} from "../src/agent/conversation.js";

// ============================================================================
// toModelMessages() and toModelMessage() Tests
// ============================================================================

describe("toModelMessages", () => {
  describe("user messages", () => {
    it("should convert a simple user message", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Hello, world!" },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "user",
        content: "Hello, world!",
      });
    });

    it("should convert multiple user messages", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "First message" },
        { role: "user", content: "Second message" },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: "user", content: "First message" });
      expect(result[1]).toEqual({ role: "user", content: "Second message" });
    });
  });

  describe("assistant messages", () => {
    it("should convert assistant message with string content", () => {
      const messages: ConversationMessage[] = [
        { role: "assistant", content: "Hello! How can I help you?" },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: "assistant",
        content: "Hello! How can I help you?",
      });
    });

    it("should convert assistant message with text parts", () => {
      const messages: ConversationMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me help you with that." },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      expect(assistantMsg.role).toBe("assistant");
      expect(assistantMsg.content).toEqual([
        { type: "text", text: "Let me help you with that." },
      ]);
    });

    it("should convert assistant message with tool calls", () => {
      const messages: ConversationMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll run a query for you." },
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "run_sql_query",
              args: { query: "SELECT * FROM users" },
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      expect(assistantMsg.role).toBe("assistant");
      expect(Array.isArray(assistantMsg.content)).toBe(true);
      const content = assistantMsg.content as Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: unknown }>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: "text", text: "I'll run a query for you." });
      expect(content[1]).toEqual({
        type: "tool-call",
        toolCallId: "call_123",
        toolName: "run_sql_query",
        input: { query: "SELECT * FROM users" },
      });
    });

    it("should convert assistant message with only tool calls (no text)", () => {
      const messages: ConversationMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_456",
              toolName: "generate_report",
              args: { title: "Analysis Report" },
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      expect(Array.isArray(assistantMsg.content)).toBe(true);
      const content = assistantMsg.content as Array<{ type: string; toolCallId?: string; toolName?: string; input?: unknown }>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        type: "tool-call",
        toolCallId: "call_456",
        toolName: "generate_report",
        input: { title: "Analysis Report" },
      });
    });
  });

  describe("tool messages", () => {
    it("should convert tool message with successful result", () => {
      const messages: ConversationMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_123",
              toolName: "run_sql_query",
              result: { rows: [{ id: 1, name: "Alice" }] },
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const toolMsg = result[0] as ToolModelMessage;
      expect(toolMsg.role).toBe("tool");
      expect(toolMsg.content).toHaveLength(1);
      expect(toolMsg.content[0]).toEqual({
        type: "tool-result",
        toolCallId: "call_123",
        toolName: "run_sql_query",
        output: { type: "json", value: { rows: [{ id: 1, name: "Alice" }] } },
      });
    });

    it("should convert tool message with error result", () => {
      const messages: ConversationMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_789",
              toolName: "run_sql_query",
              result: { error: "Invalid SQL syntax" },
              isError: true,
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const toolMsg = result[0] as ToolModelMessage;
      expect(toolMsg.content[0]).toEqual({
        type: "tool-result",
        toolCallId: "call_789",
        toolName: "run_sql_query",
        output: { type: "error-json", value: { error: "Invalid SQL syntax" } },
      });
    });

    it("should convert tool message with multiple results", () => {
      const messages: ConversationMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "tool_a",
              result: "result_a",
            },
            {
              type: "tool-result",
              toolCallId: "call_2",
              toolName: "tool_b",
              result: "result_b",
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const toolMsg = result[0] as ToolModelMessage;
      expect(toolMsg.content).toHaveLength(2);
    });
  });

  describe("mixed conversation history", () => {
    it("should convert a complete conversation with all message types", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "Analyze the user data" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll run a query." },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "run_sql_query",
              args: { query: "SELECT * FROM users" },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "run_sql_query",
              result: { count: 100 },
            },
          ],
        },
        { role: "assistant", content: "I found 100 users." },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(4);
      expect(result[0].role).toBe("user");
      expect(result[1].role).toBe("assistant");
      expect(result[2].role).toBe("tool");
      expect(result[3].role).toBe("assistant");
    });
  });

  describe("edge cases", () => {
    it("should handle empty history", () => {
      const result = toModelMessages([]);
      expect(result).toEqual([]);
    });

    it("should handle empty string content in user message", () => {
      const messages: ConversationMessage[] = [
        { role: "user", content: "" },
      ];

      const result = toModelMessages(messages);

      expect(result).toEqual([{ role: "user", content: "" }]);
    });

    it("should handle empty string content in assistant message", () => {
      const messages: ConversationMessage[] = [
        { role: "assistant", content: "" },
      ];

      const result = toModelMessages(messages);

      expect(result).toEqual([{ role: "assistant", content: "" }]);
    });

    it("should handle empty array content in assistant message", () => {
      const messages: ConversationMessage[] = [
        { role: "assistant", content: [] },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      expect(assistantMsg.content).toEqual([]);
    });

    it("should handle empty content in tool message", () => {
      const messages: ConversationMessage[] = [
        { role: "tool", content: [] },
      ];

      const result = toModelMessages(messages);

      expect(result).toHaveLength(1);
      const toolMsg = result[0] as ToolModelMessage;
      expect(toolMsg.content).toEqual([]);
    });

    it("should handle null/undefined values in tool results", () => {
      const messages: ConversationMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "test_tool",
              result: null,
            },
          ],
        },
      ];

      const result = toModelMessages(messages);

      const toolMsg = result[0] as ToolModelMessage;
      const toolResult = toolMsg.content[0] as { type: "tool-result"; output: unknown };
      expect(toolResult.output).toEqual({ type: "json", value: null });
    });
  });
});

// ============================================================================
// truncateReportToolCalls() Tests
// ============================================================================

describe("truncateReportToolCalls", () => {
  describe("generate_report truncation", () => {
    it("should truncate generate_report tool call arguments", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here's your report." },
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "generate_report",
              input: {
                title: "Analysis Report",
                content: { very: { large: { nested: { object: "with lots of data" } } } },
              },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: unknown }>;
      expect(content).toHaveLength(2);
      
      // Text part should be unchanged
      expect(content[0]).toEqual({ type: "text", text: "Here's your report." });
      
      // Tool call should have truncated content but preserved title
      expect(content[1].type).toBe("tool-call");
      expect(content[1].toolCallId).toBe("call_123");
      expect(content[1].toolName).toBe("generate_report");
      expect(content[1].input).toEqual({
        title: "Analysis Report",
        content: "[Report content truncated to save tokens]",
      });
    });

    it("should preserve title in truncated generate_report", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_456",
              toolName: "generate_report",
              input: {
                title: "Custom Title",
                content: { data: Array(1000).fill("x") },
              },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; input?: unknown }>;
      const truncatedInput = content[0].input as { title?: string; content: string };
      expect(truncatedInput.title).toBe("Custom Title");
      expect(truncatedInput.content).toBe("[Report content truncated to save tokens]");
    });

    it("should handle generate_report without title", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_789",
              toolName: "generate_report",
              input: {
                content: { large: "data" },
              },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; input?: unknown }>;
      const truncatedInput = content[0].input as { title?: string; content: string };
      expect(truncatedInput.title).toBeUndefined();
      expect(truncatedInput.content).toBe("[Report content truncated to save tokens]");
    });
  });

  describe("non-generate_report tool calls", () => {
    it("should NOT truncate other tool calls", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_sql",
              toolName: "run_sql_query",
              input: { query: "SELECT * FROM users WHERE id > 100" },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; input?: unknown }>;
      expect(content[0].input).toEqual({ query: "SELECT * FROM users WHERE id > 100" });
    });

    it("should only truncate generate_report in mixed tool calls", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "run_sql_query",
              input: { query: "SELECT COUNT(*) FROM events" },
            },
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "generate_report",
              input: { title: "Report", content: { big: "data" } },
            },
            {
              type: "tool-call",
              toolCallId: "call_3",
              toolName: "another_tool",
              input: { param: "value" },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; toolName?: string; input?: unknown }>;
      
      // First and third unchanged
      expect(content[0].input).toEqual({ query: "SELECT COUNT(*) FROM events" });
      expect(content[2].input).toEqual({ param: "value" });
      
      // Second (generate_report) truncated
      const reportInput = content[1].input as { title?: string; content: string };
      expect(reportInput.content).toBe("[Report content truncated to save tokens]");
    });
  });

  describe("non-assistant messages", () => {
    it("should pass through user messages unchanged", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Hello" } as UserModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });

    it("should pass through tool messages unchanged", () => {
      const messages: ModelMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_123",
              toolName: "generate_report",
              output: { type: "json", value: { success: true } },
            },
          ],
        } as ToolModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });
  });

  describe("assistant messages with string content", () => {
    it("should pass through string content unchanged", () => {
      const messages: ModelMessage[] = [
        { role: "assistant", content: "This is a simple text response." } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });
  });

  describe("edge cases", () => {
    it("should handle empty messages array", () => {
      const result = truncateReportToolCalls([]);
      expect(result).toEqual([]);
    });

    it("should handle multiple assistant messages with generate_report", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "generate_report",
              input: { title: "First", content: { data: "1" } },
            },
          ],
        } as AssistantModelMessage,
        { role: "user", content: "Thanks" } as UserModelMessage,
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "generate_report",
              input: { title: "Second", content: { data: "2" } },
            },
          ],
        } as AssistantModelMessage,
      ];

      const result = truncateReportToolCalls(messages);

      // Both assistant messages should have truncated content
      const first = result[0] as AssistantModelMessage;
      const second = result[2] as AssistantModelMessage;
      
      const firstContent = first.content as Array<{ type: string; input?: unknown }>;
      const secondContent = second.content as Array<{ type: string; input?: unknown }>;
      
      expect((firstContent[0].input as { content: string }).content).toBe("[Report content truncated to save tokens]");
      expect((secondContent[0].input as { content: string }).content).toBe("[Report content truncated to save tokens]");
    });

    it("should not mutate original messages", () => {
      const original: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "generate_report",
              input: { title: "Test", content: { original: "data" } },
            },
          ],
        } as AssistantModelMessage,
      ];

      const originalInput = ((original[0] as AssistantModelMessage).content as Array<{ input: unknown }>)[0].input;

      truncateReportToolCalls(original);

      // Original should be unchanged
      expect(originalInput).toEqual({ title: "Test", content: { original: "data" } });
    });
  });
});

// ============================================================================
// extractMessagesFromResponse() Tests
// ============================================================================

describe("extractMessagesFromResponse", () => {
  /**
   * Helper to create a mock AI SDK result with steps
   */
  function createMockResult(steps: Array<{
    text?: string;
    toolCalls?: Array<{
      toolCallId: string;
      toolName: string;
      input: unknown;
    }>;
    toolResults?: Array<{
      toolCallId: string;
      toolName: string;
      output: unknown;
    }>;
  }>) {
    return {
      steps: steps.map((step) => ({
        text: step.text || "",
        toolCalls: (step.toolCalls || []).map((tc) => ({
          type: "tool-call" as const,
          ...tc,
        })),
        toolResults: (step.toolResults || []).map((tr) => ({
          type: "tool-result" as const,
          ...tr,
        })),
      })),
    };
  }

  describe("text-only responses", () => {
    it("should extract assistant message from text response", () => {
      const result = createMockResult([
        { text: "Hello! I'm here to help." },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "assistant",
        content: "Hello! I'm here to help.",
      });
    });

    it("should extract multiple text steps as separate messages", () => {
      const result = createMockResult([
        { text: "First part." },
        { text: "Second part." },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: "assistant", content: "First part." });
      expect(messages[1]).toEqual({ role: "assistant", content: "Second part." });
    });
  });

  describe("tool call responses", () => {
    it("should extract assistant message with tool calls", () => {
      const result = createMockResult([
        {
          text: "Let me run a query.",
          toolCalls: [
            {
              toolCallId: "call_123",
              toolName: "run_sql_query",
              input: { query: "SELECT * FROM users" },
            },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(Array.isArray(messages[0].content)).toBe(true);
      const content = messages[0].content as ConversationAssistantContentPart[];
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: "text", text: "Let me run a query." });
      expect(content[1]).toEqual({
        type: "tool-call",
        toolCallId: "call_123",
        toolName: "run_sql_query",
        args: { query: "SELECT * FROM users" },
      });
    });

    it("should extract tool calls without text", () => {
      const result = createMockResult([
        {
          toolCalls: [
            {
              toolCallId: "call_456",
              toolName: "generate_report",
              input: { title: "Report" },
            },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      const content = messages[0].content as ConversationAssistantContentPart[];
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool-call");
    });

    it("should extract multiple tool calls in one step", () => {
      const result = createMockResult([
        {
          text: "Running multiple queries.",
          toolCalls: [
            {
              toolCallId: "call_1",
              toolName: "tool_a",
              input: { a: 1 },
            },
            {
              toolCallId: "call_2",
              toolName: "tool_b",
              input: { b: 2 },
            },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(1);
      const content = messages[0].content as ConversationAssistantContentPart[];
      expect(content).toHaveLength(3); // 1 text + 2 tool calls
    });
  });

  describe("tool result responses", () => {
    it("should extract tool results as tool message", () => {
      const result = createMockResult([
        {
          text: "Running query.",
          toolCalls: [
            {
              toolCallId: "call_123",
              toolName: "run_sql_query",
              input: { query: "SELECT 1" },
            },
          ],
          toolResults: [
            {
              toolCallId: "call_123",
              toolName: "run_sql_query",
              output: { rows: [{ result: 1 }] },
            },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      // Should have assistant message with tool call AND tool message with result
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("assistant");
      expect(messages[1].role).toBe("tool");
      
      const toolContent = (messages[1] as { role: "tool"; content: ConversationToolResultPart[] }).content;
      expect(toolContent).toHaveLength(1);
      expect(toolContent[0]).toEqual({
        type: "tool-result",
        toolCallId: "call_123",
        toolName: "run_sql_query",
        result: { rows: [{ result: 1 }] },
      });
    });

    it("should extract multiple tool results", () => {
      const result = createMockResult([
        {
          toolCalls: [
            { toolCallId: "call_1", toolName: "tool_a", input: {} },
            { toolCallId: "call_2", toolName: "tool_b", input: {} },
          ],
          toolResults: [
            { toolCallId: "call_1", toolName: "tool_a", output: "result_a" },
            { toolCallId: "call_2", toolName: "tool_b", output: "result_b" },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(2);
      const toolMsg = messages[1] as { role: "tool"; content: ConversationToolResultPart[] };
      expect(toolMsg.content).toHaveLength(2);
    });
  });

  describe("multi-step responses", () => {
    it("should handle multi-step agentic response", () => {
      const result = createMockResult([
        // Step 1: Tool call
        {
          text: "Let me check the data.",
          toolCalls: [
            { toolCallId: "call_1", toolName: "run_sql_query", input: { query: "SELECT COUNT(*)" } },
          ],
          toolResults: [
            { toolCallId: "call_1", toolName: "run_sql_query", output: { count: 100 } },
          ],
        },
        // Step 2: Another tool call based on first result
        {
          text: "Now generating report.",
          toolCalls: [
            { toolCallId: "call_2", toolName: "generate_report", input: { title: "Count" } },
          ],
          toolResults: [
            { toolCallId: "call_2", toolName: "generate_report", output: { success: true } },
          ],
        },
        // Step 3: Final response
        {
          text: "I found 100 records and created a report.",
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      // Step 1: assistant (text + tool call) + tool (result)
      // Step 2: assistant (text + tool call) + tool (result)
      // Step 3: assistant (text only)
      expect(messages).toHaveLength(5);
      expect(messages[0].role).toBe("assistant"); // text + tool call
      expect(messages[1].role).toBe("tool"); // tool result
      expect(messages[2].role).toBe("assistant"); // text + tool call
      expect(messages[3].role).toBe("tool"); // tool result
      expect(messages[4].role).toBe("assistant"); // final text
    });
  });

  describe("edge cases", () => {
    it("should return empty array for result with no steps", () => {
      const result = { steps: [] };

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toEqual([]);
    });

    it("should return empty array for result with undefined steps", () => {
      const result = {} as any;

      const messages = extractMessagesFromResponse(result);

      expect(messages).toEqual([]);
    });

    it("should skip steps with no content (no text, no tool calls)", () => {
      const result = createMockResult([
        { text: "" }, // Empty text, no tool calls - should be skipped
        { text: "Actual content." },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: "assistant", content: "Actual content." });
    });

    it("should handle steps with only tool results (no calls or text)", () => {
      const result = createMockResult([
        {
          toolResults: [
            { toolCallId: "call_1", toolName: "tool_a", output: "orphan result" },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      // Should only have tool message (no assistant message since no text/calls)
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("tool");
    });

    it("should handle complex nested tool results", () => {
      const result = createMockResult([
        {
          text: "Query result:",
          toolCalls: [
            { toolCallId: "call_1", toolName: "run_sql_query", input: {} },
          ],
          toolResults: [
            {
              toolCallId: "call_1",
              toolName: "run_sql_query",
              output: {
                rows: [
                  { id: 1, data: { nested: { deep: "value" } } },
                  { id: 2, data: null },
                ],
                metadata: { totalRows: 2 },
              },
            },
          ],
        },
      ]);

      const messages = extractMessagesFromResponse(result as any);

      expect(messages).toHaveLength(2);
      const toolMsg = messages[1] as { role: "tool"; content: ConversationToolResultPart[] };
      expect(toolMsg.content[0].result).toEqual({
        rows: [
          { id: 1, data: { nested: { deep: "value" } } },
          { id: 2, data: null },
        ],
        metadata: { totalRows: 2 },
      });
    });
  });
});

// ============================================================================
// compactConversation() Tests
// ============================================================================

describe("compactConversation", () => {
  /**
   * Helper to create a simple user message
   */
  function userMsg(content: string): ConversationMessage {
    return createUserMessage(content);
  }

  /**
   * Helper to create a simple assistant text message
   */
  function assistantMsg(content: string): ConversationMessage {
    return createAssistantMessage(content);
  }

  /**
   * Helper to create an assistant message with tool calls
   */
  function assistantWithToolCalls(
    text: string,
    toolCalls: Array<{ id: string; name: string; args: unknown }>
  ): ConversationMessage {
    const parts: ConversationAssistantContentPart[] = [];
    if (text) {
      parts.push({ type: "text", text });
    }
    for (const tc of toolCalls) {
      parts.push({
        type: "tool-call",
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.args,
      });
    }
    return createAssistantMessageWithParts(parts);
  }

  /**
   * Helper to create a tool message with results
   */
  function toolMsg(
    results: Array<{ id: string; name: string; result: JSONValue }>
  ): ConversationMessage {
    const parts: ConversationToolResultPart[] = results.map((r) => ({
      type: "tool-result",
      toolCallId: r.id,
      toolName: r.name,
      result: r.result,
    }));
    return createToolMessage(parts);
  }

  describe("short conversations (no compaction needed)", () => {
    it("should return original array when length <= keepFirstN + keepLastN", () => {
      const messages: ConversationMessage[] = [
        userMsg("Hello"),
        assistantMsg("Hi there!"),
        userMsg("How are you?"),
        assistantMsg("I'm good!"),
      ];

      // Default: keepFirstN=2, keepLastN=6 -> total=8
      // 4 messages is less than 8, so no compaction
      const result = compactConversation(messages);

      expect(result).toEqual(messages);
    });

    it("should return original array when length equals threshold", () => {
      const messages: ConversationMessage[] = Array(8)
        .fill(null)
        .map((_, i) => (i % 2 === 0 ? userMsg(`User ${i}`) : assistantMsg(`Assistant ${i}`)));

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 6 });

      expect(result).toEqual(messages);
    });

    it("should handle empty conversation", () => {
      const result = compactConversation([]);
      expect(result).toEqual([]);
    });

    it("should handle single message", () => {
      const messages: ConversationMessage[] = [userMsg("Hello")];
      const result = compactConversation(messages);
      expect(result).toEqual(messages);
    });
  });

  describe("long conversations (compaction needed)", () => {
    it("should keep first N messages intact", () => {
      const messages: ConversationMessage[] = [
        userMsg("Initial context"),
        assistantMsg("Understood"),
        userMsg("Middle 1"),
        assistantMsg("Middle 2"),
        userMsg("Middle 3"),
        assistantMsg("Middle 4"),
        userMsg("Middle 5"),
        assistantMsg("Middle 6"),
        userMsg("Recent 1"),
        assistantMsg("Recent 2"),
        userMsg("Recent 3"),
        assistantMsg("Recent 4"),
      ];

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // First 2 should be unchanged
      expect(result[0]).toEqual(userMsg("Initial context"));
      expect(result[1]).toEqual(assistantMsg("Understood"));
    });

    it("should keep last N messages intact", () => {
      const messages: ConversationMessage[] = [
        userMsg("First"),
        assistantMsg("Second"),
        userMsg("Middle 1"),
        assistantMsg("Middle 2"),
        userMsg("Middle 3"),
        assistantMsg("Middle 4"),
        userMsg("Recent 1"),
        assistantMsg("Recent 2"),
        userMsg("Recent 3"),
        assistantMsg("Final answer"),
      ];

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // Last 4 should be unchanged
      const lastFour = result.slice(-4);
      expect(lastFour[0]).toEqual(userMsg("Recent 1"));
      expect(lastFour[1]).toEqual(assistantMsg("Recent 2"));
      expect(lastFour[2]).toEqual(userMsg("Recent 3"));
      expect(lastFour[3]).toEqual(assistantMsg("Final answer"));
    });

    it("should prune tool calls from middle messages", () => {
      const messages: ConversationMessage[] = [
        userMsg("First"),
        assistantMsg("Second"),
        // Middle section with tool calls
        userMsg("Run a query"),
        assistantWithToolCalls("Running query", [
          { id: "call_1", name: "run_sql_query", args: { query: "SELECT *" } },
        ]),
        toolMsg([{ id: "call_1", name: "run_sql_query", result: { rows: [] } }]),
        assistantMsg("Query complete"),
        // Recent messages
        userMsg("Recent question"),
        assistantMsg("Recent answer"),
        userMsg("Another recent"),
        assistantMsg("Final"),
      ];

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // Middle section should have tool calls removed
      // The pruning removes tool calls and empty messages
      expect(result.length).toBeLessThan(messages.length);
      
      // Verify first 2 are intact
      expect(result[0]).toEqual(userMsg("First"));
      expect(result[1]).toEqual(assistantMsg("Second"));
      
      // Verify last 4 are intact
      const last4 = result.slice(-4);
      expect(last4[0]).toEqual(userMsg("Recent question"));
      expect(last4[3]).toEqual(assistantMsg("Final"));
    });

    it("should reduce total message count", () => {
      const messages: ConversationMessage[] = [
        userMsg("First"),
        assistantMsg("Second"),
        // Many middle messages with tool calls
        ...Array(10)
          .fill(null)
          .flatMap((_, i) => [
            userMsg(`Middle user ${i}`),
            assistantWithToolCalls(`Middle assistant ${i}`, [
              { id: `call_${i}`, name: "tool", args: { i } },
            ]),
            toolMsg([{ id: `call_${i}`, name: "tool", result: i }]),
          ]),
        // Recent
        userMsg("Recent 1"),
        assistantMsg("Recent 2"),
        userMsg("Recent 3"),
        assistantMsg("Recent 4"),
      ];

      const originalLength = messages.length;
      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // Result should be shorter due to pruning
      expect(result.length).toBeLessThan(originalLength);
    });
  });

  describe("custom options", () => {
    it("should respect custom keepFirstN", () => {
      const messages: ConversationMessage[] = Array(15)
        .fill(null)
        .map((_, i) => (i % 2 === 0 ? userMsg(`User ${i}`) : assistantMsg(`Assistant ${i}`)));

      const result = compactConversation(messages, { keepFirstN: 4, keepLastN: 4 });

      // First 4 should be preserved
      expect(result[0]).toEqual(userMsg("User 0"));
      expect(result[1]).toEqual(assistantMsg("Assistant 1"));
      expect(result[2]).toEqual(userMsg("User 2"));
      expect(result[3]).toEqual(assistantMsg("Assistant 3"));
    });

    it("should respect custom keepLastN", () => {
      const messages: ConversationMessage[] = Array(15)
        .fill(null)
        .map((_, i) => (i % 2 === 0 ? userMsg(`User ${i}`) : assistantMsg(`Assistant ${i}`)));

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 8 });

      // Last 8 should be preserved (indices 7-14: Assistant 7 through User 14)
      const last8 = result.slice(-8);
      expect(last8[0]).toEqual(assistantMsg("Assistant 7"));
      expect(last8[7]).toEqual(userMsg("User 14"));
    });

    it("should use default options when not provided", () => {
      // Default is keepFirstN=2, keepLastN=6
      const messages: ConversationMessage[] = Array(20)
        .fill(null)
        .map((_, i) => (i % 2 === 0 ? userMsg(`User ${i}`) : assistantMsg(`Assistant ${i}`)));

      const result = compactConversation(messages);

      // Should have compacted
      expect(result.length).toBeLessThanOrEqual(messages.length);
      
      // First 2 preserved
      expect(result[0]).toEqual(userMsg("User 0"));
      expect(result[1]).toEqual(assistantMsg("Assistant 1"));
      
      // Last 6 preserved
      const last6 = result.slice(-6);
      expect(last6[5]).toEqual(assistantMsg("Assistant 19"));
    });
  });

  describe("edge cases with tool-heavy conversations", () => {
    it("should handle conversation with only tool calls (no text)", () => {
      const messages: ConversationMessage[] = [
        userMsg("First"),
        assistantMsg("Second"),
        // Middle: only tool calls, no text
        assistantWithToolCalls("", [
          { id: "call_1", name: "tool_a", args: {} },
        ]),
        toolMsg([{ id: "call_1", name: "tool_a", result: null }]),
        assistantWithToolCalls("", [
          { id: "call_2", name: "tool_b", args: {} },
        ]),
        toolMsg([{ id: "call_2", name: "tool_b", result: null }]),
        // Recent
        userMsg("Recent 1"),
        assistantMsg("Recent 2"),
        userMsg("Recent 3"),
        assistantMsg("Recent 4"),
      ];

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // Should not throw
      expect(result.length).toBeGreaterThan(0);
      
      // First and last should be preserved
      expect(result[0]).toEqual(userMsg("First"));
      expect(result[result.length - 1]).toEqual(assistantMsg("Recent 4"));
    });

    it("should preserve tool calls in kept sections", () => {
      const messages: ConversationMessage[] = [
        userMsg("Initial"),
        assistantWithToolCalls("First tool", [
          { id: "call_0", name: "initial_tool", args: { init: true } },
        ]),
        toolMsg([{ id: "call_0", name: "initial_tool", result: "init result" }]),
        // Middle
        userMsg("Middle 1"),
        assistantMsg("Middle 2"),
        userMsg("Middle 3"),
        assistantMsg("Middle 4"),
        // Recent with tool call
        userMsg("Recent query"),
        assistantWithToolCalls("Recent tool", [
          { id: "call_recent", name: "recent_tool", args: { recent: true } },
        ]),
        toolMsg([{ id: "call_recent", name: "recent_tool", result: "recent result" }]),
        userMsg("Final question"),
        assistantMsg("Final answer"),
      ];

      const result = compactConversation(messages, { keepFirstN: 3, keepLastN: 5 });

      // First 3 (including tool call) should be preserved
      expect(result[0]).toEqual(userMsg("Initial"));
      const firstAssistant = result[1];
      expect(firstAssistant.role).toBe("assistant");
      expect(Array.isArray(firstAssistant.content)).toBe(true);
      
      // Last 5 (including tool call) should be preserved
      const last5 = result.slice(-5);
      expect(last5[0]).toEqual(userMsg("Recent query"));
      expect(last5[4]).toEqual(assistantMsg("Final answer"));
    });
  });

  describe("very long conversations", () => {
    it("should handle 100+ message text-only conversation without reduction", () => {
      // Text-only messages have no tool calls or reasoning to prune,
      // so the middle section remains unchanged (only empty messages are removed)
      const messages: ConversationMessage[] = [];
      
      // Add 100 exchanges
      for (let i = 0; i < 100; i++) {
        messages.push(userMsg(`Question ${i}`));
        messages.push(assistantMsg(`Answer ${i}`));
      }

      const result = compactConversation(messages, { keepFirstN: 4, keepLastN: 10 });

      // For text-only conversations, pruning doesn't reduce size (no tool calls to remove)
      // The result should still be valid and preserve boundaries
      expect(result.length).toBeLessThanOrEqual(messages.length);
      
      // Boundaries should be preserved
      expect(result[0]).toEqual(userMsg("Question 0"));
      expect(result[3]).toEqual(assistantMsg("Answer 1"));
      expect(result[result.length - 1]).toEqual(assistantMsg("Answer 99"));
    });

    it("should handle conversation with many tool calls", () => {
      const messages: ConversationMessage[] = [
        userMsg("Start"),
        assistantMsg("Begin"),
      ];
      
      // Add 20 tool call sequences in the middle
      for (let i = 0; i < 20; i++) {
        messages.push(userMsg(`Request ${i}`));
        messages.push(
          assistantWithToolCalls(`Processing ${i}`, [
            { id: `call_${i}`, name: "process", args: { data: Array(100).fill(i) } },
          ])
        );
        messages.push(
          toolMsg([{ id: `call_${i}`, name: "process", result: { processed: i } }])
        );
        messages.push(assistantMsg(`Done ${i}`));
      }
      
      // Add recent
      messages.push(userMsg("Recent 1"));
      messages.push(assistantMsg("Recent 2"));
      messages.push(userMsg("Recent 3"));
      messages.push(assistantMsg("Recent 4"));

      const result = compactConversation(messages, { keepFirstN: 2, keepLastN: 4 });

      // Should be much smaller due to tool call pruning
      expect(result.length).toBeLessThan(messages.length);
      
      // First and last preserved
      expect(result[0]).toEqual(userMsg("Start"));
      expect(result[1]).toEqual(assistantMsg("Begin"));
      expect(result[result.length - 1]).toEqual(assistantMsg("Recent 4"));
    });
  });
});
