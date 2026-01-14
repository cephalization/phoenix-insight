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

## snapshot-latest-command

- **Commander.js subcommands**: To add subcommands to an existing command, assign the parent command to a variable (`const snapshotCmd = program.command("snapshot")`) and then chain `.command("latest")` on it. The parent command can still have its own `.action()` for backward compatibility.
- **Clean output pattern**: For CLI commands that are meant to be consumed by scripts, output only the essential data to stdout (e.g., just the path) and use stderr for error messages. This allows easy piping: `SNAPSHOT_PATH=$(phoenix-insight snapshot latest)`.
- **Exit codes**: Use `process.exit(1)` for error conditions (no snapshots found) to enable proper error handling in shell scripts.
- **Testing commands**: Tests for CLI subcommands can focus on the underlying utility functions (`getLatestSnapshot()`) since the command handler is a thin wrapper. The utils tests already cover the core functionality thoroughly.
- **README updates**: When adding new user-facing commands, update both the "Snapshot Management" examples section and the "Command Reference" section with usage examples.
