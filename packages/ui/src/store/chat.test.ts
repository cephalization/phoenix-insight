import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chat";
import { useReportStore } from "./report";

describe("useChatStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      sessions: [],
      currentSessionId: null,
      isConnected: false,
      isStreaming: false,
      connectionStatus: "disconnected",
    });
  });

  describe("createSession", () => {
    it("creates a new session with generated id and timestamp", () => {
      const session = useChatStore.getState().createSession();

      expect(session.id).toBeDefined();
      expect(session.id.length).toBeGreaterThan(0);
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.title).toBeUndefined();
    });

    it("creates a session with a title when provided", () => {
      const session = useChatStore.getState().createSession("Test Session");

      expect(session.title).toBe("Test Session");
    });

    it("adds the session to the sessions array", () => {
      const session = useChatStore.getState().createSession();

      expect(useChatStore.getState().sessions).toHaveLength(1);
      expect(useChatStore.getState().sessions[0]).toEqual(session);
    });

    it("sets the new session as current", () => {
      const session = useChatStore.getState().createSession();

      expect(useChatStore.getState().currentSessionId).toBe(session.id);
    });

    it("allows creating multiple sessions", () => {
      useChatStore.getState().createSession("Session 1");
      const session2 = useChatStore.getState().createSession("Session 2");

      expect(useChatStore.getState().sessions).toHaveLength(2);
      expect(useChatStore.getState().currentSessionId).toBe(session2.id);
    });
  });

  describe("addMessage", () => {
    it("adds a message to the specified session", () => {
      const session = useChatStore.getState().createSession();
      const message = useChatStore.getState().addMessage(session.id, {
        role: "user",
        content: "Hello",
      });

      const updatedSession = useChatStore.getState().sessions[0];
      expect(updatedSession.messages).toHaveLength(1);
      expect(updatedSession.messages[0]).toEqual(message);
    });

    it("generates a unique id and timestamp for the message", () => {
      const session = useChatStore.getState().createSession();
      const message = useChatStore.getState().addMessage(session.id, {
        role: "assistant",
        content: "Hi there!",
      });

      expect(message.id).toBeDefined();
      expect(message.id.length).toBeGreaterThan(0);
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.role).toBe("assistant");
      expect(message.content).toBe("Hi there!");
    });

    it("preserves message order when adding multiple messages", () => {
      const session = useChatStore.getState().createSession();
      useChatStore.getState().addMessage(session.id, {
        role: "user",
        content: "First",
      });
      useChatStore.getState().addMessage(session.id, {
        role: "assistant",
        content: "Second",
      });
      useChatStore.getState().addMessage(session.id, {
        role: "user",
        content: "Third",
      });

      const messages = useChatStore.getState().sessions[0].messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
      expect(messages[2].content).toBe("Third");
    });

    it("does not affect other sessions", () => {
      const session1 = useChatStore.getState().createSession("Session 1");
      const session2 = useChatStore.getState().createSession("Session 2");

      useChatStore.getState().addMessage(session1.id, {
        role: "user",
        content: "Message in session 1",
      });

      const sessions = useChatStore.getState().sessions;
      const s1 = sessions.find((s) => s.id === session1.id)!;
      const s2 = sessions.find((s) => s.id === session2.id)!;

      expect(s1.messages).toHaveLength(1);
      expect(s2.messages).toHaveLength(0);
    });
  });

  describe("updateMessage", () => {
    it("updates the content of an existing message", () => {
      const session = useChatStore.getState().createSession();
      const message = useChatStore.getState().addMessage(session.id, {
        role: "assistant",
        content: "Initial content",
      });

      useChatStore
        .getState()
        .updateMessage(session.id, message.id, "Updated content");

      const updatedMessage = useChatStore.getState().sessions[0].messages[0];
      expect(updatedMessage.content).toBe("Updated content");
      expect(updatedMessage.id).toBe(message.id);
      expect(updatedMessage.timestamp).toBe(message.timestamp);
    });

    it("does not affect other messages in the same session", () => {
      const session = useChatStore.getState().createSession();
      useChatStore.getState().addMessage(session.id, {
        role: "user",
        content: "First message",
      });
      const msg2 = useChatStore.getState().addMessage(session.id, {
        role: "assistant",
        content: "Second message",
      });

      useChatStore.getState().updateMessage(session.id, msg2.id, "Updated");

      const messages = useChatStore.getState().sessions[0].messages;
      expect(messages[0].content).toBe("First message");
      expect(messages[1].content).toBe("Updated");
    });
  });

  describe("setCurrentSession", () => {
    it("sets the current session id", () => {
      const session1 = useChatStore.getState().createSession("Session 1");
      const session2 = useChatStore.getState().createSession("Session 2");

      // session2 is current after creation
      expect(useChatStore.getState().currentSessionId).toBe(session2.id);

      useChatStore.getState().setCurrentSession(session1.id);
      expect(useChatStore.getState().currentSessionId).toBe(session1.id);
    });

    it("allows setting to null", () => {
      useChatStore.getState().createSession();
      useChatStore.getState().setCurrentSession(null);

      expect(useChatStore.getState().currentSessionId).toBeNull();
    });
  });

  describe("clearSession", () => {
    it("clears all messages from the specified session", () => {
      const session = useChatStore.getState().createSession();
      useChatStore.getState().addMessage(session.id, {
        role: "user",
        content: "Message 1",
      });
      useChatStore.getState().addMessage(session.id, {
        role: "assistant",
        content: "Message 2",
      });

      useChatStore.getState().clearSession(session.id);

      const clearedSession = useChatStore.getState().sessions[0];
      expect(clearedSession.messages).toEqual([]);
      expect(clearedSession.id).toBe(session.id);
      expect(clearedSession.createdAt).toBe(session.createdAt);
    });

    it("does not affect other sessions", () => {
      const session1 = useChatStore.getState().createSession("Session 1");
      const session2 = useChatStore.getState().createSession("Session 2");

      useChatStore.getState().addMessage(session1.id, {
        role: "user",
        content: "In session 1",
      });
      useChatStore.getState().addMessage(session2.id, {
        role: "user",
        content: "In session 2",
      });

      useChatStore.getState().clearSession(session1.id);

      const sessions = useChatStore.getState().sessions;
      const s1 = sessions.find((s) => s.id === session1.id)!;
      const s2 = sessions.find((s) => s.id === session2.id)!;

      expect(s1.messages).toHaveLength(0);
      expect(s2.messages).toHaveLength(1);
    });
  });

  describe("deleteSession", () => {
    it("removes the session from the sessions array", () => {
      const session = useChatStore.getState().createSession();

      useChatStore.getState().deleteSession(session.id);

      expect(useChatStore.getState().sessions).toHaveLength(0);
    });

    it("sets currentSessionId to the last remaining session when deleting current", () => {
      const session1 = useChatStore.getState().createSession("Session 1");
      const session2 = useChatStore.getState().createSession("Session 2");

      // session2 is current
      useChatStore.getState().deleteSession(session2.id);

      expect(useChatStore.getState().currentSessionId).toBe(session1.id);
    });

    it("sets currentSessionId to null when deleting the only session", () => {
      const session = useChatStore.getState().createSession();

      useChatStore.getState().deleteSession(session.id);

      expect(useChatStore.getState().currentSessionId).toBeNull();
    });

    it("does not change currentSessionId when deleting a non-current session", () => {
      const session1 = useChatStore.getState().createSession("Session 1");
      useChatStore.getState().createSession("Session 2");

      useChatStore.getState().deleteSession(session1.id);

      expect(useChatStore.getState().sessions).toHaveLength(1);
      // currentSessionId should still be session2
      expect(useChatStore.getState().currentSessionId).not.toBe(session1.id);
    });
  });

  describe("getCurrentSession", () => {
    it("returns the current session when one exists", () => {
      const session = useChatStore.getState().createSession("Test");

      const current = useChatStore.getState().getCurrentSession();

      expect(current).toEqual(session);
    });

    it("returns null when no current session is set", () => {
      useChatStore.setState({ currentSessionId: null });

      const current = useChatStore.getState().getCurrentSession();

      expect(current).toBeNull();
    });

    it("returns null when currentSessionId points to non-existent session", () => {
      useChatStore.setState({ currentSessionId: "non-existent-id" });

      const current = useChatStore.getState().getCurrentSession();

      expect(current).toBeNull();
    });
  });

  describe("connection state", () => {
    it("setIsConnected updates isConnected state", () => {
      expect(useChatStore.getState().isConnected).toBe(false);

      useChatStore.getState().setIsConnected(true);
      expect(useChatStore.getState().isConnected).toBe(true);

      useChatStore.getState().setIsConnected(false);
      expect(useChatStore.getState().isConnected).toBe(false);
    });

    it("setIsStreaming updates isStreaming state", () => {
      expect(useChatStore.getState().isStreaming).toBe(false);

      useChatStore.getState().setIsStreaming(true);
      expect(useChatStore.getState().isStreaming).toBe(true);

      useChatStore.getState().setIsStreaming(false);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it("setConnectionStatus updates connectionStatus and isConnected states", () => {
      expect(useChatStore.getState().connectionStatus).toBe("disconnected");
      expect(useChatStore.getState().isConnected).toBe(false);

      useChatStore.getState().setConnectionStatus("connecting");
      expect(useChatStore.getState().connectionStatus).toBe("connecting");
      expect(useChatStore.getState().isConnected).toBe(false);

      useChatStore.getState().setConnectionStatus("connected");
      expect(useChatStore.getState().connectionStatus).toBe("connected");
      expect(useChatStore.getState().isConnected).toBe(true);

      useChatStore.getState().setConnectionStatus("disconnected");
      expect(useChatStore.getState().connectionStatus).toBe("disconnected");
      expect(useChatStore.getState().isConnected).toBe(false);
    });
  });

  describe("createSession report clearing", () => {
    beforeEach(() => {
      // Reset report store state
      useReportStore.setState({
        reports: [],
        currentReportId: null,
        isManuallySelected: false,
        isGeneratingReport: false,
      });
    });

    it("clears currentReportId when creating a new session and report is not manually selected", () => {
      // Create a report and set it as current (not manually)
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report content" },
      });
      expect(useReportStore.getState().currentReportId).toBe(report.id);
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      // Create a new session
      useChatStore.getState().createSession("New Session");

      // currentReportId should be cleared
      expect(useReportStore.getState().currentReportId).toBeNull();
    });

    it("preserves currentReportId when creating a new session and report is manually selected", () => {
      // Create a report
      const report = useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report content" },
      });

      // Manually select the report
      useReportStore.getState().setCurrentReportManual(report.id);
      expect(useReportStore.getState().currentReportId).toBe(report.id);
      expect(useReportStore.getState().isManuallySelected).toBe(true);

      // Create a new session
      useChatStore.getState().createSession("New Session");

      // currentReportId should be preserved
      expect(useReportStore.getState().currentReportId).toBe(report.id);
      expect(useReportStore.getState().isManuallySelected).toBe(true);
    });

    it("clears currentReportId when no manual selection even with multiple reports", () => {
      // Create multiple reports
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report 1" },
      });
      const report2 = useReportStore.getState().setReport({
        sessionId: "session-2",
        content: { type: "text", text: "Report 2" },
      });

      expect(useReportStore.getState().reports).toHaveLength(2);
      expect(useReportStore.getState().currentReportId).toBe(report2.id);
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      // Create a new session
      useChatStore.getState().createSession("New Session");

      // currentReportId should be cleared, but reports should remain
      expect(useReportStore.getState().currentReportId).toBeNull();
      expect(useReportStore.getState().reports).toHaveLength(2);
    });

    it("does not affect isManuallySelected flag when clearing report", () => {
      // Create a report (not manually selected)
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report content" },
      });
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      // Create a new session
      useChatStore.getState().createSession("New Session");

      // isManuallySelected should still be false
      expect(useReportStore.getState().isManuallySelected).toBe(false);
    });

    it("does not clear currentReportId when it is already null", () => {
      // Ensure no report is set
      expect(useReportStore.getState().currentReportId).toBeNull();
      expect(useReportStore.getState().isManuallySelected).toBe(false);

      // Create a new session
      useChatStore.getState().createSession("New Session");

      // currentReportId should still be null
      expect(useReportStore.getState().currentReportId).toBeNull();
    });

    it("creates the session correctly regardless of report clearing behavior", () => {
      // Create a report
      useReportStore.getState().setReport({
        sessionId: "session-1",
        content: { type: "text", text: "Report content" },
      });

      // Create a new session
      const session = useChatStore.getState().createSession("New Session");

      // Session should be created correctly
      expect(session.id).toBeDefined();
      expect(session.title).toBe("New Session");
      expect(session.messages).toEqual([]);
      expect(useChatStore.getState().currentSessionId).toBe(session.id);
    });
  });
});
