/**
 * JSON-Render Catalog for Phoenix Insight UI
 *
 * Defines the allowed components that can be rendered from AI-generated JSON.
 * Uses zod schemas for props validation.
 */

import { createCatalog } from "@json-render/core";
import { z } from "zod";

/**
 * Card component - container for grouping related content
 */
const CardSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Text component - for paragraphs and inline text
 */
const TextSchema = z.object({
  content: z.string(),
  variant: z.enum(["default", "muted", "lead"]).optional(),
});

/**
 * Heading component - for section headers (h1-h6)
 */
const HeadingSchema = z.object({
  content: z.string(),
  level: z.enum(["1", "2", "3", "4", "5", "6"]).optional(),
});

/**
 * List component - ordered and unordered lists
 */
const ListSchema = z.object({
  items: z.array(z.string()),
  ordered: z.boolean().optional(),
});

/**
 * Table component - tabular data display
 */
const TableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
});

/**
 * Metric component - displays a key metric value
 */
const MetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changeType: z.enum(["positive", "negative", "neutral"]).optional(),
});

/**
 * Badge component - inline status or category indicator
 */
const BadgeSchema = z.object({
  content: z.string(),
  variant: z
    .enum(["default", "secondary", "destructive", "outline"])
    .optional(),
});

/**
 * Alert component - important messages or warnings
 */
const AlertSchema = z.object({
  title: z.string().optional(),
  description: z.string(),
  variant: z.enum(["default", "destructive"]).optional(),
});

/**
 * Separator component - visual divider
 */
const SeparatorSchema = z.object({
  orientation: z.enum(["horizontal", "vertical"]).optional(),
});

/**
 * Code component - code blocks with syntax highlighting
 */
const CodeSchema = z.object({
  content: z.string(),
  language: z.string().optional(),
});

/**
 * Chart component - displays a chart from array data
 */
const ChartSchema = z.object({
  type: z.enum(["bar", "line", "pie", "area"]),
  dataPath: z.string(),
  title: z.string().nullable(),
  height: z.number().nullable(),
});

/**
 * The Phoenix Insight UI catalog
 *
 * Defines all components that AI can generate for reports.
 * Each component has a zod schema for props validation.
 */
export const catalog = createCatalog({
  name: "phoenix-insight-ui",
  components: {
    Card: {
      props: CardSchema,
      hasChildren: true,
      description:
        "Container for grouping related content with optional title and description",
    },
    Chart: {
      props: ChartSchema,
      hasChildren: false,
      description:
        "Chart display from array data with optional title and height",
    },
    Text: {
      props: TextSchema,
      hasChildren: false,
      description:
        "Text paragraph with optional styling variants (default, muted, lead)",
    },
    Heading: {
      props: HeadingSchema,
      hasChildren: false,
      description: "Section heading with configurable level (1-6)",
    },
    List: {
      props: ListSchema,
      hasChildren: false,
      description: "Ordered or unordered list of items",
    },
    Table: {
      props: TableSchema,
      hasChildren: false,
      description:
        "Tabular data display with headers, rows, and optional caption",
    },
    Metric: {
      props: MetricSchema,
      hasChildren: false,
      description:
        "Key metric display with label, value, and optional change indicator",
    },
    Badge: {
      props: BadgeSchema,
      hasChildren: false,
      description: "Inline status or category indicator with variant styling",
    },
    Alert: {
      props: AlertSchema,
      hasChildren: false,
      description:
        "Important message or warning with optional title and variant",
    },
    Separator: {
      props: SeparatorSchema,
      hasChildren: false,
      description: "Visual divider between sections",
    },
    Code: {
      props: CodeSchema,
      hasChildren: false,
      description: "Code block with optional syntax highlighting",
    },
  },
});

// Export individual schemas for use in other parts of the application
export {
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
};

// Export the catalog type for use in other modules
export type PhoenixInsightCatalog = typeof catalog;

// Re-export useful types from json-render
export type { UITree, UIElement } from "@json-render/core";
