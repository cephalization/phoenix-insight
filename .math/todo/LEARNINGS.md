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
