import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  saveSession as dbSaveSession,
  loadSessions as dbLoadSessions,
  deleteSession as dbDeleteSession,
} from "@/lib/db";

// Types
export interface ToolCall {
  id: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: "pending" | "completed" | "error";
  timestamp: number;
  /** Position in the message content where this tool call appeared (for inline rendering) */
  contentPosition?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: number;
  title?: string;
}

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isConnected: boolean;
  isStreaming: boolean;
  connectionStatus: ConnectionStatus;
}

export interface ChatActions {
  addMessage: (
    sessionId: string,
    message: Omit<Message, "id" | "timestamp">
  ) => Message;
  updateMessage: (
    sessionId: string,
    messageId: string,
    content: string
  ) => void;
  addToolCall: (
    sessionId: string,
    messageId: string,
    toolCall: Omit<ToolCall, "id" | "timestamp" | "status" | "contentPosition">,
    contentPosition?: number
  ) => ToolCall;
  updateToolCallResult: (
    sessionId: string,
    messageId: string,
    toolName: string,
    result: unknown
  ) => void;
  createSession: (title?: string) => ChatSession;
  setCurrentSession: (sessionId: string | null) => void;
  clearSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  setIsConnected: (isConnected: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  getCurrentSession: () => ChatSession | null;
}

export type ChatStore = ChatState & ChatActions;

// Generate a unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    // State
    sessions: [],
    currentSessionId: null,
    isConnected: false,
    isStreaming: false,
    connectionStatus: "disconnected" as ConnectionStatus,

    // Actions
    addMessage: (sessionId, message) => {
      const newMessage: Message = {
        ...message,
        id: generateId(),
        timestamp: Date.now(),
      };

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, messages: [...session.messages, newMessage] }
            : session
        ),
      }));

      return newMessage;
    },

    updateMessage: (sessionId, messageId, content) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, content } : msg
                ),
              }
            : session
        ),
      }));
    },

    addToolCall: (sessionId, messageId, toolCall, contentPosition) => {
      const newToolCall: ToolCall = {
        ...toolCall,
        id: generateId(),
        timestamp: Date.now(),
        status: "pending",
        contentPosition,
      };

      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        toolCalls: [...(msg.toolCalls ?? []), newToolCall],
                      }
                    : msg
                ),
              }
            : session
        ),
      }));

      return newToolCall;
    },

    updateToolCallResult: (sessionId, messageId, toolName, result) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        toolCalls: msg.toolCalls?.map((tc) =>
                          tc.toolName === toolName && tc.status === "pending"
                            ? { ...tc, result, status: "completed" as const }
                            : tc
                        ),
                      }
                    : msg
                ),
              }
            : session
        ),
      }));
    },

    createSession: (title?: string) => {
      const newSession: ChatSession = {
        id: generateId(),
        messages: [],
        createdAt: Date.now(),
        title,
      };

      set((state) => ({
        sessions: [...state.sessions, newSession],
        currentSessionId: newSession.id,
      }));

      return newSession;
    },

    setCurrentSession: (sessionId) => {
      set({ currentSessionId: sessionId });
    },

    clearSession: (sessionId) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, messages: [] } : session
        ),
      }));
    },

    deleteSession: (sessionId) => {
      set((state) => {
        const newSessions = state.sessions.filter(
          (session) => session.id !== sessionId
        );
        const newCurrentId =
          state.currentSessionId === sessionId
            ? newSessions.length > 0
              ? newSessions[newSessions.length - 1].id
              : null
            : state.currentSessionId;

        return {
          sessions: newSessions,
          currentSessionId: newCurrentId,
        };
      });
    },

    setIsConnected: (isConnected) => {
      set({ isConnected });
    },

    setIsStreaming: (isStreaming) => {
      set({ isStreaming });
    },

    setConnectionStatus: (connectionStatus) => {
      // Also update isConnected for backward compatibility
      set({
        connectionStatus,
        isConnected: connectionStatus === "connected",
      });
    },

    getCurrentSession: () => {
      const state = get();
      if (!state.currentSessionId) return null;
      return (
        state.sessions.find((s) => s.id === state.currentSessionId) ?? null
      );
    },
  }))
);

// ============================================
// IndexedDB Persistence Integration
// ============================================

/**
 * Initialize chat store from IndexedDB
 * Call this on app startup to load persisted sessions
 */
export async function initializeChatStore(): Promise<void> {
  try {
    const sessions = await dbLoadSessions();
    if (sessions.length > 0) {
      useChatStore.setState({
        sessions,
        currentSessionId: sessions[sessions.length - 1].id,
      });
    }
  } catch (error) {
    console.error("Failed to load chat sessions from IndexedDB:", error);
  }
}

/**
 * Subscribe to store changes and persist to IndexedDB
 * Returns an unsubscribe function
 */
export function subscribeToChatPersistence(): () => void {
  const unsubscribe = useChatStore.subscribe(
    (state) => state.sessions,
    async (sessions, previousSessions) => {
      const currentIds = new Set(sessions.map((s) => s.id));
      const prevIds = new Set(previousSessions.map((s) => s.id));

      // Handle deleted sessions
      for (const id of prevIds) {
        if (!currentIds.has(id)) {
          try {
            await dbDeleteSession(id);
          } catch (error) {
            console.error(
              `Failed to delete session ${id} from IndexedDB:`,
              error
            );
          }
        }
      }

      // Handle new or updated sessions
      for (const session of sessions) {
        // Check if session is new or has been modified
        const prevSession = previousSessions.find((s) => s.id === session.id);
        if (
          !prevSession ||
          JSON.stringify(prevSession) !== JSON.stringify(session)
        ) {
          try {
            await dbSaveSession(session);
          } catch (error) {
            console.error(
              `Failed to save session ${session.id} to IndexedDB:`,
              error
            );
          }
        }
      }
    },
    { fireImmediately: false }
  );

  return unsubscribe;
}
