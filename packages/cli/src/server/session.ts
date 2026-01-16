/**
 * AgentSession manages a single WebSocket client's agent interaction.
 * Handles query execution, streaming responses, tool call notifications,
 * and report generation via the report tool.
 */

import type { WebSocket } from "ws";
import type { ServerMessage, JSONRenderTree } from "./websocket.js";
import {
  PhoenixInsightAgent,
  createInsightAgent,
  type PhoenixInsightAgentConfig,
} from "../agent/index.js";
import type { ExecutionMode } from "../modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";

// ============================================================================
// Types
// ============================================================================

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Callback for broadcasting messages to a WebSocket client
 */
export type BroadcastCallback = (message: ServerMessage) => void;

/**
 * Options for creating an AgentSession
 */
export interface AgentSessionOptions {
  /** Unique session ID */
  sessionId: string;
  /** The execution mode (sandbox or local) */
  mode: ExecutionMode;
  /** Phoenix client instance */
  client: PhoenixClient;
  /** Maximum number of agent steps before stopping (default: 25) */
  maxSteps?: number;
  /** Callback to send messages to the client */
  broadcast: BroadcastCallback;
}

/**
 * Report generation callback that can be passed to tools
 */
export type ReportCallback = (
  content: JSONRenderTree,
  title?: string
) => void;

// ============================================================================
// AgentSession Class
// ============================================================================

/**
 * Manages a single WebSocket client's agent interaction.
 * - Handles query execution with streaming responses
 * - Sends tool call and tool result notifications
 * - Maintains conversation history within session
 * - Supports cancellation of in-progress queries
 */
export class AgentSession {
  private sessionId: string;
  private mode: ExecutionMode;
  private client: PhoenixClient;
  private maxSteps: number;
  private broadcast: BroadcastCallback;
  private agent: PhoenixInsightAgent | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private isExecuting = false;
  private abortController: AbortController | null = null;

  constructor(options: AgentSessionOptions) {
    this.sessionId = options.sessionId;
    this.mode = options.mode;
    this.client = options.client;
    this.maxSteps = options.maxSteps ?? 25;
    this.broadcast = options.broadcast;
  }

  /**
   * Get the session ID
   */
  get id(): string {
    return this.sessionId;
  }

  /**
   * Check if a query is currently being executed
   */
  get executing(): boolean {
    return this.isExecuting;
  }

  /**
   * Get the conversation history
   */
  get history(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Initialize the agent lazily
   */
  private async getAgent(): Promise<PhoenixInsightAgent> {
    if (!this.agent) {
      const config: PhoenixInsightAgentConfig = {
        mode: this.mode,
        client: this.client,
        maxSteps: this.maxSteps,
      };
      this.agent = await createInsightAgent(config);
    }
    return this.agent;
  }

  /**
   * Send a message to the connected client
   */
  private send(message: ServerMessage): void {
    this.broadcast(message);
  }

  /**
   * Send a text chunk to the client
   */
  private sendText(content: string): void {
    this.send({
      type: "text",
      payload: { content, sessionId: this.sessionId },
    });
  }

  /**
   * Send a tool call notification to the client
   */
  private sendToolCall(toolName: string, args: unknown): void {
    this.send({
      type: "tool_call",
      payload: { toolName, args, sessionId: this.sessionId },
    });
  }

  /**
   * Send a tool result notification to the client
   */
  private sendToolResult(toolName: string, result: unknown): void {
    this.send({
      type: "tool_result",
      payload: { toolName, result, sessionId: this.sessionId },
    });
  }

  /**
   * Send a report update to the client
   */
  sendReport(content: JSONRenderTree, title?: string): void {
    this.send({
      type: "report",
      payload: { content, sessionId: this.sessionId },
    });
  }

  /**
   * Send an error message to the client
   */
  private sendError(message: string): void {
    this.send({
      type: "error",
      payload: { message, sessionId: this.sessionId },
    });
  }

  /**
   * Send the done signal to the client
   */
  private sendDone(): void {
    this.send({
      type: "done",
      payload: { sessionId: this.sessionId },
    });
  }

  /**
   * Add a message to the conversation history
   */
  private addToHistory(role: "user" | "assistant", content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Get a callback function for the report tool
   * This can be passed to the report tool to send reports to the client
   */
  getReportCallback(): ReportCallback {
    return (content: JSONRenderTree, title?: string) => {
      this.sendReport(content, title);
    };
  }

  /**
   * Execute a query and stream the response to the client
   */
  async executeQuery(query: string): Promise<void> {
    if (this.isExecuting) {
      this.sendError("A query is already being executed");
      return;
    }

    this.isExecuting = true;
    this.abortController = new AbortController();

    // Add user message to history
    this.addToHistory("user", query);

    try {
      const agent = await this.getAgent();

      // Use streaming for responses
      const result = await agent.stream(query, {
        onStepFinish: (step: any) => {
          // Check if cancelled
          if (this.abortController?.signal.aborted) {
            return;
          }

          // Send tool call notifications
          if (step.toolCalls?.length) {
            for (const toolCall of step.toolCalls) {
              this.sendToolCall(toolCall.toolName, toolCall.args);
            }
          }

          // Send tool result notifications
          if (step.toolResults?.length) {
            for (const toolResult of step.toolResults) {
              this.sendToolResult(toolResult.toolName, toolResult.result);
            }
          }
        },
      });

      // Stream text chunks to the client
      let fullResponse = "";
      for await (const chunk of result.textStream) {
        // Check if cancelled
        if (this.abortController?.signal.aborted) {
          break;
        }
        fullResponse += chunk;
        this.sendText(chunk);
      }

      // Wait for the full response to complete
      if (!this.abortController?.signal.aborted) {
        await result.response;
      }

      // Add assistant message to history
      if (fullResponse) {
        this.addToHistory("assistant", fullResponse);
      }

      // Send done signal
      this.sendDone();
    } catch (error) {
      // Don't send error if we were cancelled
      if (!this.abortController?.signal.aborted) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.sendError(`Query failed: ${message}`);
      }
    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  /**
   * Cancel the currently executing query
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.sendDone();
    }
  }

  /**
   * Clear the conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Cancel any in-progress execution
    if (this.abortController) {
      this.abortController.abort();
    }

    // Note: We don't clean up the mode here as it may be shared
    // The caller is responsible for cleaning up the mode
    this.agent = null;
    this.conversationHistory = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AgentSession
 */
export function createAgentSession(
  options: AgentSessionOptions
): AgentSession {
  return new AgentSession(options);
}

// ============================================================================
// Session Manager (for managing multiple sessions)
// ============================================================================

/**
 * Options for creating a SessionManager
 */
export interface SessionManagerOptions {
  /** The execution mode (sandbox or local) */
  mode: ExecutionMode;
  /** Phoenix client instance */
  client: PhoenixClient;
  /** Maximum number of agent steps before stopping (default: 25) */
  maxSteps?: number;
}

/**
 * Manages multiple agent sessions (one per WebSocket client)
 */
export class SessionManager {
  private sessions: Map<string, AgentSession> = new Map();
  private clientToSession: Map<WebSocket, string> = new Map();
  private mode: ExecutionMode;
  private client: PhoenixClient;
  private maxSteps: number;

  constructor(options: SessionManagerOptions) {
    this.mode = options.mode;
    this.client = options.client;
    this.maxSteps = options.maxSteps ?? 25;
  }

  /**
   * Get or create a session for a WebSocket client
   */
  getOrCreateSession(
    ws: WebSocket,
    sessionId: string,
    broadcast: BroadcastCallback
  ): AgentSession {
    // Check if we already have a session for this ID
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Create a new session
      session = createAgentSession({
        sessionId,
        mode: this.mode,
        client: this.client,
        maxSteps: this.maxSteps,
        broadcast,
      });
      this.sessions.set(sessionId, session);
    }

    // Map the WebSocket to the session
    this.clientToSession.set(ws, sessionId);

    return session;
  }

  /**
   * Get the session for a WebSocket client
   */
  getSessionForClient(ws: WebSocket): AgentSession | undefined {
    const sessionId = this.clientToSession.get(ws);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove a session when a client disconnects
   */
  async removeSession(ws: WebSocket): Promise<void> {
    const sessionId = this.clientToSession.get(ws);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        await session.cleanup();
        this.sessions.delete(sessionId);
      }
      this.clientToSession.delete(ws);
    }
  }

  /**
   * Get the number of active sessions
   */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up all sessions
   */
  async cleanup(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.cleanup();
    }
    this.sessions.clear();
    this.clientToSession.clear();
  }
}

/**
 * Create a new SessionManager
 */
export function createSessionManager(
  options: SessionManagerOptions
): SessionManager {
  return new SessionManager(options);
}
