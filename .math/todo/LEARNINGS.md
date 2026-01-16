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

## export-catalog-types

- Added `./catalog` export entry to UI package.json following the same pattern as `./types` export
- The `catalog.ts` file already exports: `catalog`, all 11 individual schemas (CardSchema, TextSchema, HeadingSchema, ListSchema, TableSchema, MetricSchema, BadgeSchema, AlertSchema, SeparatorSchema, CodeSchema, ChartSchema), `PhoenixInsightCatalog` type, and re-exports `UITree` and `UIElement` from @json-render/core
- Fixed a pre-existing bug: `registry.tsx` was missing the `registry` object export that `registry.test.tsx` expected - added the export which fixed 3 pre-existing test failures
- Two pre-existing test issues remain unrelated to this task: (1) catalog.test.ts expects 10 components but there are 11 (Chart added later), (2) ReportRenderer.test.tsx has a mock issue with vi.mock not exposing CardRenderer
- Verified CLI can successfully import from `@cephalization/phoenix-insight-ui/catalog` using Node ESM resolution
