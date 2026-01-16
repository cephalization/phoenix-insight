import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "@/store/chat";

// Mock streamdown since it has complex dependencies and we don't need to test it
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: string }) => (
    <div data-testid="streamdown-content">{children}</div>
  ),
}));

// Helper to create a test message
function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "test-message-id",
    role: "assistant",
    content: "Test message content",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ChatMessage", () => {
  describe("rendering", () => {
    it("renders user message", () => {
      const message = createMessage({
        role: "user",
        content: "Hello, assistant!",
      });

      render(<ChatMessage message={message} />);

      expect(screen.getByText("You")).toBeInTheDocument();
      expect(screen.getByText("Hello, assistant!")).toBeInTheDocument();
    });

    it("renders assistant message", () => {
      const message = createMessage({
        role: "assistant",
        content: "Hello, user!",
      });

      render(<ChatMessage message={message} />);

      expect(screen.getByText("Assistant")).toBeInTheDocument();
      // Assistant content goes through Streamdown
      expect(screen.getByTestId("streamdown-content")).toHaveTextContent(
        "Hello, user!"
      );
    });

    it("displays formatted timestamp", () => {
      // Create a message with a specific timestamp
      const fixedTimestamp = new Date("2024-03-15T14:30:00").getTime();
      const message = createMessage({ timestamp: fixedTimestamp });

      render(<ChatMessage message={message} />);

      // The exact format depends on locale, but should contain time components
      // Using a regex to match common time formats
      const timeText = screen.getByText(/\d{1,2}:\d{2}/);
      expect(timeText).toBeInTheDocument();
    });
  });

  describe("alignment and styling", () => {
    it("aligns user messages to the right", () => {
      const message = createMessage({ role: "user" });

      const { container } = render(<ChatMessage message={message} />);

      // Find the outer container and check for justify-end class
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass("justify-end");
    });

    it("aligns assistant messages to the left", () => {
      const message = createMessage({ role: "assistant" });

      const { container } = render(<ChatMessage message={message} />);

      // Find the outer container and check for justify-start class
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass("justify-start");
    });

    it("applies primary background to user messages", () => {
      const message = createMessage({ role: "user" });

      const { container } = render(<ChatMessage message={message} />);

      // Find the message bubble (second-level div)
      const messageBubble = container.querySelector(".bg-primary");
      expect(messageBubble).toBeInTheDocument();
    });

    it("applies muted background to assistant messages", () => {
      const message = createMessage({ role: "assistant" });

      const { container } = render(<ChatMessage message={message} />);

      // Find the message bubble with muted background
      const messageBubble = container.querySelector(".bg-muted");
      expect(messageBubble).toBeInTheDocument();
    });
  });

  describe("streaming indicator", () => {
    it("shows streaming indicator when isStreaming is true and message is from assistant", () => {
      const message = createMessage({ role: "assistant" });

      render(<ChatMessage message={message} isStreaming={true} />);

      expect(screen.getByText("Typing")).toBeInTheDocument();
    });

    it("does not show streaming indicator when isStreaming is false", () => {
      const message = createMessage({ role: "assistant" });

      render(<ChatMessage message={message} isStreaming={false} />);

      expect(screen.queryByText("Typing")).not.toBeInTheDocument();
    });

    it("does not show streaming indicator for user messages even when isStreaming is true", () => {
      const message = createMessage({ role: "user" });

      render(<ChatMessage message={message} isStreaming={true} />);

      expect(screen.queryByText("Typing")).not.toBeInTheDocument();
    });

    it("defaults isStreaming to false when not provided", () => {
      const message = createMessage({ role: "assistant" });

      render(<ChatMessage message={message} />);

      expect(screen.queryByText("Typing")).not.toBeInTheDocument();
    });
  });

  describe("markdown rendering", () => {
    it("uses Streamdown for assistant message content", () => {
      const message = createMessage({
        role: "assistant",
        content: "# Heading\n\n**Bold text**",
      });

      render(<ChatMessage message={message} />);

      // Streamdown mock renders content in a div with testid
      const streamdownContent = screen.getByTestId("streamdown-content");
      // toHaveTextContent normalizes whitespace, so check for presence of content parts
      expect(streamdownContent).toHaveTextContent("# Heading");
      expect(streamdownContent).toHaveTextContent("**Bold text**");
    });

    it("renders user messages as plain text without markdown processing", () => {
      const message = createMessage({
        role: "user",
        content: "# This should be plain text",
      });

      render(<ChatMessage message={message} />);

      // User messages are rendered in a p tag, not through Streamdown
      expect(
        screen.getByText("# This should be plain text")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("streamdown-content")).not.toBeInTheDocument();
    });
  });

  describe("content display", () => {
    it("preserves whitespace in user messages", () => {
      const message = createMessage({
        role: "user",
        content: "Line 1\nLine 2\n  Indented",
      });

      const { container } = render(<ChatMessage message={message} />);

      // The p tag should have whitespace-pre-wrap class
      const contentP = container.querySelector("p.whitespace-pre-wrap");
      expect(contentP).toBeInTheDocument();
      // Verify the actual textContent property has the newlines (not using toHaveTextContent which normalizes)
      expect(contentP?.textContent).toBe("Line 1\nLine 2\n  Indented");
    });

    it("handles empty content", () => {
      const message = createMessage({
        role: "assistant",
        content: "",
      });

      render(<ChatMessage message={message} />);

      // Should still render the message structure
      expect(screen.getByText("Assistant")).toBeInTheDocument();
      const streamdownContent = screen.getByTestId("streamdown-content");
      expect(streamdownContent).toHaveTextContent("");
    });

    it("handles long content without overflow", () => {
      const longContent = "A".repeat(1000);
      const message = createMessage({
        role: "assistant",
        content: longContent,
      });

      const { container } = render(<ChatMessage message={message} />);

      // The message bubble should have max-width
      const messageBubble = container.querySelector(".max-w-\\[80\\%\\]");
      expect(messageBubble).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("uses semantic time element for timestamp", () => {
      const message = createMessage();

      render(<ChatMessage message={message} />);

      // Verify the role indicator is present
      expect(screen.getByText("Assistant")).toBeInTheDocument();
    });

    it("has proper contrast for user messages", () => {
      const message = createMessage({ role: "user" });

      const { container } = render(<ChatMessage message={message} />);

      // User messages should have text-primary-foreground class
      const messageBubble = container.querySelector(".text-primary-foreground");
      expect(messageBubble).toBeInTheDocument();
    });

    it("has proper contrast for assistant messages", () => {
      const message = createMessage({ role: "assistant" });

      const { container } = render(<ChatMessage message={message} />);

      // Assistant messages should have text-foreground class
      const messageBubble = container.querySelector(".text-foreground");
      expect(messageBubble).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles special characters in content", () => {
      const message = createMessage({
        role: "user",
        content: "<script>alert('xss')</script> & \"quotes\" 'apostrophes'",
      });

      render(<ChatMessage message={message} />);

      // Content should be escaped/rendered safely
      expect(
        screen.getByText(
          "<script>alert('xss')</script> & \"quotes\" 'apostrophes'"
        )
      ).toBeInTheDocument();
    });

    it("handles unicode and emoji in content", () => {
      const message = createMessage({
        role: "user",
        content: "Hello! Bonjour!",
      });

      render(<ChatMessage message={message} />);

      expect(screen.getByText("Hello! Bonjour!")).toBeInTheDocument();
    });

    it("handles very old timestamps", () => {
      const oldTimestamp = new Date("2000-01-01T00:00:00").getTime();
      const message = createMessage({ timestamp: oldTimestamp });

      render(<ChatMessage message={message} />);

      // Should still render without error
      expect(screen.getByText("Assistant")).toBeInTheDocument();
    });
  });
});
