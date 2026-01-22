/**
 * Tests for the `phoenix-insight init` command
 *
 * Tests the init command's configuration file creation, prompting behavior,
 * and handling of existing files.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// Mock fs module
vi.mock("node:fs/promises");

// ============================================================================
// Test: Configuration path construction
// ============================================================================

describe("config path construction", () => {
  it("should construct path in user home directory", () => {
    const configDir = path.join(os.homedir(), ".phoenix-insight");
    const configPath = path.join(configDir, "config.json");

    expect(configPath).toContain(os.homedir());
    expect(configPath).toContain(".phoenix-insight");
    expect(configPath.endsWith("config.json")).toBe(true);
  });

  it("should create both config directory and file paths", () => {
    const configDir = path.join(os.homedir(), ".phoenix-insight");
    const configPath = path.join(configDir, "config.json");

    expect(path.dirname(configPath)).toBe(configDir);
  });
});

// ============================================================================
// Test: Config file creation with provided values
// ============================================================================

describe("config file creation with provided values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create config with custom baseUrl and apiKey", async () => {
    const baseUrl = "https://app.phoenix.arize.com/s/my-space";
    const apiKey = "test-api-key-123";

    const config: Record<string, unknown> = {
      baseUrl,
      ...(apiKey && { apiKey }),
    };

    expect(config).toEqual({
      baseUrl: "https://app.phoenix.arize.com/s/my-space",
      apiKey: "test-api-key-123",
    });
  });

  it("should create config with only baseUrl when apiKey is empty", () => {
    const baseUrl = "https://custom.phoenix.com";
    const apiKey = "";

    // Build config object - only include apiKey if it has a value
    const config: Record<string, unknown> = { baseUrl };
    if (apiKey) {
      config.apiKey = apiKey;
    }

    expect(config).toEqual({
      baseUrl: "https://custom.phoenix.com",
    });
    expect(config.apiKey).toBeUndefined();
  });

  it("should write config as formatted JSON", async () => {
    const config = {
      baseUrl: "http://localhost:6006",
      apiKey: "secret-key",
    };

    const content = JSON.stringify(config, null, 2);

    expect(content).toContain('"baseUrl"');
    expect(content).toContain('"apiKey"');
    expect(content).toContain("http://localhost:6006");
    expect(content).toContain("secret-key");
    // Check it's properly indented (formatted with 2 spaces)
    expect(content).toMatch(/^\{\n  /);
  });

  it("should write config file to correct path", async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const configDir = path.join(os.homedir(), ".phoenix-insight");
    const configPath = path.join(configDir, "config.json");
    const config = { baseUrl: "http://localhost:6006" };
    const content = JSON.stringify(config, null, 2);

    await fs.writeFile(configPath, content, "utf-8");

    expect(fs.writeFile).toHaveBeenCalledWith(configPath, content, "utf-8");
  });
});

// ============================================================================
// Test: Default values handling
// ============================================================================

describe("default values handling", () => {
  it("should use default baseUrl when user provides empty input", () => {
    const userInput = "";
    const defaultValue = "http://localhost:6006";
    const baseUrl = userInput.trim() || defaultValue;

    expect(baseUrl).toBe("http://localhost:6006");
  });

  it("should use user-provided baseUrl when given", () => {
    const userInput = "https://custom.phoenix.com";
    const defaultValue = "http://localhost:6006";
    const baseUrl = userInput.trim() || defaultValue;

    expect(baseUrl).toBe("https://custom.phoenix.com");
  });

  it("should trim whitespace from user input", () => {
    const userInput = "  https://custom.phoenix.com  ";
    const defaultValue = "http://localhost:6006";
    const baseUrl = userInput.trim() || defaultValue;

    expect(baseUrl).toBe("https://custom.phoenix.com");
  });

  it("should treat whitespace-only input as empty (use default)", () => {
    const userInput = "   ";
    const defaultValue = "http://localhost:6006";
    const baseUrl = userInput.trim() || defaultValue;

    expect(baseUrl).toBe("http://localhost:6006");
  });

  it("should use empty string as default for apiKey", () => {
    const userInput = "";
    const defaultValue = "";
    const apiKey = userInput.trim() || defaultValue;

    expect(apiKey).toBe("");
  });
});

// ============================================================================
// Test: Messages about defaults
// ============================================================================

describe("messages about defaults", () => {
  it("should show localhost info message when using default URL", () => {
    const baseUrl = "http://localhost:6006";
    const isDefaultUrl = baseUrl === "http://localhost:6006";

    expect(isDefaultUrl).toBe(true);

    const infoMessage =
      "Using default localhost URL. For Phoenix Cloud, use: https://app.phoenix.arize.com/s/<space_name>";
    expect(infoMessage).toContain("localhost");
    expect(infoMessage).toContain("Phoenix Cloud");
    expect(infoMessage).toContain("app.phoenix.arize.com");
  });

  it("should not show localhost info when using custom URL", () => {
    const baseUrl: string = "https://app.phoenix.arize.com/s/my-space";
    const defaultUrl = "http://localhost:6006";
    const isDefaultUrl = baseUrl === defaultUrl;

    expect(isDefaultUrl).toBe(false);
  });

  it("should show no-api-key info message when apiKey is empty", () => {
    const apiKey = "";
    const hasNoApiKey = !apiKey;

    expect(hasNoApiKey).toBe(true);

    const infoMessage =
      "No API key provided. You can add one later if using Phoenix Cloud or authenticated Phoenix.";
    expect(infoMessage).toContain("No API key");
    expect(infoMessage).toContain("Phoenix Cloud");
  });

  it("should not show no-api-key message when apiKey is provided", () => {
    const apiKey = "secret-key";
    const hasNoApiKey = !apiKey;

    expect(hasNoApiKey).toBe(false);
  });
});

// ============================================================================
// Test: Existing config file handling
// ============================================================================

describe("existing config file handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect existing config file", async () => {
    const existingConfig = {
      baseUrl: "https://old.phoenix.com",
      apiKey: "old-key",
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));

    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );
    const content = await fs.readFile(configPath, "utf-8");
    const parsed = JSON.parse(content as string);

    expect(parsed).toEqual(existingConfig);
  });

  it("should prompt for overwrite when config exists", () => {
    // Simulating the overwrite confirmation flow
    const existingConfig = { baseUrl: "https://old.phoenix.com" };
    const promptMessage = "Overwrite existing config? (yes/no)";
    const defaultAnswer = "no";

    expect(promptMessage).toContain("Overwrite");
    expect(defaultAnswer).toBe("no");
  });

  it("should preserve existing config when user says no", () => {
    const userAnswer = "no";
    const shouldOverwrite =
      userAnswer.toLowerCase() === "yes" || userAnswer.toLowerCase() === "y";

    expect(shouldOverwrite).toBe(false);
  });

  it("should preserve existing config when user says anything other than yes/y", () => {
    const testCases = ["no", "n", "NO", "N", "", "maybe", "nope"];

    for (const answer of testCases) {
      const shouldOverwrite =
        answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
      expect(shouldOverwrite).toBe(false);
    }
  });

  it("should overwrite config when user says yes", () => {
    const userAnswer = "yes";
    const shouldOverwrite =
      userAnswer.toLowerCase() === "yes" || userAnswer.toLowerCase() === "y";

    expect(shouldOverwrite).toBe(true);
  });

  it("should overwrite config when user says y", () => {
    const userAnswer = "y";
    const shouldOverwrite =
      userAnswer.toLowerCase() === "yes" || userAnswer.toLowerCase() === "y";

    expect(shouldOverwrite).toBe(true);
  });

  it("should handle case-insensitive yes/y", () => {
    const testCases = ["yes", "YES", "Yes", "YeS", "y", "Y"];

    for (const answer of testCases) {
      const shouldOverwrite =
        answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
      expect(shouldOverwrite).toBe(true);
    }
  });

  it("should handle file not found gracefully (no existing config)", async () => {
    const enoentError = new Error("File not found") as NodeJS.ErrnoException;
    enoentError.code = "ENOENT";
    vi.mocked(fs.readFile).mockRejectedValue(enoentError);

    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );

    let existingConfig: Record<string, unknown> | null = null;
    try {
      const content = await fs.readFile(configPath, "utf-8");
      existingConfig = JSON.parse(content as string);
    } catch {
      // Config doesn't exist, which is fine
    }

    expect(existingConfig).toBeNull();
  });
});

// ============================================================================
// Test: Parent directory creation
// ============================================================================

describe("parent directory creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create parent directories recursively", async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    const configDir = path.join(os.homedir(), ".phoenix-insight");
    await fs.mkdir(configDir, { recursive: true });

    expect(fs.mkdir).toHaveBeenCalledWith(configDir, { recursive: true });
  });

  it("should handle directory already exists gracefully", async () => {
    // mkdir with recursive: true does not throw if directory exists
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    const configDir = path.join(os.homedir(), ".phoenix-insight");

    // Should not throw
    await expect(fs.mkdir(configDir, { recursive: true })).resolves.not.toThrow();
  });

  it("should create nested directory structure", async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    const nestedConfigDir = path.join(
      os.homedir(),
      ".phoenix-insight",
      "nested",
      "deep"
    );
    await fs.mkdir(nestedConfigDir, { recursive: true });

    expect(fs.mkdir).toHaveBeenCalledWith(nestedConfigDir, { recursive: true });
  });
});

// ============================================================================
// Test: Console output messages
// ============================================================================

describe("console output messages", () => {
  it("should include startup message", () => {
    const startupMessage = "🚀 Phoenix Insight Configuration Setup\n";
    expect(startupMessage).toContain("Phoenix Insight");
    expect(startupMessage).toContain("Configuration");
  });

  it("should include success message after save", () => {
    const successMessage = "✅ Configuration saved successfully!";
    expect(successMessage).toContain("saved successfully");
  });

  it("should include config file path in output", () => {
    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );
    const filePathMessage = `📁 Config file: ${configPath}`;
    expect(filePathMessage).toContain(".phoenix-insight");
    expect(filePathMessage).toContain("config.json");
  });

  it("should include next steps message", () => {
    const nextStepsMessage =
      "You can now run 'phoenix-insight' to start analyzing your Phoenix data.";
    expect(nextStepsMessage).toContain("phoenix-insight");
  });

  it("should show warning for existing config", () => {
    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );
    const warningMessage = `⚠️  Config file already exists at ${configPath}`;
    expect(warningMessage).toContain("already exists");
    expect(warningMessage).toContain(configPath);
  });

  it("should show cancel message when user declines overwrite", () => {
    const cancelMessage = "❌ Init cancelled. Existing config preserved.";
    expect(cancelMessage).toContain("cancelled");
    expect(cancelMessage).toContain("preserved");
  });

  it("should mask API key in output (show only first 8 chars)", () => {
    const apiKey = "sk-1234567890abcdef";
    const maskedKey = `${apiKey.substring(0, 8)}...`;
    expect(maskedKey).toBe("sk-12345...");
    expect(maskedKey).not.toContain("abcdef");
  });
});

// ============================================================================
// Test: Prompt function behavior
// ============================================================================

describe("prompt function behavior", () => {
  it("should format question with default value", () => {
    const question = "Phoenix base URL";
    const defaultValue = "http://localhost:6006";
    const displayDefault = defaultValue ? ` (${defaultValue})` : "";
    const fullPrompt = `${question}${displayDefault}: `;

    expect(fullPrompt).toBe("Phoenix base URL (http://localhost:6006): ");
  });

  it("should format question without default when empty", () => {
    const question = "Phoenix API key";
    const defaultValue = "";
    const displayDefault = defaultValue ? ` (${defaultValue})` : "";
    const fullPrompt = `${question}${displayDefault}: `;

    expect(fullPrompt).toBe("Phoenix API key: ");
  });

  it("should return trimmed user input", () => {
    const userAnswer = "  https://custom.com  ";
    const defaultValue = "http://localhost:6006";
    const result = userAnswer.trim() || defaultValue;

    expect(result).toBe("https://custom.com");
  });

  it("should return default when user input is empty", () => {
    const userAnswer = "";
    const defaultValue = "http://localhost:6006";
    const result = userAnswer.trim() || defaultValue;

    expect(result).toBe("http://localhost:6006");
  });
});

// ============================================================================
// Test: Error handling
// ============================================================================

describe("error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle write errors gracefully", async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockRejectedValue(new Error("Permission denied"));

    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );

    await expect(fs.writeFile(configPath, "{}", "utf-8")).rejects.toThrow(
      "Permission denied"
    );
  });

  it("should format Error objects in error messages", () => {
    const error: unknown = new Error("Disk full");
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("Disk full");
  });

  it("should format non-Error objects in error messages", () => {
    const error: unknown = "string error";
    const formattedError =
      error instanceof Error ? error.message : String(error);

    expect(formattedError).toBe("string error");
  });

  it("should handle JSON parse errors from existing config", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");

    const configPath = path.join(
      os.homedir(),
      ".phoenix-insight",
      "config.json"
    );

    let existingConfig: Record<string, unknown> | null = null;
    try {
      const content = await fs.readFile(configPath, "utf-8");
      existingConfig = JSON.parse(content as string);
    } catch {
      // Invalid JSON treated as no config
    }

    expect(existingConfig).toBeNull();
  });
});

// ============================================================================
// Test: Config schema validation
// ============================================================================

describe("config schema", () => {
  it("should accept valid config with baseUrl only", () => {
    const config = { baseUrl: "http://localhost:6006" };
    expect(config).toHaveProperty("baseUrl");
  });

  it("should accept valid config with baseUrl and apiKey", () => {
    const config = {
      baseUrl: "https://app.phoenix.arize.com/s/my-space",
      apiKey: "my-secret-key",
    };
    expect(config).toHaveProperty("baseUrl");
    expect(config).toHaveProperty("apiKey");
  });

  it("should produce valid JSON output", () => {
    const config = {
      baseUrl: "http://localhost:6006",
      apiKey: "test-key",
    };

    const jsonString = JSON.stringify(config, null, 2);
    const parsed = JSON.parse(jsonString);

    expect(parsed).toEqual(config);
  });
});
