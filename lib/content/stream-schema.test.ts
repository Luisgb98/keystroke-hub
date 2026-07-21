import { describe, expect, it } from "vitest";

import {
  DEFAULT_STREAM_DURATION_MS,
  attachEventSchema,
  checklistLabelSchema,
  retroNotesSchema,
  streamCaptureSchema,
  streamDetailsSchema,
} from "./stream-schema";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Boss rush stream",
    notes: "",
    planned: false,
    ...overrides,
  };
}

describe("streamCaptureSchema", () => {
  it("accepts a title-only, unplanned stream", () => {
    const result = streamCaptureSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Boss rush stream",
        notes: null,
        schedule: null,
      });
    }
  });

  it("keeps non-empty notes", () => {
    const result = streamCaptureSchema.safeParse(
      baseInput({ notes: "Warm up voice, check mic" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Warm up voice, check mic");
    }
  });

  it("rejects a blank title", () => {
    const result = streamCaptureSchema.safeParse(baseInput({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("creates a timed schedule with a fixed 2h duration when planned", () => {
    const result = streamCaptureSchema.safeParse(
      baseInput({ planned: true, date: "2026-08-01", time: "19:00" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schedule).toEqual({
        allDay: false,
        startsAt: new Date("2026-08-01T19:00:00"),
        endsAt: new Date(
          new Date("2026-08-01T19:00:00").getTime() + DEFAULT_STREAM_DURATION_MS
        ),
      });
    }
  });

  it("creates an all-day schedule that ignores the time field", () => {
    const result = streamCaptureSchema.safeParse(
      baseInput({ planned: true, allDay: true, date: "2026-08-01" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schedule).toEqual({
        allDay: true,
        startsAt: new Date("2026-08-01T00:00:00"),
        endsAt: new Date("2026-08-01T00:00:00"),
      });
    }
  });

  it("requires a date when planned", () => {
    const result = streamCaptureSchema.safeParse(
      baseInput({ planned: true, time: "19:00" })
    );
    expect(result.success).toBe(false);
  });

  it("requires a start time when planned and not all-day", () => {
    const result = streamCaptureSchema.safeParse(
      baseInput({ planned: true, date: "2026-08-01" })
    );
    expect(result.success).toBe(false);
  });
});

describe("streamDetailsSchema", () => {
  it("accepts a valid title update", () => {
    const result = streamDetailsSchema.safeParse({
      id: "stream-1",
      title: "Renamed stream",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank title", () => {
    const result = streamDetailsSchema.safeParse({
      id: "stream-1",
      title: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("retroNotesSchema", () => {
  it("accepts empty retro notes (clearing them)", () => {
    const result = retroNotesSchema.safeParse({
      id: "stream-1",
      retroNotes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects retro notes over the length cap", () => {
    const result = retroNotesSchema.safeParse({
      id: "stream-1",
      retroNotes: "a".repeat(4001),
    });
    expect(result.success).toBe(false);
  });
});

describe("checklistLabelSchema", () => {
  it("rejects a blank label", () => {
    expect(checklistLabelSchema.safeParse("").success).toBe(false);
    expect(checklistLabelSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts a trimmed label", () => {
    const result = checklistLabelSchema.safeParse("  Check mic  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Check mic");
  });
});

describe("attachEventSchema", () => {
  it("rejects empty ids", () => {
    expect(
      attachEventSchema.safeParse({ streamId: "", eventId: "evt-1" }).success
    ).toBe(false);
  });

  it("accepts valid ids", () => {
    expect(
      attachEventSchema.safeParse({ streamId: "s-1", eventId: "evt-1" }).success
    ).toBe(true);
  });
});
