/**
 * Integration Tests for Phoenix Snapshot Functions
 *
 * These tests verify the full snapshot workflow with MSW-mocked Phoenix API responses.
 * Unlike unit tests that mock the Phoenix client directly, these tests make real HTTP
 * requests that are intercepted by MSW, testing the actual integration between
 * snapshot functions and the Phoenix API.
 *
 * MSW server lifecycle is managed globally by test/setup.ts.
 *
 * IMPORTANT: These tests use vi.importActual to bypass the global @arizeai/phoenix-client
 * mock, allowing real HTTP requests that MSW intercepts.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { server, fixtures, useErrorHandler, createProject, createSpan, createDataset, createExperiment } from "../mocks";
import type { ExecutionMode } from "../../src/modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";

// Import the real @arizeai/phoenix-client to bypass the global mock
// This allows MSW to intercept the actual fetch calls
const { createClient: realCreateClient } = await vi.importActual<typeof import("@arizeai/phoenix-client")>("@arizeai/phoenix-client");

// Import snapshot functions - these will use whichever client we pass them
const { fetchProjects } = await import("../../src/snapshot/projects.js");
const { snapshotSpans } = await import("../../src/snapshot/spans.js");
const { fetchDatasets } = await import("../../src/snapshot/datasets.js");
const { fetchExperiments } = await import("../../src/snapshot/experiments.js");

/**
 * Creates a real Phoenix client that makes actual HTTP requests.
 * MSW intercepts these requests and returns mock responses.
 */
function createTestClient(baseURL: string): PhoenixClient {
  return realCreateClient({
    options: {
      baseUrl: baseURL,
    },
  });
}

// Test base URL - MSW intercepts requests to any URL matching the patterns
const BASE_URL = "http://localhost:6006";

/**
 * Creates a mock ExecutionMode for testing that captures all file writes
 * and simulates file reads via exec.
 */
function createMockMode() {
  const writtenFiles = new Map<string, string>();

  const mockMode: ExecutionMode = {
    writeFile: vi.fn(async (path: string, content: string) => {
      writtenFiles.set(path, content);
    }),
    exec: vi.fn(async (command: string) => {
      // Simulate reading files that were previously written
      // The spans function does: cat projects/index.jsonl
      if (command.includes("cat") && command.includes("projects/index.jsonl")) {
        const content = writtenFiles.get("/phoenix/projects/index.jsonl");
        return {
          stdout: content || "",
          stderr: "",
          exitCode: content ? 0 : 1,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    }),
    getBashTool: vi.fn(),
    getSnapshotRoot: vi.fn().mockReturnValue("/phoenix/"),
    cleanup: vi.fn(),
  };

  return { mockMode, writtenFiles };
}

describe("Snapshot Integration Tests", () => {
  beforeEach(() => {
    // Reset MSW handlers to default success responses
    server.resetHandlers();
  });

  describe("fetchProjects", () => {
    it("fetches projects from the mocked Phoenix API and writes to filesystem", async () => {
      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchProjects(client, mockMode);

      // Verify index.jsonl was written with fixture data
      const indexContent = writtenFiles.get("/phoenix/projects/index.jsonl");
      expect(indexContent).toBeDefined();

      const projects = indexContent!.split("\n").filter(line => line).map(line => JSON.parse(line));
      expect(projects).toHaveLength(fixtures.projects.length);
      expect(projects[0].id).toBe(fixtures.projects[0].id);
      expect(projects[0].name).toBe(fixtures.projects[0].name);

      // Verify metadata files were written for each project
      for (const project of fixtures.projects) {
        const metadataPath = `/phoenix/projects/${project.name}/metadata.json`;
        expect(writtenFiles.has(metadataPath)).toBe(true);

        const metadata = JSON.parse(writtenFiles.get(metadataPath)!);
        expect(metadata.id).toBe(project.id);
        expect(metadata.name).toBe(project.name);
      }
    });

    it("handles API errors gracefully", async () => {
      useErrorHandler("projects");

      const client = createTestClient(BASE_URL);
      const { mockMode } = createMockMode();

      await expect(fetchProjects(client, mockMode)).rejects.toThrow();
    });
  });

  describe("snapshotSpans", () => {
    it("fetches spans for all projects from the mocked API", async () => {
      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      // First fetch projects (snapshotSpans reads from the projects index)
      await fetchProjects(client, mockMode);

      // Now fetch spans
      await snapshotSpans(client, mockMode, { spansPerProject: 100 });

      // Verify spans were written for each project
      for (const project of fixtures.projects) {
        const spansPath = `/phoenix/projects/${project.name}/spans/index.jsonl`;
        expect(writtenFiles.has(spansPath)).toBe(true);

        const spansContent = writtenFiles.get(spansPath)!;
        const expectedSpans = fixtures.spans[project.id] || [];

        if (expectedSpans.length > 0) {
          const spans = spansContent.split("\n").filter(line => line).map(line => JSON.parse(line));
          expect(spans.length).toBe(expectedSpans.length);
        }

        // Verify metadata was written
        const metadataPath = `/phoenix/projects/${project.name}/spans/metadata.json`;
        expect(writtenFiles.has(metadataPath)).toBe(true);

        const metadata = JSON.parse(writtenFiles.get(metadataPath)!);
        expect(metadata.project).toBe(project.name);
        expect(typeof metadata.spanCount).toBe("number");
      }
    });

    it("handles empty projects list gracefully", async () => {
      // Override projects endpoint to return empty list
      server.use(
        http.get("*/v1/projects", () => {
          return HttpResponse.json({ data: [], next_cursor: null });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchProjects(client, mockMode);
      await snapshotSpans(client, mockMode);

      // Index should exist but be empty
      expect(writtenFiles.get("/phoenix/projects/index.jsonl")).toBe("");
    });

    it("handles spans API errors gracefully", async () => {
      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      // First fetch projects successfully
      await fetchProjects(client, mockMode);

      // Then make spans endpoint fail
      useErrorHandler("spans");

      // snapshotSpans wraps errors with withErrorHandling
      await expect(snapshotSpans(client, mockMode)).rejects.toThrow();
    });
  });

  describe("fetchDatasets", () => {
    it("fetches datasets from the mocked API and writes to filesystem", async () => {
      // Add handlers for dataset examples endpoint
      server.use(
        http.get("*/v1/datasets/:id/examples", ({ params }) => {
          return HttpResponse.json({
            data: {
              version_id: "v1",
              examples: [
                { id: "ex-1", input: { query: "test" }, output: { answer: "result" }, metadata: {}, updated_at: new Date().toISOString() },
              ],
              filtered_splits: [],
            },
          });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchDatasets(client, mockMode);

      // Verify index.jsonl was written
      const indexContent = writtenFiles.get("/phoenix/datasets/index.jsonl");
      expect(indexContent).toBeDefined();

      const datasets = indexContent!.split("\n").filter(line => line).map(line => JSON.parse(line));
      expect(datasets).toHaveLength(fixtures.datasets.length);

      // Verify metadata and examples were written for each dataset
      for (const dataset of fixtures.datasets) {
        const metadataPath = `/phoenix/datasets/${dataset.name}/metadata.json`;
        expect(writtenFiles.has(metadataPath)).toBe(true);

        const examplesPath = `/phoenix/datasets/${dataset.name}/examples.jsonl`;
        expect(writtenFiles.has(examplesPath)).toBe(true);

        const infoPath = `/phoenix/datasets/${dataset.name}/info.json`;
        expect(writtenFiles.has(infoPath)).toBe(true);
      }
    });

    it("handles API errors gracefully", async () => {
      useErrorHandler("datasets");

      const client = createTestClient(BASE_URL);
      const { mockMode } = createMockMode();

      await expect(fetchDatasets(client, mockMode)).rejects.toThrow();
    });
  });

  describe("fetchExperiments", () => {
    it("fetches experiments from the mocked API and writes to filesystem", async () => {
      // Add handler for experiment runs endpoint
      server.use(
        http.get("*/v1/experiments/:experiment_id/runs", ({ params }) => {
          return HttpResponse.json({
            data: [
              {
                id: "run-1",
                experiment_id: params.experiment_id,
                dataset_example_id: "ex-1",
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                output: { result: "success" },
                error: null,
                trace_id: null,
                repetition_number: 1,
              },
            ],
            next_cursor: null,
          });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchExperiments(client, mockMode, { includeRuns: true });

      // Verify index.jsonl was written
      const indexContent = writtenFiles.get("/phoenix/experiments/index.jsonl");
      expect(indexContent).toBeDefined();

      // Parse experiments and verify they match fixtures
      const experiments = indexContent!.split("\n").filter(line => line).map(line => JSON.parse(line));

      // Total experiments across all datasets
      const totalExpected = Object.values(fixtures.experiments).flat().length;
      expect(experiments).toHaveLength(totalExpected);

      // Verify experiment metadata and runs were written
      for (const experiment of experiments) {
        const metadataPath = `/phoenix/experiments/${experiment.id}/metadata.json`;
        expect(writtenFiles.has(metadataPath)).toBe(true);

        const runsPath = `/phoenix/experiments/${experiment.id}/runs.jsonl`;
        expect(writtenFiles.has(runsPath)).toBe(true);

        const summaryPath = `/phoenix/experiments/${experiment.id}/summary.json`;
        expect(writtenFiles.has(summaryPath)).toBe(true);
      }
    });

    it("fetches experiments without runs when includeRuns is false", async () => {
      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchExperiments(client, mockMode, { includeRuns: false });

      // Verify index.jsonl was written
      const indexContent = writtenFiles.get("/phoenix/experiments/index.jsonl");
      expect(indexContent).toBeDefined();

      // Experiments should be listed but no runs or metadata files
      const experiments = indexContent!.split("\n").filter(line => line).map(line => JSON.parse(line));
      expect(experiments.length).toBeGreaterThan(0);

      // No experiment subdirectories should be created
      for (const experiment of experiments) {
        const runsPath = `/phoenix/experiments/${experiment.id}/runs.jsonl`;
        expect(writtenFiles.has(runsPath)).toBe(false);
      }
    });

    it("handles datasets API errors gracefully", async () => {
      // Experiments endpoint needs datasets first
      useErrorHandler("datasets");

      const client = createTestClient(BASE_URL);
      const { mockMode } = createMockMode();

      await expect(fetchExperiments(client, mockMode)).rejects.toThrow();
    });
  });

  describe("Full Snapshot Workflow", () => {
    it("executes complete snapshot workflow with all data types", async () => {
      // Set up all required handlers for a complete workflow
      server.use(
        http.get("*/v1/datasets/:id/examples", () => {
          return HttpResponse.json({
            data: {
              version_id: "v1",
              examples: [
                { id: "ex-1", input: {}, output: {}, metadata: {}, updated_at: new Date().toISOString() },
              ],
              filtered_splits: [],
            },
          });
        }),
        http.get("*/v1/experiments/:experiment_id/runs", () => {
          return HttpResponse.json({ data: [], next_cursor: null });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      // Execute full workflow
      await fetchProjects(client, mockMode);
      await snapshotSpans(client, mockMode);
      await fetchDatasets(client, mockMode);
      await fetchExperiments(client, mockMode);

      // Verify all expected files were created

      // Projects
      expect(writtenFiles.has("/phoenix/projects/index.jsonl")).toBe(true);
      for (const project of fixtures.projects) {
        expect(writtenFiles.has(`/phoenix/projects/${project.name}/metadata.json`)).toBe(true);
        expect(writtenFiles.has(`/phoenix/projects/${project.name}/spans/index.jsonl`)).toBe(true);
        expect(writtenFiles.has(`/phoenix/projects/${project.name}/spans/metadata.json`)).toBe(true);
      }

      // Datasets
      expect(writtenFiles.has("/phoenix/datasets/index.jsonl")).toBe(true);
      for (const dataset of fixtures.datasets) {
        expect(writtenFiles.has(`/phoenix/datasets/${dataset.name}/metadata.json`)).toBe(true);
        expect(writtenFiles.has(`/phoenix/datasets/${dataset.name}/examples.jsonl`)).toBe(true);
      }

      // Experiments
      expect(writtenFiles.has("/phoenix/experiments/index.jsonl")).toBe(true);
    });

    it("handles partial failures gracefully", async () => {
      // Set up datasets endpoint to fail but others to succeed
      server.use(
        http.get("*/v1/datasets", () => {
          return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      // Projects should succeed
      await fetchProjects(client, mockMode);
      expect(writtenFiles.has("/phoenix/projects/index.jsonl")).toBe(true);

      // Spans should succeed
      await snapshotSpans(client, mockMode);
      for (const project of fixtures.projects) {
        expect(writtenFiles.has(`/phoenix/projects/${project.name}/spans/index.jsonl`)).toBe(true);
      }

      // Datasets should fail
      await expect(fetchDatasets(client, mockMode)).rejects.toThrow();

      // Experiments should also fail (depends on datasets)
      await expect(fetchExperiments(client, mockMode)).rejects.toThrow();
    });
  });

  describe("Custom Fixtures", () => {
    it("works with custom project and span fixtures", async () => {
      const customProjects = [
        createProject({ id: "custom-1", name: "custom-project" }),
      ];
      const customSpans = {
        "custom-1": [
          createSpan({ name: "custom-span-1" }),
          createSpan({ name: "custom-span-2" }),
        ],
      };

      server.use(
        http.get("*/v1/projects", () => {
          return HttpResponse.json({ data: customProjects, next_cursor: null });
        }),
        http.get("*/v1/projects/:project_identifier/spans", ({ params }) => {
          const projectId = params.project_identifier as string;
          const project = customProjects.find(p => p.id === projectId || p.name === projectId);
          if (!project) {
            return HttpResponse.json({ error: "Project not found" }, { status: 404 });
          }
          const spans = customSpans[project.id] || [];
          return HttpResponse.json({ data: spans, next_cursor: null });
        })
      );

      const client = createTestClient(BASE_URL);
      const { mockMode, writtenFiles } = createMockMode();

      await fetchProjects(client, mockMode);
      await snapshotSpans(client, mockMode);

      // Verify custom project was written
      expect(writtenFiles.has("/phoenix/projects/custom-project/metadata.json")).toBe(true);

      // Verify custom spans were written
      const spansContent = writtenFiles.get("/phoenix/projects/custom-project/spans/index.jsonl");
      expect(spansContent).toBeDefined();

      const spans = spansContent!.split("\n").filter(line => line).map(line => JSON.parse(line));
      expect(spans).toHaveLength(2);
      expect(spans.map(s => s.name)).toContain("custom-span-1");
      expect(spans.map(s => s.name)).toContain("custom-span-2");
    });
  });
});
