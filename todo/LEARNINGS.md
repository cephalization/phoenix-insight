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

## fix-spans-path

- **Root cause**: The `mode.exec()` method runs shell commands with `cwd` set to the mode's working directory. In `SandboxMode`, `cwd=/phoenix` so absolute paths like `/phoenix/projects/index.jsonl` work. In `LocalMode`, `cwd=~/.phoenix-insight/snapshots/{timestamp}/phoenix` so the absolute path `/phoenix/...` doesn't exist on the real filesystem.

- **The fix**: Use **relative paths** in `exec()` commands (e.g., `cat projects/index.jsonl` instead of `cat /phoenix/projects/index.jsonl`). This works in both modes because the relative path resolves correctly against each mode's `cwd`.

- **Key distinction**: `mode.writeFile()` handles path normalization internally (strips `/phoenix` prefix if present), but `mode.exec()` passes commands directly to the shell. This means `writeFile` can use `/phoenix/...` paths, but `exec` should use relative paths.

- **Similar issues exist**: Looking at `src/snapshot/context.ts` and `src/commands/px-fetch-more-trace.ts`, there are more places using absolute paths in `exec()` calls. These will likely need similar fixes to work in LocalMode.

- **Test improvement**: Added an explicit assertion `expect(mockMode.exec).toHaveBeenCalledWith("cat projects/index.jsonl")` to verify the correct relative path is used. This prevents regressions.

## add-spans-debug-logging

- **Pattern used**: Created a `createDebugLogger()` factory function that accepts an optional `debug` boolean parameter. If not provided, it falls back to checking `process.env.DEBUG`. This allows both explicit control via the API (`debug: true`) and implicit control via environment variable (`DEBUG=1`).

- **Debug message format**: All debug messages are prefixed with `[snapshotSpans]` to make it easy to identify the source of logs when troubleshooting. This follows a common logging convention.

- **Key logging points**: Added debug logging at these points:
  1. Reading projects index (before the read)
  2. Empty projects case (when no projects found)
  3. Project count and names (after parsing)
  4. Start of span fetch per project
  5. Completion of span fetch with count
  6. Writing spans file path
  7. Writing metadata file path

- **Testing approach**: Used `vi.spyOn(console, 'log')` to capture console output in tests. Important to remember to clean up in `afterEach` by calling `mockRestore()` and deleting `process.env.DEBUG` to prevent test pollution.

- **SnapshotSpansOptions extended**: Added `debug?: boolean` to the options interface so callers can explicitly enable debug logging without relying on the environment variable. This is useful for programmatic control and testing.
