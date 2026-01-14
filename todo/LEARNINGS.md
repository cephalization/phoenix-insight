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
