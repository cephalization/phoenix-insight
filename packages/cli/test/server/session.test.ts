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
 */
function createMockAgent() {
  const mockTextStream = {
    async *[Symbol.asyncIterator]() {
      yield "Hello ";
      yield "world!";
    },
  };

  const mockResponse = Promise.resolve({ text: "Hello world!" });

  return {
    stream: vi.fn().mockResolvedValue({
      textStream: mockTextStream,
      response: mockResponse,
    }),
    generate: vi.fn().mockResolvedValue({ text: "Hello world!" }),
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

      const slowTextStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield "done";
        },
      };

      mockAgent.stream.mockResolvedValue({
        textStream: slowTextStream,
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

      expect(createInsightAgent).toHaveBeenCalledWith({
        mode: mockMode,
        client: mockClient,
        maxSteps: 25,
      });
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
      expect(history[1].content).toBe("Hello world!");
    });

    it("should send error when already executing", async () => {
      // Start a slow query
      let resolveStream: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      const slowTextStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield "done";
        },
      };

      mockAgent.stream.mockResolvedValue({
        textStream: slowTextStream,
        response: Promise.resolve({ text: "done" }),
      });

      const firstQuery = session.executeQuery("first query");

      // Wait for the first query to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to execute another query
      await session.executeQuery("second query");

      const errorMessages = collector.messages.filter((m) => m.type === "error");
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain(
        "already being executed"
      );

      // Clean up
      resolveStream!();
      await firstQuery;
    });

    it("should send tool call notifications", async () => {
      mockAgent.stream.mockImplementation(async (_query, options) => {
        // Simulate a step with tool calls
        options?.onStepFinish?.({
          toolCalls: [
            { toolName: "bash", args: { command: "ls -la" } },
            { toolName: "px_fetch_more_spans", args: { project: "test" } },
          ],
        });

        const textStream = {
          async *[Symbol.asyncIterator]() {
            yield "Result";
          },
        };

        return {
          textStream,
          response: Promise.resolve({ text: "Result" }),
        };
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
      mockAgent.stream.mockImplementation(async (_query, options) => {
        // Simulate a step with tool results
        options?.onStepFinish?.({
          toolResults: [
            { toolName: "bash", result: { stdout: "file.txt", exitCode: 0 } },
          ],
        });

        const textStream = {
          async *[Symbol.asyncIterator]() {
            yield "Done";
          },
        };

        return {
          textStream,
          response: Promise.resolve({ text: "Done" }),
        };
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

      const errorMessages = collector.messages.filter((m) => m.type === "error");
      expect(errorMessages).toHaveLength(1);
      expect((errorMessages[0].payload as any).message).toContain("Agent failed");
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
      const slowTextStream = {
        async *[Symbol.asyncIterator]() {
          yield "First ";
          await slowPromise;
          yieldCount++;
          yield "Second";
        },
      };

      mockAgent.stream.mockResolvedValue({
        textStream: slowTextStream,
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

      const reportMessages = collector.messages.filter((m) => m.type === "report");
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

      const reportMessages = collector.messages.filter((m) => m.type === "report");
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

      const slowTextStream = {
        async *[Symbol.asyncIterator]() {
          await slowPromise;
          yield "done";
        },
      };

      mockAgent.stream.mockResolvedValue({
        textStream: slowTextStream,
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
