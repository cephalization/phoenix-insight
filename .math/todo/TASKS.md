# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Report Store State Enhancements

### add-manual-selection-tracking

- content: Add `isManuallySelected` boolean state to report store to track when users manually select a report from history vs auto-selection. Add `setCurrentReportManual(reportId)` action to set a report with manual flag, and `clearManualSelection()` to reset the flag. Update `setReport()` to automatically call `clearManualSelection()` when a new report is generated.
- status: complete
- dependencies: none

### add-report-generating-state

- content: Add `isGeneratingReport` boolean state to report store with `setIsGeneratingReport(value)` action. This state tracks when the `generate_report` tool is actively being called (distinct from general chat streaming).
- status: complete
- dependencies: none

---

## Phase 2: WebSocket Integration

### track-generate-report-tool

- content: Update useWebSocket hook to track when `generate_report` tool is called. In the `tool_call` handler, when `toolName === "generate_report"`, call `setIsGeneratingReport(true)`. In the `tool_result` handler, when `toolName === "generate_report"`, call `setIsGeneratingReport(false)`. Also reset `isGeneratingReport` to false in the `done` and `error` handlers.
- status: complete
- dependencies: add-report-generating-state

---

## Phase 3: Session Creation Behavior

### clear-report-on-new-session

- content: Update `createSession()` in chat store to clear the current report selection when a new session is created. After a new session is created, if the current report is NOT manually selected (`!isManuallySelected`), set `currentReportId` to null. This ensures empty state shows for new sessions while preserving manually viewed historical reports.
- status: pending
- dependencies: add-manual-selection-tracking

---

## Phase 4: UI Updates

### update-report-history-manual-selection

- content: Update ReportHistoryDialog to use `setCurrentReportManual()` instead of directly setting `currentReportId` when user clicks "View" on a report. This marks the selection as manual so it persists across new session creation.
- status: pending
- dependencies: add-manual-selection-tracking

### create-report-generating-skeleton

- content: Create a new `GeneratingSkeleton` component in ReportRenderer.tsx for the report generating state. Design should be similar to `LoadingSkeleton` but with visual indication that a report is being generated (e.g., animated pulse effect, "Generating report..." text with bouncing dots). This is distinct from the streaming indicator which shows when a report is being updated.
- status: pending
- dependencies: none

### integrate-generating-state-in-report-panel

- content: Update ReportPanel and ReportRenderer to consume `isGeneratingReport` from report store. Pass it to ReportRenderer alongside existing `isStreaming` prop. In ReportRenderer, show `GeneratingSkeleton` when `isGeneratingReport && !report` (generating a new report). The `LoadingSkeleton` continues to be used when `isStreaming && !report` (streaming updates to existing reports).
- status: pending
- dependencies: create-report-generating-skeleton, add-report-generating-state

---

## Phase 5: Testing

### test-report-store-enhancements

- content: Add unit tests for new report store functionality: `isManuallySelected` state, `setCurrentReportManual()`, `clearManualSelection()`, `isGeneratingReport` state, and `setIsGeneratingReport()`. Verify `setReport()` clears manual selection flag.
- status: pending
- dependencies: add-manual-selection-tracking, add-report-generating-state

### test-session-report-clearing

- content: Add unit tests to verify that creating a new session clears `currentReportId` when not manually selected, and preserves `currentReportId` when manually selected.
- status: pending
- dependencies: clear-report-on-new-session
