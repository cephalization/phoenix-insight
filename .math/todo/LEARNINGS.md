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

## export-websocket-types

- The UI package uses pnpm workspaces with `"workspace:*"` dependency in CLI's package.json to reference the UI package
- For ESM packages, the `exports` field needs both `types` and `import` conditions pointing to source `.ts` files (since this is a private package consumed within the monorepo)
- The barrel file pattern (`src/lib/types.ts`) using `export type { ... } from "./websocket"` works well for re-exporting types
- Pre-existing test failures in `registry.test.tsx` and `catalog.test.ts` exist in the UI package (related to a missing `registry` export and Chart component count mismatch) - these are unrelated to this task
- CLI package typecheck and all 534 tests pass with the new export - verified import works with `npx tsx` test script
