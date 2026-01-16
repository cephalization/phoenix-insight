# Phoenix Insight UI

Web-based user interface for the Phoenix Insight CLI.

> **Note**: This package is private and bundled with the CLI. It is not published to npm separately.

## Overview

The UI provides a visual interface for interacting with the Phoenix Insight agent:

- **Split-pane layout**: Chat interface on the left, report display on the right
- **Real-time streaming**: See agent responses as they're generated
- **Structured reports**: AI-generated reports with tables, metrics, and formatted content
- **Session management**: Persist and switch between conversations
- **Offline persistence**: Sessions and reports saved to IndexedDB

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start development server
pnpm --filter @cephalization/phoenix-insight-ui dev

# Run tests
pnpm --filter @cephalization/phoenix-insight-ui test

# Build for production
pnpm --filter @cephalization/phoenix-insight-ui build

# Type check
pnpm --filter @cephalization/phoenix-insight-ui typecheck
```

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/               # shadcn/ui base components
│   ├── ChatMessage.tsx   # Individual chat message
│   ├── ChatInput.tsx     # Message input with send/cancel
│   ├── ChatPanel.tsx     # Complete chat interface
│   ├── ReportRenderer.tsx    # json-render based report display
│   ├── ReportPanel.tsx   # Report panel with toolbar
│   ├── ReportHistoryDialog.tsx
│   ├── ConnectionStatusIndicator.tsx
│   └── ErrorBoundary.tsx
├── hooks/                # Custom React hooks
│   ├── useWebSocket.ts   # WebSocket connection management
│   └── useMediaQuery.ts  # Responsive breakpoint detection
├── lib/                  # Utilities
│   ├── db.ts             # IndexedDB persistence
│   ├── websocket.ts      # WebSocket client (partysocket)
│   ├── json-render/      # Report rendering
│   │   ├── catalog.ts    # Component schema definitions
│   │   └── registry.tsx  # shadcn component mappings
│   └── utils.ts          # cn() and other helpers
├── store/                # Zustand state management
│   ├── chat.ts           # Chat sessions and messages
│   └── report.ts         # Report state
├── App.tsx               # Main app layout
├── main.tsx              # Entry point
└── index.css             # Tailwind styles
```

## Key Dependencies

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling
- **shadcn/ui**: Component library (Radix-based)
- **Zustand**: State management
- **idb**: IndexedDB wrapper for persistence
- **partysocket**: WebSocket with auto-reconnect
- **streamdown**: Streaming-optimized markdown rendering
- **json-render**: Structured UI rendering from JSON

## Architecture

### State Management

Two Zustand stores manage application state:

- `chat.ts`: Sessions, messages, connection status, streaming state
- `report.ts`: Reports, current report ID, report history

Both stores persist to IndexedDB via `db.ts` subscriptions.

### WebSocket Communication

The UI communicates with the CLI server over WebSocket:

1. **Connection**: `useWebSocket` hook manages connection lifecycle
2. **Messages**: Typed client/server messages in `websocket.ts`
3. **Reconnection**: partysocket handles automatic reconnection with backoff

### Report Rendering

Reports use [json-render](https://github.com/vercel-labs/json-render):

1. Agent calls `generate_report` tool with UITree structure
2. CLI sends report over WebSocket
3. `ReportRenderer` uses json-render with shadcn component registry
4. Components: Card, Text, Heading, List, Table, Metric, Badge, Alert, Separator, Code

## Testing

Tests are in `src/**/*.test.ts` (colocated with source):

```bash
# Run all UI tests
pnpm --filter @cephalization/phoenix-insight-ui test

# Watch mode
pnpm --filter @cephalization/phoenix-insight-ui test -- --watch
```

The test setup includes:
- jsdom environment
- @testing-library/react for component tests
- @testing-library/jest-dom for DOM matchers
- fake-indexeddb for IndexedDB mocking

## Building for CLI

When the CLI is built, the UI dist is copied into the CLI package:

1. `pnpm build` triggers UI build first (pnpm workspace dependency order)
2. CLI's build copies `packages/ui/dist/` to `packages/cli/dist/ui/`
3. CLI's HTTP server serves these files when `phoenix-insight ui` runs

## Browser Support

The UI targets modern browsers with ES2020+ support:
- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

IndexedDB and WebSocket are required for full functionality.
