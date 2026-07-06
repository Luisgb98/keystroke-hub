import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("merges conflicting tailwind classes, keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("keeps a custom font-size token when merged with a text color utility", () => {
    // Regression: tailwind-merge doesn't know our design-system font-size
    // scale (text-display/h1/h2/h3/body/small/caption) by default, so it used
    // to misclassify e.g. text-caption as conflicting with text-muted-foreground
    // and silently drop it.
    expect(
      cn("text-caption font-medium text-muted-foreground", "text-foreground")
    ).toBe("text-caption font-medium text-foreground");
  });

  it("still resolves conflicts between two font-size tokens, keeping the last", () => {
    expect(cn("text-caption", "text-small")).toBe("text-small");
  });
});
