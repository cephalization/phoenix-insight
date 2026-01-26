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
