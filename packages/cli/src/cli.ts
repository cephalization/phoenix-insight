#!/usr/bin/env node

import { Command } from "commander";
import * as readline from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { exec } from "node:child_process";
import { createSandboxMode, createLocalMode } from "./modes/index.js";
import { createInsightAgent, runOneShotQuery } from "./agent/index.js";
import {
  type ConversationMessage,
  createUserMessage,
  extractMessagesFromResponse,
  compactConversation,
} from "./agent/conversation.js";
import { isTokenLimitError } from "./agent/token-errors.js";
import {
  createSnapshot,
  createIncrementalSnapshot,
  createPhoenixClient,
  PhoenixClientError,
} from "./snapshot/index.js";
import { getLatestSnapshot, listSnapshots } from "./snapshot/utils.js";
import type { ExecutionMode } from "./modes/types.js";
import type { PhoenixInsightAgentConfig } from "./agent/index.js";
import { AgentProgress } from "./progress.js";
import {
  initializeObservability,
  shutdownObservability,
} from "./observability/index.js";
import { initializeConfig, getConfig, type CliArgs } from "./config/index.js";
import { createUIServer } from "./server/ui.js";
import { createWebSocketServer } from "./server/websocket.js";
import { createSessionManager } from "./server/session.js";
import type { WebSocket } from "ws";

// Version will be read from package.json during build
const VERSION = "0.0.1";

const program = new Command();

/**
 * Format bash command for display in progress indicator
 */
function formatBashCommand(command: string): string {
  if (!command) return "";

  // Split by newline and get first line
  const lines = command.split("\n");
  const firstLine = lines[0]?.trim() || "";

  // Check for pipeline first (3+ commands)
  if (firstLine.includes(" | ") && firstLine.split(" | ").length > 2) {
    const parts = firstLine.split(" | ");
    const firstCmd = parts[0]?.split(" ")[0] || "";
    const lastCmd = parts[parts.length - 1]?.split(" ")[0] || "";
    return `${firstCmd} | ... | ${lastCmd}`;
  }

  // Common command patterns to display nicely
  if (firstLine.startsWith("cat ")) {
    const file = firstLine.substring(4).trim();
    return `cat ${file}`;
  } else if (firstLine.startsWith("grep ")) {
    // Extract pattern and file/directory
    const match = firstLine.match(
      /grep\s+(?:-[^\s]+\s+)*['"]?([^'"]+)['"]?\s+(.+)/
    );
    if (match && match[1] && match[2]) {
      return `grep "${match[1]}" in ${match[2]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else if (firstLine.startsWith("find ")) {
    const match = firstLine.match(
      /find\s+([^\s]+)(?:\s+-name\s+['"]?([^'"]+)['"]?)?/
    );
    if (match && match[1]) {
      return match[2]
        ? `find "${match[2]}" in ${match[1]}`
        : `find in ${match[1]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else if (firstLine.startsWith("ls ")) {
    const path = firstLine.substring(3).trim();
    return path ? `ls ${path}` : "ls";
  } else if (firstLine.startsWith("ls")) {
    return "ls";
  } else if (firstLine.startsWith("jq ")) {
    return `jq processing JSON data`;
  } else if (firstLine.startsWith("head ") || firstLine.startsWith("tail ")) {
    const cmd = firstLine.split(" ")[0];
    const fileMatch = firstLine.match(/(?:head|tail)\s+(?:-[^\s]+\s+)*(.+)/);
    if (fileMatch && fileMatch[1]) {
      return `${cmd} ${fileMatch[1]}`;
    }
    return firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");
  } else {
    // For other commands, show up to 80 characters
    return firstLine.substring(0, 80) + (firstLine.length > 80 ? "..." : "");
  }
}

/**
 * Check if ANTHROPIC_API_KEY is set and provide a helpful error if not
 */
function ensureAnthropicApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "\n❌ Error: Missing ANTHROPIC_API_KEY environment variable\n"
    );
    console.error("The Anthropic API key is required to run the AI agent.\n");
    console.error("To fix this, set the environment variable:\n");
    console.error("  export ANTHROPIC_API_KEY=sk-ant-api03-...\n");
    console.error(
      "Or add it to your shell profile (~/.zshrc, ~/.bashrc, etc.):\n"
    );
    console.error(
      "  echo 'export ANTHROPIC_API_KEY=sk-ant-api03-...' >> ~/.zshrc\n"
    );
    console.error(
      "You can get an API key from: https://console.anthropic.com/\n"
    );
    process.exit(1);
  }
}

/**
 * Handle errors with appropriate exit codes and user-friendly messages
 */
function handleError(error: unknown, context: string): never {
  console.error(`\n❌ Error ${context}:`);

  if (error instanceof PhoenixClientError) {
    switch (error.code) {
      case "NETWORK_ERROR":
        console.error(
          "\n🌐 Network Error: Unable to connect to Phoenix server"
        );
        console.error(`   Make sure Phoenix is running and accessible`);
        console.error(`   You can specify a different URL with --base-url`);
        break;
      case "AUTH_ERROR":
        console.error("\n🔒 Authentication Error: Invalid or missing API key");
        console.error(
          `   Set the PHOENIX_API_KEY environment variable or use --api-key`
        );
        break;
      case "INVALID_RESPONSE":
        console.error(
          "\n⚠️  Invalid Response: Phoenix returned unexpected data"
        );
        console.error(`   This might be a version compatibility issue`);
        break;
      default:
        console.error("\n❓ Phoenix Client Error:", error.message);
    }
    if (error.originalError && process.env.DEBUG) {
      console.error("\nOriginal error:", error.originalError);
    }
  } else if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes("ENOENT")) {
      console.error(
        "\n📁 File System Error: Required file or directory not found"
      );
      console.error(`   ${error.message}`);
    } else if (
      error.message.includes("EACCES") ||
      error.message.includes("EPERM")
    ) {
      console.error("\n🚫 Permission Error: Insufficient permissions");
      console.error(`   ${error.message}`);
      if (error.message.includes(".phoenix-insight")) {
        console.error(
          `   Try running with appropriate permissions or check ~/.phoenix-insight/`
        );
      }
    } else if (
      error.message.includes("rate limit") ||
      error.message.includes("429")
    ) {
      console.error("\n⏱️  Rate Limit Error: Too many requests to Phoenix");
      console.error(`   Please wait a moment and try again`);
    } else if (error.message.includes("timeout")) {
      console.error("\n⏰ Timeout Error: Request took too long");
      console.error(`   The Phoenix server might be slow or unresponsive`);
    } else {
      console.error(`\n${error.message}`);
    }

    if (error.stack && process.env.DEBUG) {
      console.error("\nStack trace:", error.stack);
    }
  } else {
    console.error("\nUnexpected error:", error);
  }

  console.error("\n💡 Tips:");
  console.error("   • Run with DEBUG=1 for more detailed error information");
  console.error(
    "   • Check your Phoenix connection with: phoenix-insight snapshot --base-url <url>"
  );
  console.error("   • Use --help to see all available options");

  process.exit(1);
}

program
  .name("phoenix-insight")
  .description("A CLI for Phoenix data analysis with AI agents")
  .version(VERSION)
  .usage("[options] [query]")
  .option(
    "--config <path>",
    "Path to config file (default: ~/.phoenix-insight/config.json, or set PHOENIX_INSIGHT_CONFIG env var)"
  )
  .addHelpText(
    "after",
    `
Configuration:
  Config values are loaded with the following priority (highest to lowest):
    1. CLI arguments (e.g., --base-url)
    2. Environment variables (e.g., PHOENIX_BASE_URL)
    3. Config file (~/.phoenix-insight/config.json)

  Use --config to specify a custom config file path.
  Set PHOENIX_INSIGHT_CONFIG env var to override the default config location.

Examples:
  $ phoenix-insight                                                            # Start interactive mode
  $ phoenix-insight "What are the slowest traces?"                             # Single query (sandbox mode)
  $ phoenix-insight --interactive                                              # Explicitly start interactive mode
  $ phoenix-insight --local "Show me error patterns"                           # Local mode with persistence
  $ phoenix-insight --local --stream "Analyze recent experiments"              # Local mode with streaming
  $ phoenix-insight --config ./my-config.json "Analyze traces"                 # Use custom config file
  $ phoenix-insight ui                                                         # Start web UI on localhost:6007
  $ phoenix-insight ui --port 8080                                             # Start web UI on custom port
  $ phoenix-insight ui --no-open                                               # Start web UI without opening browser
  $ opencode run "Analyze my spans" -f $(pxi snapshot latest)/_context.md      # Analyze phoenix data with OpenCode agent
  $ phoenix-insight help                                                       # Show this help message
`
  )
  .hook("preAction", async (thisCommand) => {
    // Get all options from the root command
    const opts = thisCommand.opts();
    // Build CLI args from commander options
    const cliArgs: CliArgs = {
      config: opts.config,
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      limit: opts.limit,
      stream: opts.stream,
      local: opts.local,
      refresh: opts.refresh,
      trace: opts.trace,
    };
    // Initialize config singleton before any command runs
    await initializeConfig(cliArgs);
  });

/**
 * Shared logic for creating a snapshot.
 * Used by both 'phoenix-insight snapshot' and 'phoenix-insight snapshot create'.
 */
async function executeSnapshotCreate(): Promise<void> {
  const config = getConfig();

  // Initialize observability if trace is enabled in config
  if (config.trace) {
    initializeObservability({
      enabled: true,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      projectName: "phoenix-insight-snapshot",
      debug: !!process.env.DEBUG,
    });
  }

  try {
    // Determine the execution mode
    const mode: ExecutionMode = await createLocalMode();

    // Create snapshot with config values
    const snapshotOptions = {
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      spansPerProject: config.limit,
      showProgress: true,
    };

    await createSnapshot(mode, snapshotOptions);

    // Cleanup
    await mode.cleanup();

    // Shutdown observability if enabled
    await shutdownObservability();
  } catch (error) {
    handleError(error, "creating snapshot");
  }
}

// Create snapshot command group
const snapshotCmd = program
  .command("snapshot")
  .description("Snapshot management commands");

// Default action for 'phoenix-insight snapshot' (backward compatibility alias for 'snapshot create')
snapshotCmd.action(async () => {
  await executeSnapshotCreate();
});

// Subcommand: snapshot create (explicit create command)
snapshotCmd
  .command("create")
  .description("Create a new snapshot from Phoenix data")
  .action(async () => {
    await executeSnapshotCreate();
  });

// Subcommand: snapshot latest
snapshotCmd
  .command("latest")
  .description("Print the absolute path to the latest snapshot directory")
  .action(async () => {
    try {
      const latestSnapshot = await getLatestSnapshot();

      if (!latestSnapshot) {
        console.error("No snapshots found");
        process.exit(1);
      }

      // Print only the path to stdout, no decoration
      console.log(latestSnapshot.path);
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Subcommand: snapshot list
snapshotCmd
  .command("list")
  .description("List all available snapshots with their timestamps")
  .action(async () => {
    try {
      const snapshots = await listSnapshots();

      // Print each snapshot: <timestamp> <path>
      // Most recent first (already sorted by listSnapshots)
      for (const snapshot of snapshots) {
        // Format timestamp as ISO 8601
        const isoTimestamp = snapshot.timestamp.toISOString();
        console.log(`${isoTimestamp} ${snapshot.path}`);
      }

      // Exit code 0 even if empty (just print nothing)
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

program
  .command("help")
  .description("Show help information")
  .action(() => {
    program.outputHelp();
  });

// Init Command - creates config file at ~/.phoenix-insight/config.json
program
  .command("init")
  .description("Initialize Phoenix Insight configuration file")
  .action(async () => {
    await runInitCommand();
  });

// Seed Command - sends a traced hello-world message to verify Phoenix setup
program
  .command("seed")
  .description("Send a traced hello-world message to verify Phoenix setup")
  .action(async () => {
    await runSeedCommand();
  });

program
  .command("prune")
  .description(
    "Delete the local snapshot directory (~/.phoenix-insight/snapshots)"
  )
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .action(async (options) => {
    const snapshotDir = path.join(
      os.homedir(),
      ".phoenix-insight",
      "snapshots"
    );

    try {
      // Check if the directory exists
      const stats = await fs.stat(snapshotDir).catch(() => null);

      if (!stats) {
        console.log("📁 No local snapshot directory found. Nothing to prune.");
        return;
      }

      if (options.dryRun) {
        console.log("🔍 Dry run mode - would delete:");
        console.log(`   ${snapshotDir}`);

        // Show size and count of snapshots
        const snapshots = await fs.readdir(snapshotDir).catch(() => []);
        console.log(`   📊 Contains ${snapshots.length} snapshot(s)`);

        return;
      }

      // Ask for confirmation
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `⚠️  This will delete all local snapshots at:\n   ${snapshotDir}\n\n   Are you sure? (yes/no): `,
          resolve
        );
      });

      rl.close();

      if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
        console.log("❌ Prune cancelled.");
        return;
      }

      // Delete the directory
      await fs.rm(snapshotDir, { recursive: true, force: true });
      console.log("✅ Local snapshot directory deleted successfully!");
    } catch (error) {
      console.error("❌ Error pruning snapshots:");
      console.error(
        `   ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// UI Command - starts web-based UI server
program
  .command("ui")
  .description("Start the web-based UI for interactive Phoenix analysis")
  .option("--port <number>", "Port to run the UI server on", parseInt)
  .option("--no-open", "Do not automatically open the browser")
  .action(async (options) => {
    await runUIServer(options);
  });

program
  .argument("[query]", "Query to run against Phoenix data")
  .option(
    "--sandbox",
    "Run in sandbox mode with in-memory filesystem (default)"
  )
  .option("--local", "Run in local mode with real filesystem")
  .option("--base-url <url>", "Phoenix base URL")
  .option("--api-key <key>", "Phoenix API key")
  .option("--refresh", "Force refresh of snapshot data")
  .option("--limit <number>", "Limit number of spans to fetch", parseInt)
  .option("--stream [true|false]", "Stream agent responses", (v) =>
    ["f", "false"].includes(v.toLowerCase()) ? false : true
  )
  .option("-i, --interactive", "Run in interactive mode (REPL)")
  .option("--trace", "Enable tracing of the agent to Phoenix")
  .action(async (query, options) => {
    const config = getConfig();
    // If interactive mode is requested, ignore query argument
    if (options.interactive) {
      await runInteractiveMode();
      return;
    }

    // If no query is provided and no specific flag, start interactive mode
    if (!query && !options.help) {
      await runInteractiveMode();
      return;
    }

    // Ensure Anthropic API key is available for agent execution
    ensureAnthropicApiKey();

    // Initialize observability if trace is enabled in config
    if (config.trace) {
      initializeObservability({
        enabled: true,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        projectName: "phoenix-insight",
        debug: !!process.env.DEBUG,
      });
    }

    try {
      // Determine the execution mode
      const mode: ExecutionMode =
        config.mode === "local" ? await createLocalMode() : createSandboxMode();

      // Create Phoenix client
      const client = createPhoenixClient({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
      });

      // Create or update snapshot
      const snapshotOptions = {
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        spansPerProject: config.limit,
        showProgress: true,
      };

      if (config.refresh || config.mode !== "local") {
        // For sandbox mode (default) or when refresh is requested, always create a fresh snapshot
        await createSnapshot(mode, snapshotOptions);
      } else {
        // For local mode without refresh, try incremental update
        await createIncrementalSnapshot(mode, snapshotOptions);
      }

      // Create agent configuration
      const agentConfig: PhoenixInsightAgentConfig = {
        mode,
        client,
        maxSteps: 25,
      };

      // Execute the query
      const agentProgress = new AgentProgress(!config.stream);
      agentProgress.startThinking();

      if (config.stream) {
        // Stream mode
        const result = (await runOneShotQuery(agentConfig, query, {
          stream: true,
          onStepFinish: (step) => {
            // Show tool usage even in stream mode
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const formattedCmd = formatBashCommand(command);
                  agentProgress.updateTool(toolName, formattedCmd);
                } else {
                  agentProgress.updateTool(toolName);
                }
                console.log();
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
              console.log();
            }
          },
        })) as any; // Type assertion needed due to union type

        // Stop progress before streaming
        agentProgress.stop();

        // Handle streaming response
        console.log("\n✨ Answer:\n");
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
        }
        console.log(); // Final newline

        // Wait for full response to complete
        await result.response;
      } else {
        // Non-streaming mode
        const result = (await runOneShotQuery(agentConfig, query, {
          onStepFinish: (step) => {
            // Show tool usage
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const formattedCmd = formatBashCommand(command);
                  agentProgress.updateTool(toolName, formattedCmd);
                } else {
                  agentProgress.updateTool(toolName);
                }
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
            }
          },
        })) as any; // Type assertion needed due to union type

        // Stop progress and display the final answer
        agentProgress.succeed();
        console.log("\n✨ Answer:\n");
        console.log(result.text);
      }

      // Cleanup
      await mode.cleanup();

      console.log("\n✅ Done!");
    } catch (error) {
      handleError(error, "executing query");
    } finally {
      // Shutdown observability if enabled
      await shutdownObservability();
    }
  });

/**
 * Prompt the user for input with a default value
 */
function prompt(
  rl: readline.Interface,
  question: string,
  defaultValue: string = ""
): Promise<string> {
  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` (${defaultValue})` : "";
    rl.question(`${question}${displayDefault}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Run the init command to create a configuration file
 */
async function runInitCommand(): Promise<void> {
  const configDir = path.join(os.homedir(), ".phoenix-insight");
  const configPath = path.join(configDir, "config.json");

  console.log("🚀 Phoenix Insight Configuration Setup\n");

  // Check if config file already exists
  let existingConfig: Record<string, unknown> | null = null;
  try {
    const existingContent = await fs.readFile(configPath, "utf-8");
    existingConfig = JSON.parse(existingContent);
    console.log(`⚠️  Config file already exists at ${configPath}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await prompt(rl, "Overwrite existing config? (yes/no)", "no");
    rl.close();

    if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
      console.log("\n❌ Init cancelled. Existing config preserved.");
      return;
    }
    console.log();
  } catch {
    // Config doesn't exist, which is fine
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Please provide your Phoenix configuration:\n");

  // Prompt for Phoenix base URL
  const baseUrl = await prompt(
    rl,
    "Phoenix base URL",
    "http://localhost:6006"
  );

  if (baseUrl === "http://localhost:6006") {
    console.log(
      "   ℹ️  Using default localhost URL. For Phoenix Cloud, use: https://app.phoenix.arize.com/s/<space_name>\n"
    );
  }

  // Prompt for Phoenix API key
  const apiKey = await prompt(rl, "Phoenix API key (optional, press Enter to skip)", "");

  if (!apiKey) {
    console.log(
      "   ℹ️  No API key provided. You can add one later if using Phoenix Cloud or authenticated Phoenix.\n"
    );
  }

  rl.close();

  // Build config object
  const config: Record<string, unknown> = {
    baseUrl,
    ...(apiKey && { apiKey }),
  };

  // Create directory if it doesn't exist
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Write config file
  try {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, content, "utf-8");

    console.log("✅ Configuration saved successfully!\n");
    console.log(`📁 Config file: ${configPath}`);
    console.log("\n📋 Configuration:");
    console.log(`   baseUrl: ${baseUrl}`);
    if (apiKey) {
      console.log(`   apiKey: ${apiKey.substring(0, 8)}...`);
    }
    console.log(
      "\n💡 You can now run 'phoenix-insight' to start analyzing your Phoenix data."
    );
  } catch (error) {
    console.error("\n❌ Error saving configuration:");
    console.error(
      `   ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

/**
 * Run the seed command to send a traced hello-world message
 */
async function runSeedCommand(): Promise<void> {
  const { generateText } = await import("ai");
  const { anthropic } = await import("@ai-sdk/anthropic");

  console.log("🌱 Phoenix Insight Seed - Verifying Phoenix Setup\n");

  // Load config
  let config;
  try {
    config = getConfig();
  } catch {
    // Config not initialized yet, initialize with defaults
    config = await initializeConfig({});
  }

  // Check for Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ Error: Missing ANTHROPIC_API_KEY environment variable\n");
    console.error("The Anthropic API key is required to run the seed command.\n");
    console.error("To fix this, set the environment variable:\n");
    console.error("  export ANTHROPIC_API_KEY=sk-ant-api03-...\n");
    console.error(
      "You can get an API key from: https://console.anthropic.com/\n"
    );
    process.exit(1);
  }

  console.log(`📋 Configuration:`);
  console.log(`   Phoenix URL: ${config.baseUrl}`);
  if (config.apiKey) {
    console.log(`   Phoenix API Key: ${config.apiKey.substring(0, 8)}...`);
  }
  console.log();

  // Initialize observability (always enabled for seed command)
  console.log("🔭 Initializing OpenTelemetry tracing...");
  initializeObservability({
    enabled: true,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    projectName: "phoenix-insight-seed",
    debug: !!process.env.DEBUG,
  });

  try {
    console.log("🤖 Sending hello-world message to Claude...\n");

    // Use ai-sdk generateText with a simple hello-world message
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    console.log("✨ Response from Claude:\n");
    console.log(`   ${result.text}\n`);

    // Ensure traces are flushed before showing success
    console.log("📤 Flushing traces to Phoenix...");
    await shutdownObservability();

    // Build the Phoenix UI URL
    let phoenixUrl = config.baseUrl;
    // Remove trailing slash if present
    if (phoenixUrl.endsWith("/")) {
      phoenixUrl = phoenixUrl.slice(0, -1);
    }
    // Add project path
    const projectUrl = `${phoenixUrl}/projects/phoenix-insight-seed`;

    console.log("\n✅ Seed completed successfully!\n");
    console.log("🔗 View your trace in Phoenix:");
    console.log(`   ${projectUrl}\n`);
    console.log(
      "💡 If you don't see the trace immediately, wait a few seconds and refresh the page."
    );
  } catch (error) {
    // Shutdown observability on error too
    await shutdownObservability();

    console.error("\n❌ Error during seed:");

    if (error instanceof Error) {
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("fetch failed")
      ) {
        console.error(
          `\n🌐 Network Error: Unable to connect to Phoenix at ${config.baseUrl}`
        );
        console.error("   Make sure Phoenix is running and accessible.");
        console.error(
          "   For self-hosted: docker run -d -p 6006:6006 arizephoenix/phoenix:latest"
        );
        console.error(
          "   For Phoenix Cloud: Update your config with the correct URL\n"
        );
      } else if (
        error.message.includes("authentication") ||
        error.message.includes("API key") ||
        error.message.includes("401")
      ) {
        console.error("\n🔒 Authentication Error:");
        console.error(
          "   Check your ANTHROPIC_API_KEY environment variable.\n"
        );
      } else {
        console.error(`   ${error.message}\n`);
      }
    } else {
      console.error(`   ${String(error)}\n`);
    }

    process.exit(1);
  }
}

/**
 * Open a URL in the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    // Linux and others - try xdg-open, fallback to sensible-browser
    command = `xdg-open "${url}" || sensible-browser "${url}"`;
  }

  exec(command, (error) => {
    if (error && process.env.DEBUG) {
      console.warn(`Could not open browser: ${error.message}`);
    }
  });
}

/**
 * Run the UI server with WebSocket support for agent interaction
 */
async function runUIServer(options: {
  port?: number;
  open?: boolean;
}): Promise<void> {
  // Ensure Anthropic API key is available for agent execution
  ensureAnthropicApiKey();

  const config = getConfig();
  const port = options.port ?? 6007;
  const shouldOpen = options.open !== false; // Default to opening browser

  console.log("🚀 Starting Phoenix Insight UI...\n");

  // Initialize observability if trace is enabled in config
  if (config.trace) {
    initializeObservability({
      enabled: true,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      projectName: "phoenix-insight-ui",
      debug: !!process.env.DEBUG,
    });
  }

  try {
    // Determine the execution mode - UI always uses local mode for persistence
    const mode: ExecutionMode = await createLocalMode();

    // Create Phoenix client
    const client = createPhoenixClient({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });

    // Create snapshot with config values
    const snapshotOptions = {
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      spansPerProject: config.limit,
      showProgress: true,
    };

    // Always use incremental snapshot for UI to reuse existing data
    await createIncrementalSnapshot(mode, snapshotOptions);

    console.log("\n✅ Snapshot ready.\n");

    // Create the UI HTTP server
    const uiServer = await createUIServer({ port, host: "127.0.0.1" });

    // Create the WebSocket server and attach to HTTP server
    const sessionManager = createSessionManager({
      mode,
      client,
      maxSteps: 25,
    });

    const wsServer = createWebSocketServer(uiServer.httpServer, {
      path: "/ws",
      onConnection: (ws: WebSocket) => {
        if (process.env.DEBUG) {
          console.log("WebSocket client connected");
        }
      },
      onDisconnection: async (ws: WebSocket, code, reason) => {
        if (process.env.DEBUG) {
          console.log(`WebSocket client disconnected: ${code} ${reason}`);
        }
        // Clean up the session when client disconnects
        await sessionManager.removeSession(ws);
      },
      onMessage: async (message, ws) => {
        if (message.type === "query") {
          const { content, sessionId: clientSessionId, history } = message.payload;
          const sessionId = clientSessionId ?? `session-${Date.now()}`;

          // Get or create session for this client
          const session = sessionManager.getOrCreateSession(
            ws,
            sessionId,
            (msg) => wsServer.sendToClient(ws, msg)
          );

          // Execute the query (this is async but we don't await - let it stream)
          // Pass the client-provided history if available; otherwise fall back to server-side history
          session.executeQuery(content, { history }).catch((error) => {
            console.error("Error executing query:", error);
            wsServer.sendToClient(ws, {
              type: "error",
              payload: {
                message:
                  error instanceof Error
                    ? error.message
                    : "An error occurred while executing the query",
                sessionId,
              },
            });
          });
        } else if (message.type === "cancel") {
          const session = sessionManager.getSessionForClient(ws);
          if (session) {
            session.cancel();
          }
        }
      },
      onError: (error, ws) => {
        console.error("WebSocket error:", error.message);
      },
    });

    const url = `http://localhost:${uiServer.port}`;

    console.log("🌐 Phoenix Insight UI is running!");
    console.log(`   Local:   ${url}`);
    console.log("\n💡 Press Ctrl+C to stop the server\n");

    // Open browser if not disabled
    if (shouldOpen) {
      openBrowser(url);
    }

    // Handle graceful shutdown with timeout
    let isShuttingDown = false;
    const SHUTDOWN_TIMEOUT_MS = 3000;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n\n📥 Received ${signal}, shutting down gracefully...`);

      // Set up a timeout to force exit if graceful shutdown takes too long
      const forceExitTimeout = setTimeout(() => {
        console.log("⏱️  Shutdown timeout reached, forcing exit...");
        wsServer.forceClose();
        uiServer.forceClose();
        process.exit(0);
      }, SHUTDOWN_TIMEOUT_MS);

      try {
        // Close WebSocket connections first
        await wsServer.close();

        // Close the UI server
        await uiServer.close();

        // Clean up sessions
        await sessionManager.cleanup();

        // Clean up execution mode
        await mode.cleanup();

        // Shutdown observability if enabled
        await shutdownObservability();

        clearTimeout(forceExitTimeout);
        console.log("👋 Server stopped. Goodbye!");
        process.exit(0);
      } catch (error) {
        clearTimeout(forceExitTimeout);
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Keep the process running
    await new Promise(() => {
      // This promise never resolves - server runs until SIGINT/SIGTERM
    });
  } catch (error) {
    handleError(error, "starting UI server");
  }
}

async function runInteractiveMode(): Promise<void> {
  // Ensure Anthropic API key is available for agent execution
  ensureAnthropicApiKey();

  const config = getConfig();

  console.log("🚀 Phoenix Insight Interactive Mode");
  console.log(
    "Type your queries below. Type 'help' for available commands or 'exit' to quit.\n"
  );

  // Prevent the process from exiting on unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("\n⚠️  Unhandled promise rejection:", reason);
    console.error(
      "The interactive mode will continue. You can try another query."
    );
  });

  // Initialize observability if trace is enabled in config
  if (config.trace) {
    initializeObservability({
      enabled: true,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      projectName: "phoenix-insight",
      debug: !!process.env.DEBUG,
    });
  }

  // Setup mode and snapshot once for the session
  let mode: ExecutionMode;
  let agent: any;

  try {
    // Determine the execution mode
    mode =
      config.mode === "local" ? await createLocalMode() : createSandboxMode();

    // Create Phoenix client
    const client = createPhoenixClient({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });

    // Create or update snapshot
    const snapshotOptions = {
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      spansPerProject: config.limit,
      showProgress: true,
    };

    if (config.refresh || config.mode !== "local") {
      await createSnapshot(mode, snapshotOptions);
    } else {
      await createIncrementalSnapshot(mode, snapshotOptions);
    }

    console.log(
      "\n✅ Snapshot ready. You can now ask questions about your Phoenix data.\n"
    );

    // Create agent configuration
    const agentConfig: PhoenixInsightAgentConfig = {
      mode,
      client,
      maxSteps: 25,
    };

    // Create reusable agent
    agent = await createInsightAgent(agentConfig);

    // Conversation history for multi-turn interactions (ephemeral, cleared on exit)
    const conversationHistory: ConversationMessage[] = [];

    // Setup readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "phoenix> ",
      terminal: true, // Ensure terminal mode for better compatibility
    });

    let userExited = false;

    // Handle SIGINT (Ctrl+C) gracefully
    rl.on("SIGINT", () => {
      if (userExited) {
        process.exit(0);
      }
      console.log(
        '\n\nUse "exit" to quit or press Ctrl+C again to force exit.'
      );
      userExited = true;
      rl.prompt();
    });

    // Helper function to execute a single agent query with optional history
    // Returns the result or throws an error
    const executeAgentQuery = async (
      query: string,
      messages: ConversationMessage[],
      agentProgress: AgentProgress
    ): Promise<{ assistantMessages: ConversationMessage[] }> => {
      if (config.stream) {
        // Stream mode - pass conversation history
        const result = await agent.stream(query, {
          messages: [...messages],
          onStepFinish: (step: any) => {
            // Show tool usage even in stream mode
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const shortCmd = command.split("\n")[0].substring(0, 50);
                  agentProgress.updateTool(
                    toolName,
                    shortCmd + (command.length > 50 ? "..." : "")
                  );
                } else {
                  agentProgress.updateTool(toolName);
                }
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
            }
          },
        });

        // Stop progress before streaming
        agentProgress.stop();

        // Handle streaming response
        console.log("\n✨ Answer:\n");
        for await (const chunk of result.textStream) {
          process.stdout.write(chunk);
        }
        console.log(); // Final newline

        // Wait for full response to complete and extract messages
        await result.response;

        const assistantMessages = await extractMessagesFromResponse(result);
        return { assistantMessages };
      } else {
        // Non-streaming mode - pass conversation history
        const result = await agent.generate(query, {
          messages: [...messages],
          onStepFinish: (step: any) => {
            // Show tool usage
            if (step.toolCalls?.length) {
              step.toolCalls.forEach((toolCall: any) => {
                const toolName = toolCall.toolName;
                if (toolName === "bash") {
                  // Extract bash command for better visibility
                  const command = toolCall.args?.command || "";
                  const shortCmd = command.split("\n")[0].substring(0, 50);
                  agentProgress.updateTool(
                    toolName,
                    shortCmd + (command.length > 50 ? "..." : "")
                  );
                } else {
                  agentProgress.updateTool(toolName);
                }
              });
            }

            // Show tool results
            if (step.toolResults?.length) {
              step.toolResults.forEach((toolResult: any) => {
                agentProgress.updateToolResult(
                  toolResult.toolName,
                  !toolResult.isError
                );
              });
            }
          },
        });

        // Stop progress and display the final answer
        agentProgress.succeed();
        console.log("\n✨ Answer:\n");
        console.log(result.text);

        const assistantMessages = await extractMessagesFromResponse(result);
        return { assistantMessages };
      }
    };

    // Helper function to process a single query
    const processQuery = async (query: string): Promise<boolean> => {
      if (query === "exit" || query === "quit") {
        return true; // Signal to exit
      }

      if (query === "help") {
        console.log("\n📖 Interactive Mode Commands:");
        console.log("   help              - Show this help message");
        console.log("   exit, quit        - Exit interactive mode");
        console.log(
          "   px-fetch-more     - Fetch additional data (e.g., px-fetch-more spans --project <name> --limit <n>)"
        );
        console.log("\n💡 Usage Tips:");
        console.log(
          "   • Ask natural language questions about your Phoenix data"
        );
        console.log(
          "   • The agent has access to bash commands to analyze the data"
        );
        console.log(
          "   • Use px-fetch-more commands to get additional data on-demand"
        );
        console.log("\n🔧 Options (set when starting phoenix-insight):");
        console.log(
          "   --local           - Use local mode with persistent storage"
        );
        console.log(
          "   --stream          - Stream agent responses in real-time"
        );
        console.log("   --refresh         - Force fresh snapshot data");
        console.log("   --limit <n>       - Set max spans per project");
        console.log("   --trace           - Enable observability tracing");
        return false;
      }

      if (query === "") {
        return false;
      }

      try {
        // Show continuation message if there's existing history
        if (conversationHistory.length > 0) {
          console.log(
            `(continuing conversation with ${conversationHistory.length} previous messages)\n`
          );
        }

        const agentProgress = new AgentProgress(!config.stream);
        agentProgress.startThinking();

        // Track whether we had to compact
        let didCompact = false;
        let currentHistory = [...conversationHistory];

        try {
          const { assistantMessages } = await executeAgentQuery(
            query,
            currentHistory,
            agentProgress
          );

          // Update conversation history with user message and assistant response
          conversationHistory.push(createUserMessage(query));
          conversationHistory.push(...assistantMessages);
        } catch (error) {
          // Check if this is a token limit error - if so, compact and retry
          if (isTokenLimitError(error) && conversationHistory.length > 0) {
            // Stop any running progress indicator
            agentProgress.stop();

            // Display warning to user
            console.log(
              "\n⚠️  Context was trimmed to fit model limits\n"
            );

            // Compact the conversation history
            const compactedHistory = compactConversation(conversationHistory);
            currentHistory = compactedHistory;
            didCompact = true;

            // Create a new progress indicator for the retry
            const retryProgress = new AgentProgress(!config.stream);
            retryProgress.startThinking();

            // Retry with compacted history
            const { assistantMessages } = await executeAgentQuery(
              query,
              currentHistory,
              retryProgress
            );

            // Update conversation history - replace with compacted version plus new messages
            conversationHistory.length = 0;
            conversationHistory.push(...compactedHistory);
            conversationHistory.push(createUserMessage(query));
            conversationHistory.push(...assistantMessages);
          } else {
            // Re-throw non-token-limit errors
            throw error;
          }
        }

        console.log("\n" + "─".repeat(50) + "\n");

        // Show info about compaction if it happened
        if (didCompact) {
          console.log(
            `(conversation compacted to ${conversationHistory.length} messages)\n`
          );
        }
      } catch (error) {
        console.error("\n❌ Query Error:");
        if (error instanceof PhoenixClientError) {
          console.error(`   ${error.message}`);
        } else if (error instanceof Error) {
          console.error(`   ${error.message}`);
        } else {
          console.error(`   ${String(error)}`);
        }
        console.error("   You can try again with a different query\n");
      }

      return false;
    };

    // Use event-based approach instead of async iterator to prevent
    // premature exit when ora/spinners interact with stdin
    await new Promise<void>((resolve) => {
      rl.on("line", async (line) => {
        const query = line.trim();

        // Pause readline while processing to prevent queuing
        rl.pause();

        const shouldExit = await processQuery(query);

        if (shouldExit) {
          rl.close();
        } else {
          // Resume and show prompt for next input
          rl.resume();
          rl.prompt();
        }
      });

      rl.on("close", () => {
        resolve();
      });

      // Show initial prompt
      rl.prompt();
    });

    console.log("\n👋 Goodbye!");

    // Cleanup
    await mode.cleanup();

    // Shutdown observability if enabled
    await shutdownObservability();
  } catch (error) {
    handleError(error, "setting up interactive mode");
  }
}

program.parse();
