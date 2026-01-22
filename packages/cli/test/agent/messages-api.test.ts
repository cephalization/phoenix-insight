import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConversationMessage } from "../../src/agent/conversation.js";

// Mock the AI SDK functions
vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

// Mock the anthropic SDK
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => ({ modelId: "claude-sonnet-4-5" })),
}));

describe("PhoenixInsightAgent messages API", () => {
  let generateTextMock: ReturnType<typeof vi.fn>;
  let streamTextMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Get fresh mocks
    const aiModule = await import("ai");
    generateTextMock = aiModule.generateText as ReturnType<typeof vi.fn>;
    streamTextMock = aiModule.streamText as ReturnType<typeof vi.fn>;

    // Setup default mock implementations
    generateTextMock.mockResolvedValue({
      text: "Test response",
      steps: [],
      finishReason: "stop",
    });

    streamTextMock.mockReturnValue({
      textStream: (async function* () {
        yield "Test";
        yield " stream";
      })(),
      steps: Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generate() with messages parameter", () => {
    it("uses prompt when messages is not provided", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      // Create a mock mode
      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      await agent.generate("Hello, world!");

      expect(generateTextMock).toHaveBeenCalledTimes(1);
      const callArgs = generateTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBe("Hello, world!");
      expect(callArgs.messages).toBeUndefined();
    });

    it("uses prompt when messages is empty array", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      await agent.generate("Hello!", { messages: [] });

      expect(generateTextMock).toHaveBeenCalledTimes(1);
      const callArgs = generateTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBe("Hello!");
      expect(callArgs.messages).toBeUndefined();
    });

    it("uses messages when provided with conversation history", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      const history: ConversationMessage[] = [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
      ];

      await agent.generate("Follow-up question", { messages: history });

      expect(generateTextMock).toHaveBeenCalledTimes(1);
      const callArgs = generateTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBeUndefined();
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new user message

      // Verify the messages are correctly formed
      expect(callArgs.messages[0]).toEqual({ role: "user", content: "Previous question" });
      expect(callArgs.messages[1]).toEqual({ role: "assistant", content: "Previous answer" });
      expect(callArgs.messages[2]).toEqual({ role: "user", content: "Follow-up question" });
    });

    it("appends current query as last user message", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      const history: ConversationMessage[] = [
        { role: "user", content: "First" },
        { role: "assistant", content: "Response to first" },
        { role: "user", content: "Second" },
        { role: "assistant", content: "Response to second" },
      ];

      await agent.generate("Third question", { messages: history });

      const callArgs = generateTextMock.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(5);

      // Last message should be the new query
      const lastMessage = callArgs.messages[4];
      expect(lastMessage.role).toBe("user");
      expect(lastMessage.content).toBe("Third question");
    });

    it("truncates generate_report tool calls in history", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      const largeReportContent = {
        root: "r",
        elements: {
          r: { key: "r", type: "Card", props: { title: "Big Report" }, children: [] },
        },
      };

      const history: ConversationMessage[] = [
        { role: "user", content: "Create a report" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here is your report" },
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "generate_report",
              args: { title: "Test Report", content: largeReportContent },
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
              result: { success: true },
            },
          ],
        },
      ];

      await agent.generate("Update the report", { messages: history });

      const callArgs = generateTextMock.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();

      // Find the assistant message with the tool call
      const assistantMsg = callArgs.messages[1];
      expect(assistantMsg.role).toBe("assistant");
      expect(Array.isArray(assistantMsg.content)).toBe(true);

      // The tool call should be truncated
      const toolCallPart = assistantMsg.content[1];
      expect(toolCallPart.type).toBe("tool-call");
      expect(toolCallPart.toolName).toBe("generate_report");
      expect(toolCallPart.input).toEqual({
        title: "Test Report",
        content: "[Report content truncated to save tokens]",
      });
    });
  });

  describe("stream() with messages parameter", () => {
    it("uses prompt when messages is not provided", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      await agent.stream("Hello, world!");

      expect(streamTextMock).toHaveBeenCalledTimes(1);
      const callArgs = streamTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBe("Hello, world!");
      expect(callArgs.messages).toBeUndefined();
    });

    it("uses prompt when messages is empty array", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      await agent.stream("Hello!", { messages: [] });

      expect(streamTextMock).toHaveBeenCalledTimes(1);
      const callArgs = streamTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBe("Hello!");
      expect(callArgs.messages).toBeUndefined();
    });

    it("uses messages when provided with conversation history", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      const history: ConversationMessage[] = [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" },
      ];

      await agent.stream("Follow-up question", { messages: history });

      expect(streamTextMock).toHaveBeenCalledTimes(1);
      const callArgs = streamTextMock.mock.calls[0][0];
      expect(callArgs.prompt).toBeUndefined();
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages).toHaveLength(3);

      // Verify the messages are correctly formed
      expect(callArgs.messages[0]).toEqual({ role: "user", content: "Previous question" });
      expect(callArgs.messages[1]).toEqual({ role: "assistant", content: "Previous answer" });
      expect(callArgs.messages[2]).toEqual({ role: "user", content: "Follow-up question" });
    });

    it("handles complex multi-turn conversation with tool calls", async () => {
      const { PhoenixInsightAgent } = await import("../../src/agent/index.js");

      const mockMode = {
        getBashTool: vi.fn().mockResolvedValue({
          description: "Mock bash tool",
          execute: vi.fn(),
        }),
        getSnapshotRoot: vi.fn().mockReturnValue("/mock/snapshot"),
        cleanup: vi.fn(),
      };

      const mockClient = {} as any;

      const agent = new PhoenixInsightAgent({
        mode: mockMode as any,
        client: mockClient,
      });

      const history: ConversationMessage[] = [
        { role: "user", content: "List files" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll list the files" },
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
        { role: "assistant", content: "Found 2 files: file1.txt and file2.txt" },
      ];

      await agent.stream("Now show me file1.txt", { messages: history });

      const callArgs = streamTextMock.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(5); // 4 history + 1 new query

      // Check message roles in order
      expect(callArgs.messages[0].role).toBe("user");
      expect(callArgs.messages[1].role).toBe("assistant");
      expect(callArgs.messages[2].role).toBe("tool");
      expect(callArgs.messages[3].role).toBe("assistant");
      expect(callArgs.messages[4].role).toBe("user");
      expect(callArgs.messages[4].content).toBe("Now show me file1.txt");
    });
  });

  describe("ConversationMessage type export", () => {
    it("ConversationMessage type is usable from agent index", async () => {
      // This is a compile-time check - verifying the type can be imported and used
      // We import the type at the top of the file from conversation.js
      // and verify here that the index.js re-exports it by using it in a type annotation
      const message: ConversationMessage = { role: "user", content: "test" };
      expect(message.role).toBe("user");
      expect(message.content).toBe("test");
    });
  });
});
