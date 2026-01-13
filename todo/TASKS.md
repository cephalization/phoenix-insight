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

## Phase 1: Package Configuration

### update-package-json

- content: Update package.json for npm publishing - add "publishConfig": { "access": "public" }, add "pxi" as a second bin alias, update repository/homepage/bugs URLs to point to cephalization/phoenix-insight repo
- status: complete
- dependencies: none

### install-changesets

- content: Install @changesets/cli as a devDependency and initialize changesets with `pnpm changeset init`. Configure .changeset/config.json for single-package repo (set "access" to "public", "baseBranch" to "main")
- status: complete
- dependencies: update-package-json

---

## Phase 2: GitHub Actions Workflows

### create-ci-workflow

- content: Create .github/workflows/ci.yml that runs on push to main and pull requests. Jobs: install deps (pnpm install), typecheck (pnpm typecheck), test (pnpm test), build (pnpm build). Use pnpm/action-setup and actions/setup-node with caching
- status: complete
- dependencies: install-changesets

### create-release-workflow

- content: Create .github/workflows/release.yml that runs on push to main. Uses changesets/action to either create a "Version Packages" PR (when changesets exist) or publish to npm (when no changesets and version changed). Requires NPM_TOKEN secret. Runs CI checks before publishing
- status: complete
- dependencies: create-ci-workflow

---

## Phase 3: Documentation

### update-readme-publishing

- content: Add a "Contributing & Releases" section to README.md explaining how to use changesets for versioning (pnpm changeset, commit the changeset file, merge PR, release PR gets created automatically). Include badge for npm version
- status: pending
- dependencies: create-release-workflow

