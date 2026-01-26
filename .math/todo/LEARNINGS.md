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

## track-generate-report-tool

- The useWebSocket hook uses `useCallback` with a dependency array for the `handleMessage` function - when adding new store selectors/actions, remember to add them to this dependency array
- Pattern for tracking specific tool execution: check `toolName` in both `tool_call` (set true) and `tool_result` (set false) handlers
- Also reset `isGeneratingReport` in `done` and `error` handlers as a safety net - if the tool_result message is missed or an error occurs, we don't want to leave the UI in a stuck generating state
- The existing test structure in `useWebSocket.test.ts` uses a mock `mockClient` that stores handlers (messageHandler, openHandler, etc.) which can be called in tests to simulate server messages
- When testing state changes from different stores (chat vs report), make sure to import both stores and update their state in `beforeEach` to ensure test isolation
- Added 6 new tests covering: tool_call setting isGeneratingReport for generate_report, tool_call not setting it for other tools, tool_result clearing it for generate_report, tool_result not clearing it for other tools, error handler clearing it, and done handler clearing it
