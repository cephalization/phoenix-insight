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

## update-package-json

- The `publishConfig.access: "public"` is required for scoped packages (`@cephalization/phoenix-insight`) to be published publicly on npm
- Added `pxi` as a shorter bin alias alongside `phoenix-insight` - both point to the same `./dist/cli.js` entry point
- Updated all GitHub URLs from Arize-ai/phoenix monorepo to cephalization/phoenix-insight standalone repo
- Standard homepage URL format includes `#readme` suffix: `https://github.com/cephalization/phoenix-insight#readme`
- This is a config-only change - no tests required per PROMPT.md guidelines

## install-changesets

- `pnpm changeset init` creates a `.changeset/` directory with `config.json` and `README.md`
- The default config sets `access` to "restricted" - must change to "public" for scoped public packages
- The default config already sets `baseBranch` to "main" (no change needed)
- `pnpm changeset status` will error with "no changesets found" if there are uncommitted changes - this is expected behavior, not a failure
- The "Opening `/dev/tty` failed" warning is benign in non-interactive environments (CI, automated scripts) - changesets still works correctly
- Config-only task - no tests required per PROMPT.md guidelines
