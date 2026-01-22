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

## Phase 1: Core Conversation Types and Message Conversion

### conversation-types

- content: Define TypeScript types for conversation messages compatible with AI SDK v6. Create a `ConversationMessage` type in `packages/cli/src/agent/conversation.ts` that can represent user messages, assistant messages with text content, and assistant messages with tool calls/results. These types should be convertible to AI SDK's `ModelMessage` format for multi-turn conversations.
- status: complete
- dependencies: none

### message-conversion-utils

- content: Create utility functions in `packages/cli/src/agent/conversation.ts` to convert between the internal `ConversationMessage` format and AI SDK's `ModelMessage[]` format. Implement `toModelMessages(history: ConversationMessage[]): ModelMessage[]` that properly formats tool calls and results. Also implement `truncateReportToolCalls(messages: ModelMessage[]): ModelMessage[]` to remove dense `generate_report` tool call arguments from history while keeping the tool call record (as per user requirement to save tokens).
- status: complete
- dependencies: conversation-types

---

## Phase 2: Agent Conversation History Support

### agent-messages-api

- content: Modify `PhoenixInsightAgent.stream()` and `PhoenixInsightAgent.generate()` in `packages/cli/src/agent/index.ts` to accept an optional `messages` parameter (array of `ConversationMessage`). When provided, use AI SDK's `messages` property instead of `prompt` to enable multi-turn conversations. The current user query should be appended as the last user message in the array.
- status: complete
- dependencies: message-conversion-utils

### agent-response-to-history

- content: Create a utility function `extractMessagesFromResponse(result: GenerateTextResult | StreamTextResult): ConversationMessage[]` in `packages/cli/src/agent/conversation.ts` that extracts the assistant's response (including any tool calls and results) from an AI SDK result object and converts it to internal `ConversationMessage` format. This will be used to update conversation history after each query.
- status: complete
- dependencies: conversation-types

---

## Phase 3: Token Error Detection and Conversation Compaction

### token-error-detection

- content: Create `packages/cli/src/agent/token-errors.ts` with a function `isTokenLimitError(error: unknown): boolean` that detects when an API error is due to exceeding the model's context window. Check for `AI_APICallError` and look for status code 400 with messages containing "context length", "token limit", "max_tokens", or similar patterns from Anthropic's API.
- status: complete
- dependencies: none

### conversation-compaction

- content: Create `compactConversation(messages: ConversationMessage[], options?: { keepFirstN?: number; keepLastN?: number }): ConversationMessage[]` in `packages/cli/src/agent/conversation.ts`. This function should use AI SDK's `pruneMessages()` to remove reasoning and tool calls from older messages. Default to keeping first 2 messages (system context) and last 6 messages. Also summarize older message content to reduce tokens while preserving key context.
- status: complete
- dependencies: message-conversion-utils

---

## Phase 4: CLI Session Conversation History

### cli-session-history

- content: Update `AgentSession` in `packages/cli/src/server/session.ts` to maintain a `ConversationMessage[]` history that is actually passed to the agent. Modify `executeQuery()` to: (1) build the full message history including the new user query, (2) call `agent.stream()` with the messages array, (3) extract the assistant response and append to history. The history should be ephemeral (not persisted to disk).
- status: complete
- dependencies: agent-messages-api, agent-response-to-history

### cli-session-token-retry

- content: In `AgentSession.executeQuery()`, wrap the agent call in a try-catch. If `isTokenLimitError()` returns true, automatically compact the conversation using `compactConversation()`, notify the client via a new `"context_compacted"` WebSocket message type, and retry the query. Add the new message type to the WebSocket protocol types in both CLI and UI.
- status: complete
- dependencies: cli-session-history, token-error-detection, conversation-compaction

---

## Phase 5: Interactive CLI Conversation History

### interactive-cli-history

- content: Update `runInteractiveMode()` in `packages/cli/src/cli.ts` to maintain a `ConversationMessage[]` array across queries. Pass this history to `agent.stream()` or `agent.generate()` for each query, and update the history with the response. The history is ephemeral (cleared when CLI exits). Show a message like "(continuing conversation with N previous messages)" when there's existing history.
- status: complete
- dependencies: agent-messages-api, agent-response-to-history

### interactive-cli-token-retry

- content: In the interactive CLI's query processing, catch token limit errors, compact the conversation, display a warning message to the user (e.g., "⚠️ Context was trimmed to fit model limits"), and retry the query with the compacted history.
- status: complete
- dependencies: interactive-cli-history, token-error-detection, conversation-compaction

---

## Phase 6: UI Session History Integration

### ui-send-history

- content: Update the WebSocket `query` message type in `packages/ui/src/lib/websocket.ts` to include an optional `history` field containing the session's message history. Modify `useWebSocket` hook to include the current session's messages when sending queries. Update the corresponding server-side types in `packages/cli/src/server/websocket.ts`.
- status: pending
- dependencies: conversation-types

### ui-handle-compaction

- content: Add a handler in the UI's WebSocket message processing for the `"context_compacted"` message type. When received, display a toast notification (using sonner) informing the user that older conversation context was trimmed to fit model limits. Update the chat store types if needed.
- status: pending
- dependencies: cli-session-token-retry

### cli-session-use-ui-history

- content: Modify the WebSocket message handler in `packages/cli/src/cli.ts` (runUIServer function) and `AgentSession` to use the history provided by the UI client in the query message. Convert the UI message format to `ConversationMessage[]` before passing to the agent. If the client provides history, use it; otherwise fall back to the server-side session history.
- status: pending
- dependencies: cli-session-history, ui-send-history

---

## Phase 7: Testing

### test-conversation-utils

- content: Write unit tests in `packages/cli/test/conversation.test.ts` for the conversation utility functions: `toModelMessages()`, `truncateReportToolCalls()`, `extractMessagesFromResponse()`, and `compactConversation()`. Test edge cases like empty history, history with only tool calls, and very long conversations.
- status: pending
- dependencies: conversation-compaction, agent-response-to-history

### test-token-error-detection

- content: Write unit tests in `packages/cli/test/token-errors.test.ts` for `isTokenLimitError()`. Mock various error shapes including `AI_APICallError` with different status codes and messages. Test that it correctly identifies Anthropic token limit errors and doesn't false-positive on other errors.
- status: pending
- dependencies: token-error-detection

### test-session-history

- content: Write integration tests in `packages/cli/test/session.test.ts` for the `AgentSession` class's conversation history functionality. Test that history accumulates across queries, that compaction is triggered on token errors, and that the `context_compacted` message is sent. Use mocked agents to avoid actual API calls.
- status: pending
- dependencies: cli-session-token-retry

