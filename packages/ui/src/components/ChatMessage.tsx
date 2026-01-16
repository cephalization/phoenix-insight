import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import type { Message } from "@/store/chat";

export interface ChatMessageProps {
  /** The message to display */
  message: Message;
  /** Whether this message is currently being streamed */
  isStreaming?: boolean;
}

/**
 * Formats a timestamp as a human-readable time string
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ChatMessage component displays a single chat message.
 * - User messages are aligned right with primary background
 * - Assistant messages are aligned left with muted background
 * - Uses streamdown for markdown rendering (optimized for streaming)
 * - Shows a streaming indicator for in-progress messages
 */
export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Role and timestamp header */}
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-xs",
            isUser ? "justify-end text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          <span className="font-medium">
            {isUser ? "You" : "Assistant"}
          </span>
          <span>{formatTimestamp(message.timestamp)}</span>
        </div>

        {/* Message content */}
        <div
          className={cn(
            "prose prose-sm max-w-none",
            isUser
              ? "prose-invert"
              : "prose-neutral dark:prose-invert"
          )}
        >
          {isUser ? (
            // User messages are plain text (no markdown)
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>
          ) : (
            // Assistant messages use streamdown for markdown rendering
            <Streamdown>{message.content}</Streamdown>
          )}
        </div>

        {/* Streaming indicator */}
        {isStreaming && !isUser && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Typing</span>
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
