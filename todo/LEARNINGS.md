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

## snapshot-list-command

- **Reusing utility functions**: The `listSnapshots()` function from `utils.ts` already handles all the heavy lifting (sorting by timestamp descending, filtering invalid directories). The command handler is a thin wrapper that formats output.
- **ISO 8601 timestamps**: JavaScript's `Date.toISOString()` produces the standard ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`) which is both human-readable and machine-parseable.
- **Exit code semantics**: Unlike `snapshot latest` which exits with code 1 when no snapshots exist (because it's an error condition), `snapshot list` exits with code 0 even when empty - an empty list is a valid result, not an error.
- **Script-friendly output format**: Using `<timestamp> <path>` with a space separator makes it easy to parse with standard Unix tools like `cut -d' ' -f2` or `while read timestamp path`.
- **Test coverage strategy**: Since `listSnapshots()` is already thoroughly tested in `utils.test.ts`, the command tests focus on output format (ISO 8601) and integration aspects rather than re-testing edge cases.

## snapshot-create-subcommand

- **Backward compatibility pattern**: To add a new subcommand while keeping the parent command working, extract shared logic into a helper function (e.g., `executeSnapshotCreate()`). Both the parent's default `.action()` and the subcommand's `.action()` call the same function.
- **Commander.js subcommand with default action**: A command can have both a default action (when called without subcommand) and explicit subcommands. The default action is triggered when no subcommand is provided.
- **Test strategy for thin wrappers**: When the command handler is just a thin wrapper around shared logic, tests can focus on verifying the Commander.js structure is correct (subcommands exist, descriptions are set) rather than duplicating extensive logic tests.
- **Documentation updates**: When adding alternative ways to invoke the same functionality, document both the explicit form (`snapshot create`) and the shorthand (`snapshot`) to help users choose based on clarity needs (scripts vs interactive use).
