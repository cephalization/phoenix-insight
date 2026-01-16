import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";
import { useChatStore } from "@/store/chat";
import { useReportStore } from "@/store/report";
import type { ServerMessage } from "@/lib/websocket";

// Mock WebSocket constants
const MockWebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

// Mock WebSocketClient interface
interface MockWebSocketClient {
  connectMock: Mock;
  disconnectMock: Mock;
  sendMock: Mock;
  onMessageMock: Mock;
  onOpenMock: Mock;
  onCloseMock: Mock;
  onErrorMock: Mock;
  isConnected: boolean;
  // Stored handlers for simulating events
  messageHandler?: (message: ServerMessage) => void;
  openHandler?: () => void;
  closeHandler?: () => void;
  errorHandler?: (event: Event) => void;
}

// Current mock instance for test access
let mockClient: MockWebSocketClient;

// Create a new mock client
function createMockClient(): MockWebSocketClient {
  const client: MockWebSocketClient = {
    connectMock: vi.fn(),
    disconnectMock: vi.fn(),
    sendMock: vi.fn(),
    onMessageMock: vi.fn((handler) => {
      client.messageHandler = handler;
      return vi.fn(); // unsubscribe function
    }),
    onOpenMock: vi.fn((handler) => {
      client.openHandler = handler;
      return vi.fn();
    }),
    onCloseMock: vi.fn((handler) => {
      client.closeHandler = handler;
      return vi.fn();
    }),
    onErrorMock: vi.fn((handler) => {
      client.errorHandler = handler;
      return vi.fn();
    }),
    isConnected: false,
    messageHandler: undefined,
    openHandler: undefined,
    closeHandler: undefined,
    errorHandler: undefined,
  };
  return client;
}

// Mock the WebSocketClient class
vi.mock("@/lib/websocket", () => ({
  WebSocketClient: vi.fn().mockImplementation(() => {
    mockClient = createMockClient();
    return {
      connect: mockClient.connectMock,
      disconnect: mockClient.disconnectMock,
      send: mockClient.sendMock,
      onMessage: mockClient.onMessageMock,
      onOpen: mockClient.onOpenMock,
      onClose: mockClient.onCloseMock,
      onError: mockClient.onErrorMock,
      get isConnected() {
        return mockClient.isConnected;
      },
    };
  }),
}));

describe("useWebSocket", () => {
  beforeEach(() => {
    // Reset stores before each test
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
      isConnected: false,
      isStreaming: false,
    });

    useReportStore.setState({
      reports: [],
      currentReportId: null,
    });

    // Reset mock instances
    vi.clearAllMocks();

    // Reset global WebSocket constants
    (globalThis as { WebSocket?: typeof MockWebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
  });

  describe("initialization", () => {
    it("connects to WebSocket on mount with autoConnect=true (default)", () => {
      renderHook(() => useWebSocket());

      expect(mockClient.connectMock).toHaveBeenCalled();
    });

    it("does not connect on mount with autoConnect=false", () => {
      renderHook(() => useWebSocket({ autoConnect: false }));

      expect(mockClient.connectMock).not.toHaveBeenCalled();
    });

    it("sets up event handlers on mount", () => {
      renderHook(() => useWebSocket());

      expect(mockClient.onMessageMock).toHaveBeenCalled();
      expect(mockClient.onOpenMock).toHaveBeenCalled();
      expect(mockClient.onCloseMock).toHaveBeenCalled();
      expect(mockClient.onErrorMock).toHaveBeenCalled();
    });

    it("disconnects on unmount", () => {
      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(mockClient.disconnectMock).toHaveBeenCalled();
    });
  });

  describe("connection state", () => {
    it("updates isConnected when connection opens", () => {
      renderHook(() => useWebSocket());

      // Simulate connection open
      act(() => {
        mockClient.openHandler?.();
      });

      expect(useChatStore.getState().isConnected).toBe(true);
    });

    it("updates isConnected when connection closes", () => {
      renderHook(() => useWebSocket());

      // First connect
      act(() => {
        mockClient.openHandler?.();
      });
      expect(useChatStore.getState().isConnected).toBe(true);

      // Then disconnect
      act(() => {
        mockClient.closeHandler?.();
      });
      expect(useChatStore.getState().isConnected).toBe(false);
    });

    it("resets streaming state when connection closes during streaming", () => {
      // Create a session and start streaming
      const session = useChatStore.getState().createSession();
      useChatStore.getState().setIsStreaming(true);

      renderHook(() => useWebSocket());

      // Simulate receiving text to set up assistant message ref
      act(() => {
        mockClient.messageHandler?.({
          type: "text",
          payload: { content: "Hello", sessionId: session.id },
        });
      });

      // Simulate connection close
      act(() => {
        mockClient.closeHandler?.();
      });

      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  describe("sendQuery", () => {
    it("creates a session if none exists", () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendQuery("Hello");
      });

      expect(useChatStore.getState().sessions.length).toBe(1);
      expect(useChatStore.getState().currentSessionId).not.toBeNull();
    });

    it("adds user message to chat store", () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendQuery("Test message");
      });

      const session = useChatStore.getState().sessions[0];
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe("user");
      expect(session.messages[0].content).toBe("Test message");
    });

    it("sends query to WebSocket server", () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendQuery("Hello server");
      });

      expect(mockClient.sendMock).toHaveBeenCalledWith({
        type: "query",
        payload: {
          content: "Hello server",
          sessionId: expect.any(String),
        },
      });
    });

    it("uses existing session when one exists", () => {
      const session = useChatStore.getState().createSession("Existing Session");

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendQuery("Hello");
      });

      expect(useChatStore.getState().sessions.length).toBe(1);
      expect(mockClient.sendMock).toHaveBeenCalledWith({
        type: "query",
        payload: {
          content: "Hello",
          sessionId: session.id,
        },
      });
    });

    it("handles send errors gracefully", () => {
      const { result } = renderHook(() => useWebSocket());

      // Set up mock to throw after client is created
      mockClient.sendMock.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      act(() => {
        result.current.sendQuery("Hello");
      });

      // Should have 2 messages: user message and error message
      const session = useChatStore.getState().sessions[0];
      expect(session.messages).toHaveLength(2);
      expect(session.messages[1].role).toBe("assistant");
      expect(session.messages[1].content).toContain("Failed to send message");
    });
  });

  describe("cancel", () => {
    it("sends cancel message to server", () => {
      const session = useChatStore.getState().createSession();
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.cancel();
      });

      expect(mockClient.sendMock).toHaveBeenCalledWith({
        type: "cancel",
        payload: { sessionId: session.id },
      });
    });

    it("resets streaming state", () => {
      useChatStore.getState().createSession();
      useChatStore.getState().setIsStreaming(true);

      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.cancel();
      });

      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it("does nothing when no session exists", () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.cancel();
      });

      expect(mockClient.sendMock).not.toHaveBeenCalled();
    });
  });

  describe("message handling", () => {
    describe("text messages", () => {
      it("creates assistant message on first text chunk", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Hello", sessionId: session.id },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe("assistant");
        expect(messages[0].content).toBe("Hello");
      });

      it("appends to existing assistant message on subsequent text chunks", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Hello", sessionId: session.id },
          });
        });

        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: " world", sessionId: session.id },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe("Hello world");
      });

      it("sets isStreaming to true when receiving text", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Hello", sessionId: session.id },
          });
        });

        expect(useChatStore.getState().isStreaming).toBe(true);
      });
    });

    describe("tool_call messages", () => {
      it("creates empty assistant message if none exists", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        act(() => {
          mockClient.messageHandler?.({
            type: "tool_call",
            payload: {
              toolName: "search",
              args: { query: "test" },
              sessionId: session.id,
            },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe("assistant");
        expect(useChatStore.getState().isStreaming).toBe(true);
      });
    });

    describe("report messages", () => {
      it("updates report store with report content", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        const reportContent = { type: "card", title: "Test Report" };

        act(() => {
          mockClient.messageHandler?.({
            type: "report",
            payload: { content: reportContent, sessionId: session.id },
          });
        });

        const report = useReportStore.getState().reports[0];
        expect(report).toBeDefined();
        expect(report.sessionId).toBe(session.id);
        expect(report.content).toEqual(reportContent);
      });
    });

    describe("error messages", () => {
      it("adds error as assistant message", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        act(() => {
          mockClient.messageHandler?.({
            type: "error",
            payload: { message: "Something went wrong", sessionId: session.id },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe("assistant");
        expect(messages[0].content).toBe("Error: Something went wrong");
      });

      it("updates existing assistant message with error", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        // Start streaming
        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Starting...", sessionId: session.id },
          });
        });

        // Receive error
        act(() => {
          mockClient.messageHandler?.({
            type: "error",
            payload: { message: "Connection lost", sessionId: session.id },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe("Error: Connection lost");
      });

      it("resets streaming state on error", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        // Start streaming
        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Hello", sessionId: session.id },
          });
        });

        expect(useChatStore.getState().isStreaming).toBe(true);

        // Receive error
        act(() => {
          mockClient.messageHandler?.({
            type: "error",
            payload: { message: "Error", sessionId: session.id },
          });
        });

        expect(useChatStore.getState().isStreaming).toBe(false);
      });
    });

    describe("done messages", () => {
      it("resets streaming state", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        // Start streaming
        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Hello", sessionId: session.id },
          });
        });

        expect(useChatStore.getState().isStreaming).toBe(true);

        // Done
        act(() => {
          mockClient.messageHandler?.({
            type: "done",
            payload: { sessionId: session.id },
          });
        });

        expect(useChatStore.getState().isStreaming).toBe(false);
      });

      it("allows new messages after done", () => {
        const session = useChatStore.getState().createSession();
        renderHook(() => useWebSocket());

        // First response
        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "First", sessionId: session.id },
          });
          mockClient.messageHandler?.({
            type: "done",
            payload: { sessionId: session.id },
          });
        });

        // Second response
        act(() => {
          mockClient.messageHandler?.({
            type: "text",
            payload: { content: "Second", sessionId: session.id },
          });
        });

        const messages = useChatStore.getState().sessions[0].messages;
        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe("First");
        expect(messages[1].content).toBe("Second");
      });
    });
  });

  describe("return value", () => {
    it("returns isConnected from store", () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(false);

      act(() => {
        mockClient.openHandler?.();
      });

      expect(result.current.isConnected).toBe(true);
    });

    it("returns isStreaming from store", () => {
      const session = useChatStore.getState().createSession();
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isStreaming).toBe(false);

      act(() => {
        mockClient.messageHandler?.({
          type: "text",
          payload: { content: "Hello", sessionId: session.id },
        });
      });

      expect(result.current.isStreaming).toBe(true);
    });

    it("returns sendQuery function", () => {
      const { result } = renderHook(() => useWebSocket());

      expect(typeof result.current.sendQuery).toBe("function");
    });

    it("returns cancel function", () => {
      const { result } = renderHook(() => useWebSocket());

      expect(typeof result.current.cancel).toBe("function");
    });
  });
});
