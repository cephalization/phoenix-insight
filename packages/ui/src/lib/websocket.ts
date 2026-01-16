/**
 * WebSocket client for Phoenix Insight UI using partysocket for robust connection management.
 * Provides automatic reconnection with exponential backoff, message buffering during
 * disconnection, and connection timeout handling.
 */

import { WebSocket as PartyWebSocket } from "partysocket";

// ============================================================================
// Message Types
// ============================================================================

/**
 * Messages sent from the UI client to the server
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
 * JSON render tree type placeholder - will be properly typed when json-render is integrated
 */
export type JSONRenderTree = unknown;

// ============================================================================
// Event Handler Types
// ============================================================================

export type MessageHandler = (message: ServerMessage) => void;
export type ErrorHandler = (error: Event) => void;
export type CloseHandler = (event: CloseEvent) => void;
export type OpenHandler = () => void;

// ============================================================================
// WebSocket Client
// ============================================================================

export interface WebSocketClientOptions {
  /** URL to connect to (e.g., "ws://localhost:6007") */
  url: string;
  /** Maximum reconnection attempts (default: Infinity) */
  maxRetries?: number;
  /** Minimum reconnection delay in ms (default: 1000) */
  minReconnectionDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectionDelay?: number;
  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;
}

/**
 * WebSocket client wrapper providing typed message handling and robust connection management.
 * Uses partysocket under the hood for automatic reconnection with exponential backoff.
 */
export class WebSocketClient {
  private socket: PartyWebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private closeHandlers: Set<CloseHandler> = new Set();
  private openHandlers: Set<OpenHandler> = new Set();
  private options: Required<WebSocketClientOptions>;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      maxRetries: Infinity,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 30000,
      connectionTimeout: 10000,
      ...options,
    };
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket) {
      // Already connected or connecting
      return;
    }

    // Convert http/https URL to ws/wss URL and append /ws path
    let wsUrl = this.options.url;
    if (wsUrl.startsWith("http://")) {
      wsUrl = "ws://" + wsUrl.slice(7);
    } else if (wsUrl.startsWith("https://")) {
      wsUrl = "wss://" + wsUrl.slice(8);
    }
    // Append /ws path if not already present
    if (!wsUrl.endsWith("/ws")) {
      wsUrl = wsUrl.replace(/\/?$/, "/ws");
    }

    this.socket = new PartyWebSocket(wsUrl, [], {
      // PartyWebSocket handles reconnection internally
      maxRetries: this.options.maxRetries,
      minReconnectionDelay: this.options.minReconnectionDelay,
      maxReconnectionDelay: this.options.maxReconnectionDelay,
      connectionTimeout: this.options.connectionTimeout,
    });

    const socket = this.socket;

    socket.addEventListener("open", () => {
      this.openHandlers.forEach((handler) => handler());
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        // If parsing fails, create an error message
        const errorMessage: ServerMessage = {
          type: "error",
          payload: { message: `Failed to parse server message: ${error}` },
        };
        this.messageHandlers.forEach((handler) => handler(errorMessage));
      }
    });

    socket.addEventListener("error", (event: Event) => {
      this.errorHandlers.forEach((handler) => handler(event));
    });

    socket.addEventListener("close", (event: CloseEvent) => {
      this.closeHandlers.forEach((handler) => handler(event));
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Send a message to the server
   */
  send(message: ClientMessage): void {
    if (!this.socket) {
      throw new Error("WebSocket is not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Register a handler for incoming messages
   * @returns Unsubscribe function
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register a handler for errors
   * @returns Unsubscribe function
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Register a handler for connection close
   * @returns Unsubscribe function
   */
  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /**
   * Register a handler for connection open
   * @returns Unsubscribe function
   */
  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler);
    return () => {
      this.openHandlers.delete(handler);
    };
  }

  /**
   * Check if the WebSocket is currently connected
   */
  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the current connection state
   */
  get readyState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new WebSocket client instance
 */
export function createWebSocketClient(
  options: WebSocketClientOptions
): WebSocketClient {
  return new WebSocketClient(options);
}

/**
 * Connect to a WebSocket server and return the client
 * Convenience function that creates and connects in one step
 */
export function connect(
  url: string,
  options?: Omit<WebSocketClientOptions, "url">
): WebSocketClient {
  const client = new WebSocketClient({ url, ...options });
  client.connect();
  return client;
}
