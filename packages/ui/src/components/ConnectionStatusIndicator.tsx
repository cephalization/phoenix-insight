/**
 * ConnectionStatusIndicator - Shows connection status in the app header
 *
 * Displays visual feedback for WebSocket connection state:
 * - Connected: Green dot
 * - Connecting: Yellow dot with pulse animation
 * - Disconnected: Red dot
 *
 * Also shows toast notifications on connection state changes.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useChatStore, type ConnectionStatus } from "@/store/chat";
import { cn } from "@/lib/utils";

/**
 * Get status color class based on connection status
 */
function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500";
    case "disconnected":
      return "bg-red-500";
  }
}

/**
 * Get human-readable status text
 */
function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "disconnected":
      return "Disconnected";
  }
}

export interface ConnectionStatusIndicatorProps {
  /** Optional className for the container */
  className?: string;
  /** Whether to show toast notifications (default: true) */
  showToasts?: boolean;
}

/**
 * Connection status indicator for the app header
 */
export function ConnectionStatusIndicator({
  className,
  showToasts = true,
}: ConnectionStatusIndicatorProps) {
  const connectionStatus = useChatStore((state) => state.connectionStatus);
  const previousStatusRef = useRef<ConnectionStatus | null>(null);

  // Show toast notifications on connection state changes
  useEffect(() => {
    // Skip on initial mount (no previous status)
    if (previousStatusRef.current === null) {
      previousStatusRef.current = connectionStatus;
      return;
    }

    // Skip if status hasn't changed
    if (previousStatusRef.current === connectionStatus) {
      return;
    }

    // Show toast based on state transition
    if (showToasts) {
      switch (connectionStatus) {
        case "connected":
          toast.success("Connected to server", {
            description: "Ready to send messages",
            duration: 3000,
          });
          break;
        case "connecting":
          // Only show reconnecting toast if we were previously disconnected
          if (previousStatusRef.current === "disconnected") {
            toast.info("Reconnecting...", {
              description: "Attempting to reconnect to server",
              duration: 3000,
            });
          }
          break;
        case "disconnected":
          toast.error("Disconnected from server", {
            description: "Will attempt to reconnect automatically",
            duration: 5000,
          });
          break;
      }
    }

    previousStatusRef.current = connectionStatus;
  }, [connectionStatus, showToasts]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Status indicator dot */}
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          getStatusColor(connectionStatus),
          // Add pulse animation for connecting state
          connectionStatus === "connecting" && "animate-pulse"
        )}
        aria-hidden="true"
      />
      {/* Status text */}
      <span className="text-sm text-muted-foreground">
        {getStatusText(connectionStatus)}
      </span>
    </div>
  );
}
