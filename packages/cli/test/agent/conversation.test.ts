import { describe, it, expect } from "vitest";
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
});
