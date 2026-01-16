/**
 * Report Tool for Phoenix Insight AI Agent
 *
 * AI SDK tool that allows the agent to update the UI report panel.
 * The agent calls `generate_report` with a title and JSON-Render tree content,
 * which is validated against the catalog schema and broadcast to the UI client.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ReportCallback } from "../server/session.js";

// ============================================================================
// JSON-Render Schema Definitions
// ============================================================================

/**
 * Card component - container for grouping related content
 */
const CardPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Chart component - displays a chart from array data
 */
const ChartPropsSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area"]),
  dataPath: z.string(),
  title: z.string().nullable(),
  height: z.number().nullable(),
});

/**
 * Text component - for paragraphs and inline text
 */
const TextPropsSchema = z.object({
  content: z.string(),
  variant: z.enum(["default", "muted", "lead"]).optional(),
});

/**
 * Heading component - for section headers (h1-h6)
 */
const HeadingPropsSchema = z.object({
  content: z.string(),
  level: z.enum(["1", "2", "3", "4", "5", "6"]).optional(),
});

/**
 * List component - ordered and unordered lists
 */
const ListPropsSchema = z.object({
  items: z.array(z.string()),
  ordered: z.boolean().optional(),
});

/**
 * Table component - tabular data display
 */
const TablePropsSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
});

/**
 * Metric component - displays a key metric value
 */
const MetricPropsSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changeType: z.enum(["positive", "negative", "neutral"]).optional(),
});

/**
 * Badge component - inline status or category indicator
 */
const BadgePropsSchema = z.object({
  content: z.string(),
  variant: z
    .enum(["default", "secondary", "destructive", "outline"])
    .optional(),
});

/**
 * Alert component - important messages or warnings
 */
const AlertPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string(),
  variant: z.enum(["default", "destructive"]).optional(),
});

/**
 * Separator component - visual divider
 */
const SeparatorPropsSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]).optional(),
});

/**
 * Code component - code blocks with syntax highlighting
 */
const CodePropsSchema = z.object({
  content: z.string(),
  language: z.string().optional(),
});

/**
 * UIElement schema - a single element in the render tree
 */
const UIElementSchema = z.object({
  key: z.string(),
  type: z.enum([
    "Card",
    "Text",
    "Heading",
    "List",
    "Table",
    "Metric",
    "Badge",
    "Alert",
    "Separator",
    "Code",
  ]),
  props: z.record(z.string(), z.unknown()),
  children: z.array(z.string()).optional(),
  parentKey: z.string().optional(),
});

/**
 * UITree schema - the full JSON-Render tree structure
 */
const UITreeSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), UIElementSchema),
});

/**
 * Inferred UIElement type
 */
type UIElement = z.infer<typeof UIElementSchema>;

/**
 * Inferred UITree type
 */
type UITree = z.infer<typeof UITreeSchema>;

// ============================================================================
// Report Tool Types
// ============================================================================

/**
 * Report tool input type
 */
export interface ReportToolInput {
  title?: string;
  content: UITree;
}

/**
 * Report tool result type
 */
export interface ReportToolResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Valid component types
 */
const VALID_COMPONENT_TYPES = [
  "Card",
  "Chart",
  "Text",
  "Heading",
  "List",
  "Table",
  "Metric",
  "Badge",
  "Alert",
  "Separator",
  "Code",
] as const;

type ComponentType = (typeof VALID_COMPONENT_TYPES)[number];

/**
 * Get the props schema for a specific component type
 */
function getPropsSchemaForType(
  type: ComponentType
): z.ZodType<Record<string, unknown>> {
  switch (type) {
    case "Card":
      return CardPropsSchema;
    case "Chart":
      return ChartPropsSchema;
    case "Text":
      return TextPropsSchema;
    case "Heading":
      return HeadingPropsSchema;
    case "List":
      return ListPropsSchema;
    case "Table":
      return TablePropsSchema;
    case "Metric":
      return MetricPropsSchema;
    case "Badge":
      return BadgePropsSchema;
    case "Alert":
      return AlertPropsSchema;
    case "Separator":
      return SeparatorPropsSchema;
    case "Code":
      return CodePropsSchema;
  }
}

/**
 * Validate a UITree content against the json-render catalog schema
 * Returns an object with success status and optional error message
 */
export function validateReportContent(content: unknown): {
  success: boolean;
  error?: string;
} {
  // First, validate the tree structure
  const treeResult = UITreeSchema.safeParse(content);
  if (!treeResult.success) {
    return {
      success: false,
      error: `Invalid tree structure: ${treeResult.error.message}`,
    };
  }

  const tree = treeResult.data;

  // Verify root element exists
  if (!tree.elements[tree.root]) {
    return {
      success: false,
      error: `Root element "${tree.root}" not found in elements`,
    };
  }

  // Validate each element's props against its component schema
  for (const [key, element] of Object.entries(tree.elements)) {
    const type = element.type as ComponentType;

    if (!VALID_COMPONENT_TYPES.includes(type)) {
      return {
        success: false,
        error: `Unknown component type "${type}" for element "${key}"`,
      };
    }

    const propsSchema = getPropsSchemaForType(type);
    const propsResult = propsSchema.safeParse(element.props);

    if (!propsResult.success) {
      return {
        success: false,
        error: `Invalid props for ${type} element "${key}": ${propsResult.error.message}`,
      };
    }

    // Validate children references if present
    if (element.children) {
      for (const childKey of element.children) {
        if (!tree.elements[childKey]) {
          return {
            success: false,
            error: `Child element "${childKey}" not found for parent "${key}"`,
          };
        }
      }
    }

    // Validate parent reference if present
    if (element.parentKey && !tree.elements[element.parentKey]) {
      return {
        success: false,
        error: `Parent element "${element.parentKey}" not found for element "${key}"`,
      };
    }
  }

  return { success: true };
}

// ============================================================================
// Report Tool Factory
// ============================================================================

/**
 * Create the generate_report tool for the AI agent
 *
 * @param broadcast - Callback function to send report updates to the WebSocket client
 * @returns AI SDK tool definition for generate_report
 */
export function createReportTool(broadcast: ReportCallback) {
  return tool({
    description: `Generate or update a structured report that will be displayed in the UI report panel. 
The report uses a JSON-Render tree format with the following component types:
- Chart: Displays a chart from array data (props: type: "bar" | "line" | "pie" | "area", dataPath: string, title?: string, height?: number)
- Card: Container for grouping content (props: title?, description?; can have children)
- Text: Paragraph text (props: content, variant?: "default" | "muted" | "lead")
- Heading: Section header (props: content, level?: "1"-"6")
- List: Bullet or numbered list (props: items: string[], ordered?: boolean)
- Table: Data table (props: headers: string[], rows: string[][], caption?)
- Metric: Key value display (props: label, value, change?, changeType?: "positive" | "negative" | "neutral")
- Badge: Status indicator (props: content, variant?: "default" | "secondary" | "destructive" | "outline")
- Alert: Important message (props: title?, description, variant?: "default" | "destructive")
- Separator: Visual divider (props: orientation?: "horizontal" | "vertical")
- Code: Code block (props: content, language?)

The tree structure has a 'root' key pointing to the root element and an 'elements' map of all elements.
Each element has: key (unique id), type (component type), props (component-specific), children? (array of child keys).

Use this tool when you want to present structured analysis results, metrics, tables, or formatted reports to the user.`,
    inputSchema: z.object({
      title: z
        .string()
        .optional()
        .describe("Optional title for the report displayed in the header"),
      content: UITreeSchema.describe("The JSON-Render tree structure"),
    }),
    execute: async (params: {
      title?: string;
      content: UITree;
    }): Promise<ReportToolResult> => {
      const { title, content } = params;

      // Validate content against catalog schema
      const validation = validateReportContent(content);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Broadcast the report to the WebSocket client
      try {
        broadcast(content, title);
        return {
          success: true,
          message: title
            ? `Report "${title}" generated successfully`
            : "Report generated successfully",
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to broadcast report: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },
  });
}
