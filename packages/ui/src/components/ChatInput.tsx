import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ChatInputProps {
  /** Called when the user submits a message */
  onSend: (message: string) => void;
  /** Called when the user cancels streaming */
  onCancel?: () => void;
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Optional className for the container */
  className?: string;
}

/**
 * Connection status indicator component
 */
function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

/**
 * ChatInput component provides a textarea input with send/cancel buttons.
 *
 * Features:
 * - Enter to send, Shift+Enter for newline
 * - Disabled when streaming or disconnected
 * - Connection status indicator
 * - Cancel button during streaming
 */
export function ChatInput({
  onSend,
  onCancel,
  isConnected,
  isStreaming,
  placeholder = "Type a message...",
  className,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus textarea when streaming ends
  useEffect(() => {
    if (!isStreaming && isConnected) {
      textareaRef.current?.focus();
    }
  }, [isStreaming, isConnected]);

  const handleSend = useCallback(() => {
    const trimmedValue = value.trim();
    if (trimmedValue && isConnected && !isStreaming) {
      onSend(trimmedValue);
      setValue("");
    }
  }, [value, isConnected, isStreaming, onSend]);

  const handleCancel = useCallback(() => {
    if (onCancel && isStreaming) {
      onCancel();
    }
  }, [onCancel, isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isInputDisabled = !isConnected || isStreaming;
  const canSend = value.trim().length > 0 && isConnected && !isStreaming;

  return (
    <div className={cn("flex flex-col gap-2 p-4", className)}>
      {/* Connection status indicator */}
      <ConnectionStatus isConnected={isConnected} />

      {/* Input area */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isInputDisabled}
          className={cn(
            "min-h-[80px] max-h-[200px] resize-none",
            isInputDisabled && "cursor-not-allowed opacity-50"
          )}
          aria-label="Chat message input"
        />

        <div className="flex flex-col gap-2">
          {/* Send button - hidden during streaming */}
          {!isStreaming && (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="default"
              aria-label="Send message"
            >
              <SendIcon className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          )}

          {/* Cancel button - visible during streaming */}
          {isStreaming && (
            <Button
              onClick={handleCancel}
              variant="destructive"
              size="default"
              aria-label="Cancel response"
            >
              <StopIcon className="h-4 w-4" />
              <span className="sr-only">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

/**
 * Simple send icon (arrow right/up)
 */
function SendIcon({ className }: { className?: string }) {
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
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/**
 * Simple stop icon (square)
 */
function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
