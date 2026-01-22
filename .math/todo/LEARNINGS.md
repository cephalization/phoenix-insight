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

## agent-messages-api

- **AI SDK multi-turn conversation support**: The AI SDK supports two mutually exclusive ways to provide user input: `prompt` (single string) or `messages` (array of ModelMessage). When using `messages`, the user query should be appended as the last message, not passed via `prompt`.

- **Backward compatibility maintained**: The `messages` parameter is optional. When not provided or empty, the methods fall back to using `prompt` directly, preserving existing behavior for single-turn queries.

- **Token optimization integrated**: The implementation automatically calls `truncateReportToolCalls()` on history before sending to the model. This ensures report tool calls don't bloat the context window.

- **Message conversion flow**: 
  1. Convert `ConversationMessage[]` history to `ModelMessage[]` via `toModelMessages()`
  2. Apply `truncateReportToolCalls()` to truncate dense report content
  3. Convert current query to user message via `createUserMessage()` then `toModelMessages()`
  4. Concatenate truncated history with current query
  5. Pass combined array to AI SDK's `messages` property

- **Helper functions**: Also updated `runQuery()` and `runOneShotQuery()` wrapper functions to pass through the `messages` parameter for consistency.

- **Type re-export**: Added `export type { ConversationMessage }` to make the type accessible from the agent module without importing from conversation.js directly.

- **Testing pattern**: Used `vi.mock()` to mock the AI SDK functions and verify the correct parameters are passed. The mocks intercept `generateText` and `streamText` calls, allowing inspection of whether `prompt` or `messages` was used.

## cli-session-token-retry

- **Refactored executeQuery into two methods**: The original `executeQuery()` method was monolithic. To implement retry logic cleanly, I extracted the core streaming logic into a private `executeQueryWithHistory()` method that returns an error (or null on success) instead of throwing. This allows the main `executeQuery()` to handle the token error detection and retry flow without deeply nested try-catch blocks.

- **Retry pattern design**: The retry happens at most once. If the first attempt fails with a token limit error:
  1. Compact the conversation history in place (mutating `this.conversationHistory`)
  2. Send `context_compacted` notification to the client with a reason
  3. Retry with the compacted history
  4. If retry also fails, send error to client (no further retries)
  
- **Error handling flow**: The `executeQueryWithHistory()` method catches errors and returns them instead of re-throwing. This allows the caller to distinguish between success (null returned), token limit errors (needs retry), and other errors (send error to client).

- **WebSocket message type addition**: Added `context_compacted` message type to `ServerMessage` union in `packages/ui/src/lib/websocket.ts`. The CLI's `websocket.ts` imports these types from the UI package, so only one change was needed. The payload includes `sessionId` (required) and `reason` (optional) for displaying to users.

- **Helper function reuse**: Used `getTokenLimitErrorDescription()` from `token-errors.ts` to generate user-friendly messages explaining why compaction happened, including token counts if available in the error message.

- **Done signal handling**: Important to only send `sendDone()` once per query execution. With the retry logic, need to ensure `sendDone()` is called in the success paths (both first attempt success and retry success) but not called when errors occur (errors are sent via `sendError()` instead).

## token-error-detection

- **APICallError from AI SDK**: The `APICallError` class is exported from the `ai` package (re-exported from `@ai-sdk/provider`). It has:
  - `statusCode?: number` - HTTP status code (may be undefined)
  - `message: string` - Error message
  - `static isInstance(error: unknown): error is APICallError` - Built-in type guard

- **Conservative detection approach**: The implementation requires BOTH a relevant status code (400, 413, 422) AND a matching error message pattern. This prevents false positives from other 400 errors like "Invalid JSON". When statusCode is undefined, it falls back to message pattern matching only.

- **Token limit error patterns**: Collected from Anthropic API documentation and common patterns:
  - "prompt is too long"
  - "context window", "context length"
  - "max_tokens", "token limit"
  - "tokens exceed", "too many tokens"
  
- **Testing with real APICallError instances**: Created actual `APICallError` instances in tests rather than mocking, because `APICallError.isInstance()` is used for type checking. The helper function `createAPICallError()` makes test setup cleaner.

- **Helper function added**: Also implemented `getTokenLimitErrorDescription()` to extract user-friendly descriptions from token limit errors, including extracting token counts from messages like "150000 tokens".

- **Pre-existing test failure**: The `test/server/ui.test.ts` can fail with `EADDRINUSE` on port 6007. This is an environmental issue from other processes, not related to code changes.

## conversation-compaction

- **AI SDK `pruneMessages()` function**: Exported from `ai` package. Has three main options:
  - `reasoning`: `'all'` | `'before-last-message'` | `'none'` - controls removal of reasoning parts
  - `toolCalls`: `'all'` | `'before-last-message'` | `'before-last-${n}-messages'` | `'none'` | array of tool-specific rules
  - `emptyMessages`: `'keep'` | `'remove'` - whether to remove messages that become empty after pruning

- **Design decision: Split first/middle/last**: Instead of using `pruneMessages()` on the entire history with `before-last-N-messages`, we split the conversation into three parts:
  1. First N messages (kept intact - system context/initial instructions)
  2. Middle messages (heavily pruned - all reasoning and tool calls removed)
  3. Last N messages (kept intact - recent context)
  This provides more control than pruneMessages alone, which only protects trailing messages.

- **Required inverse conversion**: Implemented `fromModelMessage()` and `fromModelMessages()` to convert back from AI SDK's `ModelMessage[]` to internal `ConversationMessage[]` after pruning. Key details:
  - `SystemModelMessage.content` is always a string (not an array like user messages)
  - `ToolResultPart.output` uses discriminated union `{type: "json"|"error-json"|"text"|"error-text", value}`
  - Reasoning parts are skipped since they're not in our internal format
  - System messages converted to user messages with `[System]:` prefix

- **TypeScript type guard pattern**: When filtering arrays, use type guard functions (e.g., `(p): p is ConversationTextPart => p.type === "text"`) to properly narrow types in the resulting array.

- **Short-circuit optimization**: If `messages.length <= keepFirstN + keepLastN`, return the array as-is without conversion/pruning overhead.

## cli-session-history

- **Replaced simple history type with rich ConversationMessage**: The old `session.ts` had a simple `ConversationMessage` type with just `role`, `content`, and `timestamp`. Replaced with the rich type from `conversation.ts` which supports tool calls, tool results, and multi-part content.

- **History array must be copied, not referenced**: When passing `conversationHistory` to `agent.stream()`, must pass a spread copy (`[...this.conversationHistory]`) rather than the array reference. Otherwise, when the test checks the mock's arguments AFTER multiple queries, it sees the mutated array, not the array at the time of each call.

- **User message added AFTER successful completion**: Initially tried adding the user message to history BEFORE calling the agent, but this causes duplication since the agent also appends the userQuery as the last message. The solution is to add the user message only AFTER the response completes successfully, along with the assistant messages.

- **extractMessagesFromResponse requires steps**: The mock agent must return a `steps` array (not just `fullStream` and `response`) because `extractMessagesFromResponse()` reads from `result.steps` to build the conversation messages. Each step contains `text`, `toolCalls`, and `toolResults`.

- **Re-exported ConversationMessage type**: Added `export type { ConversationMessage }` in session.ts so external consumers can import the type from either the session module or conversation module.
