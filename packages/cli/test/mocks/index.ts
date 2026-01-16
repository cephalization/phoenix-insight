/**
 * MSW Mocks - Main Export Point
 *
 * This module re-exports all MSW-related utilities for testing Phoenix API
 * interactions. Import from this module for a consistent API.
 *
 * @example
 * ```typescript
 * import {
 *   server,
 *   useErrorHandler,
 *   fixtures,
 *   createProject,
 * } from '../mocks';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 *
 * it('fetches projects', async () => {
 *   // Default handlers return fixtures.projects
 *   const result = await fetchProjects();
 *   expect(result).toEqual(fixtures.projects);
 * });
 *
 * it('handles errors', async () => {
 *   useErrorHandler('projects');
 *   await expect(fetchProjects()).rejects.toThrow();
 * });
 * ```
 */

// Server setup and control
export {
  server,
  useErrorHandler,
  useErrorHandlers,
  resetToSuccessHandlers,
  type ErrorHandlerName,
} from "./server";

// Handlers and fixtures
export {
  // Default handlers (success responses)
  handlers,
  // Error handlers for testing failure scenarios
  errorHandlers,
  // Pre-generated fixture data
  fixtures,
  // Fixture generators for custom test data
  createProject,
  createSpan,
  createDataset,
  createExperiment,
  // Handler factory for custom scenarios
  createHandlers,
  // Types
  type Project,
  type ProjectsResponse,
  type Span,
  type SpansResponse,
  type Dataset,
  type DatasetsResponse,
  type Experiment,
  type ExperimentsResponse,
} from "./handlers";
