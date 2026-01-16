/**
 * MSW Server Setup for Node.js Testing
 *
 * This module provides a configured MSW server for intercepting HTTP requests
 * in Node.js test environments. The server can be started/stopped/reset
 * to control mock behavior during tests.
 *
 * @example Basic usage
 * ```typescript
 * import { server } from './mocks/server';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 *
 * @example Override handlers for error testing
 * ```typescript
 * import { server, useErrorHandler } from './mocks/server';
 *
 * it('handles project fetch errors', () => {
 *   useErrorHandler('projects');
 *   // test error handling...
 * });
 * ```
 */

import { setupServer } from "msw/node";
import { handlers, errorHandlers } from "./handlers";

/**
 * MSW server instance configured with default success handlers.
 *
 * Lifecycle methods:
 * - `server.listen()` - Start intercepting requests
 * - `server.close()` - Stop intercepting requests
 * - `server.resetHandlers()` - Reset to default handlers
 * - `server.use(...handlers)` - Add runtime handlers (override defaults)
 */
export const server = setupServer(...handlers);

/**
 * Error handler names mapped to their handlers.
 * Used by `useErrorHandler()` for convenient error scenario testing.
 */
const errorHandlerMap = {
  projects: errorHandlers.projectsError,
  projectsForbidden: errorHandlers.projectsForbidden,
  spans: errorHandlers.spansError,
  datasets: errorHandlers.datasetsError,
  experiments: errorHandlers.experimentsError,
} as const;

export type ErrorHandlerName = keyof typeof errorHandlerMap;

/**
 * Convenience function to switch a specific endpoint to return an error.
 * The error handler is added for the current test only and will be reset
 * by `server.resetHandlers()`.
 *
 * @param name - The endpoint to simulate an error for
 *
 * @example
 * ```typescript
 * it('handles project errors gracefully', async () => {
 *   useErrorHandler('projects');
 *   const result = await fetchProjects();
 *   expect(result.error).toBeDefined();
 * });
 * ```
 */
export function useErrorHandler(name: ErrorHandlerName): void {
  const handler = errorHandlerMap[name];
  if (!handler) {
    throw new Error(`Unknown error handler: ${name}. Available: ${Object.keys(errorHandlerMap).join(", ")}`);
  }
  server.use(handler);
}

/**
 * Apply multiple error handlers at once.
 *
 * @param names - Array of endpoint names to simulate errors for
 *
 * @example
 * ```typescript
 * it('handles multiple API failures', async () => {
 *   useErrorHandlers(['projects', 'datasets']);
 *   // test cascade failure handling...
 * });
 * ```
 */
export function useErrorHandlers(names: ErrorHandlerName[]): void {
  for (const name of names) {
    useErrorHandler(name);
  }
}

/**
 * Reset all handlers to their default success state.
 * This is equivalent to calling `server.resetHandlers()` but
 * provides a more semantic API.
 */
export function resetToSuccessHandlers(): void {
  server.resetHandlers();
}
