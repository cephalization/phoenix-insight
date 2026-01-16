/**
 * Tests for ConnectionStatusIndicator component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { useChatStore } from "@/store/chat";

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (message: string, options?: object) => mockToastSuccess(message, options),
    info: (message: string, options?: object) => mockToastInfo(message, options),
    error: (message: string, options?: object) => mockToastError(message, options),
  },
}));

describe("ConnectionStatusIndicator", () => {
  // Reset store state before each test
  beforeEach(() => {
    useChatStore.setState({
      connectionStatus: "disconnected",
      isConnected: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render with disconnected status", () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("should render with connecting status", () => {
      useChatStore.setState({ connectionStatus: "connecting" });
      render(<ConnectionStatusIndicator />);

      expect(screen.getByText("Connecting...")).toBeInTheDocument();
    });

    it("should render with connected status", () => {
      useChatStore.setState({ connectionStatus: "connected" });
      render(<ConnectionStatusIndicator />);

      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("should have green indicator when connected", () => {
      useChatStore.setState({ connectionStatus: "connected" });
      render(<ConnectionStatusIndicator />);

      const indicator = document.querySelector("[aria-hidden='true']");
      expect(indicator).toHaveClass("bg-green-500");
    });

    it("should have yellow indicator when connecting", () => {
      useChatStore.setState({ connectionStatus: "connecting" });
      render(<ConnectionStatusIndicator />);

      const indicator = document.querySelector("[aria-hidden='true']");
      expect(indicator).toHaveClass("bg-yellow-500");
    });

    it("should have red indicator when disconnected", () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      const indicator = document.querySelector("[aria-hidden='true']");
      expect(indicator).toHaveClass("bg-red-500");
    });

    it("should have pulse animation when connecting", () => {
      useChatStore.setState({ connectionStatus: "connecting" });
      render(<ConnectionStatusIndicator />);

      const indicator = document.querySelector("[aria-hidden='true']");
      expect(indicator).toHaveClass("animate-pulse");
    });

    it("should not have pulse animation when connected", () => {
      useChatStore.setState({ connectionStatus: "connected" });
      render(<ConnectionStatusIndicator />);

      const indicator = document.querySelector("[aria-hidden='true']");
      expect(indicator).not.toHaveClass("animate-pulse");
    });

    it("should apply custom className", () => {
      render(<ConnectionStatusIndicator className="custom-class" />);

      // Find container element - it's the first div
      const container = screen.getByText("Disconnected").parentElement;
      expect(container).toHaveClass("custom-class");
    });
  });

  describe("toast notifications", () => {
    it("should not show toast on initial render", () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("should show success toast when transitioning to connected", async () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      // Transition to connected
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connected" });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Connected to server",
        expect.objectContaining({ description: "Ready to send messages" })
      );
    });

    it("should show error toast when transitioning to disconnected", async () => {
      useChatStore.setState({ connectionStatus: "connected" });
      render(<ConnectionStatusIndicator />);

      // Transition to disconnected
      await act(async () => {
        useChatStore.setState({ connectionStatus: "disconnected" });
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Disconnected from server",
        expect.objectContaining({ description: "Will attempt to reconnect automatically" })
      );
    });

    it("should show info toast when reconnecting after disconnect", async () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      // Transition to connecting (reconnecting)
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connecting" });
      });

      expect(mockToastInfo).toHaveBeenCalledWith(
        "Reconnecting...",
        expect.objectContaining({ description: "Attempting to reconnect to server" })
      );
    });

    it("should not show toast when showToasts is false", async () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator showToasts={false} />);

      // Transition to connected
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connected" });
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("should not show toast when status does not change", async () => {
      useChatStore.setState({ connectionStatus: "connected" });
      render(<ConnectionStatusIndicator />);

      // Clear any initial calls
      vi.clearAllMocks();

      // Set to same status (no change)
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connected" });
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe("status transitions", () => {
    it("should handle full connection lifecycle", async () => {
      useChatStore.setState({ connectionStatus: "disconnected" });
      render(<ConnectionStatusIndicator />);

      // Start connecting
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connecting" });
      });
      expect(screen.getByText("Connecting...")).toBeInTheDocument();

      // Get connected
      await act(async () => {
        useChatStore.setState({ connectionStatus: "connected" });
      });
      expect(screen.getByText("Connected")).toBeInTheDocument();

      // Disconnect
      await act(async () => {
        useChatStore.setState({ connectionStatus: "disconnected" });
      });
      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });
  });
});
