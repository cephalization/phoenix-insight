/**
 * ErrorBoundary component for catching and displaying React errors.
 *
 * Wraps the main app to catch unhandled errors and display a user-friendly
 * error message instead of crashing the entire application.
 *
 * Features:
 * - Catches JavaScript errors in child component tree
 * - Displays user-friendly error messages (not stack traces)
 * - Provides a "Try Again" button to reset the error state
 * - Logs errors to console for debugging
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Alert circle icon for error display
 */
function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * Refresh icon for the retry button
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** User-friendly error message */
  errorMessage: string | null;
}

/**
 * Get a user-friendly error message from an error object.
 * Avoids exposing stack traces or technical details to users.
 */
function getErrorMessage(error: unknown): string {
  // Handle common error types with user-friendly messages
  if (error instanceof TypeError) {
    return "Something went wrong while processing data. Please try again.";
  }

  if (error instanceof SyntaxError) {
    return "There was a problem with the data format. Please try again.";
  }

  if (error instanceof RangeError) {
    return "A calculation error occurred. Please try again.";
  }

  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return "A network error occurred. Please check your connection and try again.";
    }

    if (error.message.includes("timeout")) {
      return "The operation timed out. Please try again.";
    }

    // For other errors, provide a generic message
    // We intentionally don't expose the actual error message to avoid
    // showing technical details or potentially sensitive information
    return "An unexpected error occurred. Please try again.";
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: getErrorMessage(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    // In production, this could be sent to an error tracking service
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md">
            <Alert variant="destructive" className="mb-4">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                {this.state.errorMessage ||
                  "An unexpected error occurred. Please try again."}
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="gap-2"
              >
                <RefreshIcon className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
