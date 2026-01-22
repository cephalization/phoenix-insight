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

## cli-import-websocket-types

- When CLI (using `module: nodenext` resolution) imports from UI package (using `moduleResolution: bundler`), the UI barrel file must use explicit `.ts` extensions in re-exports for Node16/NodeNext compatibility
- Fixed UI's `src/lib/types.ts` to use `from "./websocket.ts"` instead of `from "./websocket"` to satisfy CLI's stricter module resolution
- Re-exported the imported types (`export type { ClientMessage, ServerMessage, JSONRenderTree }`) from CLI's websocket.ts so that consumers of the CLI module can still access these types
- Removed ~30 lines of duplicated type definitions from CLI, replaced with 5-line import/re-export pattern
- All 534 CLI tests pass; typecheck passes for both packages
- Pre-existing UI test failures (catalog component count, ReportRenderer mock) remain unrelated to this change

## cli-import-catalog-schemas

- Removed ~90 lines of duplicate Zod schema definitions from `report-tool.ts`, replaced with a single import from `@cephalization/phoenix-insight-ui/catalog`
- The UI schemas use simpler names (e.g., `CardSchema`) while CLI had used `CardPropsSchema` - updated `getPropsSchemaForType()` switch cases accordingly
- Important: The original `UIElementSchema` was missing "Chart" in its type enum - added it to maintain consistency with `VALID_COMPONENT_TYPES` array
- Kept the `UIElementSchema`, `UITreeSchema`, and validation logic in CLI since they're tool-specific (the json-render types from UI don't include the `children` and `parentKey` fields needed for CLI validation)
- All 534 CLI tests pass; typecheck passes for both packages

## dynamic-report-prompt

- Created `generateComponentDocs(catalog)` helper that iterates over `catalog.components` to build documentation dynamically
- Zod schemas can be introspected using `instanceof z.ZodObject` and accessing `.shape` to get the object keys
- For detecting optional props, check for `z.ZodOptional`, `z.ZodNullable`, or use `.isOptional?.()` method (note the optional chaining since not all types have this method)
- The catalog structure provides `props` (Zod schema), `hasChildren` (boolean), and `description` (string) for each component
- Format each component as `- ComponentName: description (props: propA, propB?, propC?; can have children)` where `?` suffix indicates optional props
- Exported `generateComponentDocs` function for testing and potential future use
- Added comprehensive tests: component names, descriptions, prop names, optional markers (`?`), children notes, and formatting
- All 542 CLI tests pass; typecheck passes for both packages
