import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import type { Message, ToolCall } from "@/store/chat";
import { ToolCallPill } from "./ToolCallPill";

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
 * Represents a segment of content to render - either text or a tool call
 */
type ContentSegment =
  | { type: "text"; content: string }
  | { type: "toolCall"; toolCall: ToolCall };

/**
 * Parses message content and tool calls into interleaved segments for rendering.
 * Uses tool call contentPosition to split text at the right places.
 */
function parseContentSegments(
  content: string,
  toolCalls?: ToolCall[]
): ContentSegment[] {
  // If no tool calls, return just the content (including empty content)
  if (!toolCalls || toolCalls.length === 0) {
    return [{ type: "text", content }];
  }

  // Sort tool calls by position (ascending)
  const sortedToolCalls = [...toolCalls].sort((a, b) => {
    const posA = a.contentPosition ?? 0;
    const posB = b.contentPosition ?? 0;
    return posA - posB;
  });

  // Check if we have position data - if not, fall back to showing all tool calls at the end
  const hasPositionData = sortedToolCalls.some(
    (tc) => tc.contentPosition !== undefined
  );
  if (!hasPositionData) {
    const segments: ContentSegment[] = [];
    if (content) {
      segments.push({ type: "text", content });
    }
    for (const toolCall of sortedToolCalls) {
      segments.push({ type: "toolCall", toolCall });
    }
    return segments;
  }

  // Build interleaved segments based on positions
  const segments: ContentSegment[] = [];
  let lastPosition = 0;

  for (const toolCall of sortedToolCalls) {
    const position = toolCall.contentPosition ?? lastPosition;

    // Add text segment before this tool call (if any)
    if (position > lastPosition) {
      const textContent = content.slice(lastPosition, position);
      if (textContent) {
        segments.push({ type: "text", content: textContent });
      }
    }

    // Add the tool call
    segments.push({ type: "toolCall", toolCall });
    lastPosition = position;
  }

  // Add remaining text after last tool call
  if (lastPosition < content.length) {
    const remainingContent = content.slice(lastPosition);
    if (remainingContent) {
      segments.push({ type: "text", content: remainingContent });
    }
  }

  return segments;
}

/**
 * ChatMessage component displays a single chat message.
 * - User messages are aligned right with primary background
 * - Assistant messages are aligned left with muted background
 * - Uses streamdown for markdown rendering (optimized for streaming)
 * - Tool calls are rendered inline where they occurred in the stream
 * - Shows a streaming indicator for in-progress messages
 */
export function ChatMessage({
  message,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  // Parse content into segments with interleaved tool calls
  const segments = isUser
    ? [{ type: "text" as const, content: message.content }]
    : parseContentSegments(message.content, message.toolCalls);

  return (
    <div
      className={cn(
        "flex min-w-0 w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 overflow-hidden",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {/* Role and timestamp header */}
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-xs",
            isUser
              ? "justify-end text-primary-foreground/70"
              : "text-muted-foreground"
          )}
        >
          <span className="font-medium">{isUser ? "You" : "Assistant"}</span>
          <span>{formatTimestamp(message.timestamp)}</span>
        </div>

        {/* Interleaved content and tool calls */}
        <div className="space-y-2">
          {segments.map((segment, index) => {
            if (segment.type === "text") {
              return (
                <div
                  key={`text-${index}`}
                  className={cn(
                    "prose prose-sm max-w-full overflow-x-auto **:data-[streamdown=code-block-body]:bg-accent-foreground! dark:**:data-[streamdown=code-block-body]:bg-primary-foreground!",
                    isUser ? "prose-invert" : "prose-neutral dark:prose-invert"
                  )}
                >
                  {isUser ? (
                    <p className="m-0 whitespace-pre-wrap break-word">
                      {segment.content}
                    </p>
                  ) : (
                    <Streamdown
                      shikiTheme={["github-dark", "github-dark"]}
                      mode="streaming"
                    >
                      {segment.content}
                    </Streamdown>
                  )}
                </div>
              );
            } else {
              return (
                <div key={`tool-${segment.toolCall.id}`} className="my-2">
                  <ToolCallPill toolCall={segment.toolCall} />
                </div>
              );
            }
          })}
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
