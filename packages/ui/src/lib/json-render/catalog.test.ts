import { describe, it, expect } from "vitest";
import {
  catalog,
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

describe("catalog", () => {
  it("should have the correct name", () => {
    expect(catalog.name).toBe("phoenix-insight-ui");
  });

  it("should have all required components", () => {
    const expectedComponents = [
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
    ];

    expect(catalog.componentNames).toEqual(
      expect.arrayContaining(expectedComponents)
    );
    expect(catalog.componentNames.length).toBe(expectedComponents.length);
  });

  it("should report Card as having children", () => {
    expect(catalog.components.Card.hasChildren).toBe(true);
  });

  it("should report other components as not having children", () => {
    const componentNames = catalog.componentNames.filter((n) => n !== "Card");
    for (const name of componentNames) {
      expect(catalog.components[name].hasChildren).toBe(false);
    }
  });

  describe("hasComponent", () => {
    it("should return true for valid components", () => {
      expect(catalog.hasComponent("Card")).toBe(true);
      expect(catalog.hasComponent("Text")).toBe(true);
      expect(catalog.hasComponent("Metric")).toBe(true);
    });

    it("should return false for invalid components", () => {
      expect(catalog.hasComponent("Invalid")).toBe(false);
      expect(catalog.hasComponent("")).toBe(false);
    });
  });
});

describe("CardSchema", () => {
  it("should accept valid card props with title and description", () => {
    const result = CardSchema.safeParse({
      title: "My Card",
      description: "This is a description",
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object (all optional)", () => {
    const result = CardSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject non-string title", () => {
    const result = CardSchema.safeParse({ title: 123 });
    expect(result.success).toBe(false);
  });
});

describe("TextSchema", () => {
  it("should accept valid text props", () => {
    const result = TextSchema.safeParse({
      content: "Hello world",
      variant: "default",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all variant options", () => {
    for (const variant of ["default", "muted", "lead"]) {
      const result = TextSchema.safeParse({ content: "Test", variant });
      expect(result.success).toBe(true);
    }
  });

  it("should require content", () => {
    const result = TextSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject invalid variant", () => {
    const result = TextSchema.safeParse({
      content: "Test",
      variant: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("HeadingSchema", () => {
  it("should accept valid heading props", () => {
    const result = HeadingSchema.safeParse({
      content: "My Heading",
      level: "1",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all level options", () => {
    for (const level of ["1", "2", "3", "4", "5", "6"]) {
      const result = HeadingSchema.safeParse({ content: "Test", level });
      expect(result.success).toBe(true);
    }
  });

  it("should require content", () => {
    const result = HeadingSchema.safeParse({ level: "1" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid level", () => {
    const result = HeadingSchema.safeParse({
      content: "Test",
      level: "7",
    });
    expect(result.success).toBe(false);
  });
});

describe("ListSchema", () => {
  it("should accept valid list props", () => {
    const result = ListSchema.safeParse({
      items: ["Item 1", "Item 2", "Item 3"],
      ordered: true,
    });
    expect(result.success).toBe(true);
  });

  it("should accept unordered list (default)", () => {
    const result = ListSchema.safeParse({
      items: ["Item 1", "Item 2"],
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty items array", () => {
    const result = ListSchema.safeParse({ items: [] });
    expect(result.success).toBe(true);
  });

  it("should require items array", () => {
    const result = ListSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject non-string items", () => {
    const result = ListSchema.safeParse({ items: [1, 2, 3] });
    expect(result.success).toBe(false);
  });
});

describe("TableSchema", () => {
  it("should accept valid table props", () => {
    const result = TableSchema.safeParse({
      headers: ["Name", "Age", "City"],
      rows: [
        ["Alice", "30", "New York"],
        ["Bob", "25", "Los Angeles"],
      ],
      caption: "User Data",
    });
    expect(result.success).toBe(true);
  });

  it("should accept table without caption", () => {
    const result = TableSchema.safeParse({
      headers: ["Col1", "Col2"],
      rows: [["A", "B"]],
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty table", () => {
    const result = TableSchema.safeParse({
      headers: [],
      rows: [],
    });
    expect(result.success).toBe(true);
  });

  it("should require headers and rows", () => {
    expect(TableSchema.safeParse({}).success).toBe(false);
    expect(TableSchema.safeParse({ headers: [] }).success).toBe(false);
    expect(TableSchema.safeParse({ rows: [] }).success).toBe(false);
  });
});

describe("MetricSchema", () => {
  it("should accept valid metric props", () => {
    const result = MetricSchema.safeParse({
      label: "Total Revenue",
      value: "$125,000",
      change: "+15%",
      changeType: "positive",
    });
    expect(result.success).toBe(true);
  });

  it("should accept metric without change", () => {
    const result = MetricSchema.safeParse({
      label: "Active Users",
      value: "1,234",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all changeType options", () => {
    for (const changeType of ["positive", "negative", "neutral"]) {
      const result = MetricSchema.safeParse({
        label: "Test",
        value: "100",
        changeType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should require label and value", () => {
    expect(MetricSchema.safeParse({}).success).toBe(false);
    expect(MetricSchema.safeParse({ label: "Test" }).success).toBe(false);
    expect(MetricSchema.safeParse({ value: "100" }).success).toBe(false);
  });
});

describe("BadgeSchema", () => {
  it("should accept valid badge props", () => {
    const result = BadgeSchema.safeParse({
      content: "Active",
      variant: "default",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all variant options", () => {
    for (const variant of ["default", "secondary", "destructive", "outline"]) {
      const result = BadgeSchema.safeParse({ content: "Test", variant });
      expect(result.success).toBe(true);
    }
  });

  it("should require content", () => {
    const result = BadgeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("AlertSchema", () => {
  it("should accept valid alert props", () => {
    const result = AlertSchema.safeParse({
      title: "Warning",
      description: "This is an important message",
      variant: "destructive",
    });
    expect(result.success).toBe(true);
  });

  it("should accept alert without title", () => {
    const result = AlertSchema.safeParse({
      description: "Simple message",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all variant options", () => {
    for (const variant of ["default", "destructive"]) {
      const result = AlertSchema.safeParse({
        description: "Test",
        variant,
      });
      expect(result.success).toBe(true);
    }
  });

  it("should require description", () => {
    const result = AlertSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("SeparatorSchema", () => {
  it("should accept valid separator props", () => {
    const result = SeparatorSchema.safeParse({
      orientation: "horizontal",
    });
    expect(result.success).toBe(true);
  });

  it("should accept all orientation options", () => {
    for (const orientation of ["horizontal", "vertical"]) {
      const result = SeparatorSchema.safeParse({ orientation });
      expect(result.success).toBe(true);
    }
  });

  it("should accept empty object (all optional)", () => {
    const result = SeparatorSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject invalid orientation", () => {
    const result = SeparatorSchema.safeParse({ orientation: "diagonal" });
    expect(result.success).toBe(false);
  });
});

describe("CodeSchema", () => {
  it("should accept valid code props", () => {
    const result = CodeSchema.safeParse({
      content: 'console.log("Hello, World!");',
      language: "javascript",
    });
    expect(result.success).toBe(true);
  });

  it("should accept code without language", () => {
    const result = CodeSchema.safeParse({
      content: "plain text code",
    });
    expect(result.success).toBe(true);
  });

  it("should require content", () => {
    const result = CodeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("catalog.validateElement", () => {
  it("should validate a valid Card element", () => {
    const element = {
      key: "card-1",
      type: "Card",
      props: { title: "Test Card" },
      children: ["text-1"],
    };
    const result = catalog.validateElement(element);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(element);
  });

  it("should validate a valid Text element", () => {
    const element = {
      key: "text-1",
      type: "Text",
      props: { content: "Hello", variant: "muted" },
    };
    const result = catalog.validateElement(element);
    expect(result.success).toBe(true);
  });

  it("should reject element with invalid type", () => {
    const element = {
      key: "invalid-1",
      type: "InvalidComponent",
      props: {},
    };
    const result = catalog.validateElement(element);
    expect(result.success).toBe(false);
  });

  it("should reject element with invalid props", () => {
    const element = {
      key: "text-1",
      type: "Text",
      props: { content: 123 }, // content should be string
    };
    const result = catalog.validateElement(element);
    expect(result.success).toBe(false);
  });

  it("should reject element without key", () => {
    const element = {
      type: "Text",
      props: { content: "Test" },
    };
    const result = catalog.validateElement(element);
    expect(result.success).toBe(false);
  });
});

describe("catalog.validateTree", () => {
  it("should validate a valid UI tree", () => {
    const tree = {
      root: "card-1",
      elements: {
        "card-1": {
          key: "card-1",
          type: "Card",
          props: { title: "Report" },
          children: ["text-1"],
        },
        "text-1": {
          key: "text-1",
          type: "Text",
          props: { content: "Hello world" },
          parentKey: "card-1",
        },
      },
    };
    const result = catalog.validateTree(tree);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(tree);
  });

  it("should validate a tree with multiple component types", () => {
    const tree = {
      root: "card-1",
      elements: {
        "card-1": {
          key: "card-1",
          type: "Card",
          props: { title: "Dashboard" },
          children: ["metric-1", "sep-1", "table-1"],
        },
        "metric-1": {
          key: "metric-1",
          type: "Metric",
          props: { label: "Revenue", value: "$100" },
          parentKey: "card-1",
        },
        "sep-1": {
          key: "sep-1",
          type: "Separator",
          props: {},
          parentKey: "card-1",
        },
        "table-1": {
          key: "table-1",
          type: "Table",
          props: { headers: ["A", "B"], rows: [["1", "2"]] },
          parentKey: "card-1",
        },
      },
    };
    const result = catalog.validateTree(tree);
    expect(result.success).toBe(true);
  });

  it("should reject tree with invalid element", () => {
    const tree = {
      root: "text-1",
      elements: {
        "text-1": {
          key: "text-1",
          type: "Text",
          props: { content: 123 }, // invalid content type
        },
      },
    };
    const result = catalog.validateTree(tree);
    expect(result.success).toBe(false);
  });

  it("should reject tree without root", () => {
    const tree = {
      elements: {
        "text-1": {
          key: "text-1",
          type: "Text",
          props: { content: "Test" },
        },
      },
    };
    const result = catalog.validateTree(tree);
    expect(result.success).toBe(false);
  });
});
