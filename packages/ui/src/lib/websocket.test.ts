import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  WebSocketClient,
  createWebSocketClient,
  connect,
  type ClientMessage,
  type ServerMessage,
} from "./websocket";

// Mock WebSocket constants
const MockWebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

// Mock PartySocket interface for tests
interface MockPartySocket {
  readyState: number;
  listeners: Map<string, Set<(event: unknown) => void>>;
  sentMessages: string[];
  addEventListener: (type: string, callback: (event: unknown) => void) => void;
  removeEventListener: (
    type: string,
    callback: (event: unknown) => void
  ) => void;
  send: (data: string) => void;
  close: () => void;
}

// Store mock instances for test access
const mockInstances: MockPartySocket[] = [];

// Create a mock socket with all methods
function createMockSocket(): MockPartySocket {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const sentMessages: string[] = [];

  const socket: MockPartySocket = {
    readyState: MockWebSocket.CONNECTING,
    listeners,
    sentMessages,
    addEventListener(type: string, callback: (event: unknown) => void) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(callback);
    },
    removeEventListener(type: string, callback: (event: unknown) => void) {
      this.listeners.get(type)?.delete(callback);
    },
    send(data: string) {
      this.sentMessages.push(data);
    },
    close() {
      this.readyState = MockWebSocket.CLOSED;
    },
  };

  mockInstances.push(socket);
  return socket;
}

// Mock PartySocket
vi.mock("partysocket", () => {
  return {
    default: vi.fn().mockImplementation(() => createMockSocket()),
  };
});

// Helper to get the latest mock instance
function getLatestMockSocket(): MockPartySocket | undefined {
  return mockInstances[mockInstances.length - 1];
}

// Helper to simulate events on the mock socket
function simulateEvent(
  socket: MockPartySocket,
  eventType: string,
  eventData?: unknown
) {
  const handlers = socket.listeners.get(eventType);
  if (handlers) {
    handlers.forEach((handler) => handler(eventData));
  }
}

describe("WebSocketClient", () => {
  beforeEach(() => {
    // Clear mock instances
    mockInstances.length = 0;
    vi.clearAllMocks();

    // Reset global WebSocket constants for tests
    (globalThis as { WebSocket?: typeof MockWebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
  });

  describe("constructor", () => {
    it("creates a client with default options", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      expect(client).toBeDefined();
      expect(client.isConnected).toBe(false);
    });

    it("creates a client with custom options", () => {
      const client = new WebSocketClient({
        url: "ws://localhost:6007",
        maxRetries: 5,
        minReconnectionDelay: 500,
        maxReconnectionDelay: 10000,
        connectionTimeout: 5000,
      });
      expect(client).toBeDefined();
    });
  });

  describe("connect", () => {
    it("creates a PartySocket connection", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      expect(socket).toBeDefined();
    });

    it("does not create duplicate connections", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });

      client.connect();
      const firstSocket = getLatestMockSocket();

      client.connect();
      const secondSocket = getLatestMockSocket();

      expect(firstSocket).toBe(secondSocket);
      expect(mockInstances.length).toBe(1);
    });

    it("sets up event listeners on the socket", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();

      // Verify that open listener was registered
      expect(socket?.listeners.has("open")).toBe(true);
      expect(socket?.listeners.has("message")).toBe(true);
      expect(socket?.listeners.has("error")).toBe(true);
      expect(socket?.listeners.has("close")).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("closes the socket connection", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();

      client.disconnect();

      expect(socket?.readyState).toBe(MockWebSocket.CLOSED);
    });

    it("handles disconnect when not connected", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });

      // Should not throw
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe("send", () => {
    it("sends a query message", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.OPEN;

      const message: ClientMessage = {
        type: "query",
        payload: { content: "What is the status?", sessionId: "session-123" },
      };

      client.send(message);

      expect(socket?.sentMessages).toHaveLength(1);
      expect(JSON.parse(socket!.sentMessages[0])).toEqual(message);
    });

    it("sends a cancel message", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.OPEN;

      const message: ClientMessage = {
        type: "cancel",
        payload: { sessionId: "session-123" },
      };

      client.send(message);

      expect(socket?.sentMessages).toHaveLength(1);
      expect(JSON.parse(socket!.sentMessages[0])).toEqual(message);
    });

    it("throws when socket is not connected", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });

      expect(() =>
        client.send({ type: "cancel", payload: {} })
      ).toThrowError("WebSocket is not connected");
    });
  });

  describe("onMessage", () => {
    it("calls handler when message is received", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onMessage(handler);
      client.connect();

      const socket = getLatestMockSocket();

      const serverMessage: ServerMessage = {
        type: "text",
        payload: { content: "Hello", sessionId: "session-123" },
      };

      simulateEvent(socket!, "message", { data: JSON.stringify(serverMessage) });

      expect(handler).toHaveBeenCalledWith(serverMessage);
    });

    it("handles multiple message handlers", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.onMessage(handler1);
      client.onMessage(handler2);
      client.connect();

      const socket = getLatestMockSocket();

      const serverMessage: ServerMessage = {
        type: "done",
        payload: { sessionId: "session-123" },
      };

      simulateEvent(socket!, "message", { data: JSON.stringify(serverMessage) });

      expect(handler1).toHaveBeenCalledWith(serverMessage);
      expect(handler2).toHaveBeenCalledWith(serverMessage);
    });

    it("returns an unsubscribe function", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      const unsubscribe = client.onMessage(handler);
      client.connect();

      const socket = getLatestMockSocket();

      // Unsubscribe before event
      unsubscribe();

      simulateEvent(socket!, "message", {
        data: JSON.stringify({ type: "done", payload: { sessionId: "s1" } }),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("handles JSON parse errors gracefully", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onMessage(handler);
      client.connect();

      const socket = getLatestMockSocket();

      // Send invalid JSON
      simulateEvent(socket!, "message", { data: "not valid json" });

      expect(handler).toHaveBeenCalled();
      const calledWith = handler.mock.calls[0][0] as ServerMessage;
      expect(calledWith.type).toBe("error");
      expect((calledWith.payload as { message: string }).message).toContain(
        "Failed to parse server message"
      );
    });

    it("handles all server message types", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onMessage(handler);
      client.connect();

      const socket = getLatestMockSocket();

      const messageTypes: ServerMessage[] = [
        { type: "text", payload: { content: "Hello", sessionId: "s1" } },
        {
          type: "tool_call",
          payload: { toolName: "search", args: { q: "test" }, sessionId: "s1" },
        },
        {
          type: "tool_result",
          payload: { toolName: "search", result: [], sessionId: "s1" },
        },
        { type: "report", payload: { content: {}, sessionId: "s1" } },
        { type: "error", payload: { message: "Error occurred" } },
        { type: "done", payload: { sessionId: "s1" } },
      ];

      messageTypes.forEach((msg) => {
        simulateEvent(socket!, "message", { data: JSON.stringify(msg) });
      });

      expect(handler).toHaveBeenCalledTimes(6);
    });
  });

  describe("onError", () => {
    it("calls handler when error occurs", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onError(handler);
      client.connect();

      const socket = getLatestMockSocket();

      const errorEvent = new Event("error");
      simulateEvent(socket!, "error", errorEvent);

      expect(handler).toHaveBeenCalledWith(errorEvent);
    });

    it("returns an unsubscribe function", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      const unsubscribe = client.onError(handler);
      unsubscribe();

      client.connect();

      const socket = getLatestMockSocket();

      simulateEvent(socket!, "error", new Event("error"));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onClose", () => {
    it("calls handler when connection closes", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onClose(handler);
      client.connect();

      const socket = getLatestMockSocket();

      const closeEvent = new CloseEvent("close", { code: 1000, reason: "Normal" });
      simulateEvent(socket!, "close", closeEvent);

      expect(handler).toHaveBeenCalledWith(closeEvent);
    });

    it("returns an unsubscribe function", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      const unsubscribe = client.onClose(handler);
      unsubscribe();

      client.connect();

      const socket = getLatestMockSocket();

      simulateEvent(socket!, "close", new CloseEvent("close"));

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onOpen", () => {
    it("calls handler when connection opens", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      client.onOpen(handler);
      client.connect();

      const socket = getLatestMockSocket();

      simulateEvent(socket!, "open", undefined);

      expect(handler).toHaveBeenCalled();
    });

    it("returns an unsubscribe function", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      const handler = vi.fn();

      const unsubscribe = client.onOpen(handler);
      unsubscribe();

      client.connect();

      const socket = getLatestMockSocket();

      simulateEvent(socket!, "open", undefined);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("returns false when not connected", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      expect(client.isConnected).toBe(false);
    });

    it("returns true when socket is open", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.OPEN;

      expect(client.isConnected).toBe(true);
    });

    it("returns false when socket is connecting", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.CONNECTING;

      expect(client.isConnected).toBe(false);
    });

    it("returns false when socket is closing", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.CLOSING;

      expect(client.isConnected).toBe(false);
    });

    it("returns false after disconnect", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.OPEN;

      client.disconnect();

      expect(client.isConnected).toBe(false);
    });
  });

  describe("readyState", () => {
    it("returns CLOSED when not connected", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      expect(client.readyState).toBe(MockWebSocket.CLOSED);
    });

    it("returns the socket readyState when connected", () => {
      const client = new WebSocketClient({ url: "ws://localhost:6007" });
      client.connect();

      const socket = getLatestMockSocket();
      socket!.readyState = MockWebSocket.OPEN;

      expect(client.readyState).toBe(MockWebSocket.OPEN);
    });
  });
});

describe("createWebSocketClient", () => {
  beforeEach(() => {
    mockInstances.length = 0;
    vi.clearAllMocks();
    (globalThis as { WebSocket?: typeof MockWebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
  });

  it("creates a WebSocketClient instance", () => {
    const client = createWebSocketClient({ url: "ws://localhost:6007" });
    expect(client).toBeInstanceOf(WebSocketClient);
  });

  it("passes options to the client", () => {
    const client = createWebSocketClient({
      url: "ws://localhost:6007",
      maxRetries: 3,
    });
    expect(client).toBeDefined();
  });
});

describe("connect function", () => {
  beforeEach(() => {
    mockInstances.length = 0;
    vi.clearAllMocks();
    (globalThis as { WebSocket?: typeof MockWebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
  });

  it("creates and connects a WebSocketClient", () => {
    const client = connect("ws://localhost:6007");

    expect(client).toBeInstanceOf(WebSocketClient);
    expect(mockInstances.length).toBe(1);
  });

  it("accepts additional options", () => {
    const client = connect("ws://localhost:6007", { maxRetries: 5 });
    expect(client).toBeDefined();
  });
});
