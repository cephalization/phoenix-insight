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
