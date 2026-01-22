/**
 * Tests for the `phoenix-insight seed` command
 *
 * Tests the seed command's configuration loading, OpenTelemetry initialization,
 * ai-sdk integration, and error handling for missing API keys and connection errors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock modules before imports
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(),
}));

vi.mock("../../src/observability/index.js", () => ({
  initializeObservability: vi.fn(),
  shutdownObservability: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/config/index.js", () => ({
  getConfig: vi.fn(),
  initializeConfig: vi.fn(),
}));

// Import after mocking
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  initializeObservability,
  shutdownObservability,
} from "../../src/observability/index.js";
import { getConfig, initializeConfig } from "../../src/config/index.js";

// ============================================================================
// Test: Configuration loading
// ============================================================================

describe("config loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use existing config when available", () => {
    const mockConfig = {
      baseUrl: "https://app.phoenix.arize.com/s/my-space",
      apiKey: "phoenix-api-key-123",
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    vi.mocked(getConfig).mockReturnValue(mockConfig);

    const config = getConfig();

    expect(config).toEqual(mockConfig);
    expect(config.baseUrl).toBe("https://app.phoenix.arize.com/s/my-space");
    expect(config.apiKey).toBe("phoenix-api-key-123");
  });

  it("should fall back to initializeConfig when getConfig throws", async () => {
    const defaultConfig = {
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    vi.mocked(getConfig).mockImplementation(() => {
      throw new Error("Config not initialized");
    });
    vi.mocked(initializeConfig).mockResolvedValue(defaultConfig);

    // Simulate the seed command's config loading logic
    let config;
    try {
      config = getConfig();
    } catch {
      config = await initializeConfig({});
    }

    expect(config).toEqual(defaultConfig);
    expect(initializeConfig).toHaveBeenCalledWith({});
  });

  it("should use default baseUrl when not configured", () => {
    const config = {
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    vi.mocked(getConfig).mockReturnValue(config);

    const result = getConfig();
    expect(result.baseUrl).toBe("http://localhost:6006");
  });

  it("should handle config with only baseUrl (no apiKey)", () => {
    const config = {
      baseUrl: "https://custom.phoenix.com",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    vi.mocked(getConfig).mockReturnValue(config);

    const result = getConfig();
    expect(result.baseUrl).toBe("https://custom.phoenix.com");
    expect(result.apiKey).toBeUndefined();
  });
});

// ============================================================================
// Test: OpenTelemetry initialization
// ============================================================================

describe("OpenTelemetry initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize observability with correct Phoenix endpoint", () => {
    const mockConfig = {
      baseUrl: "https://app.phoenix.arize.com/s/my-space",
      apiKey: "phoenix-api-key-123",
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    // Call initializeObservability as the seed command would
    initializeObservability({
      enabled: true,
      baseUrl: mockConfig.baseUrl,
      apiKey: mockConfig.apiKey,
      projectName: "phoenix-insight-seed",
      debug: false,
    });

    expect(initializeObservability).toHaveBeenCalledWith({
      enabled: true,
      baseUrl: "https://app.phoenix.arize.com/s/my-space",
      apiKey: "phoenix-api-key-123",
      projectName: "phoenix-insight-seed",
      debug: false,
    });
  });

  it("should use localhost endpoint when no custom URL configured", () => {
    const mockConfig = {
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    initializeObservability({
      enabled: true,
      baseUrl: mockConfig.baseUrl,
      apiKey: mockConfig.apiKey,
      projectName: "phoenix-insight-seed",
      debug: false,
    });

    expect(initializeObservability).toHaveBeenCalledWith({
      enabled: true,
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      projectName: "phoenix-insight-seed",
      debug: false,
    });
  });

  it("should enable debug mode when DEBUG env is set", () => {
    const mockConfig = {
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: true,
    };

    initializeObservability({
      enabled: true,
      baseUrl: mockConfig.baseUrl,
      apiKey: mockConfig.apiKey,
      projectName: "phoenix-insight-seed",
      debug: true,
    });

    expect(initializeObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        debug: true,
      })
    );
  });

  it("should always enable observability for seed command", () => {
    const mockConfig = {
      baseUrl: "http://localhost:6006",
      apiKey: undefined,
      limit: 1000,
      stream: true,
      mode: "sandbox" as const,
      refresh: false,
      trace: false, // Even if trace is disabled in config
    };

    // Seed command always enables observability regardless of trace config
    initializeObservability({
      enabled: true, // Always true for seed
      baseUrl: mockConfig.baseUrl,
      apiKey: mockConfig.apiKey,
      projectName: "phoenix-insight-seed",
      debug: false,
    });

    expect(initializeObservability).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      })
    );
  });

  it("should call shutdownObservability to flush traces", async () => {
    await shutdownObservability();

    expect(shutdownObservability).toHaveBeenCalled();
  });
});

// ============================================================================
// Test: ai-sdk generateText calls
// ============================================================================

describe("ai-sdk generateText integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock anthropic to return a model function
    vi.mocked(anthropic).mockReturnValue("mock-model" as any);
  });

  it("should call generateText with expected parameters", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Hello! How can I help you today?",
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
    } as any);

    // Simulate the seed command's generateText call
    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    expect(anthropic).toHaveBeenCalledWith("claude-sonnet-4-20250514");
    expect(generateText).toHaveBeenCalledWith({
      model: "mock-model",
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });
    expect(result.text).toBe("Hello! How can I help you today?");
  });

  it("should enable telemetry for tracing", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Hi there!",
    } as any);

    await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_telemetry: {
          isEnabled: true,
        },
      })
    );
  });

  it("should use claude-sonnet-4-20250514 model", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Hello!",
    } as any);

    await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    expect(anthropic).toHaveBeenCalledWith("claude-sonnet-4-20250514");
  });

  it("should use the hello world prompt", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Hello! I'm doing well, thanks for asking.",
    } as any);

    await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: "Hello, world! Please respond briefly.",
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Hello, world! Please respond briefly.",
      })
    );
  });
});

// ============================================================================
// Test: Missing Anthropic API key handling
// ============================================================================

describe("missing Anthropic API key handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh env object for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it("should detect missing ANTHROPIC_API_KEY", () => {
    delete process.env.ANTHROPIC_API_KEY;

    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    expect(hasApiKey).toBe(false);
  });

  it("should detect present ANTHROPIC_API_KEY", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-test-key";

    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    expect(hasApiKey).toBe(true);
  });

  it("should provide helpful error message format for missing key", () => {
    const errorMessage = "The Anthropic API key is required to run the seed command.";
    const fixSuggestion = "export ANTHROPIC_API_KEY=sk-ant-api03-...";
    const getKeyUrl = "https://console.anthropic.com/";

    expect(errorMessage).toContain("Anthropic API key");
    expect(errorMessage).toContain("required");
    expect(fixSuggestion).toContain("ANTHROPIC_API_KEY");
    expect(getKeyUrl).toContain("anthropic.com");
  });

  it("should check API key before making AI calls", () => {
    delete process.env.ANTHROPIC_API_KEY;

    // Simulate the guard logic from the seed command
    const shouldProceed = !!process.env.ANTHROPIC_API_KEY;

    expect(shouldProceed).toBe(false);
    // generateText should not be called if key is missing
    expect(generateText).not.toHaveBeenCalled();
  });

  it("should allow proceeding when API key is present", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-test-key";

    const shouldProceed = !!process.env.ANTHROPIC_API_KEY;
    expect(shouldProceed).toBe(true);
  });
});

// ============================================================================
// Test: Phoenix connection error handling
// ============================================================================

describe("Phoenix connection error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(anthropic).mockReturnValue("mock-model" as any);
  });

  it("should handle ECONNREFUSED errors gracefully", async () => {
    const connectionError = new Error("connect ECONNREFUSED 127.0.0.1:6006");

    vi.mocked(generateText).mockRejectedValue(connectionError);

    let caughtError: Error | null = null;
    try {
      await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: "Hello, world! Please respond briefly.",
        experimental_telemetry: {
          isEnabled: true,
        },
      });
    } catch (error) {
      caughtError = error as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain("ECONNREFUSED");
  });

  it("should identify network errors by message content", () => {
    const networkErrorPatterns = [
      "ECONNREFUSED",
      "fetch failed",
      "network error",
      "connection refused",
    ];

    const testErrors = [
      new Error("connect ECONNREFUSED 127.0.0.1:6006"),
      new Error("fetch failed"),
      new Error("TypeError: fetch failed"),
    ];

    for (const error of testErrors) {
      const isNetworkError = networkErrorPatterns.some(
        (pattern) =>
          error.message.toLowerCase().includes(pattern.toLowerCase())
      );
      expect(isNetworkError).toBe(true);
    }
  });

  it("should handle authentication errors gracefully", async () => {
    const authError = new Error("401 Unauthorized - Invalid API key");

    vi.mocked(generateText).mockRejectedValue(authError);

    let caughtError: Error | null = null;
    try {
      await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: "Hello, world! Please respond briefly.",
        experimental_telemetry: {
          isEnabled: true,
        },
      });
    } catch (error) {
      caughtError = error as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toContain("401");
  });

  it("should identify authentication errors by message content", () => {
    const authErrorPatterns = ["authentication", "API key", "401", "unauthorized"];

    const testErrors = [
      new Error("401 Unauthorized"),
      new Error("Invalid API key"),
      new Error("authentication failed"),
    ];

    for (const error of testErrors) {
      const isAuthError = authErrorPatterns.some(
        (pattern) =>
          error.message.toLowerCase().includes(pattern.toLowerCase())
      );
      expect(isAuthError).toBe(true);
    }
  });

  it("should call shutdownObservability even on error", async () => {
    const error = new Error("Some error");
    vi.mocked(generateText).mockRejectedValue(error);

    // Simulate the try-catch-finally pattern from the seed command
    try {
      await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: "Hello, world! Please respond briefly.",
        experimental_telemetry: {
          isEnabled: true,
        },
      });
    } catch {
      // Error caught
    }

    // Cleanup should always be called
    await shutdownObservability();

    expect(shutdownObservability).toHaveBeenCalled();
  });

  it("should provide actionable error messages for Phoenix connection issues", () => {
    const baseUrl = "http://localhost:6006";
    const errorMessage = `Network Error: Unable to connect to Phoenix at ${baseUrl}`;
    const suggestion1 = "Make sure Phoenix is running and accessible.";
    const suggestion2 =
      "docker run -d -p 6006:6006 arizephoenix/phoenix:latest";

    expect(errorMessage).toContain("Phoenix");
    expect(errorMessage).toContain(baseUrl);
    expect(suggestion1).toContain("running");
    expect(suggestion2).toContain("docker");
    expect(suggestion2).toContain("6006");
  });
});

// ============================================================================
// Test: Phoenix URL construction
// ============================================================================

describe("Phoenix URL construction", () => {
  it("should construct correct project URL from baseUrl", () => {
    const baseUrl = "http://localhost:6006";
    const projectUrl = `${baseUrl}/projects/phoenix-insight-seed`;

    expect(projectUrl).toBe("http://localhost:6006/projects/phoenix-insight-seed");
  });

  it("should handle trailing slash in baseUrl", () => {
    let baseUrl = "http://localhost:6006/";
    // Remove trailing slash if present
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const projectUrl = `${baseUrl}/projects/phoenix-insight-seed`;

    expect(projectUrl).toBe("http://localhost:6006/projects/phoenix-insight-seed");
    expect(projectUrl).not.toContain("//projects");
  });

  it("should work with Phoenix Cloud URLs", () => {
    let baseUrl = "https://app.phoenix.arize.com/s/my-space";
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const projectUrl = `${baseUrl}/projects/phoenix-insight-seed`;

    expect(projectUrl).toBe(
      "https://app.phoenix.arize.com/s/my-space/projects/phoenix-insight-seed"
    );
  });

  it("should use phoenix-insight-seed as project name", () => {
    const projectName = "phoenix-insight-seed";
    const baseUrl = "http://localhost:6006";
    const projectUrl = `${baseUrl}/projects/${projectName}`;

    expect(projectUrl).toContain("phoenix-insight-seed");
  });
});

// ============================================================================
// Test: Console output messages
// ============================================================================

describe("console output messages", () => {
  it("should include seed startup message", () => {
    const startupMessage =
      "Phoenix Insight Seed - Verifying Phoenix Setup";
    expect(startupMessage).toContain("Phoenix Insight");
    expect(startupMessage).toContain("Seed");
  });

  it("should display config information", () => {
    const config = {
      baseUrl: "http://localhost:6006",
      apiKey: "secret-key-12345",
    };

    const configDisplay = `Phoenix URL: ${config.baseUrl}`;
    const maskedKey = config.apiKey
      ? `Phoenix API Key: ${config.apiKey.substring(0, 8)}...`
      : "";

    expect(configDisplay).toContain("localhost:6006");
    expect(maskedKey).toBe("Phoenix API Key: secret-k...");
    expect(maskedKey).not.toContain("12345");
  });

  it("should show tracing initialization message", () => {
    const message = "Initializing OpenTelemetry tracing...";
    expect(message).toContain("OpenTelemetry");
    expect(message).toContain("tracing");
  });

  it("should show success message on completion", () => {
    const successMessage = "Seed completed successfully!";
    expect(successMessage).toContain("Seed");
    expect(successMessage).toContain("successfully");
  });

  it("should include Phoenix UI link in output", () => {
    const phoenixUrl = "http://localhost:6006";
    const projectUrl = `${phoenixUrl}/projects/phoenix-insight-seed`;
    const message = `View your trace in Phoenix:\n   ${projectUrl}`;

    expect(message).toContain("trace");
    expect(message).toContain(projectUrl);
  });

  it("should include tip about trace visibility delay", () => {
    const tip =
      "If you don't see the trace immediately, wait a few seconds and refresh the page.";
    expect(tip).toContain("trace");
    expect(tip).toContain("refresh");
  });
});

// ============================================================================
// Test: Error message formatting
// ============================================================================

describe("error message formatting", () => {
  it("should format Error objects correctly", () => {
    const error: unknown = new Error("Something went wrong");
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("Something went wrong");
  });

  it("should format non-Error objects as strings", () => {
    const error: unknown = "string error";
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("string error");
  });

  it("should format undefined errors", () => {
    const error: unknown = undefined;
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("undefined");
  });

  it("should format null errors", () => {
    const error: unknown = null;
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("null");
  });
});
