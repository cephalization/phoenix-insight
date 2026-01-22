/**
 * Conversation message types for multi-turn conversations with AI SDK v6
 *
 * These types represent the internal conversation history format that can be
 * converted to AI SDK's ModelMessage format for multi-turn conversations.
 */

import {
  pruneMessages,
  type ModelMessage,
  type UserModelMessage,
  type AssistantModelMessage,
  type ToolModelMessage,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
  type JSONValue as AIJSONValue,
  type GenerateTextResult,
  type StreamTextResult,
} from "ai";

/**
 * Re-export JSONValue from AI SDK for convenience when creating tool results
 */
export type JSONValue = AIJSONValue;

/**
 * A text content part in a message
 */
export interface ConversationTextPart {
  type: "text";
  text: string;
}

/**
 * A tool call content part representing an AI-initiated tool call
 */
export interface ConversationToolCallPart {
  type: "tool-call";
  /** Unique ID for this tool call, used to match with results */
  toolCallId: string;
  /** Name of the tool being called */
  toolName: string;
  /** Arguments passed to the tool (JSON-serializable) */
  args: unknown;
}

/**
 * A tool result content part representing the result of a tool call
 */
export interface ConversationToolResultPart {
  type: "tool-result";
  /** ID of the tool call this result corresponds to */
  toolCallId: string;
  /** Name of the tool that was called */
  toolName: string;
  /** Result of the tool execution (must be JSON-serializable) */
  result: JSONValue;
  /** Whether the tool execution resulted in an error */
  isError?: boolean;
}

/**
 * Content parts that can appear in assistant messages
 */
export type ConversationAssistantContentPart =
  | ConversationTextPart
  | ConversationToolCallPart;

/**
 * A user message in the conversation
 */
export interface ConversationUserMessage {
  role: "user";
  /** User message content (text only for now) */
  content: string;
}

/**
 * An assistant message in the conversation
 *
 * Can contain text content, tool calls, or both.
 * When the assistant makes tool calls, the content array will include
 * both text parts (the assistant's reasoning) and tool-call parts.
 */
export interface ConversationAssistantMessage {
  role: "assistant";
  /**
   * Content of the assistant's response.
   * - string: Simple text response
   * - array: Mixed content including text and/or tool calls
   */
  content: string | ConversationAssistantContentPart[];
}

/**
 * A tool message containing results of tool calls
 *
 * This message type is used to provide tool results back to the model
 * after tool calls have been executed.
 */
export interface ConversationToolMessage {
  role: "tool";
  /** Array of tool results */
  content: ConversationToolResultPart[];
}

/**
 * A message in the conversation history
 *
 * Represents all message types that can appear in a multi-turn conversation:
 * - user: Messages from the user
 * - assistant: Responses from the AI, potentially including tool calls
 * - tool: Results of tool call executions
 */
export type ConversationMessage =
  | ConversationUserMessage
  | ConversationAssistantMessage
  | ConversationToolMessage;

/**
 * Type guard to check if a message is a user message
 */
export function isUserMessage(
  message: ConversationMessage
): message is ConversationUserMessage {
  return message.role === "user";
}

/**
 * Type guard to check if a message is an assistant message
 */
export function isAssistantMessage(
  message: ConversationMessage
): message is ConversationAssistantMessage {
  return message.role === "assistant";
}

/**
 * Type guard to check if a message is a tool message
 */
export function isToolMessage(
  message: ConversationMessage
): message is ConversationToolMessage {
  return message.role === "tool";
}

/**
 * Type guard to check if a content part is a text part
 */
export function isTextPart(
  part: ConversationAssistantContentPart
): part is ConversationTextPart {
  return part.type === "text";
}

/**
 * Type guard to check if a content part is a tool call part
 */
export function isToolCallPart(
  part: ConversationAssistantContentPart
): part is ConversationToolCallPart {
  return part.type === "tool-call";
}

/**
 * Helper to extract text content from an assistant message
 *
 * @param message - The assistant message to extract text from
 * @returns The concatenated text content, or empty string if no text
 */
export function getAssistantText(message: ConversationAssistantMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  return message.content
    .filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

/**
 * Helper to extract tool calls from an assistant message
 *
 * @param message - The assistant message to extract tool calls from
 * @returns Array of tool call parts, empty if none
 */
export function getAssistantToolCalls(
  message: ConversationAssistantMessage
): ConversationToolCallPart[] {
  if (typeof message.content === "string") {
    return [];
  }

  return message.content.filter(isToolCallPart);
}

/**
 * Check if an assistant message contains tool calls
 *
 * @param message - The assistant message to check
 * @returns True if the message contains at least one tool call
 */
export function hasToolCalls(message: ConversationAssistantMessage): boolean {
  return getAssistantToolCalls(message).length > 0;
}

/**
 * Create a user message
 *
 * @param content - The text content of the user message
 * @returns A ConversationUserMessage
 */
export function createUserMessage(content: string): ConversationUserMessage {
  return { role: "user", content };
}

/**
 * Create an assistant message with text content
 *
 * @param content - The text content of the assistant message
 * @returns A ConversationAssistantMessage
 */
export function createAssistantMessage(
  content: string
): ConversationAssistantMessage {
  return { role: "assistant", content };
}

/**
 * Create an assistant message with mixed content (text and/or tool calls)
 *
 * @param parts - Array of content parts
 * @returns A ConversationAssistantMessage
 */
export function createAssistantMessageWithParts(
  parts: ConversationAssistantContentPart[]
): ConversationAssistantMessage {
  return { role: "assistant", content: parts };
}

/**
 * Create a tool message with results
 *
 * @param results - Array of tool result parts
 * @returns A ConversationToolMessage
 */
export function createToolMessage(
  results: ConversationToolResultPart[]
): ConversationToolMessage {
  return { role: "tool", content: results };
}

/**
 * Convert a ConversationUserMessage to AI SDK's UserModelMessage format
 */
function convertUserMessage(message: ConversationUserMessage): UserModelMessage {
  return {
    role: "user",
    content: message.content,
  };
}

/**
 * Convert a ConversationAssistantMessage to AI SDK's AssistantModelMessage format
 */
function convertAssistantMessage(
  message: ConversationAssistantMessage
): AssistantModelMessage {
  if (typeof message.content === "string") {
    return {
      role: "assistant",
      content: message.content,
    };
  }

  // Convert content parts to AI SDK format
  const sdkContent: (TextPart | ToolCallPart)[] = message.content.map((part) => {
    if (part.type === "text") {
      return {
        type: "text" as const,
        text: part.text,
      };
    } else {
      // tool-call part
      return {
        type: "tool-call" as const,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.args,
      };
    }
  });

  return {
    role: "assistant",
    content: sdkContent,
  };
}

/**
 * Convert a ConversationToolMessage to AI SDK's ToolModelMessage format
 */
function convertToolMessage(message: ConversationToolMessage): ToolModelMessage {
  const sdkContent: ToolResultPart[] = message.content.map((part) => ({
    type: "tool-result" as const,
    toolCallId: part.toolCallId,
    toolName: part.toolName,
    output: part.isError
      ? { type: "error-json" as const, value: part.result }
      : { type: "json" as const, value: part.result },
  }));

  return {
    role: "tool",
    content: sdkContent,
  };
}

/**
 * Convert a single ConversationMessage to AI SDK's ModelMessage format
 *
 * @param message - The conversation message to convert
 * @returns The equivalent AI SDK ModelMessage
 */
export function toModelMessage(message: ConversationMessage): ModelMessage {
  switch (message.role) {
    case "user":
      return convertUserMessage(message);
    case "assistant":
      return convertAssistantMessage(message);
    case "tool":
      return convertToolMessage(message);
  }
}

/**
 * Convert an array of ConversationMessages to AI SDK's ModelMessage[] format
 *
 * This is the primary conversion function used when passing conversation
 * history to the AI SDK for multi-turn conversations.
 *
 * @param history - Array of conversation messages
 * @returns Array of AI SDK ModelMessages
 */
export function toModelMessages(history: ConversationMessage[]): ModelMessage[] {
  return history.map(toModelMessage);
}

// ============================================================================
// Message Truncation Utilities
// ============================================================================

/**
 * Placeholder text used to replace truncated report content
 */
const TRUNCATED_REPORT_PLACEHOLDER = "[Report content truncated to save tokens]";

/**
 * Truncate the arguments of generate_report tool calls to save tokens in conversation history.
 *
 * The generate_report tool can have very large content arguments (JSON-Render tree structures).
 * When preserving conversation history for multi-turn conversations, these dense arguments
 * consume many tokens without providing useful context for future queries.
 *
 * This function:
 * 1. Scans assistant messages for tool calls with toolName === "generate_report"
 * 2. Replaces the args with a truncated placeholder while keeping the tool call record
 * 3. Preserves the title if present for context
 *
 * @param messages - Array of ModelMessages to process
 * @returns New array with truncated generate_report tool call arguments
 */
export function truncateReportToolCalls(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    // Only process assistant messages
    if (message.role !== "assistant") {
      return message;
    }

    // If content is a string, no tool calls to truncate
    if (typeof message.content === "string") {
      return message;
    }

    // Process content parts to truncate generate_report tool calls
    const newContent = message.content.map((part) => {
      // Only process tool-call parts
      if (part.type !== "tool-call") {
        return part;
      }

      // Only truncate generate_report tool calls
      if (part.toolName !== "generate_report") {
        return part;
      }

      // Preserve the title if present, truncate the content
      const input = part.input as { title?: string; content?: unknown } | undefined;
      const truncatedInput: { title?: string; content: string } = {
        content: TRUNCATED_REPORT_PLACEHOLDER,
      };
      
      if (input?.title) {
        truncatedInput.title = input.title;
      }

      return {
        ...part,
        input: truncatedInput,
      };
    });

    return {
      ...message,
      content: newContent,
    } as AssistantModelMessage;
  });
}

// ============================================================================
// Response Extraction Utilities
// ============================================================================

/**
 * A tool call from an AI SDK result step
 */
interface AIToolCall {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
}

/**
 * A tool result from an AI SDK result step
 */
interface AIToolResult {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: unknown;
}

/**
 * A step from an AI SDK result (simplified for extraction)
 */
interface AIStep {
  text: string;
  toolCalls: AIToolCall[];
  toolResults: AIToolResult[];
}

/**
 * Type representing either GenerateTextResult or StreamTextResult from AI SDK.
 * Both have a `steps` property that contains the execution steps.
 */
type AIResult = {
  steps: AIStep[];
};

/**
 * Extract conversation messages from an AI SDK result object.
 *
 * This function takes the result from `generateText()` or `streamText()` and
 * converts it to internal `ConversationMessage` format for updating conversation
 * history.
 *
 * The function processes each step in the result:
 * 1. If the step has text content and/or tool calls, creates an assistant message
 * 2. If the step has tool results, creates a tool message
 *
 * Note: For StreamTextResult, `steps` is a Promise that must be awaited.
 * For GenerateTextResult, `steps` is a direct array. This function handles both.
 *
 * @param result - The result from AI SDK's generateText() or streamText()
 * @returns Promise of array of ConversationMessages representing the assistant's response
 *
 * @example
 * ```typescript
 * const result = await generateText({ ... });
 * const assistantMessages = await extractMessagesFromResponse(result);
 * conversationHistory.push(...assistantMessages);
 * ```
 */
export async function extractMessagesFromResponse(
  result: GenerateTextResult<any, any> | StreamTextResult<any, any>
): Promise<ConversationMessage[]> {
  const messages: ConversationMessage[] = [];

  // Steps can be a Promise (StreamTextResult) or a direct array (GenerateTextResult)
  // We need to await it to handle both cases
  const stepsValue = result.steps;
  const steps: AIStep[] = await Promise.resolve(stepsValue);

  if (!steps || steps.length === 0) {
    return messages;
  }

  for (const step of steps) {
    // Build assistant message content
    const hasText = step.text && step.text.length > 0;
    const hasToolCalls = step.toolCalls && step.toolCalls.length > 0;

    if (hasText || hasToolCalls) {
      // Determine the content format
      if (hasToolCalls) {
        // Mixed content: text and/or tool calls
        const parts: ConversationAssistantContentPart[] = [];

        if (hasText) {
          parts.push({
            type: "text",
            text: step.text,
          });
        }

        for (const toolCall of step.toolCalls) {
          parts.push({
            type: "tool-call",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.input,
          });
        }

        messages.push(createAssistantMessageWithParts(parts));
      } else {
        // Text-only content
        messages.push(createAssistantMessage(step.text));
      }
    }

    // Add tool results as a separate tool message
    if (step.toolResults && step.toolResults.length > 0) {
      const results: ConversationToolResultPart[] = step.toolResults.map(
        (toolResult) => ({
          type: "tool-result" as const,
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          result: toolResult.output as JSONValue,
        })
      );

      messages.push(createToolMessage(results));
    }
  }

  return messages;
}

// ============================================================================
// UI Message Conversion Utilities
// ============================================================================

/**
 * UI text content part from the UI package
 */
interface UITextPart {
  type: "text";
  text: string;
}

/**
 * UI tool call content part from the UI package
 */
interface UIToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * UI assistant content parts
 */
type UIAssistantContentPart = UITextPart | UIToolCallPart;

/**
 * UI tool result content part from the UI package
 */
interface UIToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

/**
 * UI user message from the UI package
 */
interface UIUserMessage {
  role: "user";
  content: string;
}

/**
 * UI assistant message from the UI package
 */
interface UIAssistantMessage {
  role: "assistant";
  content: string | UIAssistantContentPart[];
}

/**
 * UI tool message from the UI package
 */
interface UIToolMessage {
  role: "tool";
  content: UIToolResultPart[];
}

/**
 * UI conversation message types from the UI package
 */
type UIConversationMessage = UIUserMessage | UIAssistantMessage | UIToolMessage;

/**
 * Convert a single UI conversation message to the internal ConversationMessage format.
 *
 * The UI package uses similar types but they need to be converted to ensure
 * type safety and proper handling by the agent.
 *
 * @param message - A UI conversation message
 * @returns The equivalent internal ConversationMessage
 */
function convertUIMessage(message: UIConversationMessage): ConversationMessage {
  switch (message.role) {
    case "user":
      return { role: "user", content: message.content };

    case "assistant": {
      if (typeof message.content === "string") {
        return { role: "assistant", content: message.content };
      }

      // Convert content parts
      const parts: ConversationAssistantContentPart[] = message.content.map(
        (part): ConversationAssistantContentPart => {
          if (part.type === "text") {
            return { type: "text", text: part.text };
          } else {
            // tool-call
            return {
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.args,
            };
          }
        }
      );

      return { role: "assistant", content: parts };
    }

    case "tool": {
      const results: ConversationToolResultPart[] = message.content.map(
        (part) => ({
          type: "tool-result" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          result: part.result as JSONValue,
          ...(part.isError && { isError: part.isError }),
        })
      );

      return { role: "tool", content: results };
    }
  }
}

/**
 * Convert an array of UI conversation messages to the internal ConversationMessage[] format.
 *
 * This function is used when the UI client provides conversation history with a query.
 * The UI history is converted to the internal format before being passed to the agent.
 *
 * @param uiMessages - Array of UI conversation messages
 * @returns Array of internal ConversationMessages
 *
 * @example
 * ```typescript
 * // In WebSocket message handler
 * const { content, history } = message.payload;
 * if (history) {
 *   const internalHistory = fromUIMessages(history);
 *   await session.executeQuery(content, { history: internalHistory });
 * }
 * ```
 */
export function fromUIMessages(
  uiMessages: unknown[]
): ConversationMessage[] {
  // Validate that uiMessages is an array
  if (!Array.isArray(uiMessages)) {
    return [];
  }

  // Filter and convert valid messages
  return uiMessages
    .filter((msg): msg is UIConversationMessage => {
      if (!msg || typeof msg !== "object") return false;
      const m = msg as Record<string, unknown>;
      return (
        m.role === "user" ||
        m.role === "assistant" ||
        m.role === "tool"
      );
    })
    .map(convertUIMessage);
}

// ============================================================================
// Conversation Compaction Utilities
// ============================================================================

/**
 * Options for compacting conversation history
 */
export interface CompactConversationOptions {
  /**
   * Number of messages to keep from the beginning of the conversation.
   * These are typically system context or initial user instructions.
   * @default 2
   */
  keepFirstN?: number;

  /**
   * Number of messages to keep from the end of the conversation.
   * These are the most recent and relevant messages.
   * @default 6
   */
  keepLastN?: number;
}

/**
 * Convert an AI SDK ModelMessage back to our internal ConversationMessage format.
 *
 * This is the inverse of toModelMessage(), used after applying pruneMessages().
 *
 * @param message - The AI SDK ModelMessage to convert
 * @returns The equivalent ConversationMessage
 */
function fromModelMessage(message: ModelMessage): ConversationMessage {
  switch (message.role) {
    case "user": {
      // User messages have either string content or array with text parts
      const content =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((part) => part.type === "text")
              .map((part) => (part as { type: "text"; text: string }).text)
              .join("");
      return { role: "user", content };
    }

    case "assistant": {
      // Assistant messages can have string content or array of parts
      if (typeof message.content === "string") {
        return { role: "assistant", content: message.content };
      }

      const parts: ConversationAssistantContentPart[] = [];
      for (const part of message.content) {
        if (part.type === "text") {
          parts.push({ type: "text", text: part.text });
        } else if (part.type === "tool-call") {
          parts.push({
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.input,
          });
        }
        // Skip reasoning parts as they're not in our internal format
      }

      // If no parts remain, return empty string content
      if (parts.length === 0) {
        return { role: "assistant", content: "" };
      }

      // If only text parts, check if we can simplify to string
      const textParts = parts.filter(
        (p): p is ConversationTextPart => p.type === "text"
      );
      if (parts.length === textParts.length && textParts.length === 1 && textParts[0]) {
        return { role: "assistant", content: textParts[0].text };
      }

      return { role: "assistant", content: parts };
    }

    case "tool": {
      const results: ConversationToolResultPart[] = [];
      const content = message.content;
      for (const part of content) {
        if (part.type === "tool-result") {
          const output = part.output;
          // Handle the discriminated union output type
          let result: JSONValue;
          let isError = false;
          if (
            output &&
            typeof output === "object" &&
            "type" in output &&
            "value" in output
          ) {
            const typedOutput = output as { type: string; value: unknown };
            result = typedOutput.value as JSONValue;
            isError =
              typedOutput.type === "error-json" ||
              typedOutput.type === "error-text";
          } else {
            result = output as JSONValue;
          }

          results.push({
            type: "tool-result",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            result,
            ...(isError && { isError }),
          });
        }
        // Skip approval-related parts as they're not in our internal format
      }
      return { role: "tool", content: results };
    }

    case "system": {
      // System messages aren't part of ConversationMessage, convert to user message
      // SystemModelMessage.content is always a string
      return { role: "user", content: `[System]: ${message.content}` };
    }

    default: {
      // Fallback for unknown roles
      return { role: "user", content: "[Unknown message type]" };
    }
  }
}

/**
 * Convert an array of AI SDK ModelMessages back to ConversationMessages.
 *
 * @param messages - Array of AI SDK ModelMessages
 * @returns Array of ConversationMessages
 */
function fromModelMessages(messages: ModelMessage[]): ConversationMessage[] {
  return messages.map(fromModelMessage);
}

/**
 * Compact a conversation history to reduce token usage.
 *
 * This function is used when the conversation history becomes too large for the
 * model's context window. It uses AI SDK's `pruneMessages()` to intelligently
 * remove reasoning content and tool calls from older messages while preserving:
 *
 * 1. The first N messages (system context, initial instructions)
 * 2. The last N messages (most recent and relevant context)
 * 3. Text content from middle messages (summaries of what was discussed)
 *
 * The function removes:
 * - Reasoning parts from all messages except the last few
 * - Tool calls and results from all messages except the last few
 * - Empty messages that result from pruning
 *
 * @param messages - The conversation history to compact
 * @param options - Compaction options
 * @returns A new array with compacted messages
 *
 * @example
 * ```typescript
 * // After a token limit error, compact the conversation
 * const compactedHistory = compactConversation(conversationHistory, {
 *   keepFirstN: 2,  // Keep system context
 *   keepLastN: 6,   // Keep recent exchanges
 * });
 * // Retry with compacted history
 * const result = await agent.stream(query, { messages: compactedHistory });
 * ```
 */
export function compactConversation(
  messages: ConversationMessage[],
  options?: CompactConversationOptions
): ConversationMessage[] {
  const keepFirstN = options?.keepFirstN ?? 2;
  const keepLastN = options?.keepLastN ?? 6;

  // If the conversation is short enough, no compaction needed
  if (messages.length <= keepFirstN + keepLastN) {
    return messages;
  }

  // Convert to AI SDK format
  const modelMessages = toModelMessages(messages);

  // Calculate how many middle messages there are
  const middleStartIndex = keepFirstN;
  const middleEndIndex = modelMessages.length - keepLastN;

  // If there's no middle section, return as-is
  if (middleEndIndex <= middleStartIndex) {
    return messages;
  }

  // Extract the three sections
  const firstMessages = modelMessages.slice(0, middleStartIndex);
  const middleMessages = modelMessages.slice(middleStartIndex, middleEndIndex);
  const lastMessages = modelMessages.slice(middleEndIndex);

  // Apply pruning to middle messages only
  // Remove all reasoning and tool calls from middle section
  const prunedMiddle = pruneMessages({
    messages: middleMessages,
    reasoning: "all",
    toolCalls: "all",
    emptyMessages: "remove",
  });

  // Combine: first messages (unchanged) + pruned middle + last messages (unchanged)
  const compactedModelMessages = [
    ...firstMessages,
    ...prunedMiddle,
    ...lastMessages,
  ];

  // Convert back to internal format
  return fromModelMessages(compactedModelMessages);
}
