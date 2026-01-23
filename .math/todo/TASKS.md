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

## Phase 1: Documentation Restructuring

### move-root-readme-to-development

- content: Move the existing root `README.md` content to a new `DEVELOPMENT.md` file in the repo root. This file currently contains monorepo structure, development setup, package scripts, UI integration testing instructions, architecture overview, and contributing guidelines. These are developer-focused and should live in DEVELOPMENT.md. Do NOT modify `packages/cli/README.md` - leave it as is.
- status: complete
- dependencies: none

### create-user-focused-readme

- content: Create a new user-focused `README.md` in the repo root with: (1) Clear project description explaining what Phoenix Insight does - AI-powered analysis of Phoenix observability data using the "bash + files" paradigm, (2) Key features section highlighting transparency, reproducibility, and extensibility, (3) Requirements section (Node.js v22+, Anthropic API key), (4) Installation instructions (`npm install -g @cephalization/phoenix-insight`), (5) Quick usage examples showing basic queries and the `ui` command, (6) Link to `packages/cli/README.md` for full CLI documentation, (7) Link to `DEVELOPMENT.md` for development/contributing. Keep it welcoming for new users while explaining the value proposition.
- status: complete
- dependencies: move-root-readme-to-development

---

## Phase 2: Init Command

### implement-init-command

- content: Add a new `init` subcommand to the CLI that creates a config file at `~/.phoenix-insight/config.json`. The command should: (1) Prompt for Phoenix base URL (default: http://localhost:6006), (2) Prompt for Phoenix API key (default: empty), (3) Show explanation of defaults when user skips input, (4) Write the config file with the provided or default values, (5) Print success message with path to config file. Use Node.js readline for prompts (no external deps).
- status: complete
- dependencies: none

### test-init-command

- content: Write tests for the init command in `packages/cli/test/commands/init.test.ts`. Test: (1) Creates config file with provided values, (2) Uses defaults when user provides empty input, (3) Shows appropriate messages about defaults, (4) Handles existing config file (warn but don't overwrite without confirmation), (5) Creates parent directories if they don't exist.
- status: complete
- dependencies: implement-init-command

---

## Phase 3: Seed Command

### implement-seed-command

- content: Add a new `seed` subcommand to the CLI that sends a traced hello-world message using ai-sdk. The command should: (1) Load config from the config file, (2) Initialize OpenTelemetry tracing to Phoenix, (3) Use ai-sdk `generateText` with a simple "Hello, world! Please respond briefly." message, (4) Stream or print the response, (5) Ensure the trace is sent to Phoenix, (6) Print success message with link to view trace in Phoenix UI. This validates the user's Phoenix setup is working.
- status: complete
- dependencies: implement-init-command

### test-seed-command

- content: Write tests for the seed command in `packages/cli/test/commands/seed.test.ts`. Test: (1) Loads config correctly, (2) Initializes tracing with correct Phoenix endpoint, (3) Calls ai-sdk generateText with expected parameters, (4) Handles missing Anthropic API key gracefully, (5) Handles Phoenix connection errors gracefully. Use vitest mocking for ai-sdk and OpenTelemetry.
- status: complete
- dependencies: implement-seed-command

---

## Phase 4: Final Documentation Polish

### add-quickstart-section

- content: Add a "Quickstart" section to the root README that guides users through: (1) Creating a Phoenix Cloud instance at https://app.phoenix.arize.com, (2) Optionally running self-hosted Phoenix with `docker run --pull=always -d --name arize-phoenix -p 6006:6006 arizephoenix/phoenix:latest`, (3) Running `phoenix-insight init` to generate config, (4) Configuring baseUrl as `https://app.phoenix.arize.com/s/<space_name>` for cloud or `http://localhost:6006` for self-hosted, (5) Running `phoenix-insight seed` to verify setup works. Reference both cloud and self-hosted options.
- status: complete
- dependencies: create-user-focused-readme, implement-init-command, implement-seed-command

### document-init-seed-in-cli-readme

- content: Add documentation for the `init` and `seed` commands to `packages/cli/README.md`. Include them in the Command Reference section with their options, descriptions, and example usage. Follow the existing documentation style for other commands.
- status: pending
- dependencies: add-quickstart-section

