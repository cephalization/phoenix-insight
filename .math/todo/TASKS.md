# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Monorepo Restructuring

### monorepo-init

- content: Initialize pnpm workspace at repo root. Create `pnpm-workspace.yaml` with `packages/*` glob. Move shared devDependencies (rimraf, typescript, vitest, tsx, @types/node) to root `package.json`. Create root scripts for `clean`, `build`, `test`, and `typecheck` that run across all packages using `pnpm -r`. Update `.gitignore` for monorepo structure. Ensure pnpm@9.15.0 is used.
- status: complete
- dependencies: none

### move-cli-package

- content: Use `git mv` to move all CLI files from repo root to `packages/cli/`. This includes: `src/`, `test/`, `package.json`, `tsconfig.json`, `tsconfig.esm.json`, `README.md`, and `.changeset/`. Update `package.json` paths. Update import paths if needed. Ensure the package name stays `@cephalization/phoenix-insight`. Verify `pnpm install` works and `pnpm -r test` passes.
- status: complete
- dependencies: monorepo-init

---

## Phase 2: UI Package Scaffolding

### scaffold-ui-package

- content: Create `packages/ui/` directory. Scaffold a new Vite React app using `pnpm create vite packages/ui --template react-ts`. Configure `package.json` with name `@cephalization/phoenix-insight-ui`, set `"private": true`. Add Tailwind CSS via `@tailwindcss/vite` plugin. Configure tsconfig with path alias `@/*` pointing to `./src/*`. Update `vite.config.ts` with react and tailwindcss plugins and path resolution. Create `src/index.css` with `@import "tailwindcss"`. Verify `pnpm dev` starts the Vite dev server.
- status: complete
- dependencies: move-cli-package

### setup-shadcn-ui

- content: Initialize shadcn/ui in `packages/ui/` using `pnpm dlx shadcn@latest init`. Choose Neutral as base color. Install essential components: button, card, input, scroll-area, separator, resizable, tabs, dialog, dropdown-menu, alert, badge, skeleton, sonner (toast). Verify components render correctly by creating a simple test in `App.tsx`.
- status: complete
- dependencies: scaffold-ui-package

---

## Phase 3: UI Core Architecture

### ui-app-layout

- content: Create the main app layout in `packages/ui/src/App.tsx`. Implement a responsive split-pane view using shadcn's `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle` components. Left panel (min 30%) is for chat interface, right panel (min 30%) is for report display. Include a header with app title. Use CSS to make layout full viewport height. Export `App` as default.
- status: complete
- dependencies: setup-shadcn-ui

### ui-chat-store

- content: Create a Zustand store in `packages/ui/src/store/chat.ts` for chat state management. Define types: `Message { id, role: 'user' | 'assistant', content, timestamp }`, `ChatSession { id, messages, createdAt, title? }`. Store state: `sessions`, `currentSessionId`, `isConnected`, `isStreaming`. Actions: `addMessage`, `createSession`, `setCurrentSession`, `clearSession`. Add `packages/ui` devDependency on `zustand`. Write unit tests in `packages/ui/src/store/chat.test.ts`.
- status: complete
- dependencies: setup-shadcn-ui

### ui-report-store

- content: Create a Zustand store in `packages/ui/src/store/report.ts` for report state management. Define types: `Report { id, sessionId, content: JSONRenderTree, createdAt, title? }`. Store state: `reports`, `currentReportId`. Actions: `setReport` (replaces current report, caches previous), `getReportBySession`, `deleteReport`, `listReports`. Write unit tests in `packages/ui/src/store/report.test.ts`.
- status: complete
- dependencies: setup-shadcn-ui

### ui-indexeddb-persistence

- content: Create IndexedDB persistence layer in `packages/ui/src/lib/db.ts` using `idb` library. Add `idb` as dependency. Create database `phoenix-insight-ui` with object stores: `sessions` (keyPath: id), `reports` (keyPath: id, index: sessionId). Implement functions: `saveSession`, `loadSessions`, `deleteSession`, `saveReport`, `loadReports`, `deleteReport`, `exportReportAsMarkdown`. Integrate with chat and report stores via `persist` middleware or manual sync. Write unit tests.
- status: complete
- dependencies: ui-chat-store, ui-report-store

---

## Phase 4: WebSocket Communication

### ui-websocket-client

- content: Create WebSocket client in `packages/ui/src/lib/websocket.ts` using `partysocket` for robust connection management. Add `partysocket` as dependency to `packages/ui/`. Define message types: `ClientMessage { type: 'query' | 'cancel', payload }`, `ServerMessage { type: 'text' | 'tool_call' | 'tool_result' | 'report' | 'error' | 'done', payload }`. Wrap partysocket's `WebSocket` class which provides automatic reconnection with exponential backoff, message buffering during disconnection, and connection timeout handling. Export typed wrapper with: `connect(url)`, `disconnect()`, `send(message)`, `onMessage(handler)`, `onError(handler)`, `onClose(handler)`. Write unit tests with mock WebSocket.
- status: complete
- dependencies: scaffold-ui-package

### ui-websocket-hook

- content: Create React hook `packages/ui/src/hooks/useWebSocket.ts` that wraps WebSocketClient. Hook returns: `{ isConnected, isStreaming, sendQuery, cancel }`. Integrate with chat store to append streamed messages. Integrate with report store to update report when `report` message received. Handle connection lifecycle with React useEffect. Write unit tests.
- status: complete
- dependencies: ui-websocket-client, ui-chat-store, ui-report-store

---

## Phase 5: Chat Interface

### ui-chat-message-component

- content: Create `packages/ui/src/components/ChatMessage.tsx`. Display message with role indicator (user/assistant), timestamp, and content. User messages aligned right with different background. Assistant messages aligned left. Support markdown rendering using `streamdown` (add as dependency) which is optimized for AI streaming - handles incomplete/unterminated markdown blocks gracefully. Configure streamdown with Tailwind styles via `@source` directive in globals.css. Show streaming indicator for in-progress messages. Style with Tailwind, use shadcn patterns.
- status: complete
- dependencies: ui-app-layout

### ui-chat-input-component

- content: Create `packages/ui/src/components/ChatInput.tsx`. Textarea input with send button. Support Enter to send (Shift+Enter for newline). Disable input when streaming or disconnected. Show connection status indicator. Use shadcn Button, Textarea (or Input if no Textarea - may need to add). Include cancel button visible during streaming.
- status: complete
- dependencies: ui-app-layout

### ui-chat-panel

- content: Create `packages/ui/src/components/ChatPanel.tsx`. Compose ChatMessage list and ChatInput. Use shadcn ScrollArea for message container. Auto-scroll to bottom on new messages. Show empty state when no messages. Integrate with chat store and websocket hook. Display session history dropdown using shadcn DropdownMenu.
- status: complete
- dependencies: ui-chat-message-component, ui-chat-input-component, ui-websocket-hook

---

## Phase 6: JSON-Render Integration

### setup-json-render

- content: Add `@json-render/core` and `@json-render/react` as dependencies to `packages/ui/`. Create a catalog in `packages/ui/src/lib/json-render/catalog.ts` that defines allowed components. Initial components: Card, Text, Heading, List, Table, Metric, Badge, Alert, Separator, Code. Use zod schemas for props validation. Export the catalog.
- status: complete
- dependencies: setup-shadcn-ui

### json-render-shadcn-registry

- content: Create component registry in `packages/ui/src/lib/json-render/registry.tsx` that maps json-render component types to shadcn implementations. Map: Card→shadcn Card, Text→Typography p, Heading→Typography h1-h6, List→ul/ol with styling, Table→shadcn Table, Metric→custom Card with value display, Badge→shadcn Badge, Alert→shadcn Alert, Separator→shadcn Separator, Code→styled pre/code. Export registry object.
- status: complete
- dependencies: setup-json-render

### ui-report-renderer

- content: Create `packages/ui/src/components/ReportRenderer.tsx`. Import json-render Renderer, DataProvider, catalog, and registry. Accept `report` prop (JSONRenderTree or null). Render report using json-render Renderer with shadcn components. Show empty state when no report. Show loading skeleton when report is streaming. Write component tests.
- status: complete
- dependencies: json-render-shadcn-registry, ui-report-store

---

## Phase 7: Report Panel

### ui-report-panel

- content: Create `packages/ui/src/components/ReportPanel.tsx`. Compose ReportRenderer with header toolbar. Toolbar includes: report title, download button (exports as markdown), history button (shows previous reports in dialog). Use shadcn Dialog for history view, Button for actions. Integrate with report store. Show list of cached reports with delete option.
- status: complete
- dependencies: ui-report-renderer, ui-indexeddb-persistence

### ui-report-history-dialog

- content: Create `packages/ui/src/components/ReportHistoryDialog.tsx`. Modal dialog showing list of previous reports. Each item shows: title/id, creation date, associated session. Actions per item: view, delete, download as markdown. Use shadcn Dialog, ScrollArea, Button. Integrate with report store and IndexedDB.
- status: complete
- dependencies: ui-report-panel

---

## Phase 8: CLI WebSocket Server

### cli-ws-server

- content: Add `ws` package as dependency to `packages/cli/`. Create `packages/cli/src/server/websocket.ts`. Implement WebSocket server that: binds to localhost only, handles upgrade requests, manages client connections, broadcasts messages. Define server message protocol matching UI client types. Export `createWebSocketServer(httpServer)` function. Write unit tests.
- status: complete
- dependencies: move-cli-package

### cli-ui-server

- content: Create `packages/cli/src/server/ui.ts`. Implement HTTP server using Node's `http` module that serves static files from `@cephalization/phoenix-insight-ui` dist directory. Add `@cephalization/phoenix-insight-ui` as dependency to CLI package. Resolve dist path using `require.resolve` or import.meta. Serve `index.html` for all non-asset routes (SPA fallback). Export `createUIServer(port)` function.
- status: complete
- dependencies: cli-ws-server, ui-app-layout

### cli-agent-session

- content: Create `packages/cli/src/server/session.ts`. Implement `AgentSession` class that manages a single WebSocket client's agent interaction. Reuse existing agent creation logic from cli.ts. Handle: query execution, streaming responses to client, tool call notifications, report generation via new tool. Maintain conversation history within session. Write unit tests.
- status: complete
- dependencies: cli-ws-server

### cli-report-tool

- content: Create `packages/cli/src/commands/report-tool.ts`. Implement AI SDK tool `generate_report` that the agent can call to update the UI report. Tool input schema: `{ title?: string, content: JSONRenderTree }`. Tool validates content against json-render catalog schema. Tool broadcasts report update to WebSocket client. Export tool factory that accepts broadcast function. Write unit tests.
- status: complete
- dependencies: cli-agent-session, setup-json-render

---

## Phase 9: CLI UI Command

### cli-ui-command

- content: Add `ui` subcommand to `packages/cli/src/cli.ts`. Command starts HTTP server on localhost:6007, attaches WebSocket server, opens browser (optional --no-open flag). Reuse config loading. Display startup message with URL. Handle graceful shutdown on SIGINT/SIGTERM. Update CLI help text and README.md with new command documentation.
- status: complete
- dependencies: cli-ui-server, cli-agent-session, cli-report-tool

### cli-ui-integration

- content: Wire up all server components in UI command. Create agent session on WebSocket connection. Route incoming queries to agent. Stream text chunks, tool calls, tool results back to client. Send report tool outputs as report messages. Handle client disconnect (cleanup session). Test end-to-end with manual verification.
- status: complete
- dependencies: cli-ui-command

---

## Phase 10: UI Polish & Integration

### ui-responsive-design

- content: Ensure UI is fully responsive. On mobile (< 768px), stack panels vertically with tabs to switch between chat and report. Use CSS media queries or Tailwind responsive utilities. Test at various breakpoints. Ensure touch-friendly tap targets. Add shadcn Tabs component for mobile panel switching.
- status: pending
- dependencies: ui-chat-panel, ui-report-panel

### ui-connection-status

- content: Add connection status indicator to UI header. Show: connected (green), connecting (yellow), disconnected (red). Auto-reconnect on disconnect with visual feedback. Show toast notification on connection state changes using shadcn Sonner. Disable chat input when disconnected.
- status: pending
- dependencies: ui-websocket-hook, ui-chat-panel

### ui-error-handling

- content: Implement comprehensive error handling in UI. Show toast for WebSocket errors. Display inline error messages for failed queries. Handle JSON parse errors gracefully. Add error boundary component wrapping main app. Show user-friendly messages, not stack traces.
- status: pending
- dependencies: ui-connection-status

---

## Phase 11: Build & Distribution

### ui-build-config

- content: Configure `packages/ui/vite.config.ts` for production build. Set `base: './'` for relative asset paths. Configure output to `dist/`. Ensure assets are properly chunked. Add build script to package.json. Verify `pnpm build` produces working static bundle that can be served.
- status: pending
- dependencies: ui-responsive-design, ui-error-handling

### cli-bundle-ui

- content: Update `packages/cli/package.json` to include `@cephalization/phoenix-insight-ui` as dependency. Ensure UI package builds before CLI package. Update CLI build script to verify UI dist exists. Add `files` array to include correct paths for npm publish. Test that `pnpm -r build` builds both packages in correct order.
- status: pending
- dependencies: ui-build-config, cli-ui-integration

### update-ci-workflows

- content: Update `.github/workflows/ci.yml` to handle monorepo structure. Run tests for all packages. Build all packages. Add caching for pnpm store. Update release workflow if needed for publishing CLI package only. Ensure workflows use `pnpm -r` commands.
- status: pending
- dependencies: cli-bundle-ui

---

## Phase 12: Testing & Documentation

### setup-ui-testing

- content: Add `agent-browser` as a workspace-level devDependency in root `package.json`. Create a `test:ui` script in root `package.json` that builds the UI, starts the CLI server, and runs UI integration tests. This script is for manual invocation only (not CI) since it requires a live Phoenix server on localhost:6006. Create `test/ui-integration.test.ts` at workspace root with basic test structure that uses agent-browser to: navigate to localhost:6007, verify layout renders, test sending a message, verify report panel updates. Document in README that `pnpm test:ui` requires Phoenix running.
- status: pending
- dependencies: cli-ui-integration

### update-documentation

- content: Update `packages/cli/README.md` with: new `ui` command documentation, WebSocket protocol description, UI features overview. Add screenshots if possible. Document configuration options. Update root README.md with monorepo structure explanation and links to package READMEs. Document `pnpm test:ui` manual testing workflow and requirement for live Phoenix server.
- status: pending
- dependencies: setup-ui-testing

### final-verification

- content: Final end-to-end verification. Start Phoenix on localhost:6006. Run `phoenix-insight ui`. Verify: server starts on 6007, UI loads, WebSocket connects, can send queries, responses stream, report tool works, report displays, history persists across refresh, can download report as markdown. Document any issues in LEARNINGS.md.
- status: pending
- dependencies: update-documentation
