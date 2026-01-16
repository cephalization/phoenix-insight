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

// Import component schemas and catalog from UI package (single source of truth)
import {
  catalog,
  CardSchema,
  ChartSchema,
  TextSchema,
  HeadingSchema,
  ListSchema,
  TableSchema,
  MetricSchema,
  BadgeSchema,
  AlertSchema,
  SeparatorSchema,
  CodeSchema,
} from "@cephalization/phoenix-insight-ui/catalog";

/**
 * UIElement schema - a single element in the render tree
 * Kept in CLI for tool-specific validation needs
 */
const UIElementSchema = z.object({
  key: z.string(),
  type: z.enum([
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
      return CardSchema;
    case "Chart":
      return ChartSchema;
    case "Text":
      return TextSchema;
    case "Heading":
      return HeadingSchema;
    case "List":
      return ListSchema;
    case "Table":
      return TableSchema;
    case "Metric":
      return MetricSchema;
    case "Badge":
      return BadgeSchema;
    case "Alert":
      return AlertSchema;
    case "Separator":
      return SeparatorSchema;
    case "Code":
      return CodeSchema;
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
// Dynamic Component Documentation
// ============================================================================

/**
 * Extract prop names from a Zod object schema
 * Returns array of prop names with "?" suffix for optional props
 */
function extractPropNames(schema: z.ZodTypeAny): string[] {
  // Handle ZodObject schemas
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    return Object.entries(shape).map(([key, value]) => {
      // Check if the prop is optional
      const isOptional = value instanceof z.ZodOptional || 
                         value instanceof z.ZodNullable ||
                         (value as z.ZodTypeAny).isOptional?.();
      return isOptional ? `${key}?` : key;
    });
  }
  return [];
}

/**
 * Generate component documentation from the catalog
 * Iterates over catalog.components and builds a description string
 */
export function generateComponentDocs(
  catalogDef: typeof catalog
): string {
  const lines: string[] = [];
  
  for (const [name, component] of Object.entries(catalogDef.components)) {
    const propNames = extractPropNames(component.props);
    const propsStr = propNames.length > 0 ? `props: ${propNames.join(", ")}` : "no props";
    const childrenNote = component.hasChildren ? "; can have children" : "";
    lines.push(`- ${name}: ${component.description} (${propsStr}${childrenNote})`);
  }
  
  return lines.join("\n");
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
  const componentDocs = generateComponentDocs(catalog);
  
  return tool({
    description: `Generate or update a structured report that will be displayed in the UI report panel. 
The report uses a JSON-Render tree format with the following component types:
${componentDocs}

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
