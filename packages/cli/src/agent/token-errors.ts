/**
 * Token limit error detection utilities
 *
 * Provides functions to detect when API errors are caused by exceeding
 * the model's context window limits.
 */

import { APICallError } from "ai";

/**
 * Known error message patterns that indicate a token/context limit error.
 *
 * These patterns are checked against the error message (case-insensitive)
 * to identify when the model's context window has been exceeded.
 *
 * Anthropic API errors include messages like:
 * - "prompt is too long: X tokens > Y maximum"
 * - "This request would exceed your context window limit"
 * - "max_tokens is too large"
 */
const TOKEN_LIMIT_ERROR_PATTERNS = [
  // Anthropic-specific patterns
  "prompt is too long",
  "context window",
  "context length",
  "max_tokens",
  "maximum context",
  "token limit",
  "tokens exceed",
  "exceeds the maximum",
  "too many tokens",
  // Generic patterns that might apply to other providers
  "context limit",
  "input too long",
  "request too large",
] as const;

/**
 * HTTP status codes that could indicate a token limit error.
 *
 * - 400 Bad Request: Most common for validation errors like exceeding limits
 * - 413 Payload Too Large: Sometimes used for request size limits
 * - 422 Unprocessable Entity: Can be used for validation errors
 */
const TOKEN_LIMIT_STATUS_CODES = [400, 413, 422] as const;

/**
 * Check if an error is an APICallError from the AI SDK
 *
 * @param error - The error to check
 * @returns True if the error is an APICallError instance
 */
function isAPICallError(error: unknown): error is InstanceType<typeof APICallError> {
  // Use the SDK's built-in type guard
  return APICallError.isInstance(error);
}

/**
 * Check if the error message contains any known token limit patterns
 *
 * @param message - The error message to check
 * @returns True if the message contains a token limit pattern
 */
function messageContainsTokenLimitPattern(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return TOKEN_LIMIT_ERROR_PATTERNS.some((pattern) =>
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * Detects when an API error is due to exceeding the model's context window.
 *
 * This function checks for:
 * 1. APICallError from the AI SDK (uses the SDK's built-in type guard)
 * 2. Status codes that typically indicate limit errors (400, 413, 422)
 * 3. Error messages containing known token limit patterns
 *
 * The function is intentionally conservative - it requires both a relevant
 * status code AND a matching message pattern to reduce false positives.
 * If no status code is available (undefined), it falls back to message
 * pattern matching only.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error appears to be a token/context limit error
 *
 * @example
 * ```typescript
 * try {
 *   await generateText({ ... });
 * } catch (error) {
 *   if (isTokenLimitError(error)) {
 *     // Compact conversation and retry
 *     const compacted = compactConversation(messages);
 *     await generateText({ messages: compacted });
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export function isTokenLimitError(error: unknown): boolean {
  // First, check if it's an APICallError
  if (!isAPICallError(error)) {
    // For non-APICallError, check if it's an Error with a relevant message
    // This handles cases where the error might be wrapped or transformed
    if (error instanceof Error) {
      return messageContainsTokenLimitPattern(error.message);
    }
    return false;
  }

  // Get the error message
  const message = error.message || "";

  // Check if the message contains token limit patterns
  const hasTokenLimitMessage = messageContainsTokenLimitPattern(message);

  // If no status code is available, rely solely on message pattern matching
  if (error.statusCode === undefined) {
    return hasTokenLimitMessage;
  }

  // Check if the status code is one that typically indicates a limit error
  const hasRelevantStatusCode = TOKEN_LIMIT_STATUS_CODES.includes(
    error.statusCode as (typeof TOKEN_LIMIT_STATUS_CODES)[number]
  );

  // Require both a relevant status code AND a matching message pattern
  // This reduces false positives from other 400 errors (like invalid JSON)
  return hasRelevantStatusCode && hasTokenLimitMessage;
}

/**
 * Extract a human-readable description from a token limit error.
 *
 * @param error - The error to extract a description from
 * @returns A user-friendly error description, or null if not a token limit error
 */
export function getTokenLimitErrorDescription(error: unknown): string | null {
  if (!isTokenLimitError(error)) {
    return null;
  }

  if (error instanceof Error) {
    // Try to extract useful information from the error message
    const message = error.message;

    // Look for specific token counts in the message
    // Patterns like "150000 tokens", "150000 tokens >", "exceeds 150000 tokens", "120000 tokens limit"
    const tokenMatch = message.match(/(\d+)\s*tokens?/i);
    if (tokenMatch) {
      return `Request exceeded token limit (${tokenMatch[1]} tokens). Context will be compacted.`;
    }

    // Generic message
    return "Request exceeded the model's context window. Context will be compacted.";
  }

  return "Request exceeded the model's context window. Context will be compacted.";
}
