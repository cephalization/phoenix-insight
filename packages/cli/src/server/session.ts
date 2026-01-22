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
import { createReportTool } from "../commands/report-tool.js";
import {
  type ConversationMessage,
  createUserMessage,
  extractMessagesFromResponse,
  compactConversation,
  fromUIMessages,
} from "../agent/conversation.js";
import {
  isTokenLimitError,
  getTokenLimitErrorDescription,
} from "../agent/token-errors.js";

// ============================================================================
// Types
// ============================================================================

// Re-export ConversationMessage from conversation.ts for external use
export type { ConversationMessage } from "../agent/conversation.js";

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
export type ReportCallback = (content: JSONRenderTree, title?: string) => void;

/**
 * Options for executeQuery
 */
export interface ExecuteQueryOptions {
  /**
   * Optional conversation history provided by the client.
   * If provided, this history will be used instead of the server-side session history.
   * This allows the UI to manage its own conversation state.
   */
  history?: unknown[];
}

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
   * Initialize the agent lazily, including the report tool for UI mode
   */
  private async getAgent(): Promise<PhoenixInsightAgent> {
    if (!this.agent) {
      // Create the report tool with a callback to send reports to the client
      const reportTool = createReportTool((content, title) => {
        this.sendReport(content, title);
      });

      const config: PhoenixInsightAgentConfig = {
        mode: this.mode,
        client: this.client,
        maxSteps: this.maxSteps,
        additionalTools: {
          generate_report: reportTool,
        },
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
   * Send a context compacted notification to the client
   */
  private sendContextCompacted(reason?: string): void {
    this.send({
      type: "context_compacted",
      payload: { sessionId: this.sessionId, reason },
    });
  }

  /**
   * Add a user message to the conversation history
   */
  private addUserMessage(content: string): void {
    this.conversationHistory.push(createUserMessage(content));
  }

  /**
   * Add assistant messages (including tool calls and results) to the conversation history
   */
  private addAssistantMessages(messages: ConversationMessage[]): void {
    this.conversationHistory.push(...messages);
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
   * Execute a query and stream the response to the client.
   *
   * The conversation history is passed to the agent for multi-turn context.
   * After the response completes, both the user message and the assistant's
   * response (including any tool calls and results) are appended to the history.
   *
   * If a token limit error occurs, the conversation is automatically compacted
   * and the query is retried once.
   *
   * @param query - The query to execute
   * @param options - Optional settings including client-provided history
   */
  async executeQuery(query: string, options?: ExecuteQueryOptions): Promise<void> {
    if (this.isExecuting) {
      this.sendError("A query is already being executed");
      return;
    }

    this.isExecuting = true;
    this.abortController = new AbortController();

    // Determine which history to use: client-provided or server-side
    // If the client provides history, convert it and use that; otherwise use server-side history
    let historyToUse: ConversationMessage[];
    let usingClientHistory = false;

    if (options?.history && Array.isArray(options.history) && options.history.length > 0) {
      // Convert UI message format to internal ConversationMessage format
      historyToUse = fromUIMessages(options.history);
      usingClientHistory = true;
    } else {
      historyToUse = [...this.conversationHistory];
    }

    try {
      // First attempt with determined history
      const firstAttemptError = await this.executeQueryWithHistory(
        query,
        historyToUse,
        usingClientHistory
      );

      if (firstAttemptError && isTokenLimitError(firstAttemptError)) {
        // Token limit error - compact the conversation and retry
        const errorDescription = getTokenLimitErrorDescription(firstAttemptError);
        
        // Compact the history being used
        const originalLength = historyToUse.length;
        historyToUse = compactConversation(historyToUse);
        const compactedLength = historyToUse.length;

        // If using server-side history, update it
        if (!usingClientHistory) {
          this.conversationHistory = historyToUse;
        }
        
        // Notify the client that context was compacted
        const reason = errorDescription ?? 
          `Conversation compacted from ${originalLength} to ${compactedLength} messages to fit model limits.`;
        this.sendContextCompacted(reason);
        
        // Retry with compacted history
        const retryError = await this.executeQueryWithHistory(
          query,
          historyToUse,
          usingClientHistory
        );
        
        if (retryError) {
          // Retry also failed - send error to client
          if (!this.abortController?.signal.aborted) {
            const message = retryError instanceof Error ? retryError.message : String(retryError);
            this.sendError(`Query failed after compaction: ${message}`);
          }
        } else {
          // Retry succeeded - send done signal
          this.sendDone();
        }
      } else if (firstAttemptError) {
        // Non-token-limit error - send error to client
        if (!this.abortController?.signal.aborted) {
          const message = firstAttemptError instanceof Error ? firstAttemptError.message : String(firstAttemptError);
          this.sendError(`Query failed: ${message}`);
        }
      } else {
        // First attempt succeeded - send done signal
        this.sendDone();
      }
    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  /**
   * Execute a query with the provided conversation history.
   * Returns the error if execution fails, or null if successful.
   * On success, updates the server-side conversation history with the query and response
   * (unless usingClientHistory is true, in which case the client manages its own history).
   *
   * @param query - The query to execute
   * @param history - The conversation history to use for this query
   * @param usingClientHistory - If true, the client provided the history and manages its own state
   */
  private async executeQueryWithHistory(
    query: string,
    history: ConversationMessage[],
    usingClientHistory: boolean
  ): Promise<Error | null> {
    try {
      const agent = await this.getAgent();

      // Pass the conversation history to the agent for multi-turn context
      // The agent will convert it to AI SDK format and append the current query as the last message
      const result = await agent.stream(query, {
        messages: history,
      });

      // Stream using fullStream to get real-time tool call/result events
      // This ensures tool calls are sent BEFORE execution, not after
      let lastStepHadText = false;

      for await (const part of result.fullStream) {
        // Check if cancelled
        if (this.abortController?.signal.aborted) {
          break;
        }

        switch (part.type) {
          case "text-delta":
            // Add step separator if needed (when previous step had text)
            if (lastStepHadText && part.text.trim().length > 0) {
              const separator = "\n\n";
              this.sendText(separator);
              lastStepHadText = false;
            }
            this.sendText(part.text);
            break;

          case "tool-call":
            // Send tool call notification immediately when the model calls the tool
            // This happens BEFORE the tool executes
            // AI SDK v6 uses 'input' property for the parsed arguments
            this.sendToolCall(part.toolName, part.input ?? {});
            break;

          case "tool-result":
            // Send tool result when execution completes
            // AI SDK v6 uses 'output' property for the result
            this.sendToolResult(part.toolName, part.output);
            break;

          case "text-end":
            // A text block ended - mark for separator before next step
            lastStepHadText = true;
            break;
        }
      }

      // Wait for the full response to complete
      if (!this.abortController?.signal.aborted) {
        await result.response;

        // Only update server-side history if the client is NOT managing its own history
        // When the client provides history, it's responsible for updating its own state
        if (!usingClientHistory) {
          // Add user message to history (after successful completion)
          this.addUserMessage(query);

          // Extract the assistant's response (including tool calls/results) from the result
          // and append to conversation history for future queries
          const assistantMessages = await extractMessagesFromResponse(result);
          if (assistantMessages.length > 0) {
            this.addAssistantMessages(assistantMessages);
          }
        }
      }

      return null; // Success
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
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
export function createAgentSession(options: AgentSessionOptions): AgentSession {
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
