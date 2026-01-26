# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## add-manual-selection-tracking

- The report store uses Zustand with `subscribeWithSelector` middleware for reactive persistence to IndexedDB
- When adding new state properties to the store, remember to also update the `beforeEach` reset in tests to include the new state field
- The `setReport()` function handles both creating new reports and updating existing ones (based on sessionId), so `isManuallySelected: false` needs to be set in both code paths
- Pattern: Actions that modify `currentReportId` should consider whether they need to also update `isManuallySelected` to maintain correct state
- The unit tests for the new manual selection functionality will be added in a separate task (`test-report-store-enhancements`) that depends on both `add-manual-selection-tracking` and `add-report-generating-state`

## add-report-generating-state

- Adding a simple boolean state + action to Zustand is straightforward: add to interface, add initial value, add action implementation
- The `isGeneratingReport` state is intentionally separate from `isStreaming` - it tracks specifically when the `generate_report` tool is being called, not general chat streaming
- Added tests that verify: default value is false, setting to true works, setting back to false works, and toggling doesn't affect other state
- Remember to update `beforeEach` in tests when adding new state fields to ensure clean test isolation
- This state will be consumed by WebSocket hook (next task `track-generate-report-tool`) and UI components (`integrate-generating-state-in-report-panel`)
