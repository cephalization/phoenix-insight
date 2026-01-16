/**
 * ReportPanel component that composes report functionality.
 * - Displays report with header toolbar
 * - Provides download as markdown
 * - Shows report history in a dialog
 * - Integrates with report store and IndexedDB persistence
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReportRenderer } from "./ReportRenderer";
import { ReportHistoryDialog } from "./ReportHistoryDialog";
import { useReportStore } from "@/store/report";
import { exportReportAsMarkdown } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { UITree } from "@/lib/json-render/catalog";

export interface ReportPanelProps {
  /** Optional className for the container */
  className?: string;
  /** Whether the report is currently streaming */
  isStreaming?: boolean;
}

/**
 * Download icon for export button
 */
function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/**
 * History icon for dialog trigger
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
 * Format a timestamp as a human-readable date/time string
 */
function formatReportDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Download a string as a file
 */
function downloadAsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ReportPanel - Main report interface component
 *
 * Features:
 * - Header toolbar with title, download, and history buttons
 * - ReportRenderer integration for displaying report content
 * - History dialog showing all cached reports with view/delete/download actions
 */
export function ReportPanel({ className, isStreaming = false }: ReportPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  // Report store selectors
  const getCurrentReport = useReportStore((state) => state.getCurrentReport);

  // Get current report
  const currentReport = getCurrentReport();

  // Handle downloading current report as markdown
  const handleDownload = useCallback(() => {
    if (!currentReport) return;

    const markdown = exportReportAsMarkdown(currentReport);
    const filename = `${currentReport.title ?? "report"}-${currentReport.id}.md`;
    downloadAsFile(markdown, filename);
  }, [currentReport]);

  // Get report display title
  const getReportTitle = (report: { id: string; title?: string; createdAt: number }): string => {
    return report.title ?? `Report ${formatReportDate(report.createdAt)}`;
  };

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      {/* Header toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="truncate text-sm font-medium">
          {currentReport ? getReportTitle(currentReport) : "No Report"}
        </span>

        <div className="flex items-center gap-1">
          {/* Download button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={!currentReport}
            aria-label="Download as markdown"
          >
            <DownloadIcon className="h-4 w-4" />
          </Button>

          {/* History button / dialog */}
          <ReportHistoryDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                aria-label="Report history"
              >
                <HistoryIcon className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </div>

      {/* Report content */}
      <ScrollArea className="min-h-0 flex-1">
        <ReportRenderer
          report={currentReport ? (currentReport.content as unknown as UITree) : null}
          isStreaming={isStreaming}
        />
      </ScrollArea>
    </div>
  );
}

export default ReportPanel;
