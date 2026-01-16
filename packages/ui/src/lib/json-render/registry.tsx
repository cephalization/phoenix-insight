/**
 * JSON-Render Component Registry for Phoenix Insight UI
 *
 * Maps json-render component types to shadcn/ui implementations.
 * Each component receives ComponentRenderProps from @json-render/react.
 */

import type { ComponentRegistry, ComponentRenderProps } from "@json-render/react";
import type { z } from "zod";
import type {
  CardSchema,
  TextSchema,
  HeadingSchema,
  ListSchema,
  TableSchema,
  MetricSchema,
  BadgeSchema,
  AlertSchema,
  SeparatorSchema,
  CodeSchema,
} from "./catalog";

// shadcn/ui components
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

/**
 * Card component - container for grouping related content
 */
function CardRenderer({
  element,
  children,
}: ComponentRenderProps<z.infer<typeof CardSchema>>) {
  const { title, description } = element.props;

  return (
    <Card className="mb-4">
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Text component - for paragraphs and inline text
 */
function TextRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof TextSchema>>) {
  const { content, variant = "default" } = element.props;

  const variantClasses = {
    default: "text-base leading-7",
    muted: "text-sm text-muted-foreground",
    lead: "text-xl text-muted-foreground",
  };

  return <p className={variantClasses[variant]}>{content}</p>;
}

/**
 * Heading component - for section headers (h1-h6)
 */
function HeadingRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof HeadingSchema>>) {
  const { content, level = "2" } = element.props;

  const headingClasses: Record<string, string> = {
    "1": "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
    "2": "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
    "3": "scroll-m-20 text-2xl font-semibold tracking-tight",
    "4": "scroll-m-20 text-xl font-semibold tracking-tight",
    "5": "scroll-m-20 text-lg font-semibold tracking-tight",
    "6": "scroll-m-20 text-base font-semibold tracking-tight",
  };

  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  return <Tag className={headingClasses[level]}>{content}</Tag>;
}

/**
 * List component - ordered and unordered lists
 */
function ListRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof ListSchema>>) {
  const { items, ordered = false } = element.props;

  const Tag = ordered ? "ol" : "ul";
  const listClass = ordered
    ? "my-6 ml-6 list-decimal [&>li]:mt-2"
    : "my-6 ml-6 list-disc [&>li]:mt-2";

  return (
    <Tag className={listClass}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
}

/**
 * Table component - tabular data display
 */
function TableRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof TableSchema>>) {
  const { headers, rows, caption } = element.props;

  return (
    <div className="my-6">
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Metric component - displays a key metric value with optional change indicator
 */
function MetricRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof MetricSchema>>) {
  const { label, value, change, changeType = "neutral" } = element.props;

  const changeColors = {
    positive: "text-green-600 dark:text-green-400",
    negative: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          <span className="text-2xl font-bold">{value}</span>
          {change && (
            <span className={`text-sm ${changeColors[changeType]}`}>
              {change}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Badge component - inline status or category indicator
 */
function BadgeRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof BadgeSchema>>) {
  const { content, variant = "default" } = element.props;

  return <Badge variant={variant}>{content}</Badge>;
}

/**
 * Alert component - important messages or warnings
 */
function AlertRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof AlertSchema>>) {
  const { title, description, variant = "default" } = element.props;

  return (
    <Alert variant={variant} className="mb-4">
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

/**
 * Separator component - visual divider
 */
function SeparatorRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof SeparatorSchema>>) {
  const { orientation = "horizontal" } = element.props;

  return <Separator orientation={orientation} className="my-4" />;
}

/**
 * Code component - code blocks with optional syntax highlighting
 */
function CodeRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof CodeSchema>>) {
  const { content, language } = element.props;

  return (
    <div className="my-4">
      <pre className="mb-4 overflow-x-auto rounded-lg border bg-muted p-4">
        <code
          className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
          data-language={language}
        >
          {content}
        </code>
      </pre>
    </div>
  );
}

/**
 * The Phoenix Insight UI component registry
 *
 * Maps catalog component types to their React implementations.
 * Used with @json-render/react's Renderer component.
 */
export const registry: ComponentRegistry = {
  Card: CardRenderer,
  Text: TextRenderer,
  Heading: HeadingRenderer,
  List: ListRenderer,
  Table: TableRenderer,
  Metric: MetricRenderer,
  Badge: BadgeRenderer,
  Alert: AlertRenderer,
  Separator: SeparatorRenderer,
  Code: CodeRenderer,
};

// Export individual components for direct use if needed
export {
  CardRenderer,
  TextRenderer,
  HeadingRenderer,
  ListRenderer,
  TableRenderer,
  MetricRenderer,
  BadgeRenderer,
  AlertRenderer,
  SeparatorRenderer,
  CodeRenderer,
};
