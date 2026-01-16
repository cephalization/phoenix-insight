# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Export Shared Types from UI Package

### export-websocket-types

- content: Add exports for WebSocket message types (`ClientMessage`, `ServerMessage`, `JSONRenderTree`) from UI package. Update `packages/ui/package.json` to add an `exports` field that exposes `./types` entry pointing to a new `src/lib/types.ts` barrel file. The barrel should re-export WebSocket types from `src/lib/websocket.ts`.
- status: complete
- dependencies: none

### export-catalog-types

- content: Export component catalog and schemas from UI package. Add `./catalog` export entry in `packages/ui/package.json` pointing to `src/lib/json-render/catalog.ts`. Ensure `catalog`, all individual schemas (CardSchema, TextSchema, etc.), and types (`UITree`, `UIElement`, `PhoenixInsightCatalog`) are exported.
- status: complete
- dependencies: none

---

## Phase 2: Update CLI to Import Shared Types

### cli-import-websocket-types

- content: Remove duplicate WebSocket type definitions from `packages/cli/src/server/websocket.ts`. Import `ClientMessage`, `ServerMessage`, and `JSONRenderTree` from `@cephalization/phoenix-insight-ui/types`. Keep the WebSocket server implementation code, only remove the duplicated type definitions.
- status: complete
- dependencies: export-websocket-types

### cli-import-catalog-schemas

- content: Remove duplicate Zod schemas from `packages/cli/src/commands/report-tool.ts` (lines 20-110 approximately). Import all component schemas (`CardSchema`, `TextSchema`, etc.) from `@cephalization/phoenix-insight-ui/catalog`. Update `getPropsSchemaForType()` to use the imported schemas. Keep the `UITreeSchema`, `UIElementSchema`, and validation logic in CLI since they're specific to the tool's validation needs.
- status: complete
- dependencies: export-catalog-types

---

## Phase 3: Dynamic Report Tool Prompt

### dynamic-report-prompt

- content: Refactor `createReportTool()` in `packages/cli/src/commands/report-tool.ts` to generate its description dynamically from the catalog. Import `catalog` from `@cephalization/phoenix-insight-ui/catalog`. Create a helper function `generateComponentDocs(catalog)` that iterates over `catalog.components` and builds a description string using each component's `description` field and inferred prop names from the schema. Replace the hardcoded component list in the tool description with the dynamically generated documentation.
- status: complete
- dependencies: cli-import-catalog-schemas

---

## Phase 4: Verification

### verify-type-sharing

- content: Run `pnpm -r typecheck` and `pnpm -r test` to verify all type imports resolve correctly and no regressions were introduced. Fix any TypeScript errors or test failures. Verify the CLI can still validate reports and the UI can still receive them by checking existing tests pass.
- status: pending
- dependencies: dynamic-report-prompt
