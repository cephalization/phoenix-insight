import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ChatSession } from "@/store/chat";
import type { Report, JSONRenderTree } from "@/store/report";

// Database schema definition
interface PhoenixInsightDB extends DBSchema {
  sessions: {
    key: string;
    value: ChatSession;
  };
  reports: {
    key: string;
    value: Report;
    indexes: {
      sessionId: string;
    };
  };
}

const DB_NAME = "phoenix-insight-ui";
const DB_VERSION = 1;

// Database instance cache
let dbPromise: Promise<IDBPDatabase<PhoenixInsightDB>> | null = null;

/**
 * Get or create the database connection
 */
export async function getDB(): Promise<IDBPDatabase<PhoenixInsightDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PhoenixInsightDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create sessions object store
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }

        // Create reports object store with sessionId index
        if (!db.objectStoreNames.contains("reports")) {
          const reportStore = db.createObjectStore("reports", { keyPath: "id" });
          reportStore.createIndex("sessionId", "sessionId", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================
// Session Functions
// ============================================

/**
 * Save a chat session to IndexedDB
 */
export async function saveSession(session: ChatSession): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

/**
 * Load all chat sessions from IndexedDB
 */
export async function loadSessions(): Promise<ChatSession[]> {
  const db = await getDB();
  return db.getAll("sessions");
}

/**
 * Delete a chat session from IndexedDB
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete("sessions", sessionId);
}

// ============================================
// Report Functions
// ============================================

/**
 * Save a report to IndexedDB
 */
export async function saveReport(report: Report): Promise<void> {
  const db = await getDB();
  await db.put("reports", report);
}

/**
 * Load all reports from IndexedDB
 */
export async function loadReports(): Promise<Report[]> {
  const db = await getDB();
  return db.getAll("reports");
}

/**
 * Delete a report from IndexedDB
 */
export async function deleteReport(reportId: string): Promise<void> {
  const db = await getDB();
  await db.delete("reports", reportId);
}

/**
 * Get a report by session ID
 */
export async function getReportBySessionId(sessionId: string): Promise<Report | undefined> {
  const db = await getDB();
  const reports = await db.getAllFromIndex("reports", "sessionId", sessionId);
  return reports[0];
}

// ============================================
// Export Functions
// ============================================

/**
 * Convert JSONRenderTree content to markdown string
 * This recursively processes the json-render tree structure
 */
function jsonRenderTreeToMarkdown(node: JSONRenderTree, depth: number = 0): string {
  if (!node || typeof node !== "object") {
    return String(node ?? "");
  }

  const type = node.type as string | undefined;
  const props = (node.props as Record<string, unknown>) ?? {};
  const children = node.children as JSONRenderTree[] | string | undefined;

  // Process children recursively
  const processChildren = (): string => {
    if (!children) return "";
    if (typeof children === "string") return children;
    if (Array.isArray(children)) {
      return children.map((child) => jsonRenderTreeToMarkdown(child, depth)).join("");
    }
    return "";
  };

  switch (type) {
    case "Heading": {
      const level = (props.level as number) ?? 1;
      const prefix = "#".repeat(Math.min(Math.max(level, 1), 6));
      return `${prefix} ${processChildren()}\n\n`;
    }

    case "Text":
      return `${processChildren()}\n\n`;

    case "Card": {
      const title = props.title as string | undefined;
      let result = "";
      if (title) {
        result += `### ${title}\n\n`;
      }
      result += `${processChildren()}\n`;
      return result;
    }

    case "List": {
      const ordered = props.ordered as boolean | undefined;
      const items = children as JSONRenderTree[] | undefined;
      if (!items || !Array.isArray(items)) return "";

      return (
        items
          .map((item, index) => {
            const prefix = ordered ? `${index + 1}.` : "-";
            const content = jsonRenderTreeToMarkdown(item, depth + 1).trim();
            return `${prefix} ${content}`;
          })
          .join("\n") + "\n\n"
      );
    }

    case "Table": {
      const headers = props.headers as string[] | undefined;
      const rows = props.rows as string[][] | undefined;

      if (!headers || !rows) return "";

      // Create markdown table
      let result = `| ${headers.join(" | ")} |\n`;
      result += `| ${headers.map(() => "---").join(" | ")} |\n`;
      for (const row of rows) {
        result += `| ${row.join(" | ")} |\n`;
      }
      return result + "\n";
    }

    case "Metric": {
      const label = props.label as string | undefined;
      const value = props.value as string | number | undefined;
      const description = props.description as string | undefined;

      let result = "";
      if (label) {
        result += `**${label}**: ${value ?? "N/A"}`;
        if (description) {
          result += ` - ${description}`;
        }
        result += "\n\n";
      }
      return result;
    }

    case "Badge": {
      const variant = props.variant as string | undefined;
      const content = processChildren();
      return `\`${content}\`${variant ? ` (${variant})` : ""} `;
    }

    case "Alert": {
      const title = props.title as string | undefined;
      const variant = props.variant as string | undefined;

      let prefix = ">";
      if (variant === "destructive") prefix = "> ⚠️";
      else if (variant === "warning") prefix = "> ⚡";

      let result = "";
      if (title) {
        result += `${prefix} **${title}**\n`;
      }
      const content = processChildren();
      if (content) {
        result += `${prefix} ${content.trim()}\n`;
      }
      return result + "\n";
    }

    case "Separator":
      return "---\n\n";

    case "Code": {
      const language = props.language as string | undefined;
      const content = processChildren();
      return `\`\`\`${language ?? ""}\n${content}\n\`\`\`\n\n`;
    }

    default:
      // For unknown types or plain objects, just process children
      return processChildren();
  }
}

/**
 * Export a report as markdown string
 */
export function exportReportAsMarkdown(report: Report): string {
  const parts: string[] = [];

  // Add title if present
  if (report.title) {
    parts.push(`# ${report.title}\n\n`);
  }

  // Convert content to markdown
  const contentMarkdown = jsonRenderTreeToMarkdown(report.content);
  parts.push(contentMarkdown);

  // Add metadata footer
  parts.push("\n---\n\n");
  parts.push(`*Generated: ${new Date(report.createdAt).toLocaleString()}*\n`);
  parts.push(`*Session ID: ${report.sessionId}*\n`);

  return parts.join("");
}

// ============================================
// Database Management
// ============================================

/**
 * Clear the database connection (useful for testing)
 */
export function clearDBConnection(): void {
  dbPromise = null;
}

/**
 * Clear all data from the database (useful for testing)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sessions", "reports"], "readwrite");
  await Promise.all([
    tx.objectStore("sessions").clear(),
    tx.objectStore("reports").clear(),
    tx.done,
  ]);
}
