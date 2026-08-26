import { describe, expect, it } from "vitest";

import { eventFormSchema, rescheduleSchema } from "./event-schema";

/**
 * Runs under `TZ=UTC` (vitest.config.ts) while the app zone is Europe/Madrid,
 * so every instant below is asserted as an absolute `…Z` value. Comparing
 * against `new Date("2026-07-08T09:00:00")` — the shape these tests used to
 * have — re-parses the same wall clock the schema parses, agrees with it in
 * every timezone, and is exactly why the +2h shift shipped unnoticed (#95).
 */

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
      expect(result.data.startsAt.toISOString()).toBe(
        "2026-07-08T07:00:00.000Z"
      );
      expect(result.data.endsAt.toISOString()).toBe("2026-07-08T08:00:00.000Z");
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

  it("accepts a stream, storing it on the content track", () => {
    // A stream is content work at the data level (issue #104) — it's the
    // *kind* that carries the distinction, so the two travel side by side.
    const result = eventFormSchema.safeParse(
      baseInput({ track: "stream", title: "Friday ranked run" })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.track).toBe("content");
      expect(result.data.kind).toBe("stream");
    }
  });

  it.each([
    ["work", "work"],
    ["content", "content"],
  ])("keeps kind and track identical for %s", (input, track) => {
    const result = eventFormSchema.safeParse(baseInput({ track: input }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.track).toBe(track);
      expect(result.data.kind).toBe(input);
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
      expect(result.data.startsAt.toISOString()).toBe(
        "2026-07-07T22:00:00.000Z"
      );
      expect(result.data.endsAt.toISOString()).toBe("2026-07-07T22:00:00.000Z");
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
      expect(result.data.startsAt.toISOString()).toBe(
        "2026-07-07T22:00:00.000Z"
      );
      expect(result.data.endsAt.toISOString()).toBe("2026-07-09T22:00:00.000Z");
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

/**
 * The single-day rule (#115). Content and stream events end on the day they
 * start; work keeps the full range. The schema is the one choke point all
 * three write paths — editor, drag/resize and MCP — pass through.
 */
describe("eventFormSchema — single-day content", () => {
  function content(overrides: Record<string, unknown> = {}) {
    return baseInput({ track: "content", title: "Release", ...overrides });
  }

  it("accepts a timed content event inside one day", () => {
    const result = eventFormSchema.safeParse(
      content({ startTime: "19:00", endTime: "20:00" })
    );
    expect(result.success).toBe(true);
    expect(result.data!.startsAt.toISOString()).toBe(
      "2026-07-08T17:00:00.000Z"
    );
    expect(result.data!.endsAt.toISOString()).toBe("2026-07-08T18:00:00.000Z");
  });

  it("ignores a submitted end date entirely and derives it from the start", () => {
    // The editor mounts no end-date input for these kinds, but a stale value
    // could still ride along in FormData — and used to, as the 23:00 → next
    // day 00:00 default that produced two-day releases.
    const result = eventFormSchema.safeParse(
      content({ endDate: "2026-07-20", startTime: "19:00", endTime: "20:00" })
    );
    expect(result.success).toBe(true);
    expect(result.data!.endsAt.toISOString()).toBe("2026-07-08T18:00:00.000Z");
  });

  it("does not need an end date at all", () => {
    const input = content({ startTime: "19:00", endTime: "20:00" });
    delete (input as Record<string, unknown>).endDate;
    expect(eventFormSchema.safeParse(input).success).toBe(true);
  });

  it("rejects an end time at or before the start, in plain words", () => {
    for (const endTime of ["19:00", "18:00"]) {
      const result = eventFormSchema.safeParse(
        content({ startTime: "19:00", endTime })
      );
      expect(result.success, endTime).toBe(false);
      const issue = result.error!.issues[0];
      expect(issue.path).toEqual(["endTime"]);
      expect(issue.message).toMatch(/same day/);
    }
  });

  it("rejects the midnight-spanning default outright", () => {
    // 23:00 → 00:00 was the live bug: a "stream" that ended the next day.
    const result = eventFormSchema.safeParse(
      content({ startTime: "23:00", endTime: "00:00" })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toMatch(/same day/);
  });

  it("makes an all-day content event exactly one day", () => {
    const result = eventFormSchema.safeParse(
      content({ allDay: true, endDate: "2026-07-20" })
    );
    expect(result.success).toBe(true);
    // A single-day all-day event stores startsAt === endsAt (docs/calendar.md).
    expect(result.data!.endsAt.toISOString()).toBe(
      result.data!.startsAt.toISOString()
    );
  });

  it("applies the same rule to a stream, which stores as content", () => {
    const result = eventFormSchema.safeParse(
      content({ track: "stream", startTime: "23:00", endTime: "01:00" })
    );
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toMatch(/same day/);

    const ok = eventFormSchema.safeParse(
      content({ track: "stream", startTime: "20:00", endTime: "22:00" })
    );
    expect(ok.success).toBe(true);
    expect(ok.data!.track).toBe("content");
    expect(ok.data!.kind).toBe("stream");
  });

  it("leaves multi-day work events alone", () => {
    const result = eventFormSchema.safeParse(
      baseInput({ endDate: "2026-07-10" })
    );
    expect(result.success).toBe(true);
    expect(result.data!.endsAt.toISOString()).toBe("2026-07-10T08:00:00.000Z");
  });

  it("still requires an end date for a work event", () => {
    const input = baseInput();
    delete (input as Record<string, unknown>).endDate;
    const result = eventFormSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].path).toEqual(["endDate"]);
  });
});
