import { describe, it, expect } from "vitest";
import { APICallError } from "ai";
import {
  isTokenLimitError,
  getTokenLimitErrorDescription,
} from "../src/agent/token-errors.js";

/**
 * Helper to create a mock APICallError with the specified properties.
 *
 * We create actual APICallError instances rather than mocking because:
 * 1. The SDK's isInstance() type guard checks the error properly
 * 2. It ensures our tests reflect real-world error shapes
 */
function createAPICallError(options: {
  message: string;
  statusCode?: number;
  url?: string;
  responseBody?: string;
  requestBodyValues?: unknown;
}): APICallError {
  return new APICallError({
    message: options.message,
    statusCode: options.statusCode,
    url: options.url || "https://api.anthropic.com/v1/messages",
    responseBody: options.responseBody,
    requestBodyValues: options.requestBodyValues,
  });
}

describe("isTokenLimitError", () => {
  describe("with APICallError", () => {
    describe("Anthropic-style token limit errors", () => {
      it("should detect 'prompt is too long' error with status 400", () => {
        const error = createAPICallError({
          message:
            "prompt is too long: 150000 tokens > 100000 maximum context length",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'context window' error with status 400", () => {
        const error = createAPICallError({
          message: "This request would exceed your context window limit",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'context length' error with status 400", () => {
        const error = createAPICallError({
          message: "Request exceeds maximum context length allowed",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'max_tokens' error with status 400", () => {
        const error = createAPICallError({
          message: "max_tokens is too large for this model",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'tokens exceed' error with status 400", () => {
        const error = createAPICallError({
          message: "Input tokens exceed the model's limit",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'too many tokens' error with status 400", () => {
        const error = createAPICallError({
          message: "Too many tokens in request",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'maximum context' error with status 400", () => {
        const error = createAPICallError({
          message: "Request exceeds maximum context allowed for this model",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'exceeds the maximum' error with status 400", () => {
        const error = createAPICallError({
          message: "Your input exceeds the maximum allowed by this model",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'context limit' error with status 400", () => {
        const error = createAPICallError({
          message: "Input has exceeded context limit",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'input too long' error with status 400", () => {
        const error = createAPICallError({
          message: "Input too long for the specified model",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect 'request too large' error with status 400", () => {
        const error = createAPICallError({
          message: "Request too large: please reduce input size",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });
    });

    describe("alternative status codes", () => {
      it("should detect token limit error with status 413 Payload Too Large", () => {
        const error = createAPICallError({
          message: "Request exceeds maximum context length",
          statusCode: 413,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should detect token limit error with status 422 Unprocessable Entity", () => {
        const error = createAPICallError({
          message: "Prompt is too long for this model",
          statusCode: 422,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });
    });

    describe("case insensitivity", () => {
      it("should match patterns case-insensitively", () => {
        const error = createAPICallError({
          message: "PROMPT IS TOO LONG for the model",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should match mixed case patterns", () => {
        const error = createAPICallError({
          message: "Maximum CONTEXT LENGTH has been exceeded",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(true);
      });
    });

    describe("no status code", () => {
      it("should detect token limit error when statusCode is undefined", () => {
        const error = createAPICallError({
          message: "prompt is too long: 150000 tokens",
        });

        expect(isTokenLimitError(error)).toBe(true);
      });

      it("should not detect non-token errors when statusCode is undefined", () => {
        const error = createAPICallError({
          message: "Invalid JSON in request body",
        });

        expect(isTokenLimitError(error)).toBe(false);
      });
    });

    describe("false positives prevention", () => {
      it("should NOT detect 400 error without token limit message", () => {
        const error = createAPICallError({
          message: "Invalid JSON in request body",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 400 error for authentication issues", () => {
        const error = createAPICallError({
          message: "Invalid API key provided",
          statusCode: 400,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 401 Unauthorized errors", () => {
        const error = createAPICallError({
          message: "Unauthorized: API key is invalid",
          statusCode: 401,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 403 Forbidden errors", () => {
        const error = createAPICallError({
          message: "Forbidden: Access denied",
          statusCode: 403,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 404 Not Found errors", () => {
        const error = createAPICallError({
          message: "Model not found",
          statusCode: 404,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 429 Rate Limit errors", () => {
        const error = createAPICallError({
          message: "Rate limit exceeded",
          statusCode: 429,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 500 Server errors", () => {
        const error = createAPICallError({
          message: "Internal server error",
          statusCode: 500,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });

      it("should NOT detect 503 Service Unavailable errors", () => {
        const error = createAPICallError({
          message: "Service temporarily unavailable",
          statusCode: 503,
        });

        expect(isTokenLimitError(error)).toBe(false);
      });
    });
  });

  describe("with regular Error", () => {
    it("should detect token limit pattern in regular Error", () => {
      const error = new Error("prompt is too long: exceeded maximum context length");

      expect(isTokenLimitError(error)).toBe(true);
    });

    it("should detect context window pattern in regular Error", () => {
      const error = new Error("Request exceeds context window limit");

      expect(isTokenLimitError(error)).toBe(true);
    });

    it("should NOT detect non-token errors in regular Error", () => {
      const error = new Error("Network connection failed");

      expect(isTokenLimitError(error)).toBe(false);
    });

    it("should NOT detect generic errors in regular Error", () => {
      const error = new Error("Something went wrong");

      expect(isTokenLimitError(error)).toBe(false);
    });
  });

  describe("with non-Error types", () => {
    it("should return false for string errors", () => {
      expect(isTokenLimitError("prompt is too long")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isTokenLimitError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isTokenLimitError(undefined)).toBe(false);
    });

    it("should return false for plain objects", () => {
      const error = { message: "prompt is too long", statusCode: 400 };
      expect(isTokenLimitError(error)).toBe(false);
    });

    it("should return false for numbers", () => {
      expect(isTokenLimitError(400)).toBe(false);
    });
  });
});

describe("getTokenLimitErrorDescription", () => {
  describe("with token limit errors", () => {
    it("should extract token count from error message", () => {
      const error = createAPICallError({
        message: "prompt is too long: 150000 tokens > 100000 maximum",
        statusCode: 400,
      });

      const description = getTokenLimitErrorDescription(error);

      expect(description).toContain("150000 tokens");
      expect(description).toContain("compacted");
    });

    it("should return generic message when no token count in message", () => {
      const error = createAPICallError({
        message: "Context window exceeded",
        statusCode: 400,
      });

      const description = getTokenLimitErrorDescription(error);

      expect(description).toContain("context window");
      expect(description).toContain("compacted");
    });

    it("should handle regular Error with token pattern", () => {
      const error = new Error("Prompt exceeds token limit with 120000 tokens used");

      const description = getTokenLimitErrorDescription(error);

      expect(description).not.toBe(null);
      expect(description).toContain("120000 tokens");
    });
  });

  describe("with non-token-limit errors", () => {
    it("should return null for non-token-limit APICallError", () => {
      const error = createAPICallError({
        message: "Invalid API key",
        statusCode: 401,
      });

      expect(getTokenLimitErrorDescription(error)).toBe(null);
    });

    it("should return null for regular Error without token pattern", () => {
      const error = new Error("Network timeout");

      expect(getTokenLimitErrorDescription(error)).toBe(null);
    });

    it("should return null for non-Error types", () => {
      expect(getTokenLimitErrorDescription("some string")).toBe(null);
      expect(getTokenLimitErrorDescription(null)).toBe(null);
      expect(getTokenLimitErrorDescription(undefined)).toBe(null);
    });
  });
});
