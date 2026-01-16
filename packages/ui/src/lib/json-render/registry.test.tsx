import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UIElement } from "@json-render/core";
import {
  registry,
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
} from "./registry";

// Helper to create a UIElement for testing
function createElement<T extends Record<string, unknown>>(
  type: string,
  props: T,
  key: string = "test-key"
): UIElement<string, T> {
  return {
    key,
    type,
    props,
  };
}

describe("registry", () => {
  it("should export all required component renderers", () => {
    expect(registry).toHaveProperty("Card");
    expect(registry).toHaveProperty("Text");
    expect(registry).toHaveProperty("Heading");
    expect(registry).toHaveProperty("List");
    expect(registry).toHaveProperty("Table");
    expect(registry).toHaveProperty("Metric");
    expect(registry).toHaveProperty("Badge");
    expect(registry).toHaveProperty("Alert");
    expect(registry).toHaveProperty("Separator");
    expect(registry).toHaveProperty("Code");
  });

  it("should have exactly 10 components", () => {
    expect(Object.keys(registry).length).toBe(10);
  });
});

describe("CardRenderer", () => {
  it("should render card with title and description", () => {
    render(
      <CardRenderer
        element={createElement("Card", {
          title: "Test Title",
          description: "Test description",
        })}
      >
        <p>Child content</p>
      </CardRenderer>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("should render card with only title", () => {
    render(
      <CardRenderer element={createElement("Card", { title: "Only Title" })}>
        Content
      </CardRenderer>
    );

    expect(screen.getByText("Only Title")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should render card with only children (no header)", () => {
    const { container } = render(
      <CardRenderer element={createElement("Card", {})}>
        Just content
      </CardRenderer>
    );

    expect(screen.getByText("Just content")).toBeInTheDocument();
    // Should not render CardHeader when no title/description
    expect(container.querySelector('[data-slot="card-header"]')).toBeNull();
  });
});

describe("TextRenderer", () => {
  it("should render default text", () => {
    render(
      <TextRenderer element={createElement("Text", { content: "Hello world" })} />
    );

    const text = screen.getByText("Hello world");
    expect(text).toBeInTheDocument();
    expect(text).toHaveClass("text-base", "leading-7");
  });

  it("should render muted text variant", () => {
    render(
      <TextRenderer
        element={createElement("Text", {
          content: "Muted text",
          variant: "muted",
        })}
      />
    );

    const text = screen.getByText("Muted text");
    expect(text).toHaveClass("text-sm", "text-muted-foreground");
  });

  it("should render lead text variant", () => {
    render(
      <TextRenderer
        element={createElement("Text", { content: "Lead text", variant: "lead" })}
      />
    );

    const text = screen.getByText("Lead text");
    expect(text).toHaveClass("text-xl", "text-muted-foreground");
  });
});

describe("HeadingRenderer", () => {
  it("should render h2 by default", () => {
    render(
      <HeadingRenderer
        element={createElement("Heading", { content: "Default Heading" })}
      />
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Default Heading");
  });

  it("should render h1", () => {
    render(
      <HeadingRenderer
        element={createElement("Heading", { content: "H1 Heading", level: "1" })}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("H1 Heading");
    expect(heading).toHaveClass("text-4xl", "font-extrabold");
  });

  it("should render all heading levels", () => {
    const levels = ["1", "2", "3", "4", "5", "6"] as const;

    for (const level of levels) {
      const { unmount } = render(
        <HeadingRenderer
          element={createElement("Heading", {
            content: `H${level}`,
            level,
          })}
        />
      );

      const heading = screen.getByRole("heading", { level: Number(level) });
      expect(heading).toBeInTheDocument();
      unmount();
    }
  });
});

describe("ListRenderer", () => {
  it("should render unordered list by default", () => {
    render(
      <ListRenderer
        element={createElement("List", { items: ["Item 1", "Item 2", "Item 3"] })}
      />
    );

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("UL");
    expect(list).toHaveClass("list-disc");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("should render ordered list", () => {
    render(
      <ListRenderer
        element={createElement("List", {
          items: ["First", "Second"],
          ordered: true,
        })}
      />
    );

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list).toHaveClass("list-decimal");
  });

  it("should render empty list", () => {
    render(<ListRenderer element={createElement("List", { items: [] })} />);

    const list = screen.getByRole("list");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(list).toBeInTheDocument();
  });
});

describe("TableRenderer", () => {
  it("should render table with headers and rows", () => {
    render(
      <TableRenderer
        element={createElement("Table", {
          headers: ["Name", "Age", "City"],
          rows: [
            ["Alice", "30", "NYC"],
            ["Bob", "25", "LA"],
          ],
        })}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("should render table with caption", () => {
    render(
      <TableRenderer
        element={createElement("Table", {
          headers: ["Col1"],
          rows: [["Data"]],
          caption: "Table Caption",
        })}
      />
    );

    expect(screen.getByText("Table Caption")).toBeInTheDocument();
  });

  it("should render empty table", () => {
    render(
      <TableRenderer
        element={createElement("Table", { headers: ["H1", "H2"], rows: [] })}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("H1")).toBeInTheDocument();
    expect(screen.getByText("H2")).toBeInTheDocument();
  });
});

describe("MetricRenderer", () => {
  it("should render metric with label and value", () => {
    render(
      <MetricRenderer
        element={createElement("Metric", { label: "Revenue", value: "$1,234" })}
      />
    );

    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$1,234")).toBeInTheDocument();
  });

  it("should render metric with positive change", () => {
    render(
      <MetricRenderer
        element={createElement("Metric", {
          label: "Users",
          value: "1,000",
          change: "+12%",
          changeType: "positive",
        })}
      />
    );

    const change = screen.getByText("+12%");
    expect(change).toBeInTheDocument();
    expect(change).toHaveClass("text-green-600");
  });

  it("should render metric with negative change", () => {
    render(
      <MetricRenderer
        element={createElement("Metric", {
          label: "Errors",
          value: "50",
          change: "-5%",
          changeType: "negative",
        })}
      />
    );

    const change = screen.getByText("-5%");
    expect(change).toHaveClass("text-red-600");
  });

  it("should render metric with neutral change", () => {
    render(
      <MetricRenderer
        element={createElement("Metric", {
          label: "Status",
          value: "OK",
          change: "0%",
          changeType: "neutral",
        })}
      />
    );

    const change = screen.getByText("0%");
    expect(change).toHaveClass("text-muted-foreground");
  });
});

describe("BadgeRenderer", () => {
  it("should render badge with default variant", () => {
    render(
      <BadgeRenderer
        element={createElement("Badge", { content: "Active" })}
      />
    );

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("should render badge with secondary variant", () => {
    const { container } = render(
      <BadgeRenderer
        element={createElement("Badge", {
          content: "Draft",
          variant: "secondary",
        })}
      />
    );

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-secondary");
  });

  it("should render badge with destructive variant", () => {
    const { container } = render(
      <BadgeRenderer
        element={createElement("Badge", {
          content: "Error",
          variant: "destructive",
        })}
      />
    );

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("bg-destructive");
  });

  it("should render badge with outline variant", () => {
    const { container } = render(
      <BadgeRenderer
        element={createElement("Badge", {
          content: "Info",
          variant: "outline",
        })}
      />
    );

    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("text-foreground");
  });
});

describe("AlertRenderer", () => {
  it("should render alert with description only", () => {
    render(
      <AlertRenderer
        element={createElement("Alert", { description: "Alert message" })}
      />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Alert message")).toBeInTheDocument();
  });

  it("should render alert with title and description", () => {
    render(
      <AlertRenderer
        element={createElement("Alert", {
          title: "Warning",
          description: "Something went wrong",
        })}
      />
    );

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("should render destructive alert variant", () => {
    const { container } = render(
      <AlertRenderer
        element={createElement("Alert", {
          title: "Error",
          description: "Critical failure",
          variant: "destructive",
        })}
      />
    );

    const alert = container.querySelector('[data-slot="alert"]');
    expect(alert).toHaveClass("text-destructive");
  });
});

describe("SeparatorRenderer", () => {
  it("should render horizontal separator by default", () => {
    const { container } = render(
      <SeparatorRenderer element={createElement("Separator", {})} />
    );

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
  });

  it("should render vertical separator", () => {
    const { container } = render(
      <SeparatorRenderer
        element={createElement("Separator", { orientation: "vertical" })}
      />
    );

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toHaveAttribute("data-orientation", "vertical");
  });
});

describe("CodeRenderer", () => {
  it("should render code block with content", () => {
    render(
      <CodeRenderer
        element={createElement("Code", { content: 'console.log("hello")' })}
      />
    );

    expect(screen.getByText('console.log("hello")')).toBeInTheDocument();
  });

  it("should render code block with language attribute", () => {
    const { container } = render(
      <CodeRenderer
        element={createElement("Code", {
          content: "const x = 1;",
          language: "typescript",
        })}
      />
    );

    const code = container.querySelector("code");
    expect(code).toHaveAttribute("data-language", "typescript");
  });

  it("should preserve whitespace and formatting", () => {
    const multilineCode = `function hello() {
  return "world";
}`;

    render(
      <CodeRenderer element={createElement("Code", { content: multilineCode })} />
    );

    const code = screen.getByText((_, element) => {
      return element?.tagName === "CODE" && element.textContent === multilineCode;
    });
    expect(code).toBeInTheDocument();
  });
});

describe("registry integration", () => {
  it("should be usable as ComponentRegistry type", () => {
    // This is a type-level test - if it compiles, the test passes
    const _registry: typeof registry = registry;
    expect(_registry).toBe(registry);
  });

  it("should render correct component for each type", () => {
    // Test that registry maps to correct renderers
    expect(registry.Card).toBe(CardRenderer);
    expect(registry.Text).toBe(TextRenderer);
    expect(registry.Heading).toBe(HeadingRenderer);
    expect(registry.List).toBe(ListRenderer);
    expect(registry.Table).toBe(TableRenderer);
    expect(registry.Metric).toBe(MetricRenderer);
    expect(registry.Badge).toBe(BadgeRenderer);
    expect(registry.Alert).toBe(AlertRenderer);
    expect(registry.Separator).toBe(SeparatorRenderer);
    expect(registry.Code).toBe(CodeRenderer);
  });
});
