# Phoenix Insight CLI

[![npm version](https://img.shields.io/npm/v/@cephalization/phoenix-insight.svg)](https://www.npmjs.com/package/@cephalization/phoenix-insight)

Phoenix Insight brings AI-powered analysis to your [Phoenix](https://github.com/Arize-ai/phoenix) observability data using the ["bash + files" paradigm](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash). Instead of hiding data behind opaque API calls, Phoenix Insight materializes your traces, experiments, datasets, and prompts as a structured filesystem. An AI agent then explores this data using standard bash commands you already know: `cat`, `grep`, `jq`, `awk`, and more.

This filesystem-native approach provides transparency that traditional APIs can't match. Every query the agent runs is visible and reproducible. You can inspect the exact files it reads, copy its commands, and run them yourself. The data is just files, and the analysis is just bash, making AI-driven observability debuggable, auditable, and extensible with any tool in your Unix toolkit.

## Installation

```bash
# Install globally via npm
npm install -g @cephalization/phoenix-insight

# Or use with pnpm
pnpm add -g @cephalization/phoenix-insight

# Or run directly with npx
npx @cephalization/phoenix-insight "your query"
```

## Quick Start

```bash
# Start interactive mode
phoenix-insight

# Analyze Phoenix data with natural language
phoenix-insight "What are the most common errors in the last hour?"

# Show help
phoenix-insight help
```

## CLI Examples

This section covers all CLI usage, progressing from basic to advanced scenarios.

### Basic Queries

```bash
# Ask a question about your Phoenix data
phoenix-insight "What types of errors are occurring most frequently?"

# Analyze performance patterns
phoenix-insight "Find the slowest traces and identify patterns"

# Compare experiments
phoenix-insight "Compare success rates across recent experiments"

# Explore datasets
phoenix-insight "Show me statistics about my datasets"
```

### Interactive Mode

Start an interactive REPL session for multiple queries without re-fetching data:

```bash
# Start interactive mode (default when no query is provided)
phoenix-insight

# Or explicitly with --interactive flag
phoenix-insight --interactive
```

Within interactive mode:

```
phoenix> What projects have the most spans?
[Agent analyzes and responds...]

phoenix> Show me error patterns in the chatbot-prod project
[Agent investigates specific project...]

phoenix> px-fetch-more trace --trace-id abc123
[Agent fetches specific trace data...]

phoenix> help
[Shows available commands and tips...]

phoenix> exit
```

### Snapshot Management

Create or update snapshots separately from queries:

```bash
# Create initial snapshot
phoenix-insight snapshot

# Force refresh snapshot (ignore cache)
phoenix-insight snapshot --refresh

# Snapshot from a specific Phoenix instance
phoenix-insight snapshot --base-url https://phoenix.example.com --api-key your-api-key

# Get the path to the latest snapshot
phoenix-insight snapshot latest

# List all available snapshots
phoenix-insight snapshot list

# Clean up local snapshots
phoenix-insight prune

# Preview what would be deleted
phoenix-insight prune --dry-run
```

### Local Mode

```bash
# Run a query in local mode (persistent storage, full bash capabilities)
phoenix-insight --local "analyze trace patterns"
```

### Connection Options

Connect to different Phoenix instances:

```bash
# Connect to a remote Phoenix instance
phoenix-insight --base-url https://phoenix.example.com "analyze traces"

# Authenticate with an API key
phoenix-insight --base-url https://phoenix.example.com --api-key your-api-key "show errors"
```

### Data Fetching Options

```bash
# Increase span fetch limit (default: 1000 per project)
phoenix-insight --limit 5000 "deep trace analysis"

# Force refresh of cached data
phoenix-insight --refresh "show me the latest errors"
```

### Output Options

```bash
# Disable streaming for batch processing (streaming is enabled by default)
phoenix-insight --no-stream "generate report" > report.txt
```

### Observability

```bash
# Enable tracing of agent operations to Phoenix
phoenix-insight --trace "analyze performance"
```

### On-Demand Data Fetching

Within interactive mode, the agent can fetch additional data during analysis:

```bash
px-fetch-more spans --project my-project --limit 500
px-fetch-more trace --trace-id abc123
```

### Combining Options

Combine multiple options for complex scenarios:

```bash
# Remote instance with authentication, local mode, and increased limit
phoenix-insight --local --base-url https://phoenix.example.com \
  --api-key your-api-key --limit 5000 "deep analysis of production traces"

# Refresh data, enable tracing, and stream output
phoenix-insight --refresh --trace --stream "analyze error patterns over time"
```

## Example Queries

Phoenix Insight understands natural language queries about your observability data. Here are examples organized by analysis type to help you get started.

### Error Analysis

```bash
# Find and categorize errors
phoenix-insight "What are the most common errors in the last 24 hours?"
phoenix-insight "Show me all failed spans and their error messages"
phoenix-insight "Which services have the highest error rates?"
phoenix-insight "Find traces that contain exceptions or timeouts"
```

### Performance & Latency

```bash
# Identify performance bottlenecks
phoenix-insight "What are the slowest LLM calls in my application?"
phoenix-insight "Find traces where latency exceeds 5 seconds"
phoenix-insight "Show p50, p95, and p99 latency by endpoint"
phoenix-insight "Which operations have the highest latency variance?"
```

### Token Usage & Costs

```bash
# Analyze LLM resource consumption
phoenix-insight "Which LLM calls are consuming the most tokens?"
phoenix-insight "Calculate total token usage for the chatbot project"
phoenix-insight "Show token usage breakdown by model type"
phoenix-insight "Find conversations that exceeded 10,000 tokens"
```

### RAG Analysis

```bash
# Examine retrieval-augmented generation patterns
phoenix-insight "Show retrieved documents with low relevance scores"
phoenix-insight "Find retrieval calls that returned no results"
phoenix-insight "What's the average number of documents retrieved per query?"
phoenix-insight "Identify queries where retrieval latency dominated total time"
```

### Evaluations & Experiments

```bash
# Review evaluation results and experiment metrics
phoenix-insight "What's the hallucination rate across my experiments?"
phoenix-insight "Compare accuracy scores between model versions"
phoenix-insight "Show experiments sorted by success rate"
phoenix-insight "Find evaluation runs where quality scores dropped below threshold"
```

### Dataset Analysis

```bash
# Explore datasets and examples
phoenix-insight "Show statistics for my evaluation datasets"
phoenix-insight "Find examples where the model failed quality checks"
phoenix-insight "What's the distribution of example categories in my dataset?"
phoenix-insight "List datasets with the most recent updates"
```

### Prompt Engineering

```bash
# Analyze prompt versions and performance
phoenix-insight "List all prompt versions and their performance metrics"
phoenix-insight "Compare outputs between prompt v1 and v2"
phoenix-insight "Which prompt template has the lowest error rate?"
phoenix-insight "Show the evolution of my summarization prompt"
```

### Session & Conversation Analysis

```bash
# Understand user interaction patterns
phoenix-insight "Show the conversation flow for session abc123"
phoenix-insight "Find sessions with high user abandonment"
phoenix-insight "What's the average conversation length by project?"
phoenix-insight "Identify sessions where users repeated similar queries"
```

### Tool & Function Calls

```bash
# Analyze agent tool usage
phoenix-insight "Which tools are being called most frequently?"
phoenix-insight "Find tool calls that failed or timed out"
phoenix-insight "Show the success rate for each tool type"
phoenix-insight "What's the average latency for function calls?"
```

## Command Reference

Phoenix Insight provides several commands, each with its own options.

### Query Command (Default)

The default command analyzes Phoenix data with natural language queries.

```bash
phoenix-insight [options] [query]
```

| Option              | Description                                   | Default                 | Example                                        |
| ------------------- | --------------------------------------------- | ----------------------- | ---------------------------------------------- |
| `--config <path>`   | Custom config file path                       | `~/.phoenix-insight/config.json` | `--config ./my-config.json`           |
| `--sandbox`         | Run in sandbox mode with in-memory filesystem | `true`                  | `phoenix-insight --sandbox "query"`            |
| `--local`           | Run in local mode with persistent storage     | `false`                 | `phoenix-insight --local "query"`              |
| `--base-url <url>`  | Phoenix server URL                            | `http://localhost:6006` | `--base-url https://phoenix.example.com`       |
| `--api-key <key>`   | Phoenix API key for authentication            | (none)                  | `--api-key your-api-key`                       |
| `--refresh`         | Force refresh of cached snapshot data         | `false`                 | `phoenix-insight --refresh "show latest data"` |
| `--limit <n>`       | Maximum spans to fetch per project            | `1000`                  | `--limit 5000`                                 |
| `--stream`          | Stream agent responses in real-time           | `true`                  | `--no-stream` to disable                       |
| `-i, --interactive` | Start interactive REPL mode                   | `false`                 | `phoenix-insight -i`                           |
| `--trace`           | Enable tracing of agent operations to Phoenix | `false`                 | `phoenix-insight --trace "query"`              |

### Snapshot Command

Creates or updates a data snapshot from Phoenix without running a query.

```bash
phoenix-insight snapshot [options]
```

| Option             | Description                                   | Default                 | Example                                         |
| ------------------ | --------------------------------------------- | ----------------------- | ----------------------------------------------- |
| `--config <path>`  | Custom config file path                       | `~/.phoenix-insight/config.json` | `--config ./my-config.json`            |
| `--base-url <url>` | Phoenix server URL                            | `http://localhost:6006` | `--base-url https://phoenix.example.com`        |
| `--api-key <key>`  | Phoenix API key for authentication            | (none)                  | `--api-key your-api-key`                        |
| `--refresh`        | Force refresh (ignore existing cache)         | `false`                 | `phoenix-insight snapshot --refresh`            |
| `--limit <n>`      | Maximum spans to fetch per project            | `1000`                  | `phoenix-insight snapshot --limit 5000`         |
| `--trace`          | Enable tracing of snapshot operations         | `false`                 | `phoenix-insight snapshot --trace`              |

### Snapshot Latest Command

Prints the absolute path to the latest snapshot directory.

```bash
phoenix-insight snapshot latest
```

Outputs the path to stdout with no decoration (just the path). Exit code 0 on success, exit code 1 if no snapshots exist.

**Example usage:**

```bash
# Get the latest snapshot path
phoenix-insight snapshot latest
# Output: /Users/you/.phoenix-insight/snapshots/1704067200000-abc123/phoenix

# Use in scripts
SNAPSHOT_PATH=$(phoenix-insight snapshot latest)
ls "$SNAPSHOT_PATH"

# Check if snapshots exist
if phoenix-insight snapshot latest > /dev/null 2>&1; then
  echo "Snapshots available"
else
  echo "No snapshots found"
fi
```

### Snapshot List Command

Lists all available snapshots with their timestamps.

```bash
phoenix-insight snapshot list
```

Outputs one snapshot per line in the format `<timestamp> <path>` where timestamp is ISO 8601. Most recent first. Exit code 0 even if empty (just prints nothing).

**Example usage:**

```bash
# List all snapshots
phoenix-insight snapshot list
# Output:
# 2024-01-01T12:30:00.000Z /Users/you/.phoenix-insight/snapshots/1704113400000-abc123/phoenix
# 2024-01-01T10:00:00.000Z /Users/you/.phoenix-insight/snapshots/1704104400000-def456/phoenix

# Count snapshots
phoenix-insight snapshot list | wc -l

# Get oldest snapshot path
phoenix-insight snapshot list | tail -1 | cut -d' ' -f2

# Process snapshots in a script
phoenix-insight snapshot list | while read timestamp path; do
  echo "Snapshot from $timestamp at $path"
done
```

### Prune Command

Deletes the local snapshot directory to free up disk space.

```bash
phoenix-insight prune [options]
```

| Option      | Description                              | Default | Example                         |
| ----------- | ---------------------------------------- | ------- | ------------------------------- |
| `--dry-run` | Preview what would be deleted without actually deleting | `false` | `phoenix-insight prune --dry-run` |

### Help Command

Displays help information and available options.

```bash
phoenix-insight help
```

No additional options. Shows usage information, all commands, and their options.

## How It Works

Phoenix Insight operates in three phases:

1. **Data Ingestion**: Fetches data from your Phoenix instance and creates a structured filesystem snapshot
2. **AI Analysis**: An AI agent explores the data using bash commands (cat, grep, jq, awk, etc.)
3. **Natural Language Results**: The agent synthesizes findings into clear, actionable insights

### Filesystem Structure

Phoenix data is organized into an intuitive REST-like hierarchy:

```
/phoenix/
  _context.md                       # Start here! Human-readable summary
  /projects/
    index.jsonl                     # All projects
    /{project_name}/
      metadata.json                 # Project details
      /spans/
        index.jsonl                 # Trace spans (sampled)
  /datasets/
    index.jsonl                     # All datasets
    /{dataset_name}/
      metadata.json
      examples.jsonl
  /experiments/
    index.jsonl                     # All experiments
    /{experiment_id}/
      metadata.json
      runs.jsonl
  /prompts/
    index.jsonl                     # All prompts
    /{prompt_name}/
      metadata.json
      /versions/
        /{version}.md               # Prompt templates as markdown
  /traces/                          # Fetched on-demand
    /{trace_id}/
      spans.jsonl
      metadata.json
  /_meta/
    snapshot.json                   # Snapshot metadata
```

## Examples of Agent Analysis

### Error Pattern Detection

```
User: "What are the most common errors in my traces?"

Agent: I'll analyze the error patterns in your traces. Let me start by examining the context...

*reads _context.md*
*searches for error spans across projects*
*aggregates by error type*
*identifies patterns*

I found 3 main error patterns in your traces:
1. **Database timeouts** (42% of errors): Occurring in user-service, primarily during peak hours
2. **API rate limits** (31% of errors): Third-party integration hitting limits
3. **Null pointer exceptions** (27% of errors): In the recommendation engine

The database timeouts show a clear pattern during 9-10am and 2-3pm daily.
```

### Performance Analysis

```
User: "Find the slowest API endpoints"

Agent: I'll analyze your API endpoint performance. Let me examine the span data...

*reads project spans*
*calculates latency percentiles*
*groups by endpoint*
*identifies outliers*

Here are your slowest API endpoints by p95 latency:
1. `/api/v1/recommendations` - 3.2s p95 (8.1s p99)
2. `/api/v1/search` - 2.8s p95 (5.2s p99)
3. `/api/v1/user/history` - 1.9s p95 (3.1s p99)

The recommendations endpoint has high variability, suggesting cache misses.
```

## Tips and Best Practices

### Query Formulation

- Be specific about what you want to analyze
- Mention time ranges if relevant
- Ask for patterns, not just raw data

### Performance

- Use `--limit` to control data volume
- In sandbox mode, start with smaller datasets
- Use local mode for production analysis

### Security

- Use sandbox mode when trying new queries
- Never put API keys in queries
- Review agent actions with `--stream`

## Advanced Topics

The following sections cover configuration, execution modes, and internal details for power users.

### Configuration

Phoenix Insight uses a layered configuration system with the following priority (highest to lowest):

1. **CLI arguments** - Options passed directly to the command
2. **Environment variables** - `PHOENIX_*` environment variables
3. **Config file** - JSON file at `~/.phoenix-insight/config.json`

#### Config File

On first run, Phoenix Insight automatically creates a default config file at `~/.phoenix-insight/config.json` with all default values. You can edit this file to customize your settings.

**Config file location:**

- Default: `~/.phoenix-insight/config.json`
- Override with env var: `PHOENIX_INSIGHT_CONFIG=/path/to/config.json`
- Override with CLI flag: `--config /path/to/config.json`

**Example config.json with all options:**

```json
{
  "baseUrl": "http://localhost:6006",
  "apiKey": "your-api-key",
  "limit": 1000,
  "stream": true,
  "mode": "sandbox",
  "refresh": false,
  "trace": false
}
```

| Config Key | Type                     | Default                 | Description                                   |
| ---------- | ------------------------ | ----------------------- | --------------------------------------------- |
| `baseUrl`  | string                   | `http://localhost:6006` | Phoenix server URL                            |
| `apiKey`   | string                   | (none)                  | API key for authentication                    |
| `limit`    | number                   | `1000`                  | Maximum spans to fetch per project            |
| `stream`   | boolean                  | `true`                  | Enable streaming responses from the agent     |
| `mode`     | `"sandbox"` \| `"local"` | `"sandbox"`             | Execution mode                                |
| `refresh`  | boolean                  | `false`                 | Force refresh of snapshot data                |
| `trace`    | boolean                  | `false`                 | Enable tracing of agent operations to Phoenix |

#### Environment Variables

| Variable                  | Config Key | Default                 | Description                |
| ------------------------- | ---------- | ----------------------- | -------------------------- |
| `PHOENIX_BASE_URL`        | `baseUrl`  | `http://localhost:6006` | Phoenix server URL         |
| `PHOENIX_API_KEY`         | `apiKey`   | (none)                  | API key for authentication |
| `PHOENIX_INSIGHT_LIMIT`   | `limit`    | `1000`                  | Max spans per project      |
| `PHOENIX_INSIGHT_STREAM`  | `stream`   | `true`                  | Enable streaming           |
| `PHOENIX_INSIGHT_MODE`    | `mode`     | `sandbox`               | Execution mode             |
| `PHOENIX_INSIGHT_REFRESH` | `refresh`  | `false`                 | Force refresh snapshot     |
| `PHOENIX_INSIGHT_TRACE`   | `trace`    | `false`                 | Enable tracing             |
| `PHOENIX_INSIGHT_CONFIG`  | -          | -                       | Custom config file path    |
| `DEBUG`                   | -          | `0`                     | Show detailed error info   |

#### Local Mode Storage

In local mode (`--local`), data persists at `~/.phoenix-insight/`:

```
~/.phoenix-insight/
  config.json                  # Configuration (auto-created on first run)
  /snapshots/{timestamp}/      # Snapshot data
  /cache/                      # API response cache
```

Use `phoenix-insight prune` to clean up local storage.

### Execution Modes

Phoenix Insight supports two execution modes:

| Mode | Flag | Filesystem | Bash | Use Case |
|------|------|------------|------|----------|
| **Sandbox** (default) | `--sandbox` | In-memory | [just-bash](https://github.com/vercel-labs/just-bash) (50+ commands) | CI/CD, demos, safe exploration |
| **Local** | `--local` | Persistent (`~/.phoenix-insight/`) | Real system bash | Power users, complex analysis |

### Agent Capabilities

The AI agent has access to:

#### Bash Commands (Sandbox Mode)

- **File operations**: `cat`, `ls`, `find`, `head`, `tail`
- **Search & filter**: `grep`, `awk`, `sed`
- **JSON processing**: `jq` (full featured)
- **Analysis**: `sort`, `uniq`, `wc`
- **And more**: 50+ commands via just-bash

#### Bash Commands (Local Mode)

- All commands available on your system
- Custom tools: `ripgrep`, `fd`, `bat`, etc.
- Full `jq`, `awk`, `sed` features
- Any installed CLI tools

#### Custom Commands

- `px-fetch-more spans`: Fetch additional spans for deeper analysis
- `px-fetch-more trace`: Fetch a specific trace by ID

See [On-Demand Data Fetching](#on-demand-data-fetching) for usage examples.

#### Understanding Context

The agent always starts by reading `/_context.md` which provides:

- Summary of available data
- Recent activity highlights
- Data freshness information
- Available commands reminder

### Observability

Phoenix Insight can trace its own execution back to Phoenix using `--trace`. When enabled, all agent operations, tool calls, and responses are traced as spans and sent to the Phoenix instance being queried. This is useful for debugging slow queries and understanding agent decision-making.

### Troubleshooting

For connection issues, authentication errors, debug mode, and common issues, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).

### Development

#### Building from Source

```bash
# Clone the repository
git clone https://github.com/Arize-ai/phoenix.git
cd phoenix/js/packages/phoenix-insight

# Install dependencies
pnpm install

# Run in development
pnpm dev "your query"

# Run tests
pnpm test

# Build for production
pnpm build

# Type checking
pnpm typecheck
```

#### Architecture

Phoenix Insight uses:

- **Commander.js** for CLI interface
- **AI SDK** with Anthropic Claude for the agent
- **just-bash** for sandbox execution
- **Phoenix Client** for data fetching
- **TypeScript** for type safety

#### Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test test/modes/sandbox.test.ts

# Type checking
pnpm typecheck
```

### Contributing & Releases

Contributions are welcome! This project uses [changesets](https://github.com/changesets/changesets) for version management and automated releases.

#### Making Changes

1. Fork the repository and create a feature branch
2. Make your changes and ensure tests pass (`pnpm test`)
3. Create a changeset to document your changes:

```bash
pnpm changeset
```

4. Follow the prompts to:
   - Select the type of change (patch, minor, major)
   - Describe what changed for the changelog

5. Commit the generated changeset file along with your changes
6. Open a pull request

#### Release Process

When your PR is merged to `main`:

1. If there are pending changesets, a "Version Packages" PR is automatically created
2. This PR updates the version in `package.json` and generates `CHANGELOG.md` entries
3. When the Version Packages PR is merged, the package is automatically published to npm

#### Changeset Guidelines

- **patch**: Bug fixes, documentation updates, internal refactoring
- **minor**: New features, new CLI options, non-breaking enhancements
- **major**: Breaking changes to CLI interface or behavior

### Support

This software is provided "as is" without warranty of any kind. Use at your own risk.

You may file GitHub issues at [https://github.com/cephalization/phoenix-insight/issues](https://github.com/cephalization/phoenix-insight/issues).

### License

Apache-2.0 - See [LICENSE](./LICENSE) for details.
