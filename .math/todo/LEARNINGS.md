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

## interactive-cli-history

- **Pattern: Pass history copy, not reference**: When passing `conversationHistory` to `agent.stream()` or `agent.generate()`, pass a spread copy (`[...conversationHistory]`) instead of the array directly. The agent modifies its internal view but shouldn't affect the original array until we explicitly update it after the response completes.

- **User message added AFTER successful response**: Following the same pattern from `cli-session-history`, the user message is added to the conversation history only AFTER the agent completes successfully (including tool calls), along with the extracted assistant messages from `extractMessagesFromResponse()`. This avoids duplication since the agent internally appends the user query.

- **Continuation message format**: When there's existing history, the CLI shows `(continuing conversation with N previous messages)` before processing the query. This provides visibility to users that context from previous exchanges is being used.

- **History persists across multiple queries in a session**: The `conversationHistory` array is declared outside the `processQuery` closure but inside `runInteractiveMode`, so it persists across queries but is cleared when the CLI exits (ephemeral, as required).

- **Both streaming and non-streaming paths updated**: Both the `config.stream` branch (using `agent.stream()`) and the non-streaming branch (using `agent.generate()`) pass `messages: [...conversationHistory]` and update the history after the response completes. The update logic is identical in both paths.

## interactive-cli-token-retry

- **Refactored processQuery to separate execution logic**: Extracted the core agent execution (streaming/non-streaming) into a separate `executeAgentQuery()` helper function. This allows the main `processQuery()` function to implement retry logic cleanly without duplicating the complex streaming/tool handling code.

- **Single retry pattern**: The implementation retries exactly once on token limit error. If the retry also fails (whether token error or other), it falls through to the normal error handling. This prevents infinite retry loops.

- **History replacement strategy**: When compaction is needed:
  1. Compact the current history using `compactConversation()`
  2. Execute retry with the compacted history
  3. On success, REPLACE the original `conversationHistory` entirely with: compacted history + new user message + assistant response
  This ensures the conversation history reflects the compacted state going forward.

- **Progress indicator handling**: The initial progress indicator must be stopped before displaying the compaction warning. A new progress indicator is created for the retry attempt. This provides clean visual feedback to the user.

- **User feedback messages**: 
  - Warning shown immediately: `⚠️  Context was trimmed to fit model limits`
  - Info shown after response: `(conversation compacted to N messages)`
  This helps users understand what happened without being intrusive.

- **Imports required**: Added imports for `compactConversation` from conversation.ts and `isTokenLimitError` from token-errors.ts.

- **Error condition check**: Only attempt compaction+retry if `conversationHistory.length > 0`. If history is empty, there's nothing to compact, so the error is re-thrown immediately.

## ui-send-history

- **Parallel type definitions**: Defined `UIConversationMessage` and related types in the UI package (`websocket.ts`) that mirror the CLI's `ConversationMessage` types. This creates a clear wire format boundary - the UI converts its internal `Message` types to `UIConversationMessage` before sending, and the CLI will convert received `UIConversationMessage` to its `ConversationMessage` format.

- **UI Message to ConversationMessage conversion**: The UI stores messages differently from the conversation format:
  - UI: Each `Message` has `role` and `content`, with optional embedded `toolCalls` array
  - Conversation format: Tool calls are inline content parts, tool results are separate `tool` role messages
  
  The `convertMessagesToHistory()` function handles this conversion, creating:
  1. Assistant messages with `content` as array of text/tool-call parts when tool calls exist
  2. Separate `tool` role messages containing tool results after each assistant message with tool calls

- **History sent only when non-empty**: The query payload only includes `history` field when there are previous messages (`history.length > 0`). This keeps payloads minimal for fresh sessions.

- **Type exports via barrel file**: The UI types are exported via `packages/ui/src/lib/types.ts` which re-exports from `websocket.ts`. The CLI imports from `@cephalization/phoenix-insight-ui/types`, so updating the UI types automatically updates what the CLI sees (no separate CLI changes needed).

- **Tool call status handling**: When converting tool calls, we check for both `completed` and `error` statuses to include results. The `isError` flag is set based on the status being `error`.

- **History captured before adding user message**: The history is captured from the session BEFORE adding the new user message to the store. This is important because the server will add the user message as part of the conversation when processing.

## ui-handle-compaction

- **Type already defined**: The `context_compacted` message type was already added to `ServerMessage` in `websocket.ts` during the `cli-session-token-retry` task (lines 115-118). This task only required adding the handler.

- **Handler added to switch statement**: Added a case for `context_compacted` in the `handleMessage` callback inside `useWebSocket.ts`. The handler uses `toast.info()` from sonner to display a non-intrusive notification.

- **Toast message design**: Uses title "Conversation context trimmed" with description from the `reason` field if provided, otherwise a default message "Older messages were summarized to fit model context limits." Duration set to 5 seconds to match other toast notifications in the codebase.

- **No store updates needed**: Unlike `text`, `tool_call`, `tool_result` etc., the `context_compacted` message doesn't update any stores. It's purely informational to the user - the server handles the actual compaction on its side.

- **Test pattern**: Added two tests for `context_compacted` messages - one without a reason and one with a reason. Tests verify the handler doesn't throw, since toast notifications are fire-and-forget (no state changes to assert on).

## cli-session-use-ui-history

- **UI to CLI type conversion**: Created `fromUIMessages()` function in `conversation.ts` to convert UI message types to internal `ConversationMessage[]` format. The UI types (`UIConversationMessage`) mirror the CLI types but are defined separately in the UI package to avoid tight coupling. The conversion handles all three message roles (user, assistant, tool) and their content structures.

- **Type definitions duplicated intentionally**: Rather than importing types from the UI package into the CLI's conversation module, I defined local interfaces matching the expected UI message shape. This avoids a circular dependency (CLI imports types from UI, but the types barrel file may reference other UI code) and keeps the conversion function self-contained.

- **Defensive conversion with validation**: The `fromUIMessages()` function accepts `unknown[]` and filters out invalid messages. This provides type safety when processing the potentially untyped `history` payload from WebSocket messages.

- **executeQuery now takes optional options**: Extended `AgentSession.executeQuery()` to accept an `ExecuteQueryOptions` object with optional `history` field. When history is provided and non-empty, it's converted and used instead of the server-side `conversationHistory`. This allows the UI to manage its own conversation state.

- **Client-managed vs server-managed history**: When the client provides history, the server does NOT update `this.conversationHistory` after the query completes. This is correct because the client is managing its own state - updating the server-side history would cause duplication if the client sends the updated history with the next query.

- **Compaction with client history**: If a token limit error occurs with client-provided history, the history is compacted in-place for the retry, but the server-side `conversationHistory` is NOT updated (since `usingClientHistory` is true). The `context_compacted` message tells the client to compact its own history.

- **WebSocket handler change minimal**: The only change to `cli.ts` was extracting the `history` field from the query payload and passing it to `executeQuery()`. The heavy lifting is done by the conversion function and modified session methods.

## test-conversation-utils

- **Test file location**: Tests placed in `packages/cli/test/conversation.test.ts` at the package root test directory, following the pattern of other module tests like `token-errors.test.ts`.

- **AI SDK type casting in tests**: When testing `ModelMessage` types, TypeScript requires careful casting since the SDK uses discriminated unions. Pattern: cast to `AssistantModelMessage` or `ToolModelMessage`, then access content as typed array. Example: `const content = assistantMsg.content as Array<{ type: string; input?: unknown }>`.

- **ToolResultPart output access**: The `ToolModelMessage.content` array contains union types (`ToolResultPart | ToolApprovalResponse`), requiring explicit type assertions when accessing `output` property: `const toolResult = toolMsg.content[0] as { type: "tool-result"; output: unknown }`.

- **compactConversation behavior with text-only messages**: The `pruneMessages()` function from AI SDK only removes reasoning and tool calls. For conversations with only simple text messages (no tool calls, no reasoning), the middle section remains unchanged - no reduction in size. Tests should use `toBeLessThanOrEqual()` not `toBeLessThan()` for such cases.

- **Helper function pattern for test readability**: Created helper functions (`userMsg`, `assistantMsg`, `assistantWithToolCalls`, `toolMsg`) inside describe blocks to make test cases more readable and reduce boilerplate.

- **JSONValue import required**: When creating `ConversationToolResultPart` objects in tests, the `result` field must be typed as `JSONValue` (imported from conversation.ts), not `unknown`. This matches the actual type constraint.

- **Edge case testing categories**: Organized tests into logical groups:
  1. Happy path - basic conversion of each message type
  2. Mixed conversations - complete multi-turn with all message types
  3. Edge cases - empty arrays, empty strings, null values
  4. Tool-specific - tool calls with/without text, multiple tools, error results
  5. Long conversations - 100+ messages, many tool calls

## test-token-error-detection

- **Tests already existed**: The test file `packages/cli/test/token-errors.test.ts` was already created during the `token-error-detection` task. The main work for this task was to verify coverage and add tests for any missing patterns.

- **Pattern coverage verification**: Compared the `TOKEN_LIMIT_ERROR_PATTERNS` array in `token-errors.ts` against existing tests. Found 5 patterns that weren't explicitly tested:
  - "maximum context"
  - "exceeds the maximum"
  - "context limit"
  - "input too long"
  - "request too large"
  Added explicit test cases for each of these patterns.

- **Test organization pattern**: Tests are grouped by category using nested describe blocks:
  - `Anthropic-style token limit errors` - the main pattern matching tests
  - `alternative status codes` - 413, 422 variations
  - `case insensitivity` - mixed case handling
  - `no status code` - fallback to pattern matching only
  - `false positives prevention` - critical for avoiding retry loops
  - `with regular Error` - non-APICallError handling
  - `with non-Error types` - defensive edge cases

- **Helper function for test setup**: The `createAPICallError()` helper creates real `APICallError` instances rather than mocks. This is important because `APICallError.isInstance()` type guard is used in the actual implementation.

- **Test count**: Final count is 40 tests covering `isTokenLimitError()` and `getTokenLimitErrorDescription()` functions.
