import { describe, expect, it } from "vitest";

import {
  meetingNoteCaptureSchema,
  meetingNoteDetailsSchema,
  meetingNoteEventLinkSchema,
  meetingNoteImprovementLinkSchema,
} from "./meeting-note-schema";

const VALID = {
  date: "2026-07-12",
  title: "Weekly sync",
  meetingType: "",
  notes: "Discussed the roadmap.",
  reflection: "",
  projectId: "",
};

describe("meetingNoteCaptureSchema", () => {
  it("accepts date/title/notes and fills in defaults", () => {
    const result = meetingNoteCaptureSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        date: "2026-07-12",
        title: "Weekly sync",
        meetingType: "other",
        notes: "Discussed the roadmap.",
        reflection: null,
        projectId: null,
      });
    }
  });

  it("rejects a blank title", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      title: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      title: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      date: "07/12/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects blank notes", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      notes: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 20000 characters", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      notes: "a".repeat(20001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a known meeting type", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      meetingType: "standup",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.meetingType).toBe("standup");
  });

  it("rejects an unknown meeting type", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      meetingType: "brainstorm",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reflection over 2000 characters", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      reflection: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts reflection and a project id, trimming reflection", () => {
    const result = meetingNoteCaptureSchema.safeParse({
      ...VALID,
      reflection: "  went well  ",
      projectId: "project-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reflection).toBe("went well");
      expect(result.data.projectId).toBe("project-1");
    }
  });
});

describe("meetingNoteDetailsSchema", () => {
  it("accepts a valid edit", () => {
    const result = meetingNoteDetailsSchema.safeParse({
      id: "m-1",
      ...VALID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = meetingNoteDetailsSchema.safeParse({
      id: "",
      ...VALID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank title", () => {
    const result = meetingNoteDetailsSchema.safeParse({
      id: "m-1",
      ...VALID,
      title: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("meetingNoteEventLinkSchema", () => {
  it("accepts a valid pair", () => {
    const result = meetingNoteEventLinkSchema.safeParse({
      meetingNoteId: "m-1",
      eventId: "e-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty meetingNoteId", () => {
    const result = meetingNoteEventLinkSchema.safeParse({
      meetingNoteId: "",
      eventId: "e-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("meetingNoteImprovementLinkSchema", () => {
  it("accepts a valid pair", () => {
    const result = meetingNoteImprovementLinkSchema.safeParse({
      meetingNoteId: "m-1",
      improvementId: "i-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty improvementId", () => {
    const result = meetingNoteImprovementLinkSchema.safeParse({
      meetingNoteId: "m-1",
      improvementId: "",
    });
    expect(result.success).toBe(false);
  });
});
