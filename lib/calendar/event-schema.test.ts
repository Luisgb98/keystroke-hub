import { describe, expect, it } from "vitest";

import { eventFormSchema, rescheduleSchema } from "./event-schema";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Sprint planning",
    track: "work",
    description: "",
    allDay: false,
    startDate: "2026-07-08",
    startTime: "09:00",
    endDate: "2026-07-08",
    endTime: "10:00",
    ...overrides,
  };
}

describe("eventFormSchema", () => {
  it("accepts a valid timed work event", () => {
    const result = eventFormSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.track).toBe("work");
      expect(result.data.allDay).toBe(false);
      expect(result.data.startsAt).toEqual(new Date("2026-07-08T09:00:00"));
      expect(result.data.endsAt).toEqual(new Date("2026-07-08T10:00:00"));
      expect(result.data.description).toBeNull();
    }
  });

  it("accepts a valid timed content event", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ track: "content", title: "Record voiceover" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.track).toBe("content");
      expect(result.data.title).toBe("Record voiceover");
    }
  });

  it("accepts a valid all-day event on either track, ignoring time fields", () => {
    const result = eventFormSchema.safeParse(
      baseInput({
        allDay: true,
        startTime: undefined,
        endTime: undefined,
        startDate: "2026-07-08",
        endDate: "2026-07-08",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allDay).toBe(true);
      expect(result.data.startsAt).toEqual(new Date("2026-07-08T00:00:00"));
      expect(result.data.endsAt).toEqual(new Date("2026-07-08T00:00:00"));
    }
  });

  it("normalizes a multi-day all-day event to midnight boundaries", () => {
    const result = eventFormSchema.safeParse(
      baseInput({
        allDay: true,
        startTime: undefined,
        endTime: undefined,
        startDate: "2026-07-08",
        endDate: "2026-07-10",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startsAt).toEqual(new Date("2026-07-08T00:00:00"));
      expect(result.data.endsAt).toEqual(new Date("2026-07-10T00:00:00"));
    }
  });

  it("keeps a non-empty description", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ description: "Plan the next two-week cycle." })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("Plan the next two-week cycle.");
    }
  });

  it("rejects a missing title", () => {
    const result = eventFormSchema.safeParse(baseInput({ title: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a blank (whitespace-only) title", () => {
    const result = eventFormSchema.safeParse(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing track", () => {
    const result = eventFormSchema.safeParse(baseInput({ track: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "track");
      expect(issue?.message).toBe("Choose a track");
    }
  });

  it("rejects an invalid track value", () => {
    const result = eventFormSchema.safeParse(baseInput({ track: "personal" }));
    expect(result.success).toBe(false);
  });

  it("rejects a timed event missing start time", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ startTime: undefined })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "startTime");
      expect(issue?.message).toBe("Start time is required");
    }
  });

  it("rejects a timed event missing end time", () => {
    const result = eventFormSchema.safeParse(baseInput({ endTime: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "endTime");
      expect(issue?.message).toBe("End time is required");
    }
  });

  it("rejects endsAt before startsAt on a timed event", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ startTime: "10:00", endTime: "09:00" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects endsAt before startsAt on an all-day event", () => {
    const result = eventFormSchema.safeParse(
      baseInput({
        allDay: true,
        startTime: undefined,
        endTime: undefined,
        startDate: "2026-07-10",
        endDate: "2026-07-08",
      })
    );
    expect(result.success).toBe(false);
  });

  it("accepts equal start/end on a timed event (zero-duration not allowed by DB, but schema allows the boundary)", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ startTime: "09:00", endTime: "09:00" })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ startDate: "07/08/2026" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time", () => {
    const result = eventFormSchema.safeParse(baseInput({ startTime: "9am" }));
    expect(result.success).toBe(false);
  });
});

describe("rescheduleSchema", () => {
  it("accepts a valid drag/resize payload", () => {
    const result = rescheduleSchema.safeParse({
      id: "evt-1",
      startsAt: new Date("2026-07-08T09:00:00"),
      endsAt: new Date("2026-07-08T10:00:00"),
    });
    expect(result.success).toBe(true);
  });

  it("accepts equal start/end (zero-width boundary)", () => {
    const date = new Date("2026-07-08T09:00:00");
    const result = rescheduleSchema.safeParse({
      id: "evt-1",
      startsAt: date,
      endsAt: date,
    });
    expect(result.success).toBe(true);
  });

  it("rejects endsAt before startsAt", () => {
    const result = rescheduleSchema.safeParse({
      id: "evt-1",
      startsAt: new Date("2026-07-08T10:00:00"),
      endsAt: new Date("2026-07-08T09:00:00"),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "endsAt");
      expect(issue?.message).toBe("End must be after start");
    }
  });

  it("rejects a missing id", () => {
    const result = rescheduleSchema.safeParse({
      id: "",
      startsAt: new Date("2026-07-08T09:00:00"),
      endsAt: new Date("2026-07-08T10:00:00"),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-date startsAt", () => {
    const result = rescheduleSchema.safeParse({
      id: "evt-1",
      startsAt: "2026-07-08T09:00:00",
      endsAt: new Date("2026-07-08T10:00:00"),
    });
    expect(result.success).toBe(false);
  });
});
