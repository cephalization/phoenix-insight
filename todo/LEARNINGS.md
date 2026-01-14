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
