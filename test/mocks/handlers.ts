/**
 * MSW Handlers for Phoenix API
 *
 * This file provides Mock Service Worker (MSW) handlers for testing phoenix-insight
 * without requiring a running Phoenix server. Edit this file directly to add new
 * handlers or modify existing ones.
 *
 * Mocked endpoints:
 * - GET /v1/projects - List all projects
 * - GET /v1/projects/:project_identifier/spans - Get spans for a project
 * - GET /v1/datasets - List all datasets
 * - GET /v1/datasets/:dataset_id/experiments - List experiments for a dataset
 *
 * To add a new handler:
 * 1. Add the response type interface in the "Types" section
 * 2. Add a fixture generator function in the "Fixture Generators" section
 * 3. Add pre-generated fixtures to the `fixtures` object if needed
 * 4. Add the handler to the `handlers` array
 * 5. Optionally add error handlers to the `errorHandlers` object
 *
 * @see https://raw.githubusercontent.com/Arize-ai/phoenix/refs/heads/main/schemas/openapi.json
 */

import { http, HttpResponse } from "msw";
import { faker } from "@faker-js/faker";

// Seed faker for reproducible tests
faker.seed(12345);

// ============================================================================
// Types (based on Phoenix OpenAPI schema)
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

export interface ProjectsResponse {
  data: Project[];
  next_cursor: string | null;
}

export interface Span {
  name: string;
  context: {
    trace_id: string;
    span_id: string;
  };
  parent_id: string | null;
  span_kind: "CHAIN" | "LLM" | "RETRIEVER" | "TOOL" | "AGENT" | "EMBEDDING";
  start_time: string;
  end_time: string;
  status_code: "OK" | "ERROR" | "UNSET";
  status_message: string;
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, unknown>;
  }>;
}

export interface SpansResponse {
  data: Span[];
  next_cursor: string | null;
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  example_count: number;
}

export interface DatasetsResponse {
  data: Dataset[];
  next_cursor: string | null;
}

export interface Experiment {
  id: string;
  dataset_id: string;
  dataset_version_id: string;
  name: string;
  description: string | null;
  repetitions: number;
  metadata: Record<string, unknown>;
  project_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentsResponse {
  data: Experiment[];
  next_cursor: string | null;
}

// ============================================================================
// Fixture Generators
// ============================================================================

/**
 * Generate a random project fixture
 */
export function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      "default",
      "production",
      "staging",
      "development",
      "testing",
      faker.company.buzzNoun() + "-" + faker.company.buzzAdjective(),
    ]),
    description: faker.helpers.arrayElement([
      faker.company.catchPhrase(),
      null,
    ]),
    ...overrides,
  };
}

/**
 * Generate a random span fixture
 */
export function createSpan(overrides: Partial<Span> = {}): Span {
  const traceId = faker.string.hexadecimal({ length: 32, casing: "lower", prefix: "" });
  const spanId = faker.string.hexadecimal({ length: 16, casing: "lower", prefix: "" });
  const startTime = faker.date.recent();
  const endTime = new Date(startTime.getTime() + faker.number.int({ min: 10, max: 5000 }));

  return {
    name: faker.helpers.arrayElement([
      "OpenAI.chat",
      "Anthropic.messages",
      "LangChain.chain",
      "retriever.search",
      "tool.execute",
      "embedding.generate",
    ]),
    context: {
      trace_id: traceId,
      span_id: spanId,
    },
    parent_id: faker.helpers.arrayElement([
      null,
      faker.string.hexadecimal({ length: 16, casing: "lower", prefix: "" }),
    ]),
    span_kind: faker.helpers.arrayElement(["CHAIN", "LLM", "RETRIEVER", "TOOL", "AGENT", "EMBEDDING"]),
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status_code: faker.helpers.arrayElement(["OK", "OK", "OK", "ERROR", "UNSET"]),
    status_message: "",
    attributes: {
      "llm.model_name": faker.helpers.arrayElement(["gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"]),
      "llm.token_count.prompt": faker.number.int({ min: 10, max: 1000 }),
      "llm.token_count.completion": faker.number.int({ min: 10, max: 500 }),
    },
    events: [],
    ...overrides,
  };
}

/**
 * Generate a random dataset fixture
 */
export function createDataset(overrides: Partial<Dataset> = {}): Dataset {
  const createdAt = faker.date.recent();
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      "eval-dataset",
      "training-data",
      "golden-set",
      faker.company.buzzNoun() + "-dataset",
    ]),
    description: faker.helpers.arrayElement([
      faker.lorem.sentence(),
      null,
    ]),
    metadata: {},
    created_at: createdAt.toISOString(),
    updated_at: new Date(createdAt.getTime() + faker.number.int({ min: 0, max: 86400000 })).toISOString(),
    example_count: faker.number.int({ min: 10, max: 1000 }),
    ...overrides,
  };
}

/**
 * Generate a random experiment fixture
 */
export function createExperiment(datasetId: string, overrides: Partial<Experiment> = {}): Experiment {
  const createdAt = faker.date.recent();
  return {
    id: faker.string.uuid(),
    dataset_id: datasetId,
    dataset_version_id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      "baseline-eval",
      "v2-comparison",
      "prompt-tuning",
      faker.company.buzzVerb() + "-experiment",
    ]),
    description: faker.helpers.arrayElement([
      faker.lorem.sentence(),
      null,
    ]),
    repetitions: faker.number.int({ min: 1, max: 5 }),
    metadata: {},
    project_name: faker.helpers.arrayElement(["default", "production", null]),
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Pre-generated Fixtures (for consistent test data)
// ============================================================================

export const fixtures = {
  projects: [
    createProject({ id: "proj-001", name: "default" }),
    createProject({ id: "proj-002", name: "production" }),
    createProject({ id: "proj-003", name: "staging" }),
  ],
  spans: {
    "proj-001": [createSpan(), createSpan(), createSpan()],
    "proj-002": [createSpan(), createSpan()],
    "proj-003": [createSpan()],
  } as Record<string, Span[]>,
  datasets: [
    createDataset({ id: "ds-001", name: "eval-dataset" }),
    createDataset({ id: "ds-002", name: "training-data" }),
  ],
  experiments: {
    "ds-001": [
      createExperiment("ds-001", { id: "exp-001", name: "baseline-eval" }),
      createExperiment("ds-001", { id: "exp-002", name: "v2-comparison" }),
    ],
    "ds-002": [
      createExperiment("ds-002", { id: "exp-003", name: "prompt-tuning" }),
    ],
  } as Record<string, Experiment[]>,
};

// ============================================================================
// MSW Handlers
// ============================================================================

/**
 * Default handlers that return success responses with fixture data.
 * Use these for happy-path testing.
 */
export const handlers = [
  // GET /v1/projects - List all projects
  http.get("*/v1/projects", () => {
    return HttpResponse.json<ProjectsResponse>({
      data: fixtures.projects,
      next_cursor: null,
    });
  }),

  // GET /v1/projects/:project_identifier/spans - Get spans for a project
  http.get("*/v1/projects/:project_identifier/spans", ({ params }) => {
    const projectId = params.project_identifier as string;
    // Look up by ID or name
    const project = fixtures.projects.find(p => p.id === projectId || p.name === projectId);
    if (!project) {
      return HttpResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const spans = fixtures.spans[project.id] || [];
    return HttpResponse.json<SpansResponse>({
      data: spans,
      next_cursor: null,
    });
  }),

  // GET /v1/datasets - List all datasets
  http.get("*/v1/datasets", () => {
    return HttpResponse.json<DatasetsResponse>({
      data: fixtures.datasets,
      next_cursor: null,
    });
  }),

  // GET /v1/datasets/:dataset_id/experiments - List experiments for a dataset
  http.get("*/v1/datasets/:dataset_id/experiments", ({ params }) => {
    const datasetId = params.dataset_id as string;
    const experiments = fixtures.experiments[datasetId] || [];
    return HttpResponse.json<ExperimentsResponse>({
      data: experiments,
      next_cursor: null,
    });
  }),
];

/**
 * Error handlers for testing error scenarios.
 * Use server.use(errorHandlers.projectsError) to override specific endpoints.
 */
export const errorHandlers = {
  // Projects endpoint returns 500
  projectsError: http.get("*/v1/projects", () => {
    return HttpResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),

  // Projects endpoint returns 403
  projectsForbidden: http.get("*/v1/projects", () => {
    return HttpResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }),

  // Spans endpoint returns 500
  spansError: http.get("*/v1/projects/:project_identifier/spans", () => {
    return HttpResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),

  // Datasets endpoint returns 500
  datasetsError: http.get("*/v1/datasets", () => {
    return HttpResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),

  // Experiments endpoint returns 500
  experimentsError: http.get("*/v1/datasets/:dataset_id/experiments", () => {
    return HttpResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),
};

/**
 * Create handlers with custom fixture data.
 * Useful for testing specific scenarios.
 */
export function createHandlers(customFixtures: {
  projects?: Project[];
  spans?: Record<string, Span[]>;
  datasets?: Dataset[];
  experiments?: Record<string, Experiment[]>;
}) {
  const data = {
    projects: customFixtures.projects ?? fixtures.projects,
    spans: customFixtures.spans ?? fixtures.spans,
    datasets: customFixtures.datasets ?? fixtures.datasets,
    experiments: customFixtures.experiments ?? fixtures.experiments,
  };

  return [
    http.get("*/v1/projects", () => {
      return HttpResponse.json<ProjectsResponse>({
        data: data.projects,
        next_cursor: null,
      });
    }),

    http.get("*/v1/projects/:project_identifier/spans", ({ params }) => {
      const projectId = params.project_identifier as string;
      const project = data.projects.find(p => p.id === projectId || p.name === projectId);
      if (!project) {
        return HttpResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const spans = data.spans[project.id] || [];
      return HttpResponse.json<SpansResponse>({
        data: spans,
        next_cursor: null,
      });
    }),

    http.get("*/v1/datasets", () => {
      return HttpResponse.json<DatasetsResponse>({
        data: data.datasets,
        next_cursor: null,
      });
    }),

    http.get("*/v1/datasets/:dataset_id/experiments", ({ params }) => {
      const datasetId = params.dataset_id as string;
      const experiments = data.experiments[datasetId] || [];
      return HttpResponse.json<ExperimentsResponse>({
        data: experiments,
        next_cursor: null,
      });
    }),
  ];
}
