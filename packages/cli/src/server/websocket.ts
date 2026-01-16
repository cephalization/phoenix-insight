/**
 * WebSocket server for Phoenix Insight CLI.
 * Provides bidirectional communication between the CLI agent and the web UI.
 *
 * Binds to localhost only for security (no external network access).
 * Handles HTTP upgrade requests, manages client connections, and broadcasts messages.
 */

import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

// ============================================================================
// Message Types (matching UI client types from packages/ui/src/lib/websocket.ts)
// ============================================================================

/**
 * Messages received from the UI client
 */
export type ClientMessage =
  | { type: "query"; payload: { content: string; sessionId?: string } }
  | { type: "cancel"; payload: { sessionId?: string } };

/**
 * Messages sent from the server to the UI client
 */
export type ServerMessage =
  | { type: "text"; payload: { content: string; sessionId: string } }
  | {
      type: "tool_call";
      payload: { toolName: string; args: unknown; sessionId: string };
    }
  | {
      type: "tool_result";
      payload: { toolName: string; result: unknown; sessionId: string };
    }
  | { type: "report"; payload: { content: JSONRenderTree; sessionId: string } }
  | { type: "error"; payload: { message: string; sessionId?: string } }
  | { type: "done"; payload: { sessionId: string } };

/**
 * JSON render tree type placeholder - matches UI client type
 */
export type JSONRenderTree = unknown;

// ============================================================================
// Event Handler Types
// ============================================================================

export type ClientMessageHandler = (
  message: ClientMessage,
  client: WebSocket
) => void;
export type ConnectionHandler = (client: WebSocket) => void;
export type DisconnectionHandler = (
  client: WebSocket,
  code: number,
  reason: string
) => void;
export type ErrorHandler = (error: Error, client?: WebSocket) => void;

// ============================================================================
// WebSocket Server Options
// ============================================================================

export interface WebSocketServerOptions {
  /** Path to accept WebSocket connections on (default: "/ws") */
  path?: string;
  /** Handler for incoming client messages */
  onMessage?: ClientMessageHandler;
  /** Handler for new client connections */
  onConnection?: ConnectionHandler;
  /** Handler for client disconnections */
  onDisconnection?: DisconnectionHandler;
  /** Handler for WebSocket errors */
  onError?: ErrorHandler;
}

// ============================================================================
// Phoenix WebSocket Server
// ============================================================================

/**
 * Phoenix WebSocket server wrapper providing typed message handling
 * and connection management.
 */
export class PhoenixWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private options: Required<WebSocketServerOptions>;

  constructor(options: WebSocketServerOptions = {}) {
    this.options = {
      path: "/ws",
      onMessage: () => {},
      onConnection: () => {},
      onDisconnection: () => {},
      onError: () => {},
      ...options,
    };
  }

  /**
   * Attach the WebSocket server to an existing HTTP server.
   * Uses the upgrade event to handle WebSocket handshakes.
   */
  attach(httpServer: HttpServer): void {
    if (this.wss) {
      throw new Error("WebSocket server is already attached");
    }

    // Create WebSocket server with noServer mode to handle upgrade ourselves
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests
    httpServer.on("upgrade", (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    // Set up WebSocket server event handlers
    this.setupEventHandlers();
  }

  /**
   * Handle HTTP upgrade request for WebSocket connection.
   * Only accepts connections on the configured path and from localhost.
   */
  private handleUpgrade(
    request: IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer
  ): void {
    if (!this.wss) {
      socket.destroy();
      return;
    }

    // Parse the request URL
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    // Only accept connections on the configured path
    if (url.pathname !== this.options.path) {
      socket.destroy();
      return;
    }

    // Complete the WebSocket handshake
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss?.emit("connection", ws, request);
    });
  }

  /**
   * Set up event handlers for the WebSocket server.
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      this.options.onConnection(ws);

      ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
        this.handleMessage(data, ws);
      });

      ws.on("close", (code: number, reason: Buffer) => {
        this.clients.delete(ws);
        this.options.onDisconnection(ws, code, reason.toString());
      });

      ws.on("error", (error: Error) => {
        this.options.onError(error, ws);
      });
    });

    this.wss.on("error", (error: Error) => {
      this.options.onError(error);
    });
  }

  /**
   * Handle incoming message from a client.
   * Parses JSON and validates message structure before calling handler.
   */
  private handleMessage(
    data: Buffer | ArrayBuffer | Buffer[],
    client: WebSocket
  ): void {
    try {
      const rawMessage = data.toString();
      const parsed = JSON.parse(rawMessage) as unknown;

      // Basic validation of message structure
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid message structure: expected object");
      }

      const obj = parsed as Record<string, unknown>;
      if (!("type" in obj) || typeof obj.type !== "string") {
        throw new Error("Invalid message structure: missing type field");
      }

      const messageType = obj.type;
      if (messageType !== "query" && messageType !== "cancel") {
        throw new Error(`Unknown message type: ${messageType}`);
      }

      // Now we know this is a valid ClientMessage
      const message = parsed as ClientMessage;
      this.options.onMessage(message, client);
    } catch (error) {
      // Send error message back to the client
      const errorMessage: ServerMessage = {
        type: "error",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to parse message",
        },
      };
      this.sendToClient(client, errorMessage);
    }
  }

  /**
   * Send a message to a specific client.
   */
  sendToClient(client: WebSocket, message: ServerMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Broadcast a message to all clients with a specific session ID.
   * This requires tracking session-to-client mapping externally.
   * For now, it broadcasts to all clients (to be refined in cli-agent-session).
   */
  broadcastToSession(sessionId: string, message: ServerMessage): void {
    // For now, broadcast to all clients.
    // Session-to-client mapping will be implemented in cli-agent-session task.
    this.broadcast(message);
  }

  /**
   * Get the number of connected clients.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected clients.
   */
  getClients(): Set<WebSocket> {
    return new Set(this.clients);
  }

  /**
   * Close the WebSocket server and disconnect all clients.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients) {
        client.close(1000, "Server shutting down");
      }
      this.clients.clear();

      // Close the WebSocket server
      this.wss.close((err) => {
        this.wss = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and attach a WebSocket server to an HTTP server.
 * The WebSocket server binds to localhost only (through the HTTP server).
 *
 * @param httpServer - HTTP server to attach WebSocket handling to
 * @param options - WebSocket server options
 * @returns PhoenixWebSocketServer instance
 */
export function createWebSocketServer(
  httpServer: HttpServer,
  options?: WebSocketServerOptions
): PhoenixWebSocketServer {
  const server = new PhoenixWebSocketServer(options);
  server.attach(httpServer);
  return server;
}
