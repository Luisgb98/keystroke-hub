import { describe, expect, it } from "vitest";

import {
  projectCaptureSchema,
  projectDetailsSchema,
  projectIdeaLinkSchema,
  projectNotesSchema,
  projectStatusSchema,
} from "./project-schema";

describe("projectCaptureSchema", () => {
  it("accepts a name-only capture and fills in defaults", () => {
    const result = projectCaptureSchema.safeParse({
      name: "Keystroke Hub",
      description: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Keystroke Hub",
        description: null,
      });
    }
  });

  it("rejects a blank name", () => {
    const result = projectCaptureSchema.safeParse({
      name: "   ",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    const result = projectCaptureSchema.safeParse({
      name: "a".repeat(201),
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a description and trims it", () => {
    const result = projectCaptureSchema.safeParse({
      name: "Keystroke Hub",
      description: "  A personal dashboard  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("A personal dashboard");
    }
  });

  it("rejects a description over 2000 characters", () => {
    const result = projectCaptureSchema.safeParse({
      name: "Keystroke Hub",
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("projectDetailsSchema", () => {
  it("accepts a valid edit", () => {
    const result = projectDetailsSchema.safeParse({
      id: "p-1",
      name: "Renamed",
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = projectDetailsSchema.safeParse({
      id: "",
      name: "Renamed",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = projectDetailsSchema.safeParse({
      id: "p-1",
      name: "   ",
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("projectStatusSchema", () => {
  it("accepts a known status", () => {
    const result = projectStatusSchema.safeParse({
      id: "p-1",
      status: "paused",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = projectStatusSchema.safeParse({
      id: "p-1",
      status: "archived",
    });
    expect(result.success).toBe(false);
  });
});

describe("projectNotesSchema", () => {
  it("accepts empty notes", () => {
    const result = projectNotesSchema.safeParse({ id: "p-1", notes: "" });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 20000 characters", () => {
    const result = projectNotesSchema.safeParse({
      id: "p-1",
      notes: "a".repeat(20001),
    });
    expect(result.success).toBe(false);
  });
});

describe("projectIdeaLinkSchema", () => {
  it("accepts a valid pair", () => {
    const result = projectIdeaLinkSchema.safeParse({
      projectId: "p-1",
      ideaId: "i-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing ideaId", () => {
    const result = projectIdeaLinkSchema.safeParse({
      projectId: "p-1",
      ideaId: "",
    });
    expect(result.success).toBe(false);
  });
});
