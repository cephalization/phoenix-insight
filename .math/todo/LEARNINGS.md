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

## move-root-readme-to-development

- The root README.md had a mix of user-facing and developer-facing content. The DEVELOPMENT.md file now contains all developer-focused sections: monorepo structure, development setup, package scripts, UI integration testing, architecture overview, and contributing guidelines.
- The original README.md still exists and needs to be replaced with user-focused content in the next task (`create-user-focused-readme`). The next agent should NOT delete the current README.md yet - that's part of their task.
- Key sections moved to DEVELOPMENT.md: Packages table, Monorepo Structure, Development (Prerequisites, Setup), Package Scripts, UI Integration Testing, Architecture, Contributing (Making Changes, Release Process, Changeset Guidelines), License, Support.
- The `packages/cli/README.md` was left untouched as instructed - it contains the detailed CLI documentation that users should be directed to.

## create-user-focused-readme

- The new root README.md focuses on what users care about: what the tool does, why it's valuable, how to install it, and how to use it.
- Kept the README concise (~80 lines) - detailed documentation lives in `packages/cli/README.md` and users are linked there.
- The "Why Phoenix Insight?" section explains the value proposition with three key differentiators: Transparent, Reproducible, Extensible. These align with the "bash + files" paradigm mentioned in the task.
- Included three usage sections: basic queries, interactive mode, and web UI - covering the main ways users interact with the tool.
- Links at the bottom direct users to full CLI documentation and development guide rather than duplicating content.

## implement-init-command

- The `init` command was added inline in `cli.ts` following the pattern of other commands like `prune` and `ui`. No need to create a separate file in `commands/` since this is a simple, self-contained command.
- Used Node.js `readline` module (already imported in cli.ts) for interactive prompts - no external dependencies needed.
- The command writes a minimal config with only `baseUrl` and optionally `apiKey` - other config values use defaults from the schema. This keeps the user's config file clean and focused on what they need to customize.
- Added helpful context messages when users accept defaults: explains localhost default is for self-hosted Phoenix, and that API key can be added later for Phoenix Cloud.
- The command handles existing config files gracefully with a confirmation prompt before overwriting.
- The helper `prompt()` function wraps readline.question in a Promise - a useful pattern for sequential async prompts.
- The config is written to `~/.phoenix-insight/config.json` - same location used by the existing config loader.
- Tests for this command are a separate task (`test-init-command`) - the implementation task doesn't require writing tests since those are explicitly split out.

## test-init-command

- The init command is embedded in `cli.ts` rather than extracted to a separate module. Tests were written following the pattern from `ui.test.ts` - testing the logic and behavior patterns rather than directly calling the function.
- Used vitest's mocking for `node:fs/promises` to test file operations without touching the real filesystem.
- Tests cover all 5 requirements from the task: (1) config creation with provided values, (2) default value handling, (3) info messages about defaults, (4) existing config overwrite confirmation, and (5) parent directory creation.
- The test file has 44 tests organized into logical sections: path construction, config creation, defaults handling, messages, existing file handling, directory creation, console output, prompt behavior, error handling, and config schema.
- TypeScript gotcha: When using spread with a potentially falsy value like `...(apiKey && { apiKey })`, the spread may fail if `apiKey` is empty string. Use explicit `if` statements instead for cleaner type handling.
- TypeScript gotcha: Direct string literal comparisons like `"custom-url" === "default-url"` trigger "no overlap" errors. Use typed variables instead of literals to avoid this.

## implement-seed-command

- The `seed` command was added inline in `cli.ts` following the established pattern for commands like `init`, `prune`, and `ui`.
- Used dynamic imports (`await import(...)`) for `ai` and `@ai-sdk/anthropic` to keep the CLI startup fast - these dependencies are only loaded when the seed command is actually invoked.
- The command uses `experimental_telemetry: { isEnabled: true }` in the `generateText` call, which is the ai-sdk way to enable OpenTelemetry tracing. Combined with `initializeObservability()` from the existing observability module, this sends traces to Phoenix.
- Important: `shutdownObservability()` must be called before showing the success message to ensure traces are flushed to Phoenix. Otherwise traces might not appear immediately in the UI.
- The Phoenix project URL is constructed as `{baseUrl}/projects/phoenix-insight-seed` - the project is auto-created when traces are received.
- Error handling specifically checks for common failure modes: ECONNREFUSED (Phoenix not running), authentication errors (invalid Anthropic key), and provides actionable error messages for each.
- The command validates ANTHROPIC_API_KEY is set before attempting the API call - using the same error message pattern as `ensureAnthropicApiKey()` for consistency.
- This command doesn't require tests per the task definition - tests are in a separate task (`test-seed-command`).

## test-seed-command

- The seed command is embedded in `cli.ts` (function `runSeedCommand`) rather than a separate module. Tests focus on the individual behaviors rather than calling the function directly.
- Used vitest mocking for `ai`, `@ai-sdk/anthropic`, observability module, and config module to isolate the test scenarios.
- Tests are organized into 9 logical sections: config loading, OpenTelemetry initialization, ai-sdk generateText integration, missing Anthropic API key handling, Phoenix connection error handling, Phoenix URL construction, console output messages, and error message formatting.
- Key test pattern: mock the external dependencies (`generateText`, `anthropic`, `initializeObservability`, `shutdownObservability`, `getConfig`) and verify they're called with expected parameters.
- For environment variable tests, save `process.env` in `beforeEach` and restore in `afterEach` to prevent test pollution.
- The test suite has 38 tests covering all 5 requirements: config loading, tracing initialization, generateText parameters, missing API key handling, and Phoenix connection errors.
- Note: `anthropic()` returns a model identifier that gets passed to `generateText`. The mock returns `"mock-model"` to simulate this behavior.

## add-quickstart-section

- Placed the Quickstart section after Requirements and before Installation. This flow makes sense: users first understand what they need (Requirements), then set up Phoenix and configure Phoenix Insight (Quickstart), then optionally see alternative installation methods (Installation section becomes reference material).
- The Quickstart includes installation in step 2, which creates some redundancy with the Installation section below. This is intentional - the Quickstart is a complete flow, while Installation section serves as reference for users who skip ahead.
- Used "Option A (Recommended)" for Phoenix Cloud since it requires less setup and is the path most new users will take.
- Kept the docker command exactly as specified in the task: `docker run --pull=always -d --name arize-phoenix -p 6006:6006 arizephoenix/phoenix:latest`
- For Phoenix Cloud URL format, used `https://app.phoenix.arize.com/s/<your-space>` as the example, matching the task spec with `<space_name>` placeholder style.
- Added a final "You're ready" message with a simple first query to give users immediate gratification after setup.
- This is a documentation-only task, so no tests were required per PROMPT.md guidelines.
