/**
 * ChatPanel component that composes chat functionality.
 * - Displays message list with auto-scroll
 * - Provides input for sending messages
 * - Shows session history dropdown for switching sessions
 * - Integrates with chat store and websocket hook
 */

import { useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useChatStore } from "@/store/chat";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";

export interface ChatPanelProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * Format a timestamp as a human-readable date/time string
 */
function formatSessionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * History icon for the dropdown trigger
 */
function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

/**
 * Plus icon for new session button
 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Trash icon for delete session button
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

/**
 * ChatPanel - Main chat interface component
 * 
 * Features:
 * - Message list with ScrollArea and auto-scroll
 * - ChatInput integration for sending messages
 * - Session history dropdown for managing multiple sessions
 * - Empty state when no messages exist
 * - WebSocket integration for real-time communication
 */
export function ChatPanel({ className }: ChatPanelProps) {
  // WebSocket hook for connection and messaging
  const { isConnected, isStreaming, sendQuery, cancel } = useWebSocket();

  // Chat store selectors
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const connectionStatus = useChatStore((state) => state.connectionStatus);
  const getCurrentSession = useChatStore((state) => state.getCurrentSession);
  const createSession = useChatStore((state) => state.createSession);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const deleteSession = useChatStore((state) => state.deleteSession);

  // Get current session
  const currentSession = getCurrentSession();
  const messages = currentSession?.messages ?? [];

  // Ref for auto-scrolling
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle creating a new session
  const handleNewSession = useCallback(() => {
    createSession();
  }, [createSession]);

  // Handle switching to a session
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setCurrentSession(sessionId);
    },
    [setCurrentSession]
  );

  // Handle deleting a session
  const handleDeleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent dropdown item click
      deleteSession(sessionId);
    },
    [deleteSession]
  );

  // Get session display title
  const getSessionTitle = (session: { id: string; title?: string; createdAt: number }): string => {
    return session.title ?? `Session ${formatSessionDate(session.createdAt)}`;
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header with session history dropdown */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">
          {currentSession ? getSessionTitle(currentSession) : "No Session"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Session history">
              <HistoryIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Sessions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* New session button */}
            <DropdownMenuItem onClick={handleNewSession}>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Session
            </DropdownMenuItem>

            {sessions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    History
                  </DropdownMenuLabel>
                  {/* Sort sessions by createdAt descending (newest first) */}
                  {[...sessions]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((session) => (
                      <DropdownMenuItem
                        key={session.id}
                        onClick={() => handleSelectSession(session.id)}
                        className={cn(
                          "flex items-center justify-between",
                          session.id === currentSessionId && "bg-accent"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="truncate">
                            {getSessionTitle(session)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {session.messages.length} messages
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          aria-label={`Delete ${getSessionTitle(session)}`}
                        >
                          <TrashIcon className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              </>
            )}

            {sessions.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No sessions yet
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Message list with ScrollArea */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <MessageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-medium">No messages yet</h3>
            <p className="max-w-[250px] text-sm text-muted-foreground">
              Start a conversation by typing a message below
            </p>
          </div>
        ) : (
          /* Message list */
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => {
              // Determine if this message is streaming
              // (last assistant message while isStreaming is true)
              const isMessageStreaming =
                isStreaming &&
                message.role === "assistant" &&
                index === messages.length - 1;

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isMessageStreaming}
                />
              );
            })}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Chat input */}
      <ChatInput
        onSend={sendQuery}
        onCancel={cancel}
        isConnected={isConnected}
        isStreaming={isStreaming}
        connectionStatus={connectionStatus}
        className="border-t"
      />
    </div>
  );
}

/**
 * Message icon for empty state
 */
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
