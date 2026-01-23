/**
 * Tests for the `phoenix-insight init` command
 *
 * These tests verify that the init command properly:
 * 1. Initializes all default config values with user-supplied args merged on top
 * 2. Does not overwrite existing config without confirmation
 * 3. Respects custom config path arguments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "node:path";
import * as os from "node:os";

// Mock fs/promises before any imports that use it
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

// Import after mocking
import * as fs from "node:fs/promises";
import {
  initializeConfig,
  resetConfig,
  getConfig,
  type CliArgs,
} from "../../src/config/index.js";
import { setCliConfigPath, getConfigPath } from "../../src/config/loader.js";
import { getDefaultConfig } from "../../src/config/schema.js";

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".phoenix-insight");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "config.json");

describe("init command - config initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConfig();
    // Reset environment variables that might interfere
    delete process.env.PHOENIX_BASE_URL;
    delete process.env.PHOENIX_API_KEY;
    delete process.env.PHOENIX_INSIGHT_CONFIG;
    delete process.env.PHOENIX_INSIGHT_LIMIT;
    delete process.env.PHOENIX_INSIGHT_STREAM;
    delete process.env.PHOENIX_INSIGHT_MODE;
    delete process.env.PHOENIX_INSIGHT_REFRESH;
    delete process.env.PHOENIX_INSIGHT_TRACE;
  });

  afterEach(() => {
    resetConfig();
  });

  describe("default config values", () => {
    it("should initialize all default values when no config file exists", async () => {
      // Mock: no existing config file (ENOENT error)
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Initialize with empty CLI args
      const config = await initializeConfig({});

      // Verify all default values are set
      expect(config).toEqual({
        baseUrl: "http://localhost:6006",
        limit: 1000,
        stream: true,
        mode: "sandbox",
        refresh: false,
        trace: true,
        // apiKey is optional and should be undefined
      });
    });

    it("should merge user-supplied CLI args on top of defaults", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const cliArgs: CliArgs = {
        baseUrl: "https://custom.phoenix.com",
        apiKey: "test-api-key",
        limit: 500,
        stream: false,
      };

      const config = await initializeConfig(cliArgs);

      // CLI args should override defaults
      expect(config.baseUrl).toBe("https://custom.phoenix.com");
      expect(config.apiKey).toBe("test-api-key");
      expect(config.limit).toBe(500);
      expect(config.stream).toBe(false);
      // Non-overridden values should keep defaults
      expect(config.mode).toBe("sandbox");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(true);
    });

    it("should merge file config with CLI args (CLI takes priority)", async () => {
      // Mock: existing config file with some values
      const existingConfig = {
        baseUrl: "https://file-config.com",
        apiKey: "file-api-key",
        limit: 2000,
        stream: false,
        mode: "local",
        refresh: true,
        trace: false,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // CLI args only override some values
      const cliArgs: CliArgs = {
        baseUrl: "https://cli-override.com",
        limit: 100,
      };

      const config = await initializeConfig(cliArgs);

      // CLI args should override file config
      expect(config.baseUrl).toBe("https://cli-override.com");
      expect(config.limit).toBe(100);
      // File config values should be preserved for non-overridden keys
      expect(config.apiKey).toBe("file-api-key");
      expect(config.stream).toBe(false);
      expect(config.mode).toBe("local");
      expect(config.refresh).toBe(true);
      expect(config.trace).toBe(false);
    });

    it("should merge env vars between file config and CLI args", async () => {
      // Set up environment variables
      process.env.PHOENIX_BASE_URL = "https://env-url.com";
      process.env.PHOENIX_API_KEY = "env-api-key";

      // Mock: existing config file
      const existingConfig = {
        baseUrl: "https://file-config.com",
        limit: 2000,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // CLI args only set limit
      const cliArgs: CliArgs = {
        limit: 100,
      };

      const config = await initializeConfig(cliArgs);

      // Priority: file < env < CLI
      // baseUrl: file=file-config, env=env-url -> env wins
      expect(config.baseUrl).toBe("https://env-url.com");
      // apiKey: only in env
      expect(config.apiKey).toBe("env-api-key");
      // limit: file=2000, CLI=100 -> CLI wins
      expect(config.limit).toBe(100);
    });
  });

  describe("existing config file handling", () => {
    it("should not overwrite existing config file when using default path", async () => {
      // Mock: config file already exists
      const existingConfig = {
        baseUrl: "https://existing.com",
        apiKey: "existing-key",
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined); // File exists
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig({});

      // writeFile should NOT have been called because the file exists
      // (createDefaultConfig checks fs.access and skips if file exists)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should create config file when it does not exist at default path", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError); // File does not exist
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig({});

      // Should create directory and write file
      expect(fs.mkdir).toHaveBeenCalledWith(DEFAULT_CONFIG_DIR, {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        DEFAULT_CONFIG_PATH,
        expect.any(String),
        "utf-8"
      );

      // Verify the written content includes defaults
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);
      expect(writtenContent.baseUrl).toBe("http://localhost:6006");
      expect(writtenContent.limit).toBe(1000);
      expect(writtenContent.stream).toBe(true);
    });

    it("should preserve existing config values when loading", async () => {
      const existingConfig = {
        baseUrl: "https://preserved.com",
        apiKey: "preserved-key",
        limit: 5000,
        stream: false,
        mode: "local",
        refresh: true,
        trace: false,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Initialize without any CLI overrides
      const config = await initializeConfig({});

      // All values from existing config should be preserved
      expect(config.baseUrl).toBe("https://preserved.com");
      expect(config.apiKey).toBe("preserved-key");
      expect(config.limit).toBe(5000);
      expect(config.stream).toBe(false);
      expect(config.mode).toBe("local");
      expect(config.refresh).toBe(true);
      expect(config.trace).toBe(false);
    });
  });

  describe("custom config path argument", () => {
    it("should respect custom config path via --config argument", async () => {
      const customPath = "/custom/path/to/config.json";
      const customConfig = {
        baseUrl: "https://custom-path.com",
        apiKey: "custom-path-key",
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(customConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Initialize with custom config path
      const cliArgs: CliArgs = {
        config: customPath,
      };

      const config = await initializeConfig(cliArgs);

      // Should have read from the custom path
      expect(fs.readFile).toHaveBeenCalledWith(customPath, "utf-8");

      // Values from custom config should be loaded
      expect(config.baseUrl).toBe("https://custom-path.com");
      expect(config.apiKey).toBe("custom-path-key");
    });

    it("should not create default config file when using custom path", async () => {
      const customPath = "/custom/path/to/config.json";
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";

      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const cliArgs: CliArgs = {
        config: customPath,
      };

      await initializeConfig(cliArgs);

      // writeFile should NOT have been called for custom paths
      // (createDefaultConfig only creates for isDefault=true)
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should respect PHOENIX_INSIGHT_CONFIG environment variable", async () => {
      const envPath = "/env/path/config.json";
      process.env.PHOENIX_INSIGHT_CONFIG = envPath;

      const envConfig = {
        baseUrl: "https://env-path.com",
        limit: 3000,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(envConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await initializeConfig({});

      // Should have read from the env-specified path
      expect(fs.readFile).toHaveBeenCalledWith(envPath, "utf-8");

      const config = getConfig();
      expect(config.baseUrl).toBe("https://env-path.com");
      expect(config.limit).toBe(3000);
    });

    it("should prioritize CLI --config over PHOENIX_INSIGHT_CONFIG env var", async () => {
      const cliPath = "/cli/path/config.json";
      const envPath = "/env/path/config.json";
      process.env.PHOENIX_INSIGHT_CONFIG = envPath;

      const cliConfig = {
        baseUrl: "https://cli-path.com",
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(cliConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const cliArgs: CliArgs = {
        config: cliPath,
      };

      await initializeConfig(cliArgs);

      // Should have read from CLI path, not env path
      expect(fs.readFile).toHaveBeenCalledWith(cliPath, "utf-8");
      expect(fs.readFile).not.toHaveBeenCalledWith(envPath, "utf-8");

      const config = getConfig();
      expect(config.baseUrl).toBe("https://cli-path.com");
    });
  });

  describe("getConfigPath resolution", () => {
    beforeEach(() => {
      setCliConfigPath(undefined);
      delete process.env.PHOENIX_INSIGHT_CONFIG;
    });

    it("should return default path when no overrides are set", () => {
      const { path: configPath, isDefault } = getConfigPath();

      expect(configPath).toBe(DEFAULT_CONFIG_PATH);
      expect(isDefault).toBe(true);
    });

    it("should return CLI path when set via setCliConfigPath", () => {
      const customPath = "/custom/cli/config.json";
      setCliConfigPath(customPath);

      const { path: configPath, isDefault } = getConfigPath();

      expect(configPath).toBe(customPath);
      expect(isDefault).toBe(false);
    });

    it("should return env path when PHOENIX_INSIGHT_CONFIG is set", () => {
      const envPath = "/env/config.json";
      process.env.PHOENIX_INSIGHT_CONFIG = envPath;

      const { path: configPath, isDefault } = getConfigPath();

      expect(configPath).toBe(envPath);
      expect(isDefault).toBe(false);
    });

    it("should prioritize CLI path over env path", () => {
      const cliPath = "/cli/config.json";
      const envPath = "/env/config.json";

      setCliConfigPath(cliPath);
      process.env.PHOENIX_INSIGHT_CONFIG = envPath;

      const { path: configPath, isDefault } = getConfigPath();

      expect(configPath).toBe(cliPath);
      expect(isDefault).toBe(false);
    });
  });

  describe("config value types and validation", () => {
    it("should handle boolean CLI args correctly", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const cliArgs: CliArgs = {
        local: true, // Should become mode: "local"
        refresh: true,
        trace: false,
        stream: false,
      };

      const config = await initializeConfig(cliArgs);

      expect(config.mode).toBe("local");
      expect(config.refresh).toBe(true);
      expect(config.trace).toBe(false);
      expect(config.stream).toBe(false);
    });

    it("should handle invalid config file gracefully (use defaults)", async () => {
      // Invalid JSON in config file
      vi.mocked(fs.readFile).mockResolvedValue("{ invalid json }");
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = await initializeConfig({});

      // Should fall back to defaults
      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.limit).toBe(1000);

      warnSpy.mockRestore();
    });

    it("should handle config with invalid values gracefully", async () => {
      // Config with invalid types
      const invalidConfig = {
        baseUrl: 12345, // Should be string
        limit: "not-a-number", // Should be number
        mode: "invalid-mode", // Should be "sandbox" | "local"
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = await initializeConfig({});

      // Should fall back to defaults for invalid values
      expect(config.baseUrl).toBe("http://localhost:6006");
      expect(config.limit).toBe(1000);
      expect(config.mode).toBe("sandbox");

      warnSpy.mockRestore();
    });

    it("should handle partial config file with missing fields", async () => {
      // Config with only some fields
      const partialConfig = {
        baseUrl: "https://partial.com",
        // Missing: limit, stream, mode, refresh, trace
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(partialConfig));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const config = await initializeConfig({});

      // Specified values should be used
      expect(config.baseUrl).toBe("https://partial.com");
      // Missing values should get defaults
      expect(config.limit).toBe(1000);
      expect(config.stream).toBe(true);
      expect(config.mode).toBe("sandbox");
      expect(config.refresh).toBe(false);
      expect(config.trace).toBe(true);
    });
  });

  describe("getConfig singleton behavior", () => {
    it("should throw when getConfig is called before initializeConfig", () => {
      resetConfig();

      expect(() => getConfig()).toThrow(
        "Config not initialized. Call initializeConfig() first before using getConfig()."
      );
    });

    it("should return same config instance after initialization", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const config1 = await initializeConfig({ baseUrl: "https://test.com" });
      const config2 = getConfig();

      expect(config1).toBe(config2);
      expect(config1.baseUrl).toBe("https://test.com");
    });
  });

  describe("written config file content", () => {
    it("should write config with all default values when created", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig({});

      // Capture what was written
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenPath = writeCall[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      expect(writtenPath).toBe(DEFAULT_CONFIG_PATH);
      expect(writtenContent).toEqual(getDefaultConfig());
    });

    it("should write properly formatted JSON (2-space indent)", async () => {
      const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);
      vi.mocked(fs.access).mockRejectedValue(enoentError);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await initializeConfig({});

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenRaw = writeCall[1] as string;

      // Should be formatted with 2-space indentation
      expect(writtenRaw).toMatch(/^\{\n  "/);
      expect(writtenRaw).toContain('"baseUrl"');

      // Should match expected format
      const expectedFormat = JSON.stringify(getDefaultConfig(), null, 2);
      expect(writtenRaw).toBe(expectedFormat);
    });
  });
});
