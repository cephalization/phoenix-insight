/**
 * ReportHistoryDialog component for viewing and managing report history.
 * - Modal dialog showing list of previous reports
 * - Each item shows: title/id, creation date, associated session
 * - Actions per item: view, delete, download as markdown
 * - Integrates with report store and IndexedDB
 */

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReportStore, type Report } from "@/store/report";
import { exportReportAsMarkdown } from "@/lib/db";
import { cn } from "@/lib/utils";

export interface ReportHistoryDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional trigger element - if not provided, use controlled mode only */
  trigger?: React.ReactNode;
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
 * Trash icon for delete button
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
 * Eye icon for view button
 */
function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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
 * Get display title for a report
 */
function getReportTitle(report: { id: string; title?: string; createdAt: number }): string {
  return report.title ?? `Report ${formatReportDate(report.createdAt)}`;
}

/**
 * ReportHistoryDialog - Modal dialog for viewing and managing report history
 *
 * Features:
 * - Lists all reports sorted by date (newest first)
 * - Shows title/id, creation date, session preview for each
 * - View button to switch to a report
 * - Download button to export as markdown
 * - Delete button to remove report
 * - Highlights currently selected report
 */
export function ReportHistoryDialog({
  open,
  onOpenChange,
  trigger,
}: ReportHistoryDialogProps) {
  // Report store selectors
  const reports = useReportStore((state) => state.reports);
  const currentReportId = useReportStore((state) => state.currentReportId);
  const deleteReport = useReportStore((state) => state.deleteReport);

  // Handle downloading a report as markdown
  const handleDownloadReport = useCallback((report: Report) => {
    const markdown = exportReportAsMarkdown(report);
    const filename = `${report.title ?? "report"}-${report.id}.md`;
    downloadAsFile(markdown, filename);
  }, []);

  // Handle viewing a report
  const handleViewReport = useCallback(
    (reportId: string) => {
      useReportStore.setState({ currentReportId: reportId });
      onOpenChange(false);
    },
    [onOpenChange]
  );

  // Handle deleting a report
  const handleDeleteReport = useCallback(
    (reportId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteReport(reportId);
    },
    [deleteReport]
  );

  const dialogContent = (
    <DialogContent className="max-h-[80vh] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Report History</DialogTitle>
        <DialogDescription>
          View, download, or delete your previous reports.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[60vh]">
        {reports.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No reports yet
          </div>
        ) : (
          <div className="flex flex-col gap-2 pr-4">
            {/* Sort reports by createdAt descending (newest first) */}
            {[...reports]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((report) => (
                <div
                  key={report.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border p-3",
                    report.id === currentReportId && "border-primary bg-accent"
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      {getReportTitle(report)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatReportDate(report.createdAt)} &bull; Session:{" "}
                      {report.sessionId.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* View button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleViewReport(report.id)}
                      aria-label={`View ${getReportTitle(report)}`}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>

                    {/* Download button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDownloadReport(report)}
                      aria-label={`Download ${getReportTitle(report)}`}
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => handleDeleteReport(report.id, e)}
                      aria-label={`Delete ${getReportTitle(report)}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </ScrollArea>
    </DialogContent>
  );

  // If trigger is provided, render with DialogTrigger
  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  // Otherwise, render in controlled mode only
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  );
}

export default ReportHistoryDialog;
