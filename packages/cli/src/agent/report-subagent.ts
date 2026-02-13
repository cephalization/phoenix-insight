/**
 * Report Subagent for Phoenix Insight
 *
 * A specialized subagent that generates structured reports autonomously.
 * The parent agent delegates report generation tasks to this subagent,
 * which has its own context window for processing data and generating
 * the JSON-Render tree structure.
 *
 * Benefits:
 * - Offloads report generation from main agent's context
 * - Streams progress updates to the UI in real-time via WebSocket
 * - Returns only a summary to the main agent (token efficient)
 */

import { generateText, stepCountIs, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

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

// ============================================================================
// Schema Definitions (duplicated from report-tool.ts for subagent use)
// ============================================================================

/**
 * UIElement schema - a single element in the render tree
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

type UITree = z.infer<typeof UITreeSchema>;

// ============================================================================
// Validation (duplicated from report-tool.ts for subagent validation)
// ============================================================================

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

function validateReportContent(content: unknown): {
  success: boolean;
  error?: string;
} {
  const treeResult = UITreeSchema.safeParse(content);
  if (!treeResult.success) {
    return {
      success: false,
      error: `Invalid tree structure: ${treeResult.error.message}`,
    };
  }

  const tree = treeResult.data;

  if (!tree.elements[tree.root]) {
    return {
      success: false,
      error: `Root element "${tree.root}" not found in elements`,
    };
  }

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
// Component Documentation Generation
// ============================================================================

function extractPropNames(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    return Object.entries(shape).map(([key, value]) => {
      const isOptional =
        value instanceof z.ZodOptional ||
        value instanceof z.ZodNullable ||
        (value as z.ZodTypeAny).isOptional?.();
      return isOptional ? `${key}?` : key;
    });
  }
  return [];
}

function generateComponentDocs(catalogDef: typeof catalog): string {
  const lines: string[] = [];

  for (const [name, component] of Object.entries(catalogDef.components)) {
    const propNames = extractPropNames(component.props);
    const propsStr =
      propNames.length > 0 ? `props: ${propNames.join(", ")}` : "no props";
    const childrenNote = component.hasChildren ? "; can have children" : "";
    lines.push(
      `- ${name}: ${component.description} (${propsStr}${childrenNote})`
    );
  }

  return lines.join("\n");
}

// ============================================================================
// Report Subagent Types
// ============================================================================

/**
 * Report generation progress state - sent to UI via WebSocket
 */
export interface ReportProgress {
  /** Current status of report generation */
  status: "starting" | "generating" | "validating" | "complete" | "error";
  /** Optional status message */
  message?: string;
  /** The report title if available */
  title?: string;
}

/**
 * Callback for sending report progress updates to the client
 */
export type ReportProgressCallback = (progress: ReportProgress) => void;

/**
 * Callback for sending completed reports to the client (JSON-Render tree)
 */
export type ReportCompleteCallback = (content: UITree, title?: string) => void;

/**
 * Options for running the report subagent
 */
export interface ReportSubagentOptions {
  /** Callback for sending completed reports to the client */
  onReport: ReportCompleteCallback;
  /** Callback for streaming report progress to the client */
  onProgress: ReportProgressCallback;
}

/**
 * Result returned to the main agent (summarized for token efficiency)
 */
export interface ReportSubagentResult {
  success: boolean;
  title?: string;
  message: string;
  /** Brief summary of what was generated */
  summary?: string;
}

// ============================================================================
// Report Subagent Implementation
// ============================================================================

/**
 * The system prompt for the report subagent
 */
function getReportSubagentPrompt(): string {
  const componentDocs = generateComponentDocs(catalog);

  return `You are a report generation specialist. Your task is to analyze the provided data and generate a structured report using the JSON-Render tree format.

## Available Components

${componentDocs}

## JSON-Render Tree Format

The report must be a valid JSON object with this structure:
{
  "root": "<key of the root element>",
  "elements": {
    "<key>": {
      "key": "<same as the object key>",
      "type": "<component type>",
      "props": { <component-specific props> },
      "children": ["<child key 1>", "<child key 2>", ...],  // optional, for containers
      "parentKey": "<parent key>"  // optional, for non-root elements
    },
    ...
  }
}

## Guidelines

1. Start with a Card as the root element to contain the report
2. Use Headings (h1, h2, h3) to structure sections
3. Use Metrics for key performance indicators
4. Use Charts for data visualization (bar, line, pie, area)
5. Use Tables for tabular data
6. Use Lists for bullet points or numbered items
7. Use Text for paragraphs and descriptions
8. Use Alerts for important warnings or information
9. Use Badges for status indicators
10. Use Separators to divide sections

## Important

- Generate a COMPLETE report that fully addresses the analysis request
- Include relevant metrics, charts, and tables based on the data
- Organize content logically with clear section headings
- Write a final text summary of your findings at the end of your response

When you call the submit_report tool, the report will be sent to the user interface.`;
}

/**
 * Create the internal report submission tool used by the subagent
 */
function createSubmitReportTool(
  onReport: ReportCompleteCallback,
  onProgress: ReportProgressCallback
) {
  return tool({
    description:
      "Submit the generated report. Call this when you have completed building the report structure.",
    inputSchema: z.object({
      title: z.string().optional().describe("Title for the report"),
      content: UITreeSchema.describe("The complete JSON-Render tree structure"),
    }),
    execute: async (params: {
      title?: string;
      content: UITree;
    }): Promise<{ success: boolean; error?: string }> => {
      const { title, content } = params;

      // Send validating progress
      onProgress({
        status: "validating",
        message: "Validating report structure...",
        title,
      });

      // Validate the report
      const validation = validateReportContent(content);
      if (!validation.success) {
        onProgress({
          status: "error",
          message: validation.error,
          title,
        });
        return { success: false, error: validation.error };
      }

      // Send the completed report
      onReport(content, title);

      // Send completion progress
      onProgress({
        status: "complete",
        message: title
          ? `Report "${title}" generated successfully`
          : "Report generated successfully",
        title,
      });

      return { success: true };
    },
  });
}

/**
 * Run the report subagent to generate a report from the given task
 *
 * @param task - Description of what report to generate and what data to analyze
 * @param options - Callbacks for report and progress
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The result to be returned to the main agent
 */
export async function runReportSubagent(
  task: string,
  options: ReportSubagentOptions,
  abortSignal?: AbortSignal
): Promise<ReportSubagentResult> {
  const { onReport, onProgress } = options;

  // Use claude-sonnet-4-5 for report generation (same as main agent)
  const model = anthropic("claude-sonnet-4-5");

  // Send starting progress
  onProgress({
    status: "starting",
    message: "Initializing report generation...",
  });

  try {
    // Create the submission tool
    const submitReportTool = createSubmitReportTool(onReport, onProgress);

    // Send generating progress
    onProgress({
      status: "generating",
      message: "Analyzing data and generating report structure...",
    });

    // Run the subagent with its own context window
    const result = await generateText({
      model,
      system: getReportSubagentPrompt(),
      prompt: task,
      tools: {
        submit_report: submitReportTool,
      },
      stopWhen: stepCountIs(3), // Usually 1-2 steps: generate + submit
      abortSignal,
    });

    // Extract the final text as a summary for the main agent
    const summaryText =
      result.text || "Report generated and submitted successfully.";

    return {
      success: true,
      message: "Report generation completed",
      summary: summaryText.slice(0, 500), // Limit summary length for main agent
    };
  } catch (error) {
    // Send error progress
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    onProgress({
      status: "error",
      message: `Report generation failed: ${errorMessage}`,
    });

    return {
      success: false,
      message: `Report generation failed: ${errorMessage}`,
    };
  }
}

/**
 * Create the report subagent tool for the main agent
 *
 * This tool delegates report generation to the report subagent,
 * which runs autonomously with its own context window.
 * Progress updates are sent to the UI via WebSocket callbacks.
 *
 * @param options - Callbacks for report and progress
 * @returns AI SDK tool definition for the main agent
 */
export function createReportSubagentTool(options: ReportSubagentOptions) {
  return tool({
    description: `Delegate report generation to a specialized subagent. 

Use this tool when you need to generate a structured visual report for the user.
Provide a detailed task description including:
- What data to analyze (reference specific findings from your analysis)
- What insights to highlight  
- What metrics, charts, or tables to include
- Any specific formatting requirements

The subagent will generate the report autonomously and stream progress updates to the UI.
You will receive a summary when complete - do NOT try to generate the report structure yourself.`,
    inputSchema: z.object({
      task: z
        .string()
        .describe(
          "Detailed description of what report to generate, including the data and insights to present"
        ),
    }),
    execute: async (params, { abortSignal }) => {
      const { task } = params;

      // Run the subagent - progress is streamed via the onProgress callback
      const result = await runReportSubagent(task, options, abortSignal);

      return result;
    },
    // Control what the main agent model sees - only the summarized result
    toModelOutput: ({ output }) => {
      const result = output as ReportSubagentResult;
      return {
        type: "text" as const,
        value: result.success
          ? `Report generated successfully. ${result.summary || ""}`
          : `Report generation failed: ${result.message}`,
      };
    },
  });
}
