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

## Phase 1: Snapshot Discovery Infrastructure

### add-snapshot-utils

- content: Create a utility module `src/snapshot/utils.ts` with functions to list all snapshot directories and find the latest snapshot. Implement `listSnapshots()` returning array of `{path, timestamp, id}` sorted by timestamp descending, and `getLatestSnapshot()` returning the latest snapshot path or null if none exist. Handle edge cases: no snapshots directory, empty directory, invalid directory names.
- status: complete
- dependencies: none

### snapshot-latest-command

- content: Add `phoenix-insight snapshot latest` subcommand that prints the absolute path to the latest snapshot directory to stdout (path only, no decoration). Exit code 0 on success, exit code 1 with error message to stderr if no snapshots exist. Use the utility functions from add-snapshot-utils. Update README with documentation.
- status: complete
- dependencies: add-snapshot-utils

### snapshot-list-command

- content: Add `phoenix-insight snapshot list` subcommand that prints all available snapshots with their timestamps, one per line. Format: `<timestamp> <path>` where timestamp is ISO 8601. Most recent first. Exit code 0 even if empty (just print nothing). Update README with documentation.
- status: pending
- dependencies: add-snapshot-utils

---

## Phase 2: Backward Compatibility

### snapshot-create-subcommand

- content: Refactor the existing `snapshot` command to use Commander.js subcommand pattern. Add `phoenix-insight snapshot create` as the explicit create command. Keep `phoenix-insight snapshot` (no subcommand) working as an alias for `snapshot create` for backward compatibility. All existing options should continue to work.
- status: pending
- dependencies: snapshot-latest-command, snapshot-list-command

---

## Phase 3: Agent Discoverability

### enhance-context-md

- content: Improve `_context.md` to better support external agents that don't know about phoenix-insight. Add a "Quick Start for External Agents" section at the top explaining: 1) This is a read-only snapshot, 2) How to parse each file format (JSONL, JSON, MD), 3) Key files to start with (index.jsonl files), 4) Example bash commands for common operations. Keep existing content but reorganize for discoverability.
- status: pending
- dependencies: snapshot-create-subcommand

