# Phoenix Insight

AI-powered analysis of your [Phoenix](https://github.com/Arize-ai/phoenix) observability data using the "bash + files" paradigm.

Phoenix Insight materializes your traces, experiments, datasets, and prompts as a structured filesystem, then uses an AI agent to explore and analyze the data with standard Unix commands you already know: `cat`, `grep`, `jq`, `awk`, and more.

## Why Phoenix Insight?

Traditional AI observability tools hide data behind opaque APIs and dashboards. Phoenix Insight takes a different approach:

- **Transparent**: Every query the agent runs is visible. You see the exact commands, the files it reads, and the data it processes.
- **Reproducible**: Commands are just bash. Copy them, modify them, run them yourself. Debug AI-driven analysis like you debug any script.
- **Extensible**: The data is just files. Use any tool in your Unix toolkit: ripgrep for faster search, custom scripts for specialized analysis, or pipe output through your favorite tools.

## Requirements

- **Node.js v22 or newer**
- **Anthropic API key**

Set your API key before running:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get an API key at [console.anthropic.com](https://console.anthropic.com/).

## Installation

```bash
npm install -g @cephalization/phoenix-insight
```

Or run directly with npx:

```bash
npx @cephalization/phoenix-insight "your query"
```

## Usage

### Ask Questions About Your Data

```bash
# Analyze error patterns
phoenix-insight "What are the most common errors in my traces?"

# Find performance bottlenecks
phoenix-insight "Which endpoints have the highest latency?"

# Explore LLM usage
phoenix-insight "Show token usage breakdown by model"
```

### Interactive Mode

Start an interactive session for multiple queries:

```bash
phoenix-insight
```

```
phoenix> What projects have the most errors?
[Agent analyzes and responds...]

phoenix> Show me the top 5 slowest traces
[Agent investigates...]

phoenix> exit
```

### Web UI

Launch a visual interface with chat and structured reports:

```bash
phoenix-insight ui
```

This opens a browser with:
- Chat panel for natural language queries
- Report panel for structured analysis results
- Session history and report persistence

## Documentation

- **[CLI Documentation](./packages/cli/README.md)** - Full command reference, configuration options, and advanced usage
- **[Development Guide](./DEVELOPMENT.md)** - Monorepo setup, architecture, and contributing

## License

Apache-2.0 - See [LICENSE](./packages/cli/LICENSE) for details.
