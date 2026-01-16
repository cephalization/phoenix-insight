/**
 * JSON-Render Component Registry for Phoenix Insight UI
 *
 * Maps json-render component types to shadcn/ui implementations.
 * Each component receives ComponentRenderProps from @json-render/react.
 */

import type { ComponentRenderProps } from "@json-render/react";
import { useData } from "@json-render/react";
import { getByPath } from "@json-render/core";
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
  ChartSchema,
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
 * Chart component - displays charts from array data
 * Supports bar, line, area, and pie chart types
 */
function ChartRenderer({
  element,
}: ComponentRenderProps<z.infer<typeof ChartSchema>>) {
  const { type, dataPath, title, height } = element.props;
  const { data } = useData();
  const chartData = getByPath(data, dataPath) as
    | Array<{ label: string; value: number }>
    | undefined;

  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center p-5 text-muted-foreground">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...chartData.map((d) => d.value));
  const chartHeight = height ?? 120;

  // Pie chart rendering
  if (type === "pie") {
    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    const colors = [
      "bg-primary",
      "bg-secondary",
      "bg-accent",
      "bg-muted",
      "bg-destructive",
    ];

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          {title && <h4 className="mb-4 text-sm font-semibold">{title}</h4>}
          <div className="flex flex-col gap-2">
            {chartData.map((d, i) => {
              const percentage = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      colors[i % colors.length]
                    }`}
                  />
                  <span className="flex-1 text-sm">{d.label}</span>
                  <span className="text-sm font-medium">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Bar chart rendering (default)
  if (type === "bar") {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          {title && <h4 className="mb-4 text-sm font-semibold">{title}</h4>}
          <div className="flex items-end gap-2" style={{ height: chartHeight }}>
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-foreground transition-all"
                  style={{
                    height: `${maxValue > 0 ? (d.value / maxValue) * 100 : 0}%`,
                    minHeight: 4,
                  }}
                />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Line chart rendering
  if (type === "line") {
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1 || 1)) * 100;
      const y = maxValue > 0 ? 100 - (d.value / maxValue) * 100 : 100;
      return `${x},${y}`;
    });

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          {title && <h4 className="mb-4 text-sm font-semibold">{title}</h4>}
          <div style={{ height: chartHeight }}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={points.join(" ")}
                className="text-foreground"
              />
              {chartData.map((_, i) => {
                const x = (i / (chartData.length - 1 || 1)) * 100;
                const y =
                  maxValue > 0
                    ? 100 - (chartData[i].value / maxValue) * 100
                    : 100;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    vectorEffect="non-scaling-stroke"
                    className="fill-background stroke-foreground"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          </div>
          <div className="mt-2 flex justify-between">
            {chartData.map((d, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {d.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Area chart rendering
  if (type === "area") {
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1 || 1)) * 100;
      const y = maxValue > 0 ? 100 - (d.value / maxValue) * 100 : 100;
      return `${x},${y}`;
    });
    const areaPath = `0,100 ${points.join(" ")} 100,100`;

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          {title && <h4 className="mb-4 text-sm font-semibold">{title}</h4>}
          <div style={{ height: chartHeight }}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <polygon points={areaPath} className="fill-foreground/20" />
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={points.join(" ")}
                className="text-foreground"
              />
            </svg>
          </div>
          <div className="mt-2 flex justify-between">
            {chartData.map((d, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {d.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback for unknown types
  return (
    <div className="flex items-center justify-center p-5 text-muted-foreground">
      Unsupported chart type: {type}
    </div>
  );
}

/**
 * Component registry mapping component types to their renderers.
 * Used by json-render to look up components by type name.
 */
export const registry = {
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
  ChartRenderer,
};
