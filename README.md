# Phoenix Insight Monorepo

This monorepo contains the Phoenix Insight CLI and its companion web UI.

## Packages

| Package | Description | Published |
|---------|-------------|-----------|
| [@cephalization/phoenix-insight](./packages/cli/) | CLI for AI-powered Phoenix observability analysis | Yes (npm) |
| [@cephalization/phoenix-insight-ui](./packages/ui/) | Web UI for visual interaction with the agent | No (bundled with CLI) |

## Quick Start

```bash
# Install the CLI globally
npm install -g @cephalization/phoenix-insight

# Or use pnpm
pnpm add -g @cephalization/phoenix-insight

# Run a query
phoenix-insight "What are the most common errors?"

# Start the web UI
phoenix-insight ui
```

For detailed CLI documentation, see the [CLI README](./packages/cli/README.md).

## Monorepo Structure

```
phoenix-insight/
├── .changeset/              # Changesets for version management
├── .github/
│   └── workflows/
│       ├── ci.yml           # CI checks (test, build, typecheck)
│       └── release.yml      # Automated npm publishing
├── packages/
│   ├── cli/                 # @cephalization/phoenix-insight
│   │   ├── src/             # CLI source code
│   │   ├── test/            # CLI tests
│   │   └── package.json
│   └── ui/                  # @cephalization/phoenix-insight-ui
│       ├── src/             # React app source
│       ├── dist/            # Vite build output (bundled with CLI)
│       └── package.json
├── package.json             # Root workspace config
├── pnpm-workspace.yaml      # Workspace packages definition
└── README.md                # This file
```

## Requirements

- **Node.js v22 or newer** - Required for the CLI to run
- **Anthropic API key** - Required for the AI agent

Set your Anthropic API key before running:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

You can get an API key from [console.anthropic.com](https://console.anthropic.com/).

## Development

### Prerequisites

- Node.js v22 or newer
- pnpm 9.15.0 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Anthropic API key (see [Requirements](#requirements))

### Setup

```bash
# Clone the repository
git clone https://github.com/cephalization/phoenix-insight.git
cd phoenix-insight

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

### Package Scripts

Run from the monorepo root:

| Script | Description |
|--------|-------------|
| `pnpm build` | Build all packages in dependency order |
| `pnpm test` | Run tests in all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm clean` | Remove dist and build artifacts |
| `pnpm changeset` | Create a new changeset for version bumping |

Run for a specific package:

```bash
# CLI package
pnpm --filter @cephalization/phoenix-insight dev       # Run CLI in dev mode
pnpm --filter @cephalization/phoenix-insight test      # Run CLI tests
pnpm --filter @cephalization/phoenix-insight build     # Build CLI

# UI package
pnpm --filter @cephalization/phoenix-insight-ui dev    # Start Vite dev server
pnpm --filter @cephalization/phoenix-insight-ui test   # Run UI tests
pnpm --filter @cephalization/phoenix-insight-ui build  # Build UI for production
```

### UI Integration Testing

The web UI has manual integration tests using [agent-browser](https://github.com/vercel-labs/agent-browser) for browser automation. These tests require a live Phoenix server and are NOT run in CI.

**Prerequisites:**
1. Phoenix server running on `localhost:6006` with data
2. UI server running on `localhost:6007` (via `phoenix-insight ui`)

**Running the tests:**

```bash
# Terminal 1: Start Phoenix
phoenix serve

# Terminal 2: Start the UI server (after building)
pnpm build
cd packages/cli && pnpm dev ui

# Terminal 3: Run UI integration tests
pnpm test:ui
```

The `test:ui` script builds all packages and runs browser automation tests that verify:
- Layout renders correctly (chat panel, report panel)
- Chat input accepts messages
- WebSocket connection establishes
- Session management works
- Report panel displays content

If tests skip with "Phoenix server not running" or "UI server not running", ensure both servers are accessible.

## Architecture

### How the Packages Work Together

1. **UI Package (`packages/ui/`)**: A React application built with Vite. It provides the chat interface and report display. The built assets are bundled into the CLI package for distribution.

2. **CLI Package (`packages/cli/`)**: The main entry point. It includes:
   - Command-line interface (Commander.js)
   - AI agent with bash/filesystem tools (AI SDK + Anthropic)
   - Snapshot management for Phoenix data
   - HTTP server that serves the bundled UI
   - WebSocket server for real-time communication

When you run `phoenix-insight ui`:
1. CLI starts an HTTP server serving the UI's static files
2. CLI starts a WebSocket server at `/ws`
3. UI connects via WebSocket and sends queries
4. CLI streams responses, tool calls, and reports back to UI

### Key Technologies

- **pnpm workspaces**: Monorepo package management
- **TypeScript**: Type safety across all packages
- **Vite**: UI bundling with React
- **shadcn/ui**: UI components (built on Radix)
- **Zustand**: UI state management
- **IndexedDB**: Browser-side persistence (idb library)
- **partysocket**: Robust WebSocket with auto-reconnect
- **json-render**: Structured report rendering
- **vitest**: Testing framework for both packages

## Contributing

### Making Changes

1. Fork the repository and create a feature branch
2. Make your changes and ensure tests pass (`pnpm test`)
3. Create a changeset to document your changes:
   ```bash
   pnpm changeset
   ```
4. Commit the changeset file with your changes
5. Open a pull request

### Release Process

When a PR with changesets is merged to `main`:
1. A "Version Packages" PR is automatically created
2. This PR updates versions and generates CHANGELOG entries
3. Merging the Version Packages PR publishes to npm

Only the CLI package is published to npm. The UI package is private and bundled with the CLI.

### Changeset Guidelines

- **patch**: Bug fixes, documentation, internal refactoring
- **minor**: New features, new CLI options, non-breaking enhancements  
- **major**: Breaking changes to CLI interface or behavior

## License

Apache-2.0 - See [LICENSE](./packages/cli/LICENSE) for details.

## Support

File issues at [https://github.com/cephalization/phoenix-insight/issues](https://github.com/cephalization/phoenix-insight/issues).
