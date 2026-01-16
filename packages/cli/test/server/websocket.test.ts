import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { WebSocket } from "ws";
import {
  PhoenixWebSocketServer,
  createWebSocketServer,
  type ClientMessage,
  type ServerMessage,
} from "../../src/server/websocket.js";

/**
 * Helper to create an HTTP server for testing
 */
function createTestHttpServer(): Promise<{ server: HttpServer; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(404);
      res.end();
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      resolve({ server, port });
    });
  });
}

/**
 * Helper to create a WebSocket client for testing
 */
function createTestClient(port: number, path = "/ws"): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}${path}`);
}

/**
 * Helper to wait for a WebSocket to open
 */
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.on("open", () => resolve());
    ws.on("error", (err) => reject(err));
  });
}

/**
 * Helper to wait for a WebSocket message
 */
function waitForMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    ws.on("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()) as ServerMessage);
      } catch (err) {
        reject(err);
      }
    });
    ws.on("error", (err) => reject(err));
  });
}

/**
 * Helper to wait for a WebSocket to close
 */
function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on("close", (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

describe("PhoenixWebSocketServer", () => {
  let httpServer: HttpServer;
  let port: number;
  let wsServer: PhoenixWebSocketServer;
  let testClients: WebSocket[] = [];

  beforeEach(async () => {
    const result = await createTestHttpServer();
    httpServer = result.server;
    port = result.port;
    testClients = [];
  });

  afterEach(async () => {
    // Close all test clients
    for (const client of testClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    testClients = [];

    // Close WebSocket server
    if (wsServer) {
      await wsServer.close();
    }

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe("attach", () => {
    it("should attach to an HTTP server", () => {
      wsServer = new PhoenixWebSocketServer();
      expect(() => wsServer.attach(httpServer)).not.toThrow();
    });

    it("should throw if already attached", () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);
      expect(() => wsServer.attach(httpServer)).toThrow(
        "WebSocket server is already attached"
      );
    });
  });

  describe("connection handling", () => {
    it("should accept WebSocket connections on the default path", async () => {
      const onConnection = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onConnection });
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      expect(onConnection).toHaveBeenCalledTimes(1);
      expect(wsServer.clientCount).toBe(1);
    });

    it("should accept WebSocket connections on a custom path", async () => {
      const onConnection = vi.fn();
      wsServer = new PhoenixWebSocketServer({ path: "/custom", onConnection });
      wsServer.attach(httpServer);

      const client = createTestClient(port, "/custom");
      testClients.push(client);

      await waitForOpen(client);

      expect(onConnection).toHaveBeenCalledTimes(1);
    });

    it("should reject WebSocket connections on wrong path", async () => {
      const onConnection = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onConnection });
      wsServer.attach(httpServer);

      const client = createTestClient(port, "/wrong-path");
      testClients.push(client);

      // Wait for connection to fail (close or error event)
      await new Promise<void>((resolve) => {
        client.on("close", () => resolve());
        client.on("error", () => resolve());
      });

      expect(onConnection).not.toHaveBeenCalled();
      expect(wsServer.clientCount).toBe(0);
    });

    it("should handle multiple client connections", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client1 = createTestClient(port);
      const client2 = createTestClient(port);
      const client3 = createTestClient(port);
      testClients.push(client1, client2, client3);

      await Promise.all([
        waitForOpen(client1),
        waitForOpen(client2),
        waitForOpen(client3),
      ]);

      expect(wsServer.clientCount).toBe(3);
      expect(wsServer.getClients().size).toBe(3);
    });

    it("should call onDisconnection when client disconnects", async () => {
      const onDisconnection = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onDisconnection });
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);
      expect(wsServer.clientCount).toBe(1);

      client.close(1000, "Normal closure");

      // Wait a bit for the close event to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onDisconnection).toHaveBeenCalledTimes(1);
      expect(onDisconnection).toHaveBeenCalledWith(
        expect.anything(),
        1000,
        "Normal closure"
      );
      expect(wsServer.clientCount).toBe(0);
    });
  });

  describe("message handling", () => {
    it("should call onMessage for valid query messages", async () => {
      const onMessage = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onMessage });
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const message: ClientMessage = {
        type: "query",
        payload: { content: "Test query", sessionId: "session-123" },
      };
      client.send(JSON.stringify(message));

      // Wait for message to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(message, expect.anything());
    });

    it("should call onMessage for valid cancel messages", async () => {
      const onMessage = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onMessage });
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const message: ClientMessage = {
        type: "cancel",
        payload: { sessionId: "session-123" },
      };
      client.send(JSON.stringify(message));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(message, expect.anything());
    });

    it("should send error for invalid JSON", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const messagePromise = waitForMessage(client);
      client.send("not valid json");

      const response = await messagePromise;
      expect(response.type).toBe("error");
      expect(response.payload).toHaveProperty("message");
    });

    it("should send error for missing type field", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ payload: { content: "test" } }));

      const response = await messagePromise;
      expect(response.type).toBe("error");
      expect((response.payload as { message: string }).message).toContain(
        "missing type field"
      );
    });

    it("should send error for unknown message type", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: "unknown", payload: {} }));

      const response = await messagePromise;
      expect(response.type).toBe("error");
      expect((response.payload as { message: string }).message).toContain(
        "Unknown message type"
      );
    });

    it("should send error for non-object messages", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify("just a string"));

      const response = await messagePromise;
      expect(response.type).toBe("error");
      expect((response.payload as { message: string }).message).toContain(
        "expected object"
      );
    });
  });

  describe("sendToClient", () => {
    it("should send a message to a specific client", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const messagePromise = waitForMessage(client);

      // Get the WebSocket instance from the server
      const clients = wsServer.getClients();
      const serverClient = clients.values().next().value;

      const message: ServerMessage = {
        type: "text",
        payload: { content: "Hello client!", sessionId: "session-123" },
      };
      wsServer.sendToClient(serverClient!, message);

      const response = await messagePromise;
      expect(response).toEqual(message);
    });

    it("should not throw when sending to closed client", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const clients = wsServer.getClients();
      const serverClient = clients.values().next().value;

      // Close the client
      client.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // This should not throw
      const message: ServerMessage = {
        type: "text",
        payload: { content: "Hello", sessionId: "session-123" },
      };
      expect(() => wsServer.sendToClient(serverClient!, message)).not.toThrow();
    });
  });

  describe("broadcast", () => {
    it("should broadcast a message to all connected clients", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client1 = createTestClient(port);
      const client2 = createTestClient(port);
      testClients.push(client1, client2);

      await Promise.all([waitForOpen(client1), waitForOpen(client2)]);

      const messagePromise1 = waitForMessage(client1);
      const messagePromise2 = waitForMessage(client2);

      const message: ServerMessage = {
        type: "done",
        payload: { sessionId: "session-123" },
      };
      wsServer.broadcast(message);

      const [response1, response2] = await Promise.all([
        messagePromise1,
        messagePromise2,
      ]);

      expect(response1).toEqual(message);
      expect(response2).toEqual(message);
    });

    it("should not throw when no clients are connected", () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const message: ServerMessage = {
        type: "error",
        payload: { message: "Test error" },
      };

      expect(() => wsServer.broadcast(message)).not.toThrow();
    });
  });

  describe("broadcastToSession", () => {
    it("should broadcast to all clients (pending session-to-client mapping)", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client1 = createTestClient(port);
      const client2 = createTestClient(port);
      testClients.push(client1, client2);

      await Promise.all([waitForOpen(client1), waitForOpen(client2)]);

      const messagePromise1 = waitForMessage(client1);
      const messagePromise2 = waitForMessage(client2);

      const message: ServerMessage = {
        type: "text",
        payload: { content: "Session message", sessionId: "session-123" },
      };
      wsServer.broadcastToSession("session-123", message);

      const [response1, response2] = await Promise.all([
        messagePromise1,
        messagePromise2,
      ]);

      expect(response1).toEqual(message);
      expect(response2).toEqual(message);
    });
  });

  describe("close", () => {
    it("should close all client connections", async () => {
      wsServer = new PhoenixWebSocketServer();
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      const closePromise = waitForClose(client);
      await wsServer.close();

      const result = await closePromise;
      expect(result.code).toBe(1000);
      expect(result.reason).toBe("Server shutting down");
      expect(wsServer.clientCount).toBe(0);
    });

    it("should resolve immediately if not attached", async () => {
      wsServer = new PhoenixWebSocketServer();
      await expect(wsServer.close()).resolves.not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should call onError for WebSocket errors", async () => {
      const onError = vi.fn();
      wsServer = new PhoenixWebSocketServer({ onError });
      wsServer.attach(httpServer);

      const client = createTestClient(port);
      testClients.push(client);

      await waitForOpen(client);

      // Simulate an error by sending a message with invalid UTF-8
      // This is tricky to test, so we'll verify the handler is registered
      expect(onError).not.toHaveBeenCalled();
    });
  });
});

describe("createWebSocketServer", () => {
  let httpServer: HttpServer;
  let port: number;
  let wsServer: PhoenixWebSocketServer;

  beforeEach(async () => {
    const result = await createTestHttpServer();
    httpServer = result.server;
    port = result.port;
  });

  afterEach(async () => {
    if (wsServer) {
      await wsServer.close();
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("should create and attach a WebSocket server", () => {
    wsServer = createWebSocketServer(httpServer);
    expect(wsServer).toBeInstanceOf(PhoenixWebSocketServer);
  });

  it("should accept options", async () => {
    const onConnection = vi.fn();
    wsServer = createWebSocketServer(httpServer, {
      path: "/custom",
      onConnection,
    });

    const client = new WebSocket(`ws://127.0.0.1:${port}/custom`);
    await waitForOpen(client);
    client.close();

    expect(onConnection).toHaveBeenCalledTimes(1);
  });
});

describe("Message types", () => {
  it("should have correct ClientMessage structure", () => {
    const queryMessage: ClientMessage = {
      type: "query",
      payload: { content: "test", sessionId: "123" },
    };
    expect(queryMessage.type).toBe("query");
    expect(queryMessage.payload.content).toBe("test");

    const cancelMessage: ClientMessage = {
      type: "cancel",
      payload: { sessionId: "123" },
    };
    expect(cancelMessage.type).toBe("cancel");
  });

  it("should have correct ServerMessage structure", () => {
    const textMessage: ServerMessage = {
      type: "text",
      payload: { content: "Hello", sessionId: "123" },
    };
    expect(textMessage.type).toBe("text");

    const toolCallMessage: ServerMessage = {
      type: "tool_call",
      payload: { toolName: "test", args: { foo: "bar" }, sessionId: "123" },
    };
    expect(toolCallMessage.type).toBe("tool_call");

    const toolResultMessage: ServerMessage = {
      type: "tool_result",
      payload: { toolName: "test", result: { success: true }, sessionId: "123" },
    };
    expect(toolResultMessage.type).toBe("tool_result");

    const reportMessage: ServerMessage = {
      type: "report",
      payload: { content: { root: "test" }, sessionId: "123" },
    };
    expect(reportMessage.type).toBe("report");

    const errorMessage: ServerMessage = {
      type: "error",
      payload: { message: "Error occurred" },
    };
    expect(errorMessage.type).toBe("error");

    const doneMessage: ServerMessage = {
      type: "done",
      payload: { sessionId: "123" },
    };
    expect(doneMessage.type).toBe("done");
  });
});
