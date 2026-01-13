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

## update-package-json

- The `publishConfig.access: "public"` is required for scoped packages (`@cephalization/phoenix-insight`) to be published publicly on npm
- Added `pxi` as a shorter bin alias alongside `phoenix-insight` - both point to the same `./dist/cli.js` entry point
- Updated all GitHub URLs from Arize-ai/phoenix monorepo to cephalization/phoenix-insight standalone repo
- Standard homepage URL format includes `#readme` suffix: `https://github.com/cephalization/phoenix-insight#readme`
- This is a config-only change - no tests required per PROMPT.md guidelines

## install-changesets

- `pnpm changeset init` creates a `.changeset/` directory with `config.json` and `README.md`
- The default config sets `access` to "restricted" - must change to "public" for scoped public packages
- The default config already sets `baseBranch` to "main" (no change needed)
- `pnpm changeset status` will error with "no changesets found" if there are uncommitted changes - this is expected behavior, not a failure
- The "Opening `/dev/tty` failed" warning is benign in non-interactive environments (CI, automated scripts) - changesets still works correctly
- Config-only task - no tests required per PROMPT.md guidelines

## create-ci-workflow

- Created `.github/workflows/ci.yml` with a single job that runs all CI steps sequentially
- Used `pnpm/action-setup@v4` with explicit version `9.15.0` to match `packageManager` in package.json
- Used `actions/setup-node@v4` with `cache: 'pnpm'` for dependency caching
- Node version 18 matches the `engines.node` requirement in package.json
- Steps run in order: checkout, pnpm setup, node setup, install (with `--frozen-lockfile`), typecheck, test, build
- `--frozen-lockfile` flag ensures CI fails if lockfile is out of sync with package.json
- Workflow triggers on push to main and pull requests targeting main
- No tests required for workflow-only task per PROMPT.md guidelines

## create-release-workflow

- Created `.github/workflows/release.yml` using the `changesets/action@v1` action
- Added `concurrency: ${{ github.workflow }}-${{ github.ref }}` to prevent concurrent releases which could cause race conditions
- The workflow reuses the same CI steps (typecheck, test, build) before the release step to ensure only passing code gets published
- `changesets/action` handles the dual behavior automatically:
  - When changesets exist: Creates/updates a "Version Packages" PR with bumped versions
  - When no changesets (after merging version PR): Publishes to npm
- Two secrets are required:
  - `GITHUB_TOKEN` (auto-provided): For creating PRs and commits
  - `NPM_TOKEN` (must be added manually): For npm publishing
- The `publish` option specifies `pnpm changeset publish` which handles the actual npm publish
- Custom `title` and `commit` options set the PR/commit message format to `chore: version packages`
- Workflow-only task - no tests required per PROMPT.md guidelines
