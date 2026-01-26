/**
 * ReportRenderer Component
 *
 * Renders a JSON report using the json-render library with shadcn/ui components.
 * Supports loading states, empty states, and streaming indicators.
 */

import {
  ActionProvider,
  DataProvider,
  Renderer,
  VisibilityProvider,
} from "@json-render/react";
import type { UITree } from "@json-render/core";
import { registry } from "@/lib/json-render/registryManifest";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

export interface ReportRendererProps {
  /** The report content as a JSON render tree, or null if no report */
  report: UITree | null;
  /** Whether the report is currently streaming */
  isStreaming?: boolean;
  /** Whether a report is being generated (generate_report tool is active) */
  isGeneratingReport?: boolean;
}

/**
 * Empty state component shown when no report is available
 */
function EmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-muted p-6">
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium">No Report Yet</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Start a conversation in the chat panel to generate a report. The
          assistant will create structured reports based on your queries.
        </p>
      </div>
    </div>
  );
}

/**
 * Generating skeleton shown while report is being generated
 * Distinct from LoadingSkeleton - shows when generate_report tool is called
 * but no report content exists yet
 */
function GeneratingSkeleton() {
  return (
    <div className="space-y-4 p-4" data-testid="report-generating-skeleton">
      {/* Generating indicator header */}
      <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-4">
        <div className="flex gap-1">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary" />
        </div>
        <span className="font-medium text-primary">Generating report...</span>
      </div>

      {/* Title skeleton with emphasized pulse */}
      <Skeleton className="h-8 w-3/4 animate-pulse" />

      {/* Card skeleton */}
      <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Another card skeleton */}
      <div className="space-y-3 rounded-lg border border-primary/10 bg-primary/5 p-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Metrics row skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 rounded-lg border border-primary/10 bg-primary/5 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="space-y-2 rounded-lg border border-primary/10 bg-primary/5 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton shown while report is streaming
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4" data-testid="report-loading-skeleton">
      {/* Title skeleton */}
      <Skeleton className="h-8 w-3/4" />

      {/* Card skeleton */}
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Another card skeleton */}
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Metrics row skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Streaming indicator shown when report is being updated
 */
function StreamingIndicator() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground"
      data-testid="report-streaming-indicator"
    >
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
      <span>Updating report...</span>
    </div>
  );
}

/**
 * Fallback component for unknown component types
 */
function FallbackComponent({
  element,
}: {
  element: { type: string; props: Record<string, unknown> };
}) {
  return (
    <div className="rounded border border-dashed border-muted-foreground/50 p-2 text-sm text-muted-foreground">
      Unknown component: {element.type}
    </div>
  );
}

/**
 * ReportRenderer - renders a JSON report with shadcn/ui components
 *
 * Shows:
 * - GeneratingSkeleton when generating a new report (isGeneratingReport && !report)
 * - Empty state when no report is available and not generating
 * - Loading skeleton when streaming without content
 * - Report content with streaming indicator when streaming with content
 * - Full report when complete
 */
export function ReportRenderer({
  report,
  isStreaming = false,
  isGeneratingReport = false,
}: ReportRendererProps) {
  // Generating a new report but no content yet - show generating skeleton
  if (isGeneratingReport && !report) {
    return <GeneratingSkeleton />;
  }

  // No report and not streaming/generating - show empty state
  if (!report && !isStreaming) {
    return <EmptyState />;
  }

  // Streaming but no content yet - show loading skeleton
  if (!report && isStreaming) {
    return <LoadingSkeleton />;
  }

  // Have report - render it
  return (
    <div className="flex flex-col">
      {/* Streaming indicator at top when updating */}
      {isStreaming && <StreamingIndicator />}

      {/* Report content */}
      <div className="p-4">
        <DataProvider>
          <VisibilityProvider>
            <ActionProvider>
              <Renderer
                tree={report}
                registry={registry}
                loading={isStreaming}
                fallback={FallbackComponent}
              />
            </ActionProvider>
          </VisibilityProvider>
        </DataProvider>
      </div>
    </div>
  );
}

export { GeneratingSkeleton };
export default ReportRenderer;
