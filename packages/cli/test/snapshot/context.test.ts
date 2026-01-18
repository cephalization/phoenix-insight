import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateContext } from "../../src/snapshot/context.js";
import type { ExecutionMode } from "../../src/modes/types.js";

describe("generateContext", () => {
  let mockMode: ExecutionMode;
  let writtenFiles: Record<string, string>;

  beforeEach(() => {
    writtenFiles = {};

    mockMode = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles[path] = content;
      }),
      exec: vi.fn(async (command: string) => {
        // Mock responses for different commands
        // Use relative paths since cwd is the phoenix directory
        if (command.includes("cat projects/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "chatbot-prod",
                updated_at: "2025-01-10T10:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "rag-experiment",
                updated_at: "2025-01-09T15:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes("cat projects/chatbot-prod/spans/metadata.json")
        ) {
          return {
            stdout: JSON.stringify({ spanCount: 2341 }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes("cat projects/rag-experiment/spans/metadata.json")
        ) {
          return {
            stdout: JSON.stringify({ spanCount: 892 }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (command.includes("cat datasets/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "customer-queries",
                updated_at: "2025-01-10T08:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "test-cases",
                updated_at: "2025-01-08T10:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "wc -l < datasets/customer-queries/examples.jsonl"
          )
        ) {
          return { stdout: "150", stderr: "", exitCode: 0 };
        }

        if (
          command.includes("wc -l < datasets/test-cases/examples.jsonl")
        ) {
          return { stdout: "75", stderr: "", exitCode: 0 };
        }

        if (command.includes("cat experiments/index.jsonl")) {
          return {
            stdout: JSON.stringify({
              id: "exp-123",
              datasetName: "customer-queries",
              project_name: "chatbot-prod",
              example_count: 50,
              repetitions: 3,
              successful_run_count: 150,
              failed_run_count: 0,
              missing_run_count: 0,
              updated_at: "2025-01-10T09:00:00Z",
            }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (command.includes("cat prompts/index.jsonl")) {
          return {
            stdout:
              JSON.stringify({
                name: "main-assistant",
                updated_at: "2025-01-09T14:00:00Z",
              }) +
              "\n" +
              JSON.stringify({
                name: "summarizer",
                updated_at: "2025-01-08T16:00:00Z",
              }),
            stderr: "",
            exitCode: 0,
          };
        }

        if (
          command.includes(
            "wc -l < prompts/main-assistant/versions/index.jsonl"
          )
        ) {
          return { stdout: "5", stderr: "", exitCode: 0 };
        }

        if (
          command.includes("wc -l < prompts/summarizer/versions/index.jsonl")
        ) {
          return { stdout: "3", stderr: "", exitCode: 0 };
        }

        // Default: empty response for missing files
        return { stdout: "", stderr: "", exitCode: 0 };
      }),
      getBashTool: vi.fn(),
      getSnapshotRoot: vi.fn().mockReturnValue("/phoenix/"),
      cleanup: vi.fn(),
    };
  });

  describe("section structure", () => {
    it("should include all major section headings", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
        spansPerProject: 1000,
      };

      await generateContext(mockMode, metadata);

      expect(mockMode.writeFile).toHaveBeenCalledWith(
        "/phoenix/_context.md",
        expect.any(String)
      );

      const content = writtenFiles["/phoenix/_context.md"];

      // Verify all major sections exist via headings
      expect(content).toContain("# Phoenix Snapshot Context");
      expect(content).toContain("## Quick Start for External Agents");
      expect(content).toContain("## What's Here");
      expect(content).toContain("## Directory Structure");
      expect(content).toContain("## What You Can Do");
      expect(content).toContain("## Data Freshness");
    });

    it("should include Quick Start subsections", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify Quick Start subsections exist (structure, not exact wording)
      expect(content).toContain("### Key Files to Start With");
      expect(content).toContain("### How to Parse Each File Format");
      expect(content).toContain("### Common Operations");
    });
  });

  describe("dynamic content interpolation", () => {
    it("should interpolate project names and span counts", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
        spansPerProject: 1000,
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify project count and names are interpolated
      expect(content).toMatch(/\*\*2 projects\*\*/);
      expect(content).toContain("chatbot-prod");
      expect(content).toContain("2341 spans");
      expect(content).toContain("rag-experiment");
      expect(content).toContain("892 spans");
    });

    it("should interpolate dataset names", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify dataset count and names are interpolated
      expect(content).toMatch(/\*\*2 datasets\*\*/);
      expect(content).toContain("customer-queries");
      expect(content).toContain("test-cases");
    });

    it("should interpolate prompt names", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify prompt count and names are interpolated
      expect(content).toMatch(/\*\*2 prompts\*\*/);
      expect(content).toContain("main-assistant");
      expect(content).toContain("summarizer");
    });

    it("should interpolate experiment counts by status", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify experiment count is interpolated (1 experiment from mock)
      expect(content).toMatch(/\*\*1 experiments?\*\*/);
      expect(content).toContain("1 completed");
    });

    it("should interpolate Phoenix URL", async () => {
      const metadata = {
        phoenixUrl: "https://my-phoenix.example.com",
        snapshotTime: new Date("2025-01-10T10:30:00Z"),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Verify the source URL is included
      expect(content).toContain("https://my-phoenix.example.com");
    });
  });

  describe("conditional content", () => {
    it("should show 'No projects found' when empty", async () => {
      mockMode.exec = vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }));

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      expect(content).toContain("**No projects found**");
    });

    it("should show 'No datasets found' when empty", async () => {
      mockMode.exec = vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }));

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      expect(content).toContain("**No datasets found**");
    });

    it("should show 'No experiments found' when empty", async () => {
      mockMode.exec = vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }));

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      expect(content).toContain("**No experiments found**");
    });

    it("should show 'No prompts found' when empty", async () => {
      mockMode.exec = vi.fn(async () => ({
        stdout: "",
        stderr: "",
        exitCode: 0,
      }));

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      expect(content).toContain("**No prompts found**");
    });

    it("should include Recent Activity section when there is recent activity", async () => {
      // Create a recent timestamp (1 hour ago)
      const recentTime = new Date();
      recentTime.setHours(recentTime.getHours() - 1);

      mockMode.exec = vi.fn(async (command: string) => {
        if (command.includes("cat experiments/index.jsonl")) {
          return {
            stdout: JSON.stringify({
              id: "exp-recent",
              datasetName: "test-data",
              project_name: "test-project",
              example_count: 10,
              repetitions: 1,
              successful_run_count: 10,
              failed_run_count: 0,
              missing_run_count: 0,
              updated_at: recentTime.toISOString(),
            }),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Should include Recent Activity section with project name
      expect(content).toContain("## Recent Activity");
      expect(content).toContain("test-project");
    });

    it("should not include Recent Activity section when no recent activity", async () => {
      // Create an old timestamp (2 days ago)
      const oldTime = new Date();
      oldTime.setDate(oldTime.getDate() - 2);

      mockMode.exec = vi.fn(async (command: string) => {
        if (command.includes("cat experiments/index.jsonl")) {
          return {
            stdout: JSON.stringify({
              id: "exp-old",
              datasetName: "test-data",
              project_name: "test-project",
              example_count: 10,
              repetitions: 1,
              successful_run_count: 10,
              failed_run_count: 0,
              missing_run_count: 0,
              updated_at: oldTime.toISOString(),
            }),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Should NOT include Recent Activity section
      expect(content).not.toContain("## Recent Activity");
    });
  });

  describe("experiment status determination", () => {
    it("should correctly count experiments by status", async () => {
      mockMode.exec = vi.fn(async (command: string) => {
        if (command.includes("cat experiments/index.jsonl")) {
          return {
            stdout:
              // Completed experiment
              JSON.stringify({
                id: "exp-complete",
                datasetName: "data1",
                example_count: 10,
                repetitions: 2,
                successful_run_count: 20,
                failed_run_count: 0,
                missing_run_count: 0,
              }) +
              "\n" +
              // In progress experiment
              JSON.stringify({
                id: "exp-progress",
                datasetName: "data2",
                example_count: 10,
                repetitions: 2,
                successful_run_count: 5,
                failed_run_count: 0,
                missing_run_count: 15,
              }) +
              "\n" +
              // Failed experiment
              JSON.stringify({
                id: "exp-failed",
                datasetName: "data3",
                example_count: 10,
                repetitions: 1,
                successful_run_count: 2,
                failed_run_count: 8,
                missing_run_count: 0,
              }),
            stderr: "",
            exitCode: 0,
          };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Should show correct counts: 1 completed, 1 failed, 1 in_progress
      expect(content).toMatch(/\*\*3 experiments\*\*/);
      expect(content).toContain("1 completed");
      expect(content).toContain("1 in progress");
      expect(content).toContain("1 failed");
    });
  });

  describe("timestamp formatting", () => {
    it("should format recent snapshot time as 'just now'", async () => {
      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(), // Just now
      };

      await generateContext(mockMode, metadata);
      const content = writtenFiles["/phoenix/_context.md"];

      // Should say "just now" for a very recent snapshot
      expect(content).toContain("just now");
    });
  });

  describe("error handling", () => {
    it("should handle exec errors gracefully and continue", async () => {
      let callCount = 0;
      mockMode.exec = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          throw new Error("Command failed");
        }
        // Other calls succeed with empty data
        return { stdout: "", stderr: "", exitCode: 0 };
      });

      const metadata = {
        phoenixUrl: "http://localhost:6006",
        snapshotTime: new Date(),
      };

      // Should not throw, but continue with empty data
      await expect(generateContext(mockMode, metadata)).resolves.not.toThrow();

      expect(mockMode.writeFile).toHaveBeenCalled();
      const content = writtenFiles["/phoenix/_context.md"];
      
      // Should still produce valid output with "no X found" messages
      expect(content).toContain("# Phoenix Snapshot Context");
      expect(content).toContain("**No projects found**");
    });
  });
});
