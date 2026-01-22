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

## conversation-types

- **AI SDK v6 ModelMessage types**: The key types are exported from `ai` package directly (`ModelMessage`, `UserModelMessage`, `AssistantModelMessage`, `ToolModelMessage`). The actual definitions are in `@ai-sdk/provider-utils` but re-exported from `ai`.

- **Tool call/result differences between our types and SDK**: 
  - Our `ConversationToolCallPart` uses `args` field, but SDK's `ToolCallPart` uses `input`
  - Our `ConversationToolResultPart` uses `result` field, but SDK's `ToolResultPart` uses `output` with a discriminated union type (`{type: "json", value}` or `{type: "error-json", value}`)

- **JSONValue requirement**: The `ToolResultPart.output.value` in AI SDK requires `JSONValue` type, not `unknown`. We re-export `JSONValue` from the conversation module so consumers can use it when creating tool results.

- **Pattern that worked well**: Creating a simplified internal type system (`ConversationMessage`) with conversion functions (`toModelMessages`) provides a clean API while handling the SDK's more complex type structure internally.

- **Test location**: Tests for agent code go in `test/agent/` directory following existing patterns in `test/snapshot/`, `test/server/`, etc.

## message-conversion-utils

- **toModelMessages already existed**: The `conversation-types` task had already implemented `toModelMessages()` and related conversion functions. The main work for this task was implementing `truncateReportToolCalls()`.

- **truncateReportToolCalls design decisions**:
  - Works on `ModelMessage[]` (AI SDK format) rather than `ConversationMessage[]` because it's intended to be applied after conversion to the SDK format, just before sending to the model
  - Preserves the `title` field from generate_report calls since it provides useful context and is small
  - Only replaces the `content` field with a placeholder, not the entire input
  - Does not mutate original messages - creates new objects via spread operator
  - Handles edge cases: string content, non-assistant messages, non-tool-call parts

- **Type casting in tests**: When testing ModelMessage types, TypeScript requires careful casting since the SDK types use discriminated unions. Using `as AssistantModelMessage` and explicit array typing helps make tests readable.

- **Port conflict in tests**: The `test/server/ui.test.ts` can fail with EADDRINUSE if port 6007 is in use. This is an environmental issue unrelated to code changes.
