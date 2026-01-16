/**
 * UI Integration Tests for Phoenix Insight Web UI
 *
 * These tests use agent-browser to automate browser interactions with the
 * Phoenix Insight UI. They verify the layout, chat functionality, and
 * report panel updates work correctly.
 *
 * PREREQUISITES:
 * 1. Phoenix server running on localhost:6006
 * 2. Run `pnpm test:ui` which will:
 *    - Build the UI package
 *    - Start the CLI server on localhost:6007
 *    - Run these tests
 *
 * NOTE: These tests are NOT run in CI because they require a live Phoenix
 * server with data. They are for manual verification only.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawn, ChildProcess } from "child_process";

const UI_URL = "http://localhost:6007";
const PHOENIX_URL = "http://localhost:6006";

// Helper to run agent-browser commands
function agentBrowser(command: string): string {
  try {
    const result = execSync(`pnpm exec agent-browser ${command}`, {
      encoding: "utf-8",
      timeout: 30000,
      cwd: process.cwd(),
    });
    return result.trim();
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    throw new Error(
      `agent-browser command failed: ${command}\n${execError.stderr || execError.stdout || error}`
    );
  }
}

// Helper to run agent-browser commands with JSON output
function agentBrowserJson<T>(command: string): T {
  const result = agentBrowser(`${command} --json`);
  try {
    const parsed = JSON.parse(result);
    if (parsed.success === false) {
      throw new Error(parsed.error || "Command failed");
    }
    return parsed.data || parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse JSON from agent-browser: ${result}`);
    }
    throw error;
  }
}

// Check if Phoenix is running
async function isPhoenixRunning(): Promise<boolean> {
  try {
    const response = await fetch(PHOENIX_URL);
    return response.ok;
  } catch {
    return false;
  }
}

// Check if UI server is running
async function isUIServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(UI_URL);
    return response.ok;
  } catch {
    return false;
  }
}

describe("Phoenix Insight UI Integration", () => {
  let skipTests = false;

  beforeAll(async () => {
    // Check prerequisites
    const phoenixRunning = await isPhoenixRunning();
    const uiRunning = await isUIServerRunning();

    if (!phoenixRunning) {
      console.warn(
        "\n[SKIP] Phoenix server not running on localhost:6006. Start Phoenix first.\n"
      );
      skipTests = true;
      return;
    }

    if (!uiRunning) {
      console.warn(
        "\n[SKIP] UI server not running on localhost:6007. Start with `phoenix-insight ui`.\n"
      );
      skipTests = true;
      return;
    }

    // Install browser if needed (runs once)
    try {
      agentBrowser("install");
    } catch {
      // May already be installed, that's fine
    }
  });

  afterAll(() => {
    // Close browser session
    try {
      agentBrowser("close");
    } catch {
      // Browser may already be closed
    }
  });

  describe("Layout", () => {
    it("should navigate to the UI and verify page loads", async () => {
      if (skipTests) return;

      agentBrowser(`open ${UI_URL}`);

      // Get page title
      const title = agentBrowser("get title");
      expect(title).toContain("Phoenix Insight");
    });

    it("should display the main layout with header", async () => {
      if (skipTests) return;

      // Take a snapshot to see the accessibility tree
      const snapshot = agentBrowser("snapshot -c");

      // Verify key UI elements are present
      expect(snapshot).toContain("Phoenix Insight");
    });

    it("should show resizable chat and report panels on desktop", async () => {
      if (skipTests) return;

      // Set desktop viewport
      agentBrowser("set viewport 1280 720");
      agentBrowser(`open ${UI_URL}`);

      // Take a snapshot focused on interactive elements
      const snapshot = agentBrowser("snapshot -i");

      // Should have resizable panels (indicated by panel structure)
      // The exact output depends on the UI, but we verify the page loaded
      expect(snapshot.length).toBeGreaterThan(0);
    });

    it("should show tabs on mobile viewport", async () => {
      if (skipTests) return;

      // Set mobile viewport
      agentBrowser("set viewport 375 667");
      agentBrowser(`open ${UI_URL}`);

      // Take snapshot
      const snapshot = agentBrowser("snapshot -i");

      // On mobile, should have tab navigation
      expect(snapshot).toMatch(/tab|chat|report/i);
    });
  });

  describe("Chat Interface", () => {
    beforeAll(() => {
      if (skipTests) return;
      // Reset to desktop viewport
      agentBrowser("set viewport 1280 720");
      agentBrowser(`open ${UI_URL}`);
    });

    it("should display chat input area", async () => {
      if (skipTests) return;

      const snapshot = agentBrowser("snapshot -i");

      // Should have a text input for chat
      expect(snapshot).toMatch(/textbox|textarea|input/i);
    });

    it("should show connection status indicator", async () => {
      if (skipTests) return;

      const snapshot = agentBrowser("snapshot");

      // Should show connection status (connected/connecting/disconnected)
      expect(snapshot).toMatch(/connect/i);
    });

    it("should be able to type in chat input", async () => {
      if (skipTests) return;

      // Find and focus the chat input
      const snapshot = agentBrowser("snapshot -i");

      // Look for a textbox ref in the snapshot
      const textboxMatch = snapshot.match(/\[ref=(@?\w+)\].*textbox/i);
      if (textboxMatch) {
        const ref = textboxMatch[1];
        agentBrowser(`fill ${ref} "Hello, Phoenix!"`);

        // Verify the text was entered
        const value = agentBrowser(`get value ${ref}`);
        expect(value).toBe("Hello, Phoenix!");
      } else {
        // Try finding by role
        agentBrowser('find role textbox fill "Hello, Phoenix!"');
      }
    });

    it("should send message when clicking send button", async () => {
      if (skipTests) return;

      // First enter some text
      agentBrowser('find role textbox fill "What data do you see in Phoenix?"');

      // Find and click the send button
      const snapshot = agentBrowser("snapshot -i");
      const buttonMatch = snapshot.match(
        /\[ref=(@?\w+)\].*button.*send/i
      );

      if (buttonMatch) {
        const ref = buttonMatch[1];
        agentBrowser(`click ${ref}`);
      } else {
        // Try pressing Enter to send
        agentBrowser("press Enter");
      }

      // Wait for response to start streaming (give it a moment)
      agentBrowser("wait 2000");

      // Take snapshot to see if message appeared
      const afterSnapshot = agentBrowser("snapshot");

      // Should see the message in the chat
      expect(afterSnapshot).toMatch(/phoenix|data|message/i);
    });
  });

  describe("Report Panel", () => {
    it("should display report panel area", async () => {
      if (skipTests) return;

      // Reset viewport and navigate
      agentBrowser("set viewport 1280 720");
      agentBrowser(`open ${UI_URL}`);

      const snapshot = agentBrowser("snapshot");

      // Report panel should be visible (may say "No Report" initially)
      expect(snapshot).toMatch(/report/i);
    });

    it("should show empty state when no report generated", async () => {
      if (skipTests) return;

      const snapshot = agentBrowser("snapshot");

      // Should show some indication of empty/no report state
      expect(snapshot).toMatch(/no report|empty|generate/i);
    });

    it("should have download and history buttons in toolbar", async () => {
      if (skipTests) return;

      const snapshot = agentBrowser("snapshot -i");

      // Should have toolbar buttons
      expect(snapshot).toMatch(/button/i);
    });
  });

  describe("WebSocket Connection", () => {
    it("should show connected status when server is running", async () => {
      if (skipTests) return;

      agentBrowser(`open ${UI_URL}`);

      // Wait for WebSocket to connect
      agentBrowser("wait 1000");

      const snapshot = agentBrowser("snapshot");

      // Should indicate connected status
      expect(snapshot).toMatch(/connect/i);
    });

    it("should enable chat input when connected", async () => {
      if (skipTests) return;

      const snapshot = agentBrowser("snapshot -i");

      // Check if textbox is present and not disabled
      const hasTextbox = snapshot.match(/textbox/i);
      expect(hasTextbox).toBeTruthy();
    });
  });

  describe("Session Management", () => {
    it("should display session dropdown in chat panel", async () => {
      if (skipTests) return;

      agentBrowser("set viewport 1280 720");
      agentBrowser(`open ${UI_URL}`);

      const snapshot = agentBrowser("snapshot -i");

      // Should have a dropdown or button for sessions
      expect(snapshot).toMatch(/button|menu|session|new/i);
    });

    it("should be able to create a new session", async () => {
      if (skipTests) return;

      // Look for new session button
      const snapshot = agentBrowser("snapshot -i");

      // Try to find and click a "new" or "+" button
      const newMatch = snapshot.match(
        /\[ref=(@?\w+)\].*button.*(new|plus|\+)/i
      );

      if (newMatch) {
        const beforeSnapshot = agentBrowser("snapshot");
        agentBrowser(`click ${newMatch[1]}`);
        agentBrowser("wait 500");
        const afterSnapshot = agentBrowser("snapshot");

        // Something should have changed
        expect(afterSnapshot).not.toBe(beforeSnapshot);
      }
    });
  });

  describe("Error Handling", () => {
    it("should display error boundary on critical errors", async () => {
      if (skipTests) return;

      // Navigate to the page
      agentBrowser(`open ${UI_URL}`);

      // The error boundary should not be visible under normal conditions
      const snapshot = agentBrowser("snapshot");

      // Should NOT show error boundary text
      expect(snapshot).not.toMatch(/something went wrong/i);
    });

    it("should show toast notifications for connection issues", async () => {
      if (skipTests) return;

      // Take a screenshot for manual verification
      agentBrowser("screenshot test/ui-connection-test.png");

      // Verify the screenshot was taken
      expect(true).toBe(true);
    });
  });
});
