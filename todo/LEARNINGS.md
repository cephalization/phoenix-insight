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

## add-snapshot-utils

- **Directory structure**: Snapshots are stored in `~/.phoenix-insight/snapshots/<timestamp>-<random>/phoenix/`. The `LocalMode` class creates directories with format `Date.now()-<randomSuffix>`.
- **Timezone gotcha**: When validating timestamp years from directory names, use `getUTCFullYear()` instead of `getFullYear()` to avoid timezone-related failures in tests.
- **Testing pattern**: Mock `node:fs/promises` and `node:os` before importing the module under test. The existing test files (e.g., `local-mode.test.ts`) provide good patterns for mocking filesystem operations.
- **Edge cases handled**: No snapshots directory, empty directory, invalid directory name format, missing phoenix subdirectory, concurrent access.
- **Utility exports**: The new `utils.ts` exports `listSnapshots()`, `getLatestSnapshot()`, `getSnapshotsDir()`, and `SnapshotInfo` interface for use by subsequent commands.
