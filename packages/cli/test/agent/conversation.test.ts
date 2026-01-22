import { describe, it, expect } from "vitest";
import type { ModelMessage, AssistantModelMessage } from "ai";
import {
  // Types
  type ConversationMessage,
  type ConversationUserMessage,
  type ConversationAssistantMessage,
  type ConversationToolMessage,
  type ConversationTextPart,
  type ConversationToolCallPart,
  type ConversationToolResultPart,
  type JSONValue,
  // Type guards
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isTextPart,
  isToolCallPart,
  // Helper functions
  getAssistantText,
  getAssistantToolCalls,
  hasToolCalls,
  // Factory functions
  createUserMessage,
  createAssistantMessage,
  createAssistantMessageWithParts,
  createToolMessage,
  // Conversion functions
  toModelMessage,
  toModelMessages,
  truncateReportToolCalls,
} from "../../src/agent/conversation.js";

describe("conversation types", () => {
  describe("type guards", () => {
    it("isUserMessage correctly identifies user messages", () => {
      const userMessage: ConversationUserMessage = {
        role: "user",
        content: "Hello",
      };
      const assistantMessage: ConversationAssistantMessage = {
        role: "assistant",
        content: "Hi there",
      };
      const toolMessage: ConversationToolMessage = {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "test",
            result: "done",
          },
        ],
      };

      expect(isUserMessage(userMessage)).toBe(true);
      expect(isUserMessage(assistantMessage)).toBe(false);
      expect(isUserMessage(toolMessage)).toBe(false);
    });

    it("isAssistantMessage correctly identifies assistant messages", () => {
      const userMessage: ConversationUserMessage = {
        role: "user",
        content: "Hello",
      };
      const assistantMessage: ConversationAssistantMessage = {
        role: "assistant",
        content: "Hi there",
      };
      const toolMessage: ConversationToolMessage = {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "test",
            result: "done",
          },
        ],
      };

      expect(isAssistantMessage(userMessage)).toBe(false);
      expect(isAssistantMessage(assistantMessage)).toBe(true);
      expect(isAssistantMessage(toolMessage)).toBe(false);
    });

    it("isToolMessage correctly identifies tool messages", () => {
      const userMessage: ConversationUserMessage = {
        role: "user",
        content: "Hello",
      };
      const assistantMessage: ConversationAssistantMessage = {
        role: "assistant",
        content: "Hi there",
      };
      const toolMessage: ConversationToolMessage = {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "test",
            result: "done",
          },
        ],
      };

      expect(isToolMessage(userMessage)).toBe(false);
      expect(isToolMessage(assistantMessage)).toBe(false);
      expect(isToolMessage(toolMessage)).toBe(true);
    });

    it("isTextPart correctly identifies text parts", () => {
      const textPart: ConversationTextPart = { type: "text", text: "Hello" };
      const toolCallPart: ConversationToolCallPart = {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "test",
        args: {},
      };

      expect(isTextPart(textPart)).toBe(true);
      expect(isTextPart(toolCallPart)).toBe(false);
    });

    it("isToolCallPart correctly identifies tool call parts", () => {
      const textPart: ConversationTextPart = { type: "text", text: "Hello" };
      const toolCallPart: ConversationToolCallPart = {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "test",
        args: {},
      };

      expect(isToolCallPart(textPart)).toBe(false);
      expect(isToolCallPart(toolCallPart)).toBe(true);
    });
  });

  describe("helper functions", () => {
    describe("getAssistantText", () => {
      it("returns text from string content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: "Hello world",
        };

        expect(getAssistantText(message)).toBe("Hello world");
      });

      it("returns concatenated text from array content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        };

        expect(getAssistantText(message)).toBe("Hello world");
      });

      it("ignores tool call parts when extracting text", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            { type: "text", text: "Let me help with that." },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              args: { command: "ls" },
            },
          ],
        };

        expect(getAssistantText(message)).toBe("Let me help with that.");
      });

      it("returns empty string when no text parts exist", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              args: { command: "ls" },
            },
          ],
        };

        expect(getAssistantText(message)).toBe("");
      });
    });

    describe("getAssistantToolCalls", () => {
      it("returns empty array for string content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: "Just text",
        };

        expect(getAssistantToolCalls(message)).toEqual([]);
      });

      it("returns tool calls from array content", () => {
        const toolCall: ConversationToolCallPart = {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "bash",
          args: { command: "ls" },
        };
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [{ type: "text", text: "Let me run that" }, toolCall],
        };

        const result = getAssistantToolCalls(message);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(toolCall);
      });

      it("returns multiple tool calls", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              args: { command: "ls" },
            },
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "read_file",
              args: { path: "/tmp/test" },
            },
          ],
        };

        const result = getAssistantToolCalls(message);
        expect(result).toHaveLength(2);
        expect(result[0]?.toolCallId).toBe("call_1");
        expect(result[1]?.toolCallId).toBe("call_2");
      });
    });

    describe("hasToolCalls", () => {
      it("returns false for string content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: "Just text",
        };

        expect(hasToolCalls(message)).toBe(false);
      });

      it("returns false for text-only array content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [{ type: "text", text: "Just text" }],
        };

        expect(hasToolCalls(message)).toBe(false);
      });

      it("returns true when tool calls exist", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            { type: "text", text: "Let me help" },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              args: {},
            },
          ],
        };

        expect(hasToolCalls(message)).toBe(true);
      });
    });
  });

  describe("factory functions", () => {
    it("createUserMessage creates a valid user message", () => {
      const message = createUserMessage("Hello");

      expect(message).toEqual({
        role: "user",
        content: "Hello",
      });
      expect(isUserMessage(message)).toBe(true);
    });

    it("createAssistantMessage creates a valid assistant message with text", () => {
      const message = createAssistantMessage("Hi there");

      expect(message).toEqual({
        role: "assistant",
        content: "Hi there",
      });
      expect(isAssistantMessage(message)).toBe(true);
    });

    it("createAssistantMessageWithParts creates a valid assistant message with parts", () => {
      const parts: ConversationTextPart[] = [
        { type: "text", text: "Part 1" },
        { type: "text", text: "Part 2" },
      ];
      const message = createAssistantMessageWithParts(parts);

      expect(message).toEqual({
        role: "assistant",
        content: parts,
      });
      expect(isAssistantMessage(message)).toBe(true);
    });

    it("createToolMessage creates a valid tool message", () => {
      const results: ConversationToolResultPart[] = [
        {
          type: "tool-result",
          toolCallId: "call_1",
          toolName: "bash",
          result: { output: "success" },
        },
      ];
      const message = createToolMessage(results);

      expect(message).toEqual({
        role: "tool",
        content: results,
      });
      expect(isToolMessage(message)).toBe(true);
    });
  });

  describe("conversion to ModelMessage", () => {
    describe("toModelMessage", () => {
      it("converts user message to UserModelMessage", () => {
        const message: ConversationUserMessage = {
          role: "user",
          content: "Hello",
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "user",
          content: "Hello",
        });
      });

      it("converts assistant message with string content", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: "Hi there",
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "assistant",
          content: "Hi there",
        });
      });

      it("converts assistant message with text parts", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: " world" },
          ],
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "assistant",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: " world" },
          ],
        });
      });

      it("converts assistant message with tool calls", () => {
        const message: ConversationAssistantMessage = {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check" },
            {
              type: "tool-call",
              toolCallId: "call_abc123",
              toolName: "bash",
              args: { command: "ls -la" },
            },
          ],
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "assistant",
          content: [
            { type: "text", text: "Let me check" },
            {
              type: "tool-call",
              toolCallId: "call_abc123",
              toolName: "bash",
              input: { command: "ls -la" },
            },
          ],
        });
      });

      it("converts tool message with successful result", () => {
        const message: ConversationToolMessage = {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_abc123",
              toolName: "bash",
              result: { output: "file1.txt\nfile2.txt" },
            },
          ],
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_abc123",
              toolName: "bash",
              output: {
                type: "json",
                value: { output: "file1.txt\nfile2.txt" },
              },
            },
          ],
        });
      });

      it("converts tool message with error result", () => {
        const message: ConversationToolMessage = {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_abc123",
              toolName: "bash",
              result: { error: "Command not found" },
              isError: true,
            },
          ],
        };

        const result = toModelMessage(message);

        expect(result).toEqual({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_abc123",
              toolName: "bash",
              output: {
                type: "error-json",
                value: { error: "Command not found" },
              },
            },
          ],
        });
      });
    });

    describe("toModelMessages", () => {
      it("converts empty array", () => {
        expect(toModelMessages([])).toEqual([]);
      });

      it("converts array of messages", () => {
        const messages: ConversationMessage[] = [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
        ];

        const result = toModelMessages(messages);

        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ role: "user", content: "Hello" });
        expect(result[1]).toEqual({ role: "assistant", content: "Hi there!" });
        expect(result[2]).toEqual({ role: "user", content: "How are you?" });
      });

      it("converts multi-turn conversation with tool calls", () => {
        const messages: ConversationMessage[] = [
          { role: "user", content: "List files in current directory" },
          {
            role: "assistant",
            content: [
              { type: "text", text: "I'll list the files for you." },
              {
                type: "tool-call",
                toolCallId: "call_1",
                toolName: "bash",
                args: { command: "ls" },
              },
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "call_1",
                toolName: "bash",
                result: "file1.txt\nfile2.txt",
              },
            ],
          },
          { role: "assistant", content: "Here are the files: file1.txt, file2.txt" },
        ];

        const result = toModelMessages(messages);

        expect(result).toHaveLength(4);
        expect(result[0]?.role).toBe("user");
        expect(result[1]?.role).toBe("assistant");
        expect(result[2]?.role).toBe("tool");
        expect(result[3]?.role).toBe("assistant");
      });
    });
  });

  describe("type validation", () => {
    it("JSONValue type accepts valid JSON values", () => {
      // This is a compile-time check - if it compiles, the types are correct
      const stringValue: JSONValue = "hello";
      const numberValue: JSONValue = 42;
      const boolValue: JSONValue = true;
      const nullValue: JSONValue = null;
      const arrayValue: JSONValue = [1, "two", true, null];
      const objectValue: JSONValue = { key: "value", nested: { num: 1 } };

      // All values should be defined (no runtime errors)
      expect(stringValue).toBe("hello");
      expect(numberValue).toBe(42);
      expect(boolValue).toBe(true);
      expect(nullValue).toBe(null);
      expect(arrayValue).toEqual([1, "two", true, null]);
      expect(objectValue).toEqual({ key: "value", nested: { num: 1 } });
    });

    it("ConversationToolResultPart requires JSONValue for result", () => {
      const result: ConversationToolResultPart = {
        type: "tool-result",
        toolCallId: "call_1",
        toolName: "test",
        result: { data: [1, 2, 3], status: "ok" },
      };

      expect(result.result).toEqual({ data: [1, 2, 3], status: "ok" });
    });
  });

  describe("truncateReportToolCalls", () => {
    it("returns empty array for empty input", () => {
      expect(truncateReportToolCalls([])).toEqual([]);
    });

    it("does not modify user messages", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Hello" },
        { role: "user", content: "How are you?" },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });

    it("does not modify assistant messages with string content", () => {
      const messages: ModelMessage[] = [
        { role: "assistant", content: "I am fine, thank you!" },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });

    it("does not modify tool messages", () => {
      const messages: ModelMessage[] = [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "generate_report",
              output: { type: "json" as const, value: { success: true } },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });

    it("does not modify non-generate_report tool calls", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              input: { command: "ls -la" },
            },
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "px_fetch_more_spans",
              input: { project: "test-project", limit: 100 },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toEqual(messages);
    });

    it("truncates generate_report tool call content while preserving title", () => {
      const largeContent = {
        root: "root-element",
        elements: {
          "root-element": {
            key: "root-element",
            type: "Card",
            props: { title: "Analysis Results" },
            children: ["metric-1", "metric-2", "table-1"],
          },
          "metric-1": {
            key: "metric-1",
            type: "Metric",
            props: { label: "Total Spans", value: 1234 },
            parentKey: "root-element",
          },
          "metric-2": {
            key: "metric-2",
            type: "Metric",
            props: { label: "Error Rate", value: "2.5%" },
            parentKey: "root-element",
          },
          "table-1": {
            key: "table-1",
            type: "Table",
            props: {
              columns: ["Name", "Duration", "Status"],
              data: [
                ["Trace 1", "120ms", "OK"],
                ["Trace 2", "350ms", "ERROR"],
                ["Trace 3", "45ms", "OK"],
              ],
            },
            parentKey: "root-element",
          },
        },
      };

      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here is your analysis report." },
            {
              type: "tool-call",
              toolCallId: "call_report",
              toolName: "generate_report",
              input: { title: "Span Analysis", content: largeContent },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toHaveLength(1);
      const assistantMsg = result[0] as AssistantModelMessage;
      expect(assistantMsg.role).toBe("assistant");
      expect(Array.isArray(assistantMsg.content)).toBe(true);

      const content = assistantMsg.content as Array<{ type: string; [key: string]: unknown }>;
      expect(content).toHaveLength(2);

      // Text part should be unchanged
      expect(content[0]).toEqual({ type: "text", text: "Here is your analysis report." });

      // Tool call should be truncated but preserve title
      const toolCall = content[1] as { type: string; toolCallId: string; toolName: string; input: unknown };
      expect(toolCall.type).toBe("tool-call");
      expect(toolCall.toolCallId).toBe("call_report");
      expect(toolCall.toolName).toBe("generate_report");
      expect(toolCall.input).toEqual({
        title: "Span Analysis",
        content: "[Report content truncated to save tokens]",
      });
    });

    it("truncates generate_report tool call without title", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_report",
              toolName: "generate_report",
              input: { content: { root: "r", elements: {} } },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; input?: unknown }>;
      const toolCall = content[0] as { input: { title?: string; content: string } };

      expect(toolCall.input).toEqual({
        content: "[Report content truncated to save tokens]",
      });
      expect(toolCall.input.title).toBeUndefined();
    });

    it("truncates only generate_report calls in mixed content", () => {
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me analyze this" },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "bash",
              input: { command: "cat data.json" },
            },
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "generate_report",
              input: { title: "Report", content: { root: "r", elements: { r: { key: "r", type: "Card", props: {} } } } },
            },
            {
              type: "tool-call",
              toolCallId: "call_3",
              toolName: "px_fetch_more_spans",
              input: { project: "test", limit: 50 },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      const assistantMsg = result[0] as AssistantModelMessage;
      const content = assistantMsg.content as Array<{ type: string; toolName?: string; input?: unknown }>;

      // Text part unchanged
      expect(content[0]).toEqual({ type: "text", text: "Let me analyze this" });

      // bash tool unchanged
      expect(content[1]).toEqual({
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "bash",
        input: { command: "cat data.json" },
      });

      // generate_report truncated
      expect((content[2] as { input: { title?: string; content: string } }).input).toEqual({
        title: "Report",
        content: "[Report content truncated to save tokens]",
      });

      // px_fetch_more_spans unchanged
      expect(content[3]).toEqual({
        type: "tool-call",
        toolCallId: "call_3",
        toolName: "px_fetch_more_spans",
        input: { project: "test", limit: 50 },
      });
    });

    it("handles conversation with multiple assistant messages", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Analyze my spans" },
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "generate_report",
              input: { title: "First Report", content: { root: "r1", elements: {} } },
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_1",
              toolName: "generate_report",
              output: { type: "json" as const, value: { success: true } },
            },
          ],
        },
        { role: "user", content: "Update the report" },
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_2",
              toolName: "generate_report",
              input: { title: "Updated Report", content: { root: "r2", elements: {} } },
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      expect(result).toHaveLength(5);

      // User message unchanged
      expect(result[0]).toEqual({ role: "user", content: "Analyze my spans" });

      // First assistant message truncated
      const firstAssistant = result[1] as AssistantModelMessage;
      const firstContent = firstAssistant.content as Array<{ input: unknown }>;
      expect((firstContent[0] as { input: { title: string; content: string } }).input).toEqual({
        title: "First Report",
        content: "[Report content truncated to save tokens]",
      });

      // Tool message unchanged
      expect(result[2]).toEqual(messages[2]);

      // Second user message unchanged
      expect(result[3]).toEqual({ role: "user", content: "Update the report" });

      // Second assistant message truncated
      const secondAssistant = result[4] as AssistantModelMessage;
      const secondContent = secondAssistant.content as Array<{ input: unknown }>;
      expect((secondContent[0] as { input: { title: string; content: string } }).input).toEqual({
        title: "Updated Report",
        content: "[Report content truncated to save tokens]",
      });
    });

    it("does not mutate the original messages array", () => {
      const originalInput = { title: "Test", content: { root: "r", elements: {} } };
      const messages: ModelMessage[] = [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "generate_report",
              input: originalInput,
            },
          ],
        },
      ];

      const result = truncateReportToolCalls(messages);

      // Original should be unchanged
      const origContent = (messages[0] as AssistantModelMessage).content as Array<{ input: unknown }>;
      expect(origContent[0]?.input).toEqual(originalInput);

      // Result should be different
      const resultContent = (result[0] as AssistantModelMessage).content as Array<{ input: unknown }>;
      expect(resultContent[0]?.input).not.toEqual(originalInput);
    });
  });
});
