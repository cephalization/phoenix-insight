/**
 * Tests for MSW Server Setup
 *
 * Verifies that the MSW server correctly intercepts HTTP requests
 * and can switch between success and error responses.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  server,
  useErrorHandler,
  useErrorHandlers,
  resetToSuccessHandlers,
  fixtures,
} from "./index";

// Use a consistent base URL for testing
const BASE_URL = "http://localhost:6006";

describe("MSW Server Setup", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe("default success handlers", () => {
    it("returns projects from GET /v1/projects", async () => {
      const response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual(fixtures.projects);
      expect(data.next_cursor).toBeNull();
    });

    it("returns spans from GET /v1/projects/:id/spans", async () => {
      const projectId = fixtures.projects[0].id;
      const response = await fetch(`${BASE_URL}/v1/projects/${projectId}/spans`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual(fixtures.spans[projectId]);
      expect(data.next_cursor).toBeNull();
    });

    it("returns spans when looking up by project name", async () => {
      const projectName = fixtures.projects[0].name;
      const projectId = fixtures.projects[0].id;
      const response = await fetch(`${BASE_URL}/v1/projects/${projectName}/spans`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual(fixtures.spans[projectId]);
    });

    it("returns 404 for unknown project spans", async () => {
      const response = await fetch(`${BASE_URL}/v1/projects/unknown-project/spans`);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Project not found");
    });

    it("returns datasets from GET /v1/datasets", async () => {
      const response = await fetch(`${BASE_URL}/v1/datasets`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual(fixtures.datasets);
      expect(data.next_cursor).toBeNull();
    });

    it("returns experiments from GET /v1/datasets/:id/experiments", async () => {
      const datasetId = fixtures.datasets[0].id;
      const response = await fetch(`${BASE_URL}/v1/datasets/${datasetId}/experiments`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual(fixtures.experiments[datasetId]);
      expect(data.next_cursor).toBeNull();
    });

    it("returns empty array for dataset with no experiments", async () => {
      const response = await fetch(`${BASE_URL}/v1/datasets/unknown-dataset/experiments`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data).toEqual([]);
    });
  });

  describe("useErrorHandler", () => {
    it("switches projects endpoint to return 500 error", async () => {
      useErrorHandler("projects");

      const response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });

    it("switches projects endpoint to return 403 forbidden", async () => {
      useErrorHandler("projectsForbidden");

      const response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("switches spans endpoint to return error", async () => {
      useErrorHandler("spans");

      const response = await fetch(`${BASE_URL}/v1/projects/proj-001/spans`);
      expect(response.status).toBe(500);
    });

    it("switches datasets endpoint to return error", async () => {
      useErrorHandler("datasets");

      const response = await fetch(`${BASE_URL}/v1/datasets`);
      expect(response.status).toBe(500);
    });

    it("switches experiments endpoint to return error", async () => {
      useErrorHandler("experiments");

      const response = await fetch(`${BASE_URL}/v1/datasets/ds-001/experiments`);
      expect(response.status).toBe(500);
    });

    it("throws for unknown handler name", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => useErrorHandler("invalid")).toThrow("Unknown error handler");
    });
  });

  describe("useErrorHandlers", () => {
    it("switches multiple endpoints to return errors", async () => {
      useErrorHandlers(["projects", "datasets"]);

      const projectsResponse = await fetch(`${BASE_URL}/v1/projects`);
      expect(projectsResponse.status).toBe(500);

      const datasetsResponse = await fetch(`${BASE_URL}/v1/datasets`);
      expect(datasetsResponse.status).toBe(500);

      // Experiments should still work (not in the error list)
      const experimentsResponse = await fetch(`${BASE_URL}/v1/datasets/ds-001/experiments`);
      expect(experimentsResponse.ok).toBe(true);
    });
  });

  describe("resetToSuccessHandlers", () => {
    it("resets error handlers back to success responses", async () => {
      // First set up error state
      useErrorHandler("projects");
      let response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.status).toBe(500);

      // Reset to success
      resetToSuccessHandlers();

      // Should now return success
      response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.ok).toBe(true);
    });
  });

  describe("handler isolation", () => {
    it("error handlers do not affect subsequent tests", async () => {
      // This test runs after other tests that set error handlers
      // Due to afterEach resetHandlers, this should succeed
      const response = await fetch(`${BASE_URL}/v1/projects`);
      expect(response.ok).toBe(true);
    });
  });
});
