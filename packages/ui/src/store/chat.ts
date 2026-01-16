import { create } from "zustand";

// Types
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: number;
  title?: string;
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isConnected: boolean;
  isStreaming: boolean;
}

export interface ChatActions {
  addMessage: (
    sessionId: string,
    message: Omit<Message, "id" | "timestamp">
  ) => Message;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  createSession: (title?: string) => ChatSession;
  setCurrentSession: (sessionId: string | null) => void;
  clearSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  setIsConnected: (isConnected: boolean) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  getCurrentSession: () => ChatSession | null;
}

export type ChatStore = ChatState & ChatActions;

// Generate a unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  sessions: [],
  currentSessionId: null,
  isConnected: false,
  isStreaming: false,

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

  getCurrentSession: () => {
    const state = get();
    if (!state.currentSessionId) return null;
    return (
      state.sessions.find((s) => s.id === state.currentSessionId) ?? null
    );
  },
}));
