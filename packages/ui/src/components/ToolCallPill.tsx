/**
 * ToolCallPill - A pill/chip component for displaying tool calls.
 * Shows tool name with icon, expandable to see full parameters and results.
 */

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/store/chat";

export interface ToolCallPillProps {
  /** The tool call to display */
  toolCall: ToolCall;
  /** Optional className for the container */
  className?: string;
}

/**
 * Get a friendly display name for a tool
 */
function getToolDisplayName(toolName: string): string {
  const nameMap: Record<string, string> = {
    bash: "Shell Command",
    px_fetch_more_spans: "Fetch Spans",
    px_fetch_more_trace: "Fetch Trace",
    generate_report: "Generate Report",
  };
  return nameMap[toolName] ?? toolName.replace(/_/g, " ");
}

/**
 * Get an icon for a tool
 */
function ToolIcon({
  toolName,
  className,
}: {
  toolName: string;
  className?: string;
}) {
  // Different icons for different tool types
  switch (toolName) {
    case "bash":
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
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    case "px_fetch_more_spans":
    case "px_fetch_more_trace":
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "generate_report":
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
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    default:
      // Generic tool icon (wrench)
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
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
  }
}

/**
 * Chevron icon for expand/collapse
 */
function ChevronIcon({
  isOpen,
  className,
}: {
  isOpen: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        className,
        "transition-transform duration-200",
        isOpen && "rotate-180"
      )}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Spinner for pending status
 */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className, "animate-spin")}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * Check icon for completed status
 */
function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Format JSON for display (truncated for pill preview)
 * Extracts key info for common tools to show meaningful preview
 */
function formatArgsPreview(args: unknown, toolName: string): string {
  if (!args) return "";
  if (typeof args === "string") {
    return args.length > 40 ? args.slice(0, 40) + "…" : args;
  }

  try {
    // For bash/shell commands, show the command itself
    if (toolName === "bash" && typeof args === "object" && args !== null) {
      const argsObj = args as Record<string, unknown>;
      if (argsObj.command && typeof argsObj.command === "string") {
        const cmd = argsObj.command;
        return cmd.length > 40 ? cmd.slice(0, 40) + "…" : cmd;
      }
    }

    // For other tools, stringify and truncate
    const str = JSON.stringify(args);
    if (str === "{}") return "";
    if (str.length > 40) {
      return str.slice(0, 40) + "…";
    }
    return str;
  } catch {
    return String(args);
  }
}

/**
 * Format JSON for expanded display
 */
function formatJsonExpanded(value: unknown): string {
  if (!value) return "null";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * ToolCallPill component - displays a tool call as an expandable pill
 * Shows tool name with a truncated args preview, expandable on click
 */
export function ToolCallPill({ toolCall, className }: ToolCallPillProps) {
  const [isOpen, setIsOpen] = useState(false);

  const displayName = getToolDisplayName(toolCall.toolName);
  const isPending = toolCall.status === "pending";

  // Check if we have details to show (args can be {} which is truthy but empty)
  const hasArgs =
    toolCall.args !== undefined &&
    toolCall.args !== null &&
    (typeof toolCall.args !== "object" ||
      Object.keys(toolCall.args as object).length > 0);
  const hasResult = toolCall.result !== undefined && toolCall.result !== null;
  const hasDetails = hasArgs || hasResult;

  // Get truncated args preview for inline display
  const argsPreview = hasArgs
    ? formatArgsPreview(toolCall.args, toolCall.toolName)
    : "";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild disabled={!hasDetails}>
        <button
          className={cn(
            "group inline-flex max-w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPending
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            hasDetails && "hover:bg-accent/50 cursor-pointer",
            !hasDetails && "cursor-default"
          )}
        >
          {/* Tool icon */}
          <ToolIcon
            toolName={toolCall.toolName}
            className="h-3.5 w-3.5 shrink-0"
          />

          {/* Tool name */}
          <span className="shrink-0 font-semibold">{displayName}</span>

          {/* Args preview - truncated, semi-transparent */}
          {argsPreview && (
            <span className="min-w-0 truncate font-mono text-[10px] opacity-60">
              {argsPreview}
            </span>
          )}

          {/* Status indicator */}
          {isPending ? (
            <Spinner className="h-3 w-3 shrink-0" />
          ) : (
            <CheckIcon className="h-3 w-3 shrink-0" />
          )}

          {/* Expand indicator (only if has details) */}
          {hasDetails && (
            <ChevronIcon
              isOpen={isOpen}
              className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100"
            />
          )}
        </button>
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent className="mt-2 overflow-hidden animate-in slide-in-from-top-1 duration-200">
          <div className="rounded-lg border bg-background/80 p-3 text-xs shadow-sm backdrop-blur-sm">
            {/* Arguments section */}
            {hasArgs && (
              <div className={hasResult ? "mb-3" : ""}>
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 17l6-6-6-6M12 19h8" />
                  </svg>
                  Input
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">
                  {formatJsonExpanded(toolCall.args)}
                </pre>
              </div>
            )}

            {/* Result section */}
            {hasResult && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  Output
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">
                  {formatJsonExpanded(toolCall.result)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

/**
 * ToolCallList - Displays a list of tool calls
 */
export interface ToolCallListProps {
  toolCalls: ToolCall[];
  className?: string;
}

export function ToolCallList({ toolCalls, className }: ToolCallListProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {toolCalls.map((toolCall) => (
        <ToolCallPill key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}
