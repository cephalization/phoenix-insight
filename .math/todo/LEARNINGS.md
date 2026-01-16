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

## monorepo-init

- Converted the existing single-package root package.json into a workspace root by making it `private: true` and moving shared devDependencies
- The workspace scripts use `pnpm -r run <script>` to run scripts across all packages
- The pnpm-workspace.yaml file uses `packages/*` glob to match all packages in the packages directory
- The next task (move-cli-package) needs to recreate package.json inside packages/cli/ with all the CLI-specific dependencies that were removed from root (like @ai-sdk/anthropic, commander, etc.)
- Updated .gitignore to use `packages/*/dist/` pattern for ignoring build outputs in all packages
- The root package name changed to `phoenix-insight-monorepo` (private) - the CLI package should retain the original name `@cephalization/phoenix-insight`
