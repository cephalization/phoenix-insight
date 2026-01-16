/**
 * React hook for WebSocket connection management.
 * Integrates with chat and report stores to handle streamed messages.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { WebSocketClient, type ServerMessage } from "@/lib/websocket";
import { useChatStore } from "@/store/chat";
import { useReportStore, type JSONRenderTree } from "@/store/report";

// Default WebSocket URL (localhost:6007)
const DEFAULT_WS_URL = "ws://localhost:6007";

/**
 * Convert technical error messages to user-friendly messages.
 * Avoids exposing stack traces or overly technical details.
 */
function getUserFriendlyErrorMessage(errorMessage: string): string {
  const lowerError = errorMessage.toLowerCase();

  // Network-related errors
  if (lowerError.includes("network") || lowerError.includes("connection")) {
    return "A network error occurred. Please check your connection.";
  }

  // Timeout errors
  if (lowerError.includes("timeout")) {
    return "The request timed out. Please try again.";
  }

  // Rate limiting
  if (lowerError.includes("rate limit") || lowerError.includes("too many requests")) {
    return "Too many requests. Please wait a moment before trying again.";
  }

  // Authentication/authorization
  if (lowerError.includes("unauthorized") || lowerError.includes("forbidden")) {
    return "You don't have permission to perform this action.";
  }

  // Phoenix/API specific errors
  if (lowerError.includes("phoenix")) {
    return "Unable to communicate with Phoenix. Please ensure it's running.";
  }

  // Model/AI errors
  if (lowerError.includes("model") || lowerError.includes("api key")) {
    return "There was a problem with the AI service. Please check your configuration.";
  }

  // JSON parse errors (already handled in websocket.ts but may come through as error message)
  if (lowerError.includes("json") || lowerError.includes("parse")) {
    return "There was a problem processing the response data.";
  }

  // If the error message is short and doesn't contain technical jargon, use it
  if (errorMessage.length < 100 && !errorMessage.includes("at ") && !errorMessage.includes("Error:")) {
    return errorMessage;
  }

  // Default fallback
  return "An unexpected error occurred. Please try again.";
}

export interface UseWebSocketOptions {
  /** WebSocket server URL (defaults to ws://localhost:6007) */
  url?: string;
  /** Auto-connect on mount (defaults to true) */
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** Whether a query is currently streaming */
  isStreaming: boolean;
  /** Send a query to the server */
  sendQuery: (content: string) => void;
  /** Cancel the current streaming query */
  cancel: () => void;
}

/**
 * Hook that wraps WebSocketClient and integrates with chat/report stores.
 * Handles connection lifecycle, message streaming, and store updates.
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { url = DEFAULT_WS_URL, autoConnect = true } = options;

  // Refs for mutable state that shouldn't trigger re-renders
  const clientRef = useRef<WebSocketClient | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  // Chat store selectors
  const isConnected = useChatStore((state) => state.isConnected);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const createSession = useChatStore((state) => state.createSession);
  const setConnectionStatus = useChatStore((state) => state.setConnectionStatus);
  const setIsStreaming = useChatStore((state) => state.setIsStreaming);

  // Report store selectors
  const setReport = useReportStore((state) => state.setReport);

  // Handle incoming server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      // Get or create session for this message
      // Note: We read currentSessionId from store directly to avoid
      // including it in dependencies which would cause effect re-runs
      const sessionId = "sessionId" in message.payload
        ? (message.payload as { sessionId: string }).sessionId
        : useChatStore.getState().currentSessionId;

      if (!sessionId) {
        console.warn("Received message without session context:", message);
        return;
      }

      switch (message.type) {
        case "text": {
          const { content } = message.payload;

          // If we have an existing assistant message, append to it (streaming)
          if (currentAssistantMessageIdRef.current) {
            // Get current content and append
            const currentSession = useChatStore
              .getState()
              .sessions.find((s) => s.id === sessionId);
            const currentMessage = currentSession?.messages.find(
              (m) => m.id === currentAssistantMessageIdRef.current
            );
            const currentContent = currentMessage?.content ?? "";
            updateMessage(
              sessionId,
              currentAssistantMessageIdRef.current,
              currentContent + content
            );
          } else {
            // Start a new assistant message
            const newMessage = addMessage(sessionId, {
              role: "assistant",
              content,
            });
            currentAssistantMessageIdRef.current = newMessage.id;
            setIsStreaming(true);
          }
          break;
        }

        case "tool_call": {
          // Tool calls are informational - could display in UI
          // For now, we just ensure streaming state is set
          if (!currentAssistantMessageIdRef.current) {
            const newMessage = addMessage(sessionId, {
              role: "assistant",
              content: "",
            });
            currentAssistantMessageIdRef.current = newMessage.id;
            setIsStreaming(true);
          }
          break;
        }

        case "tool_result": {
          // Tool results are informational - streaming continues
          break;
        }

        case "report": {
          const { content } = message.payload;
          // Update report store with new report content
          // Cast content to JSONRenderTree (websocket uses `unknown` as placeholder)
          setReport({
            sessionId,
            content: content as JSONRenderTree,
          });
          break;
        }

        case "error": {
          const { message: errorMessage } = message.payload;
          // Show toast for server errors
          toast.error("Query failed", {
            description: getUserFriendlyErrorMessage(errorMessage),
            duration: 5000,
          });
          // Add error as assistant message (inline display)
          if (currentAssistantMessageIdRef.current) {
            updateMessage(
              sessionId,
              currentAssistantMessageIdRef.current,
              `Error: ${getUserFriendlyErrorMessage(errorMessage)}`
            );
          } else {
            addMessage(sessionId, {
              role: "assistant",
              content: `Error: ${getUserFriendlyErrorMessage(errorMessage)}`,
            });
          }
          // Reset streaming state on error
          currentAssistantMessageIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case "done": {
          // Query completed - reset streaming state
          currentAssistantMessageIdRef.current = null;
          setIsStreaming(false);
          break;
        }
      }
    },
    [
      addMessage,
      updateMessage,
      setIsStreaming,
      setReport,
    ]
  );

  // Handle connection open
  const handleOpen = useCallback(() => {
    setConnectionStatus("connected");
  }, [setConnectionStatus]);

  // Handle connection close
  const handleClose = useCallback(() => {
    // Set to connecting first (partysocket will auto-reconnect)
    // The status will be updated to disconnected if reconnection fails
    setConnectionStatus("connecting");
    // If we were streaming, reset state
    if (currentAssistantMessageIdRef.current) {
      currentAssistantMessageIdRef.current = null;
      setIsStreaming(false);
    }
  }, [setConnectionStatus, setIsStreaming]);

  // Handle connection error
  const handleError = useCallback(
    (event: Event) => {
      console.error("WebSocket error:", event);
      // Show toast notification for WebSocket errors
      toast.error("Connection error", {
        description: "A WebSocket error occurred. Attempting to reconnect...",
        duration: 5000,
      });
      // Connection state will be updated by close handler
    },
    []
  );

  // Initialize WebSocket client and set up event handlers
  useEffect(() => {
    const client = new WebSocketClient({ url });
    clientRef.current = client;

    // Set up event handlers
    const unsubMessage = client.onMessage(handleMessage);
    const unsubOpen = client.onOpen(handleOpen);
    const unsubClose = client.onClose(handleClose);
    const unsubError = client.onError(handleError);

    // Auto-connect if enabled
    if (autoConnect) {
      // Set connecting status before attempting connection
      setConnectionStatus("connecting");
      client.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubMessage();
      unsubOpen();
      unsubClose();
      unsubError();
      client.disconnect();
      clientRef.current = null;
      // Don't set disconnected on cleanup - the component is unmounting
    };
  }, [url, autoConnect, handleMessage, handleOpen, handleClose, handleError, setConnectionStatus]);

  // Send a query to the server
  const sendQuery = useCallback(
    (content: string) => {
      if (!clientRef.current) {
        console.error("WebSocket client not initialized");
        return;
      }

      // Ensure we have a session
      let sessionId = currentSessionId;
      if (!sessionId) {
        const newSession = createSession();
        sessionId = newSession.id;
      }

      // Add user message to chat
      addMessage(sessionId, { role: "user", content });

      // Reset any previous assistant message ref
      currentAssistantMessageIdRef.current = null;

      // Send query to server
      try {
        clientRef.current.send({
          type: "query",
          payload: { content, sessionId },
        });
      } catch (error) {
        console.error("Failed to send query:", error);
        const errorMsg = getUserFriendlyErrorMessage(
          error instanceof Error ? error.message : "Unknown error"
        );
        // Show toast notification
        toast.error("Failed to send message", {
          description: errorMsg,
          duration: 5000,
        });
        // Add error message inline
        addMessage(sessionId, {
          role: "assistant",
          content: `Failed to send message: ${errorMsg}`,
        });
      }
    },
    [currentSessionId, createSession, addMessage]
  );

  // Cancel the current streaming query
  const cancel = useCallback(() => {
    if (!clientRef.current) {
      return;
    }

    const sessionId = currentSessionId;
    if (!sessionId) {
      return;
    }

    try {
      clientRef.current.send({
        type: "cancel",
        payload: { sessionId },
      });
    } catch (error) {
      console.error("Failed to send cancel:", error);
    }

    // Reset streaming state
    currentAssistantMessageIdRef.current = null;
    setIsStreaming(false);
  }, [currentSessionId, setIsStreaming]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      isConnected,
      isStreaming,
      sendQuery,
      cancel,
    }),
    [isConnected, isStreaming, sendQuery, cancel]
  );
}
