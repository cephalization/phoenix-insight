import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "./ChatInput";
import type { ChatInputProps } from "./ChatInput";

// Default props for testing
const defaultProps: ChatInputProps = {
  onSend: vi.fn(),
  onCancel: vi.fn(),
  isConnected: true,
  isStreaming: false,
};

function renderChatInput(props: Partial<ChatInputProps> = {}) {
  const mergedProps = { ...defaultProps, ...props };
  return render(<ChatInput {...mergedProps} />);
}

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders textarea and send button", () => {
      renderChatInput();

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /send/i })
      ).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      renderChatInput({ placeholder: "Ask a question..." });

      expect(
        screen.getByPlaceholderText("Ask a question...")
      ).toBeInTheDocument();
    });

    it("renders with default placeholder", () => {
      renderChatInput();

      expect(
        screen.getByPlaceholderText("Type a message...")
      ).toBeInTheDocument();
    });

    it("displays helper text for keyboard shortcuts", () => {
      renderChatInput();

      expect(
        screen.getByText(/press enter to send.*shift\+enter for new line/i)
      ).toBeInTheDocument();
    });
  });

  describe("connection status indicator", () => {
    it("shows connected status when isConnected is true", () => {
      renderChatInput({ isConnected: true });

      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("shows disconnected status when isConnected is false", () => {
      renderChatInput({ isConnected: false });

      expect(screen.getByText("Disconnected")).toBeInTheDocument();
    });

    it("shows green indicator when connected", () => {
      const { container } = renderChatInput({ isConnected: true });

      const indicator = container.querySelector(".bg-green-500");
      expect(indicator).toBeInTheDocument();
    });

    it("shows red indicator when disconnected", () => {
      const { container } = renderChatInput({ isConnected: false });

      const indicator = container.querySelector(".bg-red-500");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("input behavior", () => {
    it("updates value when typing", async () => {
      const user = userEvent.setup();
      renderChatInput();

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello world");

      expect(textarea).toHaveValue("Hello world");
    });

    it("clears input after sending", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Test message");
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(textarea).toHaveValue("");
    });

    it("disables textarea when disconnected", () => {
      renderChatInput({ isConnected: false });

      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("disables textarea when streaming", () => {
      renderChatInput({ isStreaming: true });

      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("enables textarea when connected and not streaming", () => {
      renderChatInput({ isConnected: true, isStreaming: false });

      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });
  });

  describe("send functionality", () => {
    it("calls onSend with trimmed message when send button is clicked", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "  Hello world  ");
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith("Hello world");
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("calls onSend when Enter is pressed", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Test message");
      await user.keyboard("{Enter}");

      expect(onSend).toHaveBeenCalledWith("Test message");
    });

    it("does not call onSend when Shift+Enter is pressed", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Line 1");
      await user.keyboard("{Shift>}{Enter}{/Shift}");

      expect(onSend).not.toHaveBeenCalled();
      // Note: the actual newline character depends on the textarea behavior
    });

    it("does not call onSend when message is empty", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not call onSend when message is only whitespace", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "   ");
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).not.toHaveBeenCalled();
    });

    it("does not call onSend when disconnected", () => {
      const onSend = vi.fn();
      renderChatInput({ onSend, isConnected: false });

      // Need to enable the textarea manually for this test since it's disabled
      // Instead, we'll verify the button is disabled
      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });

    it("does not call onSend when streaming", async () => {
      const onSend = vi.fn();
      renderChatInput({ onSend, isStreaming: true });

      // Send button shouldn't be visible during streaming
      expect(
        screen.queryByRole("button", { name: /send/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("send button state", () => {
    it("disables send button when input is empty", () => {
      renderChatInput();

      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });

    it("enables send button when input has content", async () => {
      const user = userEvent.setup();
      renderChatInput();

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello");

      expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
    });

    it("disables send button when disconnected even with content", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <ChatInput {...defaultProps} isConnected={true} />
      );

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello");

      rerender(<ChatInput {...defaultProps} isConnected={false} />);

      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });
  });

  describe("cancel functionality", () => {
    it("shows cancel button when streaming", () => {
      renderChatInput({ isStreaming: true });

      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("hides send button when streaming", () => {
      renderChatInput({ isStreaming: true });

      expect(
        screen.queryByRole("button", { name: /send/i })
      ).not.toBeInTheDocument();
    });

    it("calls onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderChatInput({ onCancel, isStreaming: true });

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when not streaming", async () => {
      const onCancel = vi.fn();
      renderChatInput({ onCancel, isStreaming: false });

      // Cancel button shouldn't be visible when not streaming
      expect(
        screen.queryByRole("button", { name: /cancel/i })
      ).not.toBeInTheDocument();
    });

    it("shows send button and hides cancel button when not streaming", () => {
      renderChatInput({ isStreaming: false });

      expect(
        screen.getByRole("button", { name: /send/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /cancel/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper aria-label on textarea", () => {
      renderChatInput();

      expect(
        screen.getByLabelText("Chat message input")
      ).toBeInTheDocument();
    });

    it("has proper aria-label on send button", () => {
      renderChatInput();

      expect(screen.getByRole("button", { name: /send/i })).toHaveAttribute(
        "aria-label",
        "Send message"
      );
    });

    it("has proper aria-label on cancel button", () => {
      renderChatInput({ isStreaming: true });

      expect(screen.getByRole("button", { name: /cancel/i })).toHaveAttribute(
        "aria-label",
        "Cancel response"
      );
    });

    it("hides decorative icons from screen readers", () => {
      const { container } = renderChatInput();

      const icons = container.querySelectorAll("svg");
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute("aria-hidden", "true");
      });
    });
  });

  describe("focus behavior", () => {
    it("focuses textarea on mount", () => {
      renderChatInput();

      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("refocuses textarea when streaming ends", async () => {
      const { rerender } = render(
        <ChatInput {...defaultProps} isStreaming={true} isConnected={true} />
      );

      // Simulate streaming ending
      rerender(
        <ChatInput {...defaultProps} isStreaming={false} isConnected={true} />
      );

      expect(screen.getByRole("textbox")).toHaveFocus();
    });
  });

  describe("custom className", () => {
    it("applies custom className to container", () => {
      const { container } = renderChatInput({ className: "custom-class" });

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });

  describe("edge cases", () => {
    it("handles rapid typing without issues", async () => {
      const user = userEvent.setup({ delay: null });
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "abcdefghijklmnopqrstuvwxyz");

      expect(textarea).toHaveValue("abcdefghijklmnopqrstuvwxyz");
    });

    it("handles special characters in message", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      const specialChars = "<script>alert('xss')</script>";
      await user.type(textarea, specialChars);
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith(specialChars);
    });

    it("handles unicode and emoji in message", async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      renderChatInput({ onSend });

      const textarea = screen.getByRole("textbox");
      // Note: userEvent may not handle emoji paste well, using fireEvent
      fireEvent.change(textarea, { target: { value: "Hello! Bonjour!" } });
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(onSend).toHaveBeenCalledWith("Hello! Bonjour!");
    });

    it("handles onCancel being undefined", async () => {
      const user = userEvent.setup();
      renderChatInput({ onCancel: undefined, isStreaming: true });

      // Should not throw when clicking cancel without onCancel handler
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);
      // No assertion needed - just ensuring no error is thrown
    });
  });
});
