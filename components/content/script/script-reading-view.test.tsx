import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScriptReadingView } from "./script-reading-view";

describe("ScriptReadingView", () => {
  it("shows a placeholder when there's no content yet", () => {
    render(<ScriptReadingView content="" />);
    expect(screen.getByText(/Nothing written yet/)).toBeInTheDocument();
  });

  it("renders headings with design-system typography classes", () => {
    render(<ScriptReadingView content={"# Title\n\n## Section"} />);

    const h1 = screen.getByRole("heading", { level: 1, name: "Title" });
    expect(h1).toHaveClass("text-h1");
    const h2 = screen.getByRole("heading", { level: 2, name: "Section" });
    expect(h2).toHaveClass("text-h2");
  });

  it("renders GFM tables and lists", () => {
    render(
      <ScriptReadingView
        content={"- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |"}
      />
    );

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("distinguishes inline code from a fenced code block", () => {
    render(
      <ScriptReadingView
        content={"Use `inline()` then:\n\n```js\nconst x = 1;\n```"}
      />
    );

    const inline = screen.getByText("inline()");
    expect(inline.tagName).toBe("CODE");
    expect(inline).toHaveClass("bg-muted");

    const block = screen.getByText((text) => text.includes("const x = 1"));
    expect(block.closest("pre")).toBeInTheDocument();
  });

  it("does not render raw HTML embedded in the content", () => {
    render(<ScriptReadingView content={"<script>window.x = 1</script>"} />);
    expect(
      document.querySelector("script[src], script:not([type])")
    ).toBeNull();
    expect(screen.getByText(/window\.x = 1/)).toBeInTheDocument();
  });

  it("opens links in a new tab with a safe rel", () => {
    render(<ScriptReadingView content={"[docs](https://example.com)"} />);
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
