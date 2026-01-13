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

## Phase 1: Research & Planning

### research-phoenix-use-cases

- content: Review Phoenix documentation to understand key use cases (tracing, evals, datasets/experiments, prompts) for writing relevant query examples. Document 8-12 compelling query examples that demonstrate real Phoenix analysis scenarios.
- status: complete
- dependencies: none
- notes: Completed during planning - use cases documented below for reference by later tasks

**Phoenix Use Cases for Query Examples:**
1. **Tracing/Latency**: "What are the slowest LLM calls in my application?" / "Find traces where latency exceeds 5 seconds"
2. **Error Analysis**: "Show me all failed spans and their error messages" / "What are the most common exceptions in the last 24 hours?"
3. **Token Usage**: "Which LLM calls are consuming the most tokens?" / "Calculate total token cost for the chatbot project"
4. **RAG Analysis**: "Show retrieved documents with low relevance scores" / "Find retrieval calls that returned no results"
5. **Evaluation Results**: "What's the hallucination rate across my experiments?" / "Compare accuracy scores between model versions"
6. **Dataset Analysis**: "Show statistics for my evaluation datasets" / "Find examples where the model failed quality checks"
7. **Prompt Engineering**: "List all prompt versions and their performance" / "Compare outputs between prompt v1 and v2"
8. **Session Analysis**: "Show the conversation flow for session X" / "Find sessions with high user abandonment"
9. **Tool Calls**: "Which tools are being called most frequently?" / "Find tool calls that failed or timed out"
10. **Embedding Analysis**: "Show embedding dimensions across projects" / "Find semantic similarity outliers in retrieval"

---

## Phase 2: Documentation Restructure

### create-troubleshooting-doc

- content: Extract all troubleshooting content from README.md into a new TROUBLESHOOTING.md file. Include connection issues, authentication errors, debug mode, and common issues sections. Add cross-reference link in README.
- status: pending
- dependencies: none

### restructure-readme-intro

- content: Rewrite the README introduction to lead with architecture value proposition. Explain the "bash + files" paradigm, why filesystem-native analysis is powerful, and how it enables transparent AI-driven observability. Keep it concise (2-3 paragraphs max).
- status: pending
- dependencies: none

### consolidate-cli-examples

- content: Create a single progressive "CLI Examples" section that starts with basic usage and advances to complex scenarios. Remove scattered examples from other sections. Cover: basic query, interactive mode, snapshot management, local mode, connection options, all flags with brief examples.
- status: pending
- dependencies: create-troubleshooting-doc

### create-query-examples-section

- content: Create a dedicated "Example Queries" section showcasing useful natural language queries for Phoenix analysis. Include categories: Error Analysis, Performance/Latency, Token Usage, RAG Analysis, Evaluations, Dataset Analysis, and Prompt Engineering. Use real Phoenix terminology.
- status: pending
- dependencies: research-phoenix-use-cases

### create-command-reference-tables

- content: Create separate CLI reference tables for each command (default/query, snapshot, prune, help). Each table should list all options with descriptions, defaults, and brief inline examples. Remove the current single combined table.
- status: pending
- dependencies: consolidate-cli-examples

---

## Phase 3: Content Sequencing

### sequence-basic-content

- content: Organize the "basic" portion of README: Introduction (architecture value), Installation, Quick Start, CLI Examples (progressive), Example Queries. Ensure smooth flow from simple to intermediate usage.
- status: pending
- dependencies: restructure-readme-intro, consolidate-cli-examples, create-query-examples-section, create-command-reference-tables

### sequence-advanced-content

- content: Organize the "advanced" portion of README: Configuration (file, env vars, tables), Execution Modes (sandbox vs local details), Agent Capabilities, Observability (--trace), Development, Contributing & Releases, License. Move these sections to the end.
- status: pending
- dependencies: sequence-basic-content

### remove-redundancy

- content: Final pass to remove all redundant content. Eliminate duplicate explanations, consolidate repeated flag descriptions, remove any content that appears in multiple places. Ensure each concept is explained exactly once.
- status: pending
- dependencies: sequence-advanced-content

---

## Phase 4: Final Review

### review-and-polish

- content: Final review of restructured README. Check for: consistent formatting, working markdown links, logical flow from basic to advanced, all commands documented with all options, no orphaned sections. Fix any issues found.
- status: pending
- dependencies: remove-redundancy
