/**
 * Conversation message types for multi-turn conversations with AI SDK v6
 *
 * These types represent the internal conversation history format that can be
 * converted to AI SDK's ModelMessage format for multi-turn conversations.
 */

import type {
  ModelMessage,
  UserModelMessage,
  AssistantModelMessage,
  ToolModelMessage,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  JSONValue as AIJSONValue,
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
