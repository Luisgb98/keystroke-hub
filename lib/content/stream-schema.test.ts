import { describe, expect, it } from "vitest";

import {
  DEFAULT_STREAM_DURATION_MS,
  attachEventSchema,
  checklistLabelSchema,
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
        gameId: null,
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
        // 19:00 Madrid (CEST, +2) as an absolute instant — see #95.
        startsAt: new Date("2026-08-01T17:00:00.000Z"),
        endsAt: new Date(
          new Date("2026-08-01T17:00:00.000Z").getTime() +
            DEFAULT_STREAM_DURATION_MS
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
        // App-zone midnight on 2026-08-01 is 22:00Z the evening before.
        startsAt: new Date("2026-07-31T22:00:00.000Z"),
        endsAt: new Date("2026-07-31T22:00:00.000Z"),
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
      retroNotes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank title", () => {
    const result = streamDetailsSchema.safeParse({
      id: "stream-1",
      title: "",
      notes: "",
      retroNotes: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty retro notes (clearing them)", () => {
    const result = streamDetailsSchema.safeParse({
      id: "stream-1",
      title: "Renamed stream",
      notes: "",
      retroNotes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects retro notes over the length cap, failing the whole save", () => {
    const result = streamDetailsSchema.safeParse({
      id: "stream-1",
      title: "Renamed stream",
      notes: "",
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
