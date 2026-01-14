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

## Phase 1: Fix Span Fetching Bug

### fix-spans-path

- content: Fix absolute path issue in `snapshotSpans` function (`src/snapshot/spans.ts:50-51`). The `mode.exec("cat /phoenix/projects/index.jsonl")` uses an absolute path which doesn't work in LocalMode where the working directory is `~/.phoenix-insight/snapshots/{timestamp}/phoenix`. Change to use a relative path `cat projects/index.jsonl` so it works correctly with the `cwd` set by the execution mode. Update the corresponding test in `test/snapshot/spans.test.ts` to verify the fix.
- status: complete
- dependencies: none

### add-spans-debug-logging

- content: Add optional debug logging to `snapshotSpans` to help diagnose future issues. Log when reading projects index (count found), when starting/completing span fetch per project, and when writing output files. Use a debug flag or environment variable to control verbosity. This helps users understand what's happening during snapshot creation.
- status: complete
- dependencies: fix-spans-path

### verify-spans-integration

- content: Manually verify the fix works end-to-end by running `pnpm dev` against a real Phoenix server with spans. Document the verification steps and results in LEARNINGS.md. This ensures the fix works in real-world conditions, not just in tests.
- status: complete
- dependencies: add-spans-debug-logging

---

## Phase 2: MSW Mock Server for Snapshot Testing

Goal: Set up MSW (Mock Service Worker) to mock Phoenix API responses for reliable snapshot testing without requiring a running Phoenix instance. Keep it simple - happy path testing only.

### msw-research-tooling

- content: Research TypeScript libraries that can generate MSW handlers from OpenAPI schemas. Investigate options like `msw-auto-mock`, `openapi-msw`, `@mswjs/data`, or manual generation approaches. Document findings in LEARNINGS.md with pros/cons of each approach. Recommend the simplest solution that supports: (1) generating handlers from OpenAPI JSON, (2) basic faker-style data generation, (3) ability to switch between success/error responses. The OpenAPI schema is at `https://raw.githubusercontent.com/Arize-ai/phoenix/refs/heads/main/schemas/openapi.json`.
- status: complete
- dependencies: none

### msw-install-deps

- content: Install MSW and any chosen OpenAPI-to-MSW tooling as devDependencies. Run `pnpm add -D msw` plus any additional packages identified in the research task. Verify installation succeeds and MSW version is compatible with Node 18+.
- status: pending
- dependencies: msw-research-tooling

### msw-generator-script

- content: Create `scripts/generate-msw-handlers.ts` that fetches the Phoenix OpenAPI schema and generates MSW handlers. The script should: (1) fetch `https://raw.githubusercontent.com/Arize-ai/phoenix/refs/heads/main/schemas/openapi.json`, (2) generate handlers ONLY for endpoints used by phoenix-insight (`/v1/projects`, `/v1/projects/{id}/spans`, `/v1/datasets`, `/v1/experiments`), (3) output generated handlers to `test/mocks/handlers.ts`, (4) include realistic fake data using faker or simple fixtures. Add a `pnpm generate:mocks` script to package.json.
- status: pending
- dependencies: msw-install-deps

### msw-setup-test-server

- content: Create `test/mocks/server.ts` with MSW server setup for Node.js testing. Import the generated handlers and configure the server. Create `test/mocks/index.ts` as the main export point. The setup should support switching between success/error responses via a simple API (e.g., `server.use(errorHandlers.projects)` to simulate errors).
- status: pending
- dependencies: msw-generator-script

### msw-integrate-vitest

- content: Update `test/setup.ts` to start/stop the MSW server for tests. Configure MSW to intercept fetch requests to the Phoenix API base URL. Ensure MSW plays nicely with existing vitest configuration. The existing `@arizeai/phoenix-client` module mock can be removed if MSW handles all HTTP interception, or kept for unit tests if preferred.
- status: pending
- dependencies: msw-setup-test-server

### msw-snapshot-integration-test

- content: Write an integration test in `test/snapshot/integration.test.ts` that uses MSW to test the full snapshot workflow with mocked Phoenix responses. Test that `snapshotProjects`, `snapshotSpans`, `snapshotDatasets`, and `snapshotExperiments` work correctly with the mocked server. This validates the MSW setup works end-to-end and prevents snapshot functionality from breaking.
- status: pending
- dependencies: msw-integrate-vitest
