import { vi, beforeAll, afterAll, afterEach } from "vitest";
import { server } from "./mocks";

// Mock @arizeai/phoenix-client globally to ensure no real network calls
// This is kept for unit tests that need to mock the client directly.
// MSW handles HTTP-level interception for integration tests.
vi.mock("@arizeai/phoenix-client", () => ({
  createClient: vi.fn(),
}));

/**
 * MSW Server Lifecycle
 *
 * Start the MSW server before all tests to intercept HTTP requests.
 * This allows tests to make real fetch() calls that are intercepted
 * and return mock responses defined in test/mocks/handlers.ts.
 *
 * The server uses `onUnhandledRequest: 'bypass'` to allow unmatched
 * requests through (e.g., localhost requests not to Phoenix API).
 * Individual tests that want stricter behavior can use:
 *   server.listen({ onUnhandledRequest: 'error' })
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

// Reset handlers after each test to ensure clean state
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

// Clean up MSW server after all tests
afterAll(() => {
  server.close();
});

// Note: Console methods are not mocked globally to allow tests to verify console output.
// Individual tests can mock console methods if needed to suppress output.
