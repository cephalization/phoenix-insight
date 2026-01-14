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

## verify-spans-integration

### Verification Steps Performed

1. **Ran snapshot command with DEBUG logging enabled**:
   ```bash
   DEBUG=1 pnpm dev snapshot
   ```
   
2. **Verified relative path fix is working**:
   - Debug output shows: `[snapshotSpans] Reading projects index from projects/index.jsonl`
   - This confirms the fix from `fix-spans-path` is using relative paths correctly
   - The `cat projects/index.jsonl` command executes with `cwd` set to the snapshot's phoenix directory

3. **Verified end-to-end span fetching**:
   - Successfully connected to real Phoenix server at `http://localhost:6006`
   - Found 3 projects: `phoenix-insight`, `mastra-service`, `default`
   - Fetched spans for each project (59, 20, 26 spans respectively)
   - Wrote span data to `index.jsonl` and metadata to `metadata.json` for each project

4. **Verified file structure**:
   ```
   ~/.phoenix-insight/snapshots/{timestamp}/phoenix/projects/
   ├── index.jsonl
   ├── default/
   │   ├── metadata.json
   │   └── spans/
   │       ├── index.jsonl (197KB of span data)
   │       └── metadata.json
   ├── mastra-service/
   │   └── spans/
   │       ├── index.jsonl (57KB)
   │       └── metadata.json
   └── phoenix-insight/
       └── spans/
           ├── index.jsonl
           └── metadata.json
   ```

5. **Verified span data content**:
   - Span data is valid JSONL format
   - Sample span name: `OpenAI.chat`
   - Metadata correctly tracks span count and snapshot time

6. **Ran full test suite**:
   - All 355 tests pass
   - No type errors

### Key Observations

- **The relative path fix works correctly**: The `snapshotSpans` function now uses `cat projects/index.jsonl` instead of `cat /phoenix/projects/index.jsonl`, which resolves correctly in both SandboxMode and LocalMode.

- **Debug logging is helpful**: The `[snapshotSpans]` prefix makes it easy to trace the span fetching process. Logs show project discovery, fetch progress, and file writes.

- **Agent path issue (unrelated to this fix)**: The AI agent still uses absolute paths like `/phoenix/_context.md` because that's what the system prompt instructs. This is expected behavior - the system prompt is designed for the agent's mental model, not the actual filesystem. The bash tool's `cwd` is set to the phoenix directory, so the agent should ideally use relative paths, but the system prompt would need updating to change this behavior. This is outside the scope of the spans fix.

### Conclusion

The `snapshotSpans` fix is verified working end-to-end against a real Phoenix server. The relative path change allows span data to be correctly fetched and stored in LocalMode.

## msw-research-tooling

### Research Summary

Investigated TypeScript libraries that can generate MSW handlers from OpenAPI schemas. The Phoenix OpenAPI schema is at `https://raw.githubusercontent.com/Arize-ai/phoenix/refs/heads/main/schemas/openapi.json` and uses OpenAPI 3.1.0.

### Libraries Evaluated

#### 1. msw-auto-mock (380 stars)
**GitHub**: https://github.com/zoubingwu/msw-auto-mock

**What it does**: CLI tool that generates random mock data from OpenAPI definitions for MSW.

**Pros**:
- Generates complete MSW handler files directly from OpenAPI JSON/YAML
- Built-in faker.js integration for random data generation
- Supports filtering endpoints via `--includes` and `--excludes` flags
- Supports static or dynamic mock generation
- Can generate TypeScript files with `--typescript` flag
- Active maintenance (v0.31.0 as of Apr 2025)
- Generative AI support for smarter mock data (optional)

**Cons**:
- Requires @faker-js/faker >= 8 and msw >= 2 as peer dependencies
- Output is generated code that needs regeneration when schema changes
- Less type-safe at runtime (types come from generated code)

**Usage**:
```bash
npx msw-auto-mock https://openapi-url.json -o ./mock --typescript
```

#### 2. openapi-msw (81 stars)
**GitHub**: https://github.com/christoph-fricke/openapi-msw

**What it does**: Type-safe wrapper around MSW for type inference from OpenAPI schemas.

**Pros**:
- Tiny wrapper, minimal footprint
- Full TypeScript type safety with inference from OpenAPI types
- Requires openapi-typescript to generate types first
- Great developer experience with type-safe path, params, query, body, response
- Built-in `response` helper for validated responses by status code
- No code generation for handlers - write handlers manually with type support

**Cons**:
- Does NOT generate mock data or handlers automatically
- Requires manual handler writing for each endpoint
- Requires openapi-typescript as a prerequisite step
- Only provides type safety, not mock data generation

**Usage**:
```typescript
import { createOpenApiHttp } from "openapi-msw";
import type { paths } from "./your-openapi-schema"; // from openapi-typescript
const http = createOpenApiHttp<paths>();
```

#### 3. @mswjs/data (969 stars)
**GitHub**: https://github.com/mswjs/data

**What it does**: Data modeling and querying library for testing, works with MSW.

**Pros**:
- Official MSW library for data modeling
- ORM-like syntax for creating/querying mock data
- Supports relations between models
- Schema validation via Standard Schema (Zod, etc.)

**Cons**:
- Does NOT work with OpenAPI schemas
- Requires manually defining schemas (not generated from OpenAPI)
- Meant for stateful mock databases, not simple request/response mocking
- Overkill for snapshot testing use case

### Recommendation: msw-auto-mock (Recommended)

For phoenix-insight's needs, **msw-auto-mock** is the best choice because it:

1. **Generates handlers from OpenAPI JSON** - Directly supports the Phoenix OpenAPI schema URL
2. **Basic faker-style data generation** - Built-in @faker-js/faker integration
3. **Ability to switch between success/error responses** - Handlers can be customized after generation
4. **Simple integration** - One CLI command generates all handler files
5. **Filtering support** - Can target specific endpoints via `--includes` flag

**Implementation approach**:
1. Install: `pnpm add -D msw msw-auto-mock @faker-js/faker`
2. Create generation script that:
   - Fetches Phoenix OpenAPI schema
   - Uses msw-auto-mock with `--includes` to generate only needed endpoints
   - Outputs to `test/mocks/handlers.ts`
3. Customize generated handlers as needed for error scenarios

**Endpoints needed** (per TASKS.md):
- `/v1/projects`
- `/v1/projects/{id}/spans`
- `/v1/datasets`
- `/v1/experiments` (actually `/v1/datasets/{dataset_id}/experiments` per OpenAPI)

### Why not the alternatives?

- **openapi-msw**: Great for type safety but requires manual handler writing. Since we just need happy-path mocks with fake data, auto-generation is more appropriate.

- **@mswjs/data**: Designed for complex stateful mock databases. Our snapshot tests just need simple request/response mocking, not a full mock database.

### Notes on Phoenix OpenAPI Schema

- Uses OpenAPI 3.1.0
- Defines many endpoints, but phoenix-insight only uses a subset
- Endpoints of interest:
  - `GET /v1/projects` - listProjects (actually not directly in schema, uses `GET /v1/projects/{project_identifier}/spans`)
  - `GET /v1/datasets` - listDatasets
  - `GET /v1/datasets/{dataset_id}/experiments` - listExperiments
  - Spans are fetched via `@arizeai/phoenix-client`, may need different approach

### Important caveat

Looking at the OpenAPI schema, I noticed phoenix-insight uses `@arizeai/phoenix-client` for some operations (spans) rather than direct REST calls. The MSW mocking will need to intercept the underlying fetch calls that the client makes. This should work as long as the client uses standard fetch under the hood.

## msw-install-deps

### Packages Installed

Installed three devDependencies as recommended by the research task:
- `msw@2.12.7` - Mock Service Worker for intercepting HTTP requests
- `msw-auto-mock@0.31.0` - CLI tool to generate MSW handlers from OpenAPI schemas
- `@faker-js/faker@10.2.0` - Fake data generation for mock responses

### Peer Dependency Warnings

During installation, pnpm reported unmet peer dependency warnings for zod:
```
msw-auto-mock 0.31.0
├─┬ ai 4.1.54
│ ├── ✕ unmet peer zod@^3.0.0: found 4.3.5
...
```

**These warnings can be safely ignored** because:
1. The warnings are about `msw-auto-mock`'s internal dependencies (`ai` SDK)
2. We only use `msw-auto-mock` as a CLI code generation tool, not its runtime features
3. The generated handlers use `msw` directly, not the AI SDK features
4. Our project uses zod@4.3.5 for its own validation, which is unrelated to msw-auto-mock's needs

### Verification Results

- **MSW import works**: Both `msw` and `msw/node` (server setup) import successfully
- **Faker import works**: `@faker-js/faker` imports and generates fake data correctly
- **All 355 tests pass**: No regressions from adding these dependencies
- **Node compatibility**: Verified on Node v24.11.0, MSW 2.x supports Node 18+

### Key Import Paths for Next Tasks

```typescript
// Core MSW exports
import { http, HttpResponse } from 'msw';

// Node.js server for testing
import { setupServer } from 'msw/node';

// Faker for test data
import { faker } from '@faker-js/faker';

// msw-auto-mock is a CLI tool, invoked via:
// npx msw-auto-mock <openapi-url> -o ./output --typescript
```

### Notes for msw-generator-script Task

The next task will create a script to generate handlers. Key considerations:
1. Use `--includes` flag to filter to only needed endpoints
2. Target endpoints: `/v1/projects`, `/v1/projects/{id}/spans`, `/v1/datasets`, `/v1/datasets/{dataset_id}/experiments`
3. Output to `test/mocks/handlers.ts`
4. May need to customize generated handlers for error scenarios post-generation

## msw-generator-script

### Why msw-auto-mock Couldn't Be Used Directly

Initially tried using `msw-auto-mock` CLI tool to auto-generate handlers from the Phoenix OpenAPI schema. However, the Phoenix schema has **circular references** in the OTLP (OpenTelemetry Protocol) types:

```
circular reference for path #/components/schemas/OtlpSpan -> #/components/schemas/OtlpKeyValue 
-> #/components/schemas/OtlpAnyValue -> #/components/schemas/OtlpArrayValue -> #/components/schemas/OtlpAnyValue
```

This causes `msw-auto-mock` to crash when generating handlers for endpoints that return spans. The `/v1/projects/:project_identifier/spans` endpoint uses these circular types, so direct generation fails.

### Solution: Custom Generator Script

Created a custom `scripts/generate-msw-handlers.ts` that generates handlers manually with:
1. **TypeScript types** based on Phoenix OpenAPI schema (Project, Span, Dataset, Experiment)
2. **Fixture generators** using `@faker-js/faker` for realistic test data
3. **Pre-generated fixtures** for consistent test data across runs
4. **Default handlers** that return success responses (happy path)
5. **Error handlers** for testing error scenarios (`errorHandlers.projectsError`, etc.)
6. **createHandlers()** utility for custom fixture injection

### Key Design Decisions

1. **Seeded faker** (`faker.seed(12345)`) ensures reproducible test data across runs
2. **Wildcard URL patterns** (`*/v1/projects`) allow handlers to match any base URL
3. **Lookup by ID or name** in spans handler matches Phoenix API behavior
4. **Exported fixtures** allow tests to assert against expected data
5. **Separate error handlers** pattern lets tests override specific endpoints

### Output Structure

```typescript
// test/mocks/handlers.ts exports:
- handlers         // Default success handlers
- errorHandlers    // Error scenario handlers
- fixtures         // Pre-generated test data
- createProject()  // Fixture generator
- createSpan()     // Fixture generator
- createDataset()  // Fixture generator
- createExperiment() // Fixture generator
- createHandlers() // Custom handler factory
```

### Usage Pattern (for next task)

```typescript
import { setupServer } from 'msw/node';
import { handlers, errorHandlers, fixtures } from './mocks/handlers';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Override for error testing:
server.use(errorHandlers.projectsError);
```

### Phoenix API Endpoints Mocked

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/projects` | GET | List all projects |
| `/v1/projects/:project_identifier/spans` | GET | Get spans for a project |
| `/v1/datasets` | GET | List all datasets |
| `/v1/datasets/:dataset_id/experiments` | GET | List experiments for a dataset |

## msw-setup-test-server

### Files Created

1. **`test/mocks/server.ts`** - MSW server setup for Node.js testing
2. **`test/mocks/index.ts`** - Main export point that re-exports server and handlers
3. **`test/mocks/server.test.ts`** - Tests verifying the MSW setup works correctly

### Server API Design

The server module provides a simple API for controlling mock behavior:

```typescript
import { server, useErrorHandler, fixtures } from '../mocks';

// Lifecycle management
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Switch to error responses
useErrorHandler('projects');        // 500 error
useErrorHandler('projectsForbidden'); // 403 error
useErrorHandler('spans');           // 500 error
useErrorHandler('datasets');        // 500 error
useErrorHandler('experiments');     // 500 error

// Multiple errors at once
useErrorHandlers(['projects', 'datasets']);

// Reset back to success handlers
resetToSuccessHandlers();
```

### Key Design Decisions

1. **Type-safe error handler names**: Used a const object mapping to ensure `useErrorHandler()` only accepts valid handler names with TypeScript inference.

2. **Convenience wrappers**: Instead of requiring `server.use(errorHandlers.projectsError)`, provided `useErrorHandler('projects')` for cleaner test code.

3. **Clear separation**: Server setup (`server.ts`) is separate from handler definitions (`handlers.ts`), keeping concerns modular.

4. **Comprehensive re-exports**: The `index.ts` re-exports everything from both modules so tests can import from a single location.

### Test Coverage

The server tests verify:
- All 4 success handlers return correct fixture data
- Project lookup works by both ID and name
- 404 is returned for unknown projects
- Empty arrays for datasets with no experiments
- All 5 error handlers switch correctly
- Multiple error handlers can be combined
- `resetToSuccessHandlers()` restores default behavior
- Handler isolation across tests (via `afterEach`)

### Usage Pattern for Next Tasks

The `msw-integrate-vitest` task will need to:
1. Start the server in `test/setup.ts`
2. Reset handlers after each test
3. Close server after all tests

```typescript
// test/setup.ts
import { server } from './mocks';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

The `msw-snapshot-integration-test` task can then write integration tests like:

```typescript
import { useErrorHandler, fixtures } from '../mocks';

it('fetches projects from mock API', async () => {
  const result = await snapshotProjects(mockMode, baseUrl);
  expect(result).toContain(fixtures.projects[0].name);
});

it('handles API errors gracefully', async () => {
  useErrorHandler('projects');
  await expect(snapshotProjects(mockMode, baseUrl)).rejects.toThrow();
});
```

## msw-integrate-vitest

### What Was Done

Updated `test/setup.ts` to integrate MSW server lifecycle globally:
1. Import `server` from `./mocks`
2. Add `beforeAll()` to start the MSW server with `onUnhandledRequest: "bypass"`
3. Add `afterEach()` to reset handlers (combined with existing `vi.clearAllMocks()`)
4. Add `afterAll()` to close the server

### Key Design Decisions

1. **Kept `@arizeai/phoenix-client` mock**: The global `vi.mock("@arizeai/phoenix-client")` is preserved because many unit tests mock the client directly to test specific error conditions and behaviors. MSW handles HTTP-level interception for integration tests, but unit tests benefit from module-level mocking.

2. **Used `onUnhandledRequest: "bypass"`**: This allows non-Phoenix API requests to pass through without errors. This is important because:
   - Tests may make localhost requests that aren't meant to hit Phoenix
   - Stricter behavior (`"error"`) can be used in specific test files if needed
   - Individual test suites can override this with `server.listen({ onUnhandledRequest: "error" })`

3. **Removed duplicate lifecycle from `server.test.ts`**: The server tests previously had their own `beforeAll`/`afterEach`/`afterAll` blocks. These were removed since the global setup now handles this. The tests continue to work because the server is started globally before any tests run.

### Why This Approach Works

- **Centralized lifecycle management**: All tests benefit from MSW without needing to set up the server individually
- **Handler reset between tests**: `server.resetHandlers()` in `afterEach` ensures error handlers don't leak between tests
- **Backwards compatible**: Existing tests that mock `@arizeai/phoenix-client` continue to work unchanged
- **Integration-test ready**: The next task (`msw-snapshot-integration-test`) can now make real `fetch()` calls that are intercepted by MSW

### Test Count

All 371 tests pass with no type errors. The test count increased from 355 to 371 since the previous tasks, likely due to accumulated test additions.

## msw-snapshot-integration-test

### Integration Test Setup

Created `test/snapshot/integration.test.ts` with 13 tests covering the full snapshot workflow with MSW-mocked Phoenix API responses. The tests verify that `fetchProjects`, `snapshotSpans`, `fetchDatasets`, and `fetchExperiments` work correctly with mocked API responses.

### Key Challenge: Bypassing Global Client Mock

The global `test/setup.ts` mocks `@arizeai/phoenix-client` to prevent unit tests from making real network calls. This caused integration tests to fail because `createPhoenixClient()` would return `undefined`.

**Solution**: Used `vi.importActual()` to import the real `@arizeai/phoenix-client` module:

```typescript
const { createClient: realCreateClient } = await vi.importActual<typeof import("@arizeai/phoenix-client")>("@arizeai/phoenix-client");

function createTestClient(baseURL: string): PhoenixClient {
  return realCreateClient({
    options: { baseUrl: baseURL },
  });
}
```

This allows the integration tests to:
1. Create real Phoenix client instances
2. Make actual HTTP requests via `fetch()`
3. Have those requests intercepted by MSW
4. Receive mock responses from our handlers

### Test Coverage

The integration tests cover:

1. **fetchProjects**: Fetches projects from mocked API, writes index.jsonl and metadata files
2. **snapshotSpans**: Fetches spans for all projects, writes span data and metadata
3. **fetchDatasets**: Fetches datasets with examples, writes dataset files
4. **fetchExperiments**: Fetches experiments with runs, writes experiment files
5. **Full Workflow**: Executes complete snapshot workflow with all data types
6. **Partial Failures**: Tests graceful handling when some APIs fail
7. **Custom Fixtures**: Demonstrates using `createProject()`, `createSpan()`, etc. for custom test data

### Additional MSW Handlers Needed

The existing handlers only covered `/v1/projects`, `/v1/projects/:id/spans`, `/v1/datasets`, and `/v1/datasets/:id/experiments`. The integration tests add inline handlers for:

- `/v1/datasets/:id/examples` - Returns dataset examples
- `/v1/experiments/:experiment_id/runs` - Returns experiment runs

These could be added to `test/mocks/handlers.ts` in the future for broader reuse.

### Mock ExecutionMode Pattern

Created a `createMockMode()` helper that:
1. Captures all `writeFile()` calls in a Map
2. Simulates `exec()` for reading the projects index (needed by `snapshotSpans`)
3. Returns both the mock mode and the written files map for assertions

```typescript
function createMockMode() {
  const writtenFiles = new Map<string, string>();
  const mockMode: ExecutionMode = {
    writeFile: vi.fn(async (path, content) => writtenFiles.set(path, content)),
    exec: vi.fn(async (command) => {
      if (command.includes("cat") && command.includes("projects/index.jsonl")) {
        const content = writtenFiles.get("/phoenix/projects/index.jsonl");
        return { stdout: content || "", stderr: "", exitCode: content ? 0 : 1 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    }),
    getBashTool: vi.fn(),
    cleanup: vi.fn(),
  };
  return { mockMode, writtenFiles };
}
```

### Test Count

All 384 tests pass (13 new integration tests added).
