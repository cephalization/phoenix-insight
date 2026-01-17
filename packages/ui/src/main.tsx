import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import {
  initializeChatStore,
  subscribeToChatPersistence,
} from "./store/chat.ts";
import {
  initializeReportStore,
  subscribeToReportPersistence,
} from "./store/report.ts";

// Initialize stores from IndexedDB before rendering
async function initialize() {
  try {
    // Load persisted data
    await Promise.all([initializeChatStore(), initializeReportStore()]);

    // Subscribe to changes for persistence
    subscribeToChatPersistence();
    subscribeToReportPersistence();
  } catch (error) {
    console.error("Failed to initialize stores:", error);
  }
}

// Initialize and render
initialize()
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  })
  .catch((error) => {
    document.getElementById(
      "root"
    )!.innerHTML = `<div>Failed to initialize: ${error}</div>`;
  });
