/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Component that throws an error
function ThrowingComponent({ error }: { error: Error }): never {
  throw error;
}

// Component that works normally
function WorkingComponent() {
  return <div>Working content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console errors during tests
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe("rendering", () => {
    it("renders children when there is no error", () => {
      render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Working content")).toBeInTheDocument();
    });

    it("renders error UI when a child throws an error", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Test error")} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("renders custom fallback when provided", () => {
      const customFallback = <div>Custom error fallback</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent error={new Error("Test error")} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom error fallback")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });
  });

  describe("error messages", () => {
    it("shows generic message for standard Error", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Some technical error")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("An unexpected error occurred. Please try again.")
      ).toBeInTheDocument();
    });

    it("shows appropriate message for TypeError", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new TypeError("Cannot read property")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("Something went wrong while processing data. Please try again.")
      ).toBeInTheDocument();
    });

    it("shows appropriate message for SyntaxError", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new SyntaxError("Unexpected token")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("There was a problem with the data format. Please try again.")
      ).toBeInTheDocument();
    });

    it("shows appropriate message for RangeError", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new RangeError("Invalid array length")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("A calculation error occurred. Please try again.")
      ).toBeInTheDocument();
    });

    it("shows network message for network-related errors", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("network request failed")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("A network error occurred. Please check your connection and try again.")
      ).toBeInTheDocument();
    });

    it("shows timeout message for timeout errors", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Request timeout")} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("The operation timed out. Please try again.")
      ).toBeInTheDocument();
    });
  });

  describe("recovery", () => {
    it("resets error state when Try Again is clicked", () => {
      // This requires a stateful test setup
      let shouldThrow = true;
      
      function ConditionalThrowing() {
        if (shouldThrow) {
          throw new Error("Test error");
        }
        return <div>Recovered content</div>;
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrowing />
        </ErrorBoundary>
      );

      // Error is shown
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Stop throwing
      shouldThrow = false;

      // Click Try Again
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      // Rerender to pick up the change
      rerender(
        <ErrorBoundary>
          <ConditionalThrowing />
        </ErrorBoundary>
      );

      // Content is shown
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });
  });

  describe("logging", () => {
    it("logs error to console", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Logged error")} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        "ErrorBoundary caught an error:",
        expect.any(Error)
      );
    });

    it("logs component stack to console", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Stack error")} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalledWith(
        "Component stack:",
        expect.any(String)
      );
    });
  });

  describe("accessibility", () => {
    it("has role='alert' on error display", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Test error")} />
        </ErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("has accessible button for recovery action", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent error={new Error("Test error")} />
        </ErrorBoundary>
      );

      const button = screen.getByRole("button", { name: /try again/i });
      expect(button).toBeInTheDocument();
    });
  });
});
