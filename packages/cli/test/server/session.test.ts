import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { WebSocket } from "ws";
import {
  AgentSession,
  SessionManager,
  createAgentSession,
  createSessionManager,
  type BroadcastCallback,
  type AgentSessionOptions,
  type ConversationMessage,
} from "../../src/server/session.js";
import type { ServerMessage } from "../../src/server/websocket.js";
import type { ExecutionMode } from "../../src/modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import { APICallError } from "ai";

// ============================================================================
// Mocks
// ============================================================================

// Mock the agent module
vi.mock("../../src/agent/index.js", () => ({
  createInsightAgent: vi.fn(),
  PhoenixInsightAgent: vi.fn(),
}));

// Import the mocked module
import { createInsightAgent } from "../../src/agent/index.js";

/**
 * Create a mock execution mode
 */
function createMockMode(): ExecutionMode {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
    getBashTool: vi.fn().mockResolvedValue({
      description: "Execute bash commands",
      execute: vi.fn(),
    }),
    getSnapshotRoot: vi.fn().mockReturnValue("/phoenix/"),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock Phoenix client
 */
function createMockClient(): PhoenixClient {
  return {} as PhoenixClient;
}

/**
 * Create a mock agent that can be controlled in tests
 * The stream method should return { fullStream, response, steps } to match AI SDK v6 API
 *
 * The `steps` array is used by `extractMessagesFromResponse()` to build the conversation history.
 */
function createMockAgent() {
  const mockFullStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: "text-delta", text: "Hello " };
      yield { type: "text-delta", text: "world!" };
      yield { type: "text-end" };
    },
  };

  const mockResponse = Promise.resolve({ text: "Hello world!" });

  // Steps array used by extractMessagesFromResponse()
  const mockSteps = [
    {
      text: "Hello world!",
      toolCalls: [],
      toolResults: [],
    },
  ];

  return {
    stream: vi.fn().mockResolvedValue({
      fullStream: mockFullStream,
      response: mockResponse,
      steps: mockSteps,
    }),
    generate: vi.fn().mockResolvedValue({
      text: "Hello world!",
      steps: mockSteps,
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock WebSocket
 */
function createMockWebSocket(): WebSocket {
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket;
}

/**
 * Collect messages sent through a broadcast callback
 */
function createMessageCollector(): {
  broadcast: BroadcastCallback;
  messages: ServerMessage[];
} {
  const messages: ServerMessage[] = [];
  const broadcast: BroadcastCallback = (message) => {
    messages.push(message);
  };
  return { broadcast, messages };
}

/**
 * Create a mock APICallError for token limit testing
 */
function createTokenLimitError(message?: string): APICallError {
  return new APICallError({
    message: message || "prompt is too long: 150000 tokens > 100000 maximum",
    statusCode: 400,
    url: "https://api.anthropic.com/v1/messages",
    responseBody: "",
    requestBodyValues: {},
  });
}

/**
 * Create a mock agent that fails with a token limit error on first call,
 * then succeeds on second call (after compaction)
 */
function createMockAgentWithTokenLimitRetry() {
  let callCount = 0;
  
  const successFullStream = {
    async *[Symbol.asyncIterator]() {
      yield { type: "text-delta", text: "Retry " };
      yield { type: "text-delta", text: "succeeded!" };
      yield { type: "text-end" };
    },
  };

  const successSteps = [
    {
      text: "Retry succeeded!",
      toolCalls: [],
      toolResults: [],
    },
  ];

  return {
    stream: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call fails with token limit error
        return Promise.reject(createTokenLimitError());
      }
      // Second call (after compaction) succeeds
      return Promise.resolve({
        fullStream: successFullStream,
        response: Promise.resolve({ text: "Retry succeeded!" }),
        steps: successSteps,
      });
    }),
    generate: vi.fn().mockResolvedValue({
      text: "Response",
      steps: [{ text: "Response", toolCalls: [], toolResults: [] }],
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    getCallCount: () => callCount,
  };
}

// ============================================================================
// AgentSession Tests
// ============================================================================

describe("AgentSession", () => {
  let mockMode: ExecutionMode;
  let mockClient: PhoenixClient;
  let mockAgent: ReturnType<typeof createMockAgent>;
  let collector: ReturnType<typeof createMessageCollector>;
  let session: AgentSession;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMode = createMockMode();
    mockClient = createMockClient();
    mockAgent = createMockAgent();
    collector = createMessageCollector();

    // Set up the mock to return our controlled agent
    vi.mocked(createInsightAgent).mockResolvedValue(mockAgent as any);

    session = new AgentSession({
      sessionId: "test-session-123",
      mode: mockMode,
      client: mockClient,
      maxSteps: 25,
      broadcast: collector.broadcast,
    });
  });

  afterEach(async () => {
    await session.cleanup();
  });

  describe("constructor", () => {
    it("should create a session with the provided options", () => {
      expect(session.id).toBe("test-session-123");
      expect(session.executing).toBe(false);
      expect(session.history).toEqual([]);
    });

    it("should use default maxSteps if not provided", () => {
      const sessionWithDefaults = new AgentSession({
        sessionId: "test-session",
        mode: mockMode,
        client: mockClient,
        broadcast: collector.broadcast,
      });
      // maxSteps is private, so we can't check it directly
      // But we can verify the session was created successfully
      expect(sessionWithDefaults.id).toBe("test-session");
    });
  });

  describe("id", () => {
    it("should return the session ID", () => {
      expect(session.id).toBe("test-session-123");
    });
  });

  describe("executing", () => {
    it("should return false when not executing", () => {
      expect(session.executing).toBe(false);
    });

    it("should return true during query execution", async () => {
      // Create a slow agent that we can check during execution
      let resolveStream: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const slowFullStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield { type: "text-delta", text: "done" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream: slowFullStream,
        response: Promise.resolve({ text: "done" }),
      });

      const executePromise = session.executeQuery("test query");

      // Check that we're executing (need a small delay for the async to start)
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(session.executing).toBe(true);

      // Let the stream complete
      resolveStream!();
      await executePromise;

      expect(session.executing).toBe(false);
    });
  });

  describe("history", () => {
    it("should return empty history initially", () => {
      expect(session.history).toEqual([]);
    });

    it("should return a copy of the history", () => {
      const history1 = session.history;
      const history2 = session.history;
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe("executeQuery", () => {
    it("should create an agent lazily on first query", async () => {
      await session.executeQuery("test query");

      expect(createInsightAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: mockMode,
          client: mockClient,
          maxSteps: 25,
          additionalTools: expect.objectContaining({
            generate_report: expect.anything(),
          }),
        })
      );
    });

    it("should reuse the agent for subsequent queries", async () => {
      await session.executeQuery("query 1");
      await session.executeQuery("query 2");

      expect(createInsightAgent).toHaveBeenCalledTimes(1);
    });

    it("should send streamed text chunks to the client", async () => {
      await session.executeQuery("test query");

      const textMessages = collector.messages.filter((m) => m.type === "text");
      expect(textMessages).toHaveLength(2);
      expect(textMessages[0].payload).toEqual({
        content: "Hello ",
        sessionId: "test-session-123",
      });
      expect(textMessages[1].payload).toEqual({
        content: "world!",
        sessionId: "test-session-123",
      });
    });

    it("should send done signal after query completes", async () => {
      await session.executeQuery("test query");

      const doneMessages = collector.messages.filter((m) => m.type === "done");
      expect(doneMessages).toHaveLength(1);
      expect(doneMessages[0].payload).toEqual({
        sessionId: "test-session-123",
      });
    });

    it("should add user and assistant messages to history", async () => {
      await session.executeQuery("test query");

      const history = session.history;
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe("user");
      expect(history[0].content).toBe("test query");
      expect(history[1].role).toBe("assistant");
      // The assistant message content can be a string or an array of parts
      // depending on whether there were tool calls. For text-only, it's a string.
      expect(history[1].content).toBe("Hello world!");
    });

    it("should pass conversation history to agent for multi-turn context", async () => {
      // First query
      await session.executeQuery("first query");

      // Second query should include history from first query
      await session.executeQuery("second query");

      // The agent should have been called with messages option on both calls
      expect(mockAgent.stream).toHaveBeenCalledTimes(2);

      // First call: history is empty (user message added AFTER successful completion)
      const firstCall = mockAgent.stream.mock.calls[0];
      expect(firstCall[0]).toBe("first query");
      expect(firstCall[1].messages).toHaveLength(0);

      // Second call: history has first user message and first assistant response
      // The agent will append the current userQuery ("second query") as the last message
      const secondCall = mockAgent.stream.mock.calls[1];
      expect(secondCall[0]).toBe("second query");
      // History has: first user, first assistant
      expect(secondCall[1].messages).toHaveLength(2);
      expect(secondCall[1].messages[0]).toEqual({
        role: "user",
        content: "first query",
      });
      expect(secondCall[1].messages[1]).toEqual({
        role: "assistant",
        content: "Hello world!",
      });
    });

    it("should include tool calls and results in history", async () => {
      // Create a mock that includes tool calls
      const fullStreamWithTools = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: "tool-call",
            toolName: "bash",
            input: { command: "ls" },
          };
          yield {
            type: "tool-result",
            toolName: "bash",
            output: { stdout: "file.txt", exitCode: 0 },
          };
          yield { type: "text-delta", text: "Found file.txt" };
          yield { type: "text-end" };
        },
      };

      const stepsWithTools = [
        {
          text: "Found file.txt",
          toolCalls: [
            {
              type: "tool-call",
              toolCallId: "call-123",
              toolName: "bash",
              input: { command: "ls" },
            },
          ],
          toolResults: [
            {
              type: "tool-result",
              toolCallId: "call-123",
              toolName: "bash",
              output: { stdout: "file.txt", exitCode: 0 },
            },
          ],
        },
      ];

      mockAgent.stream.mockResolvedValue({
        fullStream: fullStreamWithTools,
        response: Promise.resolve({ text: "Found file.txt" }),
        steps: stepsWithTools,
      });

      await session.executeQuery("list files");

      const history = session.history;
      // Should have: user message, assistant message (with tool call), tool message (with result)
      expect(history).toHaveLength(3);
      expect(history[0]).toEqual({ role: "user", content: "list files" });
      // Assistant message with tool call
      expect(history[1].role).toBe("assistant");
      expect(Array.isArray(history[1].content)).toBe(true);
      // Tool result message
      expect(history[2].role).toBe("tool");
    });

    it("should send error when already executing", async () => {
      // Start a slow query
      let resolveStream: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const slowFullStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield { type: "text-delta", text: "done" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream: slowFullStream,
        response: Promise.resolve({ text: "done" }),
      });

      const firstQuery = session.executeQuery("first query");

      // Wait for the first query to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to execute another query
      await session.executeQuery("second query");

      const errorMessages = collector.messages.filter(
        (m) => m.type === "error"
      );
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain(
        "already being executed"
      );

      // Clean up
      resolveStream!();
      await firstQuery;
    });

    it("should send tool call notifications", async () => {
      // The fullStream emits tool-call events that the session sends to the client
      // AI SDK v6 uses 'input' property for the parsed arguments
      const fullStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: "tool-call",
            toolName: "bash",
            input: { command: "ls -la" },
          };
          yield {
            type: "tool-call",
            toolName: "px_fetch_more_spans",
            input: { project: "test" },
          };
          yield { type: "text-delta", text: "Result" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream,
        response: Promise.resolve({ text: "Result" }),
      });

      await session.executeQuery("test query");

      const toolCallMessages = collector.messages.filter(
        (m) => m.type === "tool_call"
      );
      expect(toolCallMessages).toHaveLength(2);
      expect(toolCallMessages[0].payload).toEqual({
        toolName: "bash",
        args: { command: "ls -la" },
        sessionId: "test-session-123",
      });
    });

    it("should send tool result notifications", async () => {
      // The fullStream emits tool-result events that the session sends to the client
      // AI SDK v6 uses 'output' property for the tool result
      const fullStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: "tool-result",
            toolName: "bash",
            output: { stdout: "file.txt", exitCode: 0 },
          };
          yield { type: "text-delta", text: "Done" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream,
        response: Promise.resolve({ text: "Done" }),
      });

      await session.executeQuery("test query");

      const toolResultMessages = collector.messages.filter(
        (m) => m.type === "tool_result"
      );
      expect(toolResultMessages).toHaveLength(1);
      expect(toolResultMessages[0].payload).toEqual({
        toolName: "bash",
        result: { stdout: "file.txt", exitCode: 0 },
        sessionId: "test-session-123",
      });
    });

    it("should send error on agent failure", async () => {
      mockAgent.stream.mockRejectedValue(new Error("Agent failed"));

      await session.executeQuery("test query");

      const errorMessages = collector.messages.filter(
        (m) => m.type === "error"
      );
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain(
        "Agent failed"
      );
    });
  });

  describe("cancel", () => {
    it("should cancel an executing query", async () => {
      // Start a slow query
      let resolveStream: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      let yieldCount = 0;
      const slowFullStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: "text-delta", text: "First " };
          await slowPromise;
          yieldCount++;
          yield { type: "text-delta", text: "Second" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream: slowFullStream,
        response: Promise.resolve({ text: "First Second" }),
      });

      const executePromise = session.executeQuery("test query");

      // Wait for the first yield
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cancel the query
      session.cancel();

      // Let the stream try to continue
      resolveStream!();
      await executePromise;

      // Should have sent done message on cancel
      const doneMessages = collector.messages.filter((m) => m.type === "done");
      expect(doneMessages.length).toBeGreaterThanOrEqual(1);
    });

    it("should do nothing if not executing", () => {
      // Should not throw
      expect(() => session.cancel()).not.toThrow();
    });
  });

  describe("sendReport", () => {
    it("should send report to client", () => {
      const content = { root: "test-root", elements: {} };
      session.sendReport(content, "Test Report");

      const reportMessages = collector.messages.filter(
        (m) => m.type === "report"
      );
      expect(reportMessages).toHaveLength(1);
      expect(reportMessages[0].payload).toEqual({
        content,
        sessionId: "test-session-123",
      });
    });
  });

  describe("getReportCallback", () => {
    it("should return a callback that sends reports", () => {
      const callback = session.getReportCallback();
      const content = { root: "test", elements: {} };

      callback(content, "Title");

      const reportMessages = collector.messages.filter(
        (m) => m.type === "report"
      );
      expect(reportMessages).toHaveLength(1);
    });
  });

  describe("clearHistory", () => {
    it("should clear the conversation history", async () => {
      await session.executeQuery("test query");
      expect(session.history).toHaveLength(2);

      session.clearHistory();
      expect(session.history).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("should clean up resources", async () => {
      await session.executeQuery("test query");

      await session.cleanup();

      // History should be cleared
      expect(session.history).toHaveLength(0);
    });

    it("should cancel executing query on cleanup", async () => {
      // Start a slow query
      let resolveStream: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const slowFullStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield { type: "text-delta", text: "done" };
          yield { type: "text-end" };
        },
      };

      mockAgent.stream.mockResolvedValue({
        fullStream: slowFullStream,
        response: Promise.resolve({ text: "done" }),
      });

      const executePromise = session.executeQuery("test query");

      // Wait for the query to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Cleanup should abort the query
      await session.cleanup();

      // Let the stream complete (it should have been aborted)
      resolveStream!();
      await executePromise;
    });
  });

  describe("token error handling and compaction", () => {
    it("should compact history and retry successfully when history exists", async () => {
      // Create a custom mock that:
      // 1. First few calls succeed (to build history)
      // 2. Next call fails with token limit error
      // 3. Final call (retry with compacted history) succeeds
      let callCount = 0;
      const createSuccessfulStream = () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "text-delta", text: "Success!" };
          yield { type: "text-end" };
        },
      });
      const successSteps = [{ text: "Success!", toolCalls: [], toolResults: [] }];

      const mixedAgent = {
        stream: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 10) {
            // First 10 calls succeed (building history)
            return Promise.resolve({
              fullStream: createSuccessfulStream(),
              response: Promise.resolve({ text: "Success!" }),
              steps: successSteps,
            });
          } else if (callCount === 11) {
            // 11th call fails with token limit error
            return Promise.reject(createTokenLimitError());
          } else {
            // 12th+ call (retry) succeeds
            return Promise.resolve({
              fullStream: createSuccessfulStream(),
              response: Promise.resolve({ text: "Success!" }),
              steps: successSteps,
            });
          }
        }),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(mixedAgent as any);

      const testSession = new AgentSession({
        sessionId: "mixed-test-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: collector.broadcast,
      });

      // Build up history with 10 queries
      for (let i = 0; i < 10; i++) {
        await testSession.executeQuery(`query ${i}`);
      }

      // Verify history has accumulated (user message + assistant response per query)
      const historyBeforeError = testSession.history;
      expect(historyBeforeError.length).toBe(20); // 10 user + 10 assistant messages

      // Clear messages to track new ones
      collector.messages.length = 0;

      // Now execute a query that will trigger token limit error
      // The session should compact history and retry
      await testSession.executeQuery("query that triggers compaction");

      // Check for context_compacted message
      const compactedMessages = collector.messages.filter(
        (m) => m.type === "context_compacted"
      );
      expect(compactedMessages).toHaveLength(1);
      expect(compactedMessages[0].payload).toEqual({
        sessionId: "mixed-test-session",
        reason: expect.stringContaining("compacted"),
      });

      // Check that the query succeeded after retry (done message sent)
      const doneMessages = collector.messages.filter((m) => m.type === "done");
      expect(doneMessages).toHaveLength(1);

      // The agent should have been called 12 times total
      // (10 for building history + 1 fail + 1 retry)
      expect(mixedAgent.stream).toHaveBeenCalledTimes(12);

      await testSession.cleanup();
    });

    it("should send error if retry also fails after compaction", async () => {
      // Create agent that builds history with tool calls, then fails twice in a row
      // Tool calls are needed because compactConversation only prunes reasoning/tool calls,
      // not simple text messages
      let callCount = 0;
      
      // Create stream with tool calls so compaction has something to prune
      const createStreamWithToolCalls = () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "tool-call", toolName: "bash", input: { command: "ls" } };
          yield { type: "tool-result", toolName: "bash", output: { stdout: "file.txt", exitCode: 0 } };
          yield { type: "text-delta", text: "Done" };
          yield { type: "text-end" };
        },
      });

      // Steps that include tool calls (which will be pruned during compaction)
      const stepsWithToolCalls = [{
        text: "Done",
        toolCalls: [{ type: "tool-call", toolCallId: `call-${Date.now()}`, toolName: "bash", input: { command: "ls" } }],
        toolResults: [{ type: "tool-result", toolCallId: `call-${Date.now()}`, toolName: "bash", output: { stdout: "file.txt", exitCode: 0 } }],
      }];

      const newCollector = createMessageCollector();
      const mixedAgent = {
        stream: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 10) {
            // First 10 calls succeed (building history with tool calls)
            return Promise.resolve({
              fullStream: createStreamWithToolCalls(),
              response: Promise.resolve({ text: "Done" }),
              steps: stepsWithToolCalls,
            });
          } else {
            // 11th and 12th calls both fail with token limit error
            // Use a proper token limit error message so isTokenLimitError() recognizes it
            return Promise.reject(createTokenLimitError(`prompt is too long: attempt ${callCount}`));
          }
        }),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(mixedAgent as any);

      const testSession = new AgentSession({
        sessionId: "double-fail-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: newCollector.broadcast,
      });

      // Build history with tool calls
      for (let i = 0; i < 10; i++) {
        await testSession.executeQuery(`query ${i}`);
      }
      // History should have: 10 user + 10 assistant (with tool calls) + 10 tool result messages = 30
      expect(testSession.history.length).toBe(30);

      // Clear messages
      newCollector.messages.length = 0;

      // Execute query that will fail, compact, then fail again
      await testSession.executeQuery("doomed query");

      // Should have context_compacted message (from first failure)
      const compactedMessages = newCollector.messages.filter(
        (m) => m.type === "context_compacted"
      );
      expect(compactedMessages).toHaveLength(1);

      // Should have error message (from second failure after compaction)
      const errorMessages = newCollector.messages.filter((m) => m.type === "error");
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain(
        "after compaction"
      );

      // Should NOT have done message (query ultimately failed)
      const doneMessages = newCollector.messages.filter((m) => m.type === "done");
      expect(doneMessages).toHaveLength(0);

      // Agent should have been called 12 times total (10 success + 2 failures)
      expect(mixedAgent.stream).toHaveBeenCalledTimes(12);

      await testSession.cleanup();
    });

    it("should not trigger compaction for non-token-limit errors", async () => {
      // Create an agent that fails with a non-token-limit error
      const otherError = new Error("Some other error");
      const failAgent = {
        stream: vi.fn().mockRejectedValue(otherError),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(failAgent as any);

      const testSession = new AgentSession({
        sessionId: "other-error-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: collector.broadcast,
      });

      collector.messages.length = 0;

      await testSession.executeQuery("query");

      // Should have error message but NOT context_compacted
      const compactedMessages = collector.messages.filter(
        (m) => m.type === "context_compacted"
      );
      expect(compactedMessages).toHaveLength(0);

      const errorMessages = collector.messages.filter((m) => m.type === "error");
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain(
        "Some other error"
      );

      // Agent should only be called once (no retry)
      expect(failAgent.stream).toHaveBeenCalledTimes(1);

      await testSession.cleanup();
    });

    it("should send error with token limit details when history is empty", async () => {
      // When there's no history to compact, the token error should still be handled
      // but there's nothing useful to compact, so the error propagates
      const failAgent = {
        stream: vi.fn().mockRejectedValue(createTokenLimitError("prompt is too long: 150000 tokens")),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(failAgent as any);

      const testSession = new AgentSession({
        sessionId: "empty-history-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: collector.broadcast,
      });

      // Session has empty history at this point
      expect(testSession.history).toHaveLength(0);

      collector.messages.length = 0;

      await testSession.executeQuery("query");

      // With empty history, compaction still "happens" but doesn't help
      // The compacted message is still sent and retry is attempted
      // But since history was already empty, retry will likely fail too
      
      // We expect either a context_compacted (if compaction was attempted)
      // followed by an error, OR just an error if compaction yielded no change
      const errorMessages = collector.messages.filter((m) => m.type === "error");
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);

      await testSession.cleanup();
    });

    it("should include reason with token count in context_compacted message", async () => {
      // Create agent that fails with specific token message, then succeeds
      let callCount = 0;
      const createStream = () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "text-delta", text: "OK" };
          yield { type: "text-end" };
        },
      });

      const mixedAgent = {
        stream: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 10) {
            return Promise.resolve({
              fullStream: createStream(),
              response: Promise.resolve({ text: "OK" }),
              steps: [{ text: "OK", toolCalls: [], toolResults: [] }],
            });
          } else if (callCount === 11) {
            return Promise.reject(
              createTokenLimitError("prompt is too long: 250000 tokens > 200000 maximum")
            );
          } else {
            return Promise.resolve({
              fullStream: createStream(),
              response: Promise.resolve({ text: "Retried!" }),
              steps: [{ text: "Retried!", toolCalls: [], toolResults: [] }],
            });
          }
        }),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(mixedAgent as any);

      const testSession = new AgentSession({
        sessionId: "reason-test-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: collector.broadcast,
      });

      // Build history
      for (let i = 0; i < 10; i++) {
        await testSession.executeQuery(`query ${i}`);
      }

      collector.messages.length = 0;

      // Trigger compaction
      await testSession.executeQuery("trigger compaction");

      const compactedMessages = collector.messages.filter(
        (m) => m.type === "context_compacted"
      );
      expect(compactedMessages).toHaveLength(1);

      // The reason should contain token information
      const payload = compactedMessages[0].payload as { sessionId: string; reason?: string };
      expect(payload.reason).toBeDefined();
      expect(payload.reason).toContain("250000 tokens");

      await testSession.cleanup();
    });

    it("should update conversation history after successful retry", async () => {
      // Create agent that builds history with tool calls (so compaction has something to prune)
      let callCount = 0;
      
      // Create stream with tool calls
      const createStreamWithToolCalls = () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "tool-call", toolName: "bash", input: { command: "ls" } };
          yield { type: "tool-result", toolName: "bash", output: { stdout: "file.txt", exitCode: 0 } };
          yield { type: "text-delta", text: "Response" };
          yield { type: "text-end" };
        },
      });
      
      const createSimpleStream = () => ({
        async *[Symbol.asyncIterator]() {
          yield { type: "text-delta", text: "Retry Response" };
          yield { type: "text-end" };
        },
      });

      const stepsWithToolCalls = [{
        text: "Response",
        toolCalls: [{ type: "tool-call", toolCallId: `call-${Date.now()}`, toolName: "bash", input: { command: "ls" } }],
        toolResults: [{ type: "tool-result", toolCallId: `call-${Date.now()}`, toolName: "bash", output: { stdout: "file.txt", exitCode: 0 } }],
      }];

      const mixedAgent = {
        stream: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 10) {
            return Promise.resolve({
              fullStream: createStreamWithToolCalls(),
              response: Promise.resolve({ text: "Response" }),
              steps: stepsWithToolCalls,
            });
          } else if (callCount === 11) {
            return Promise.reject(createTokenLimitError());
          } else {
            return Promise.resolve({
              fullStream: createSimpleStream(),
              response: Promise.resolve({ text: "Retry Response" }),
              steps: [{ text: "Retry Response", toolCalls: [], toolResults: [] }],
            });
          }
        }),
        generate: vi.fn(),
        cleanup: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(createInsightAgent).mockResolvedValue(mixedAgent as any);

      const testSession = new AgentSession({
        sessionId: "history-update-session",
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
        broadcast: collector.broadcast,
      });

      // Build history with 10 queries (each has user + assistant + tool = 3 messages)
      for (let i = 0; i < 10; i++) {
        await testSession.executeQuery(`query ${i}`);
      }
      const historyBefore = testSession.history.length;
      expect(historyBefore).toBe(30); // 10 * (user + assistant + tool) = 30

      // Execute query that will trigger compaction
      await testSession.executeQuery("compaction query");

      // After compaction and successful retry, history should be updated
      // Compaction keeps first 2 and last 6 messages, prunes tool calls from middle
      // Then adds new user message + assistant response
      const historyAfter = testSession.history;
      
      // History should be smaller due to compaction of middle section
      // Compaction prunes tool calls, so the history length should be less
      // Note: The exact reduction depends on pruneMessages behavior
      
      // The last two messages should be the new query and response
      const lastUserMsg = historyAfter[historyAfter.length - 2];
      const lastAssistantMsg = historyAfter[historyAfter.length - 1];
      expect(lastUserMsg.role).toBe("user");
      expect(lastUserMsg.content).toBe("compaction query");
      expect(lastAssistantMsg.role).toBe("assistant");

      await testSession.cleanup();
    });
  });
});

describe("createAgentSession", () => {
  it("should create an AgentSession instance", () => {
    const mockMode = createMockMode();
    const mockClient = createMockClient();
    const collector = createMessageCollector();

    const session = createAgentSession({
      sessionId: "test-123",
      mode: mockMode,
      client: mockClient,
      broadcast: collector.broadcast,
    });

    expect(session).toBeInstanceOf(AgentSession);
    expect(session.id).toBe("test-123");
  });
});

// ============================================================================
// SessionManager Tests
// ============================================================================

describe("SessionManager", () => {
  let mockMode: ExecutionMode;
  let mockClient: PhoenixClient;
  let mockAgent: ReturnType<typeof createMockAgent>;
  let manager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMode = createMockMode();
    mockClient = createMockClient();
    mockAgent = createMockAgent();

    vi.mocked(createInsightAgent).mockResolvedValue(mockAgent as any);

    manager = new SessionManager({
      mode: mockMode,
      client: mockClient,
      maxSteps: 25,
    });
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("getOrCreateSession", () => {
    it("should create a new session for a new ID", () => {
      const ws = createMockWebSocket();
      const collector = createMessageCollector();

      const session = manager.getOrCreateSession(
        ws,
        "session-123",
        collector.broadcast
      );

      expect(session).toBeInstanceOf(AgentSession);
      expect(session.id).toBe("session-123");
      expect(manager.sessionCount).toBe(1);
    });

    it("should return existing session for same ID", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const collector1 = createMessageCollector();
      const collector2 = createMessageCollector();

      const session1 = manager.getOrCreateSession(
        ws1,
        "session-123",
        collector1.broadcast
      );
      const session2 = manager.getOrCreateSession(
        ws2,
        "session-123",
        collector2.broadcast
      );

      expect(session1).toBe(session2);
      expect(manager.sessionCount).toBe(1);
    });

    it("should create separate sessions for different IDs", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const collector1 = createMessageCollector();
      const collector2 = createMessageCollector();

      const session1 = manager.getOrCreateSession(
        ws1,
        "session-1",
        collector1.broadcast
      );
      const session2 = manager.getOrCreateSession(
        ws2,
        "session-2",
        collector2.broadcast
      );

      expect(session1).not.toBe(session2);
      expect(manager.sessionCount).toBe(2);
    });
  });

  describe("getSessionForClient", () => {
    it("should return session for connected client", () => {
      const ws = createMockWebSocket();
      const collector = createMessageCollector();

      const session = manager.getOrCreateSession(
        ws,
        "session-123",
        collector.broadcast
      );
      const retrievedSession = manager.getSessionForClient(ws);

      expect(retrievedSession).toBe(session);
    });

    it("should return undefined for unknown client", () => {
      const ws = createMockWebSocket();
      const retrievedSession = manager.getSessionForClient(ws);

      expect(retrievedSession).toBeUndefined();
    });
  });

  describe("getSession", () => {
    it("should return session by ID", () => {
      const ws = createMockWebSocket();
      const collector = createMessageCollector();

      const session = manager.getOrCreateSession(
        ws,
        "session-123",
        collector.broadcast
      );
      const retrievedSession = manager.getSession("session-123");

      expect(retrievedSession).toBe(session);
    });

    it("should return undefined for unknown ID", () => {
      const retrievedSession = manager.getSession("unknown-session");

      expect(retrievedSession).toBeUndefined();
    });
  });

  describe("removeSession", () => {
    it("should remove session and clean up", async () => {
      const ws = createMockWebSocket();
      const collector = createMessageCollector();

      manager.getOrCreateSession(ws, "session-123", collector.broadcast);
      expect(manager.sessionCount).toBe(1);

      await manager.removeSession(ws);

      expect(manager.sessionCount).toBe(0);
      expect(manager.getSession("session-123")).toBeUndefined();
      expect(manager.getSessionForClient(ws)).toBeUndefined();
    });

    it("should do nothing for unknown client", async () => {
      const ws = createMockWebSocket();
      await expect(manager.removeSession(ws)).resolves.not.toThrow();
    });
  });

  describe("sessionCount", () => {
    it("should return 0 initially", () => {
      expect(manager.sessionCount).toBe(0);
    });

    it("should track session count accurately", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const collector = createMessageCollector();

      manager.getOrCreateSession(ws1, "session-1", collector.broadcast);
      expect(manager.sessionCount).toBe(1);

      manager.getOrCreateSession(ws2, "session-2", collector.broadcast);
      expect(manager.sessionCount).toBe(2);
    });
  });

  describe("cleanup", () => {
    it("should clean up all sessions", async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const collector = createMessageCollector();

      manager.getOrCreateSession(ws1, "session-1", collector.broadcast);
      manager.getOrCreateSession(ws2, "session-2", collector.broadcast);
      expect(manager.sessionCount).toBe(2);

      await manager.cleanup();

      expect(manager.sessionCount).toBe(0);
    });

    it("should not throw on empty manager", async () => {
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });
});

describe("createSessionManager", () => {
  it("should create a SessionManager instance", () => {
    const mockMode = createMockMode();
    const mockClient = createMockClient();

    const manager = createSessionManager({
      mode: mockMode,
      client: mockClient,
    });

    expect(manager).toBeInstanceOf(SessionManager);
    expect(manager.sessionCount).toBe(0);
  });
});
