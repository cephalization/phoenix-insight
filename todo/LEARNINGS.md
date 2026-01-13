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

## create-troubleshooting-doc

- The README troubleshooting section was at lines 318-399, containing: Connection Issues, Authentication Errors, Debug Mode, and Common Issues
- When extracting content, I expanded the documentation with additional context (e.g., added Docker/remote server notes, slow queries section, Phoenix instance errors section) to make TROUBLESHOOTING.md a more complete standalone guide
- The cross-reference link in README.md keeps the troubleshooting section header so users know where to look, but directs them to the detailed guide
- Pattern: Extract content, enhance it for the standalone doc, then simplify the original to just a pointer

## restructure-readme-intro

- The previous intro was descriptive but buried the value proposition. The new intro leads with "what you get" (AI-powered analysis) and "how it works" (bash + files paradigm)
- Key insight: The architecture's value is transparency and reproducibility. Every AI query is just bash commands on files, so users can inspect, copy, and reproduce anything the agent does
- Kept it to exactly 2 paragraphs as requested, covering: (1) what it is and how it works, (2) why the filesystem-native approach matters
- The Vercel blog link is preserved as it provides important context for the paradigm
- Made sure to mention specific commands (cat, grep, jq, awk) to make the "bash" concept concrete and familiar

## consolidate-cli-examples

- Identified 7 scattered example sections: Quick Start, Usage Examples (Basic Queries + Advanced Options), Interactive Mode, Snapshot Management, On-Demand Data Fetching, plus duplicates in Local Mode Storage and Observability
- Created a single progressive "CLI Examples" section with subsections: Basic Queries, Interactive Mode, Snapshot Management, Local Mode, Connection Options, Data Fetching Options, Output Options, Observability, On-Demand Data Fetching, Combining Options
- Kept the Quick Start section minimal (3 examples) for quick onboarding, with the full examples in CLI Examples
- Removed duplicate examples from Local Mode Storage and Observability sections, replacing them with cross-reference links to CLI Examples
- Important: When consolidating, I accidentally removed the Execution Modes section - had to re-add it between Filesystem Structure and CLI Examples
- Pattern: When doing large edits that replace multiple sections, double-check that all essential explanatory content (not just examples) is preserved
- The progressive structure goes: basic usage → interactive mode → snapshot management → local mode → connection → data fetching → output → observability → on-demand → combining options

## create-query-examples-section

- Added a dedicated "Example Queries" section after "CLI Examples" and before "Configuration" to maintain the basic-to-advanced flow
- Organized into 9 categories covering all requested areas plus two bonus categories (Session Analysis and Tool Calls) that were in the research notes
- Categories: Error Analysis, Performance & Latency, Token Usage & Costs, RAG Analysis, Evaluations & Experiments, Dataset Analysis, Prompt Engineering, Session & Conversation Analysis, Tool & Function Calls
- Each category has 4 example queries showing progressively more specific or advanced use cases
- Used Phoenix-specific terminology: spans, traces, sessions, evaluations, experiments, retrievals, embeddings, tool calls
- Key insight: The queries should demonstrate what's uniquely possible with Phoenix Insight's filesystem approach (e.g., cross-project analysis, aggregations, pattern detection) rather than simple lookups
- Pattern: Each query example is a complete `phoenix-insight "..."` command users can copy-paste directly
- Placed section strategically to flow from "how to use the CLI" (CLI Examples) to "what to ask" (Example Queries) to "how to configure" (Configuration)

## create-command-reference-tables

- Replaced the single combined CLI options table with four separate command-specific tables: Query (default), Snapshot, Prune, and Help
- Each table includes: Option, Description, Default value, and Example (showing actual usage)
- Key insight: Reading the source code (`src/cli.ts`) was essential to understand which options apply to which commands. The Commander.js setup shows:
  - Query command (default): Most options including `--sandbox`, `--local`, `--stream`, `--interactive`
  - Snapshot command: Inherits global options via preAction hook (`--config`, `--base-url`, `--api-key`, `--trace`, `--refresh`, `--limit`)
  - Prune command: Only has `--dry-run`
  - Help command: No additional options
- Added code blocks showing the command syntax before each table (e.g., `phoenix-insight [options] [query]`)
- Pattern: Include inline examples in the table's Example column so users can see real usage without scrolling to CLI Examples section
- The Help command gets a minimal section (no table needed, just explains what it does)
- Changed section header from "Commands" + "Command Line Options" to single "Command Reference" with subheadings for each command

## sequence-basic-content

- The task was to organize the "basic" portion of README to flow: Introduction → Installation → Quick Start → CLI Examples → Example Queries
- The original README had "How It Works", "Filesystem Structure", and "Execution Modes" sections sandwiched between Quick Start and CLI Examples, breaking the simple→complex flow
- Moved these explanatory sections to after Example Queries with a horizontal rule (---) as a visual separator between "basic usage" and "advanced details"
- The Command Reference tables were also moved up to follow Example Queries since they're essential reference material for the basic section
- Key insight: The separation between "basic" and "advanced" content is about user journey - users want to know "how do I use this?" before "how does this work internally?"
- Fixed a broken internal link: `#observability-1` changed to `#observability` since the section ID is no longer duplicated after reorganization
- The next task (sequence-advanced-content) should properly order the advanced sections: Configuration, Execution Modes, Agent Capabilities, Observability, Development, Contributing, License

## sequence-advanced-content

- Reorganized advanced sections into a logical flow after the basic content: Configuration → Execution Modes → Agent Capabilities → Observability → Troubleshooting → Development → Contributing & Releases → Support → License
- Added an "Advanced Topics" header with a brief intro sentence to create a clear boundary between basic and advanced content
- Key insight: The advanced section order follows a "configure → understand → extend" progression:
  1. Configuration (how to customize) - most commonly needed by power users
  2. Execution Modes (sandbox vs local) - understanding the two operating modes
  3. Agent Capabilities (what the AI can do) - internal details about bash commands and tools
  4. Observability (tracing) - self-monitoring capabilities
  5. Troubleshooting (link) - help when things go wrong
  6. Development (building from source) - for contributors
  7. Contributing & Releases - how to contribute
  8. Support, License - standard end sections
- Moved "Examples of Agent Analysis" and "Tips and Best Practices" to just before the "Advanced Topics" divider since they're practical content useful to all users, not just power users
- The horizontal rule (---) serves as a visual separator between the basic usage sections and the advanced configuration/internals sections
- Pattern: Group content by user intent - basic users want to start using, advanced users want to customize and understand internals

## remove-redundancy

- Reduced README from 706 to 661 lines by eliminating duplicate content
- Key redundancies found and addressed:
  1. **Local mode explanation**: Condensed CLI Examples "Local Mode" subsection to a single command example - full explanation is in the Execution Modes section
  2. **Streaming output**: Removed redundant "Stream responses in real-time (default: enabled)" example since the Command Reference table already explains it's enabled by default
  3. **Observability section**: Condensed from 8 lines to 2 lines - the CLI Examples already show `--trace` usage, so the advanced section only needs a brief explanation of what tracing does
  4. **Execution Modes section**: Converted from two multi-bullet subsections to a compact comparison table, reducing from 14 lines to 4 lines while preserving all information
  5. **On-demand data fetching**: Removed verbose intro text, added cross-reference from Agent Capabilities "Custom Commands" to avoid repeating the same command examples
  6. **Local Mode Storage**: Condensed directory structure example by combining nested paths
- Pattern: CLI Examples section should focus on "how to use" (command examples), while Advanced Topics sections explain "how it works" (internal details). When there's overlap, keep the usage in CLI Examples and link to it from the explanatory section
- Pattern: Use tables for comparing multiple related items (like Sandbox vs Local mode) - more compact and scannable than bullet lists
- Removed intro sentences like "Control how results are displayed:" before code blocks when the code comments are self-explanatory
