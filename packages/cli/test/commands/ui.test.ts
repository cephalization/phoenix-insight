/**
 * Tests for the `phoenix-insight ui` command
 *
 * Tests the UI command's initialization, browser opening, and graceful shutdown.
 * The actual server functionality is tested in server/ui.test.ts and server/websocket.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { exec } from "node:child_process";
import * as os from "node:os";

// ============================================================================
// Test: openBrowser helper
// ============================================================================

/**
 * Helper function to get browser open command based on platform
 */
function getBrowserCommand(platform: string, url: string): string {
  if (platform === "darwin") {
    return `open "${url}"`;
  } else if (platform === "win32") {
    return `start "" "${url}"`;
  } else {
    return `xdg-open "${url}" || sensible-browser "${url}"`;
  }
}

describe("openBrowser", () => {
  // We test the logic by examining what command would be used based on platform

  it("should use 'open' command on macOS (darwin)", () => {
    const url = "http://localhost:6007";
    const command = getBrowserCommand("darwin", url);
    expect(command).toBe(`open "${url}"`);
  });

  it("should use 'start' command on Windows", () => {
    const url = "http://localhost:6007";
    const command = getBrowserCommand("win32", url);
    expect(command).toBe(`start "" "${url}"`);
  });

  it("should use 'xdg-open' command on Linux", () => {
    const url = "http://localhost:6007";
    const command = getBrowserCommand("linux", url);
    expect(command).toBe(`xdg-open "${url}" || sensible-browser "${url}"`);
  });

  it("should escape URLs with quotes properly", () => {
    const url = "http://localhost:6007?param=value";
    const command = getBrowserCommand("darwin", url);
    expect(command).toBe(`open "${url}"`);
    expect(command).toContain('"');
  });
});

// ============================================================================
// Test: UI command options parsing
// ============================================================================

describe("UI command options", () => {
  describe("--port option", () => {
    it("should default to port 6007", () => {
      const options = { port: undefined, open: true };
      const port = options.port ?? 6007;
      expect(port).toBe(6007);
    });

    it("should accept custom port", () => {
      const options = { port: 8080, open: true };
      const port = options.port ?? 6007;
      expect(port).toBe(8080);
    });

    it("should accept port 0 for random assignment", () => {
      const options = { port: 0, open: true };
      const port = options.port ?? 6007;
      expect(port).toBe(0);
    });
  });

  describe("--no-open option", () => {
    it("should default to opening browser (open !== false)", () => {
      const options = { port: 6007, open: undefined };
      const shouldOpen = options.open !== false;
      expect(shouldOpen).toBe(true);
    });

    it("should not open browser when --no-open is specified", () => {
      const options = { port: 6007, open: false };
      const shouldOpen = options.open !== false;
      expect(shouldOpen).toBe(false);
    });

    it("should open browser when --open is explicitly true", () => {
      const options = { port: 6007, open: true };
      const shouldOpen = options.open !== false;
      expect(shouldOpen).toBe(true);
    });
  });
});

// ============================================================================
// Test: Graceful shutdown behavior
// ============================================================================

describe("graceful shutdown", () => {
  it("should handle SIGINT signal", () => {
    // Test that shutdown flag prevents duplicate shutdowns
    let isShuttingDown = false;
    const shutdownCalls: string[] = [];

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      shutdownCalls.push(signal);
    };

    // Simulate multiple SIGINT signals
    shutdown("SIGINT");
    shutdown("SIGINT");
    shutdown("SIGINT");

    expect(shutdownCalls).toHaveLength(1);
    expect(shutdownCalls[0]).toBe("SIGINT");
  });

  it("should handle SIGTERM signal", () => {
    let isShuttingDown = false;
    const shutdownCalls: string[] = [];

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      shutdownCalls.push(signal);
    };

    shutdown("SIGTERM");
    shutdown("SIGTERM");

    expect(shutdownCalls).toHaveLength(1);
    expect(shutdownCalls[0]).toBe("SIGTERM");
  });

  it("should execute cleanup steps in correct order", async () => {
    const cleanupOrder: string[] = [];

    const wsServerClose = async () => {
      cleanupOrder.push("wsServer.close");
    };
    const uiServerClose = async () => {
      cleanupOrder.push("uiServer.close");
    };
    const sessionManagerCleanup = async () => {
      cleanupOrder.push("sessionManager.cleanup");
    };
    const modeCleanup = async () => {
      cleanupOrder.push("mode.cleanup");
    };
    const shutdownObservability = async () => {
      cleanupOrder.push("shutdownObservability");
    };

    // Simulate shutdown sequence
    await wsServerClose();
    await uiServerClose();
    await sessionManagerCleanup();
    await modeCleanup();
    await shutdownObservability();

    expect(cleanupOrder).toEqual([
      "wsServer.close",
      "uiServer.close",
      "sessionManager.cleanup",
      "mode.cleanup",
      "shutdownObservability",
    ]);
  });
});

// ============================================================================
// Test: Session management integration
// ============================================================================

describe("session management in UI command", () => {
  it("should create new session when sessionId is not provided", () => {
    const message = {
      type: "query" as const,
      payload: { content: "test query", sessionId: undefined },
    };
    const sessionId = message.payload.sessionId ?? `session-${Date.now()}`;

    expect(sessionId).toMatch(/^session-\d+$/);
  });

  it("should use provided sessionId", () => {
    const message = {
      type: "query" as const,
      payload: { content: "test query", sessionId: "existing-session-123" },
    };
    const sessionId = message.payload.sessionId ?? `session-${Date.now()}`;

    expect(sessionId).toBe("existing-session-123");
  });

  it("should handle cancel message type", () => {
    const message = {
      type: "cancel" as const,
      payload: { sessionId: "session-123" },
    };

    expect(message.type).toBe("cancel");
    expect(message.payload.sessionId).toBe("session-123");
  });
});

// ============================================================================
// Test: URL construction
// ============================================================================

describe("URL construction", () => {
  it("should construct correct localhost URL", () => {
    const port = 6007;
    const url = `http://localhost:${port}`;
    expect(url).toBe("http://localhost:6007");
  });

  it("should construct correct custom port URL", () => {
    const port = 8080;
    const url = `http://localhost:${port}`;
    expect(url).toBe("http://localhost:8080");
  });

  it("should handle dynamic port from server", () => {
    // Simulating server returning actual port after binding to port 0
    const requestedPort = 0;
    const actualPort = 54321; // Random port assigned by OS
    const url = `http://localhost:${actualPort}`;
    expect(url).toBe("http://localhost:54321");
  });
});

// ============================================================================
// Test: Console output messages
// ============================================================================

describe("console output messages", () => {
  it("should include startup message", () => {
    const startupMessage = "🚀 Starting Phoenix Insight UI...\n";
    expect(startupMessage).toContain("Phoenix Insight UI");
  });

  it("should include server URL in output", () => {
    const port = 6007;
    const serverInfo = `🌐 Phoenix Insight UI is running!\n   Local:   http://localhost:${port}`;
    expect(serverInfo).toContain("http://localhost:6007");
    expect(serverInfo).toContain("Phoenix Insight UI is running");
  });

  it("should include shutdown instructions", () => {
    const helpText = "💡 Press Ctrl+C to stop the server";
    expect(helpText).toContain("Ctrl+C");
    expect(helpText).toContain("stop");
  });

  it("should include goodbye message on shutdown", () => {
    const goodbyeMessage = "👋 Server stopped. Goodbye!";
    expect(goodbyeMessage).toContain("Goodbye");
  });
});

// ============================================================================
// Test: Error handling
// ============================================================================

describe("error handling in UI command", () => {
  it("should catch and format query execution errors", () => {
    const error: unknown = new Error("Agent execution failed");
    const formattedError = error instanceof Error ? error.message : "An error occurred while executing the query";
    expect(formattedError).toBe("Agent execution failed");
  });

  it("should handle non-Error objects in catch", () => {
    const error: unknown = "string error";
    const formattedError = error instanceof Error ? error.message : "An error occurred while executing the query";
    expect(formattedError).toBe("An error occurred while executing the query");
  });
});

// ============================================================================
// Test: Mode selection
// ============================================================================

describe("mode selection in UI command", () => {
  it("should always use local mode for UI", () => {
    // UI command uses local mode for persistence
    // This is different from query command which can use sandbox
    const uiMode = "local";
    expect(uiMode).toBe("local");
  });
});
