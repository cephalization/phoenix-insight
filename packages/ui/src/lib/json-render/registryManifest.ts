import {
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
} from "@/lib/json-render/registry";
import type { ComponentRegistry } from "@json-render/react";

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
  Chart: ChartRenderer,
};
