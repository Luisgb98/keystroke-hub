import { describe, expect, it } from "vitest";

import { scriptSaveSchema } from "./script-schema";

describe("scriptSaveSchema", () => {
  it("accepts a well-formed save", () => {
    const result = scriptSaveSchema.safeParse({
      ideaId: "idea-1",
      content: "# Cold open\n\nHook the viewer in five seconds.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty content — the first keystroke is what creates the row", () => {
    const result = scriptSaveSchema.safeParse({
      ideaId: "idea-1",
      content: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing idea id", () => {
    const result = scriptSaveSchema.safeParse({ ideaId: "", content: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects content over the max length", () => {
    const result = scriptSaveSchema.safeParse({
      ideaId: "idea-1",
      content: "a".repeat(200_001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts content right at the max length", () => {
    const result = scriptSaveSchema.safeParse({
      ideaId: "idea-1",
      content: "a".repeat(200_000),
    });
    expect(result.success).toBe(true);
  });
});
