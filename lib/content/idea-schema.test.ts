import { describe, expect, it } from "vitest";

import {
  ideaCaptureSchema,
  ideaEditSchema,
  ideaStatusSchema,
  normalizeTags,
  PUBLISHING_TAG_STANDARD,
} from "./idea-schema";
import { DEFAULT_RELEASE_TIME } from "./release";

describe("normalizeTags", () => {
  it("returns an empty array for empty/undefined input", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("")).toEqual([]);
  });

  it("trims, lowercases, and splits on commas", () => {
    expect(normalizeTags(" Tutorial ,  Speedrun,VOD")).toEqual([
      "tutorial",
      "speedrun",
      "vod",
    ]);
  });

  it("drops empty entries from stray commas", () => {
    expect(normalizeTags("tutorial,,  ,speedrun")).toEqual([
      "tutorial",
      "speedrun",
    ]);
  });

  it("dedupes while preserving first-seen order and casing precedent", () => {
    expect(normalizeTags("Tutorial, tutorial, TUTORIAL, speedrun")).toEqual([
      "tutorial",
      "speedrun",
    ]);
  });

  it("truncates an overly long tag rather than rejecting it", () => {
    const longTag = "a".repeat(80);
    const [result] = normalizeTags(longTag);
    expect(result).toHaveLength(50);
  });

  it("caps the number of tags rather than rejecting the whole input", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`).join(",");
    expect(normalizeTags(many)).toHaveLength(20);
  });
});

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Speedrun any% commentary",
    notes: "",
    format: undefined,
    tags: undefined,
    ...overrides,
  };
}

/** Five distinct tags — the publishing standard, so a fixture can build valid tag input without spelling it out each time. */
const FIVE_TAGS = "speedrun, glitch, tutorial, any%, vod";

describe("ideaCaptureSchema", () => {
  it("accepts a title-only capture and fills in defaults", () => {
    const result = ideaCaptureSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Speedrun any% commentary",
        notes: null,
        format: "either",
        tags: [],
        release: null,
        script: null,
      });
    }
  });

  it("rejects a blank title", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects a title over 200 characters", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ title: "a".repeat(201) })
    );
    expect(result.success).toBe(false);
  });

  it("accepts full input: notes, format, tags", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({
        notes: "Cover the glitch route",
        format: "video",
        tags: "speedrun, glitch",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Cover the glitch route");
      expect(result.data.format).toBe("video");
      expect(result.data.tags).toEqual(["speedrun", "glitch"]);
    }
  });

  it("rejects an invalid format", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ format: "podcast" })
    );
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only notes down to null", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ notes: "   " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeNull();
    }
  });

  it("keeps a captured script, and nulls an empty one", () => {
    const withScript = ideaCaptureSchema.safeParse(
      baseInput({ script: "# Intro\n\nHello" })
    );
    expect(withScript.success && withScript.data.script).toBe(
      "# Intro\n\nHello"
    );

    const empty = ideaCaptureSchema.safeParse(baseInput({ script: "" }));
    expect(empty.success && empty.data.script).toBeNull();
  });

  it("rejects a script over the length cap", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ script: "a".repeat(200_001) })
    );
    expect(result.success).toBe(false);
  });
});

describe("release date/time parsing", () => {
  it("produces no release when no date is given", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ releaseTime: "20:30" })
    );
    expect(result.success && result.data.release).toBeNull();
  });

  it("defaults the time to 19:00 when a date is set without one", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ releaseDate: "2026-08-01" })
    );
    expect(result.success).toBe(true);
    if (result.success && result.data.release) {
      const { startsAt, endsAt } = result.data.release;
      expect(startsAt).toEqual(new Date("2026-08-01T19:00:00"));
      // 60-minute nominal block (see RELEASE_EVENT_DURATION_MINUTES).
      expect(endsAt.getTime() - startsAt.getTime()).toBe(60 * 60_000);
    }
    expect(DEFAULT_RELEASE_TIME).toBe("19:00");
  });

  it("uses an explicit time when given alongside a date", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ releaseDate: "2026-08-01", releaseTime: "21:15" })
    );
    expect(result.success && result.data.release?.startsAt).toEqual(
      new Date("2026-08-01T21:15:00")
    );
  });

  it("rejects a malformed release date", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ releaseDate: "08/01/2026" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed release time", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ releaseDate: "2026-08-01", releaseTime: "25:99" })
    );
    expect(result.success).toBe(false);
  });
});

describe("the five-tag publishing standard", () => {
  it("uses five as the standard", () => {
    expect(PUBLISHING_TAG_STANDARD).toBe(5);
  });

  it("accepts fewer than five tags (quick capture stays quick)", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ tags: "a, b" }));
    expect(result.success).toBe(true);
  });

  it("accepts exactly five tags", () => {
    const result = ideaCaptureSchema.safeParse(baseInput({ tags: FIVE_TAGS }));
    expect(result.success && result.data.tags).toHaveLength(5);
  });

  it("rejects more than five tags, flagging the tags field", () => {
    const result = ideaCaptureSchema.safeParse(
      baseInput({ tags: "a, b, c, d, e, f" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      expect(flat.tags?.[0]).toContain("5");
    }
  });
});

describe("ideaEditSchema", () => {
  it("parses every editable field and omits the script", () => {
    const result = ideaEditSchema.safeParse(
      baseInput({
        title: "Edited title",
        notes: "new notes",
        format: "stream",
        tags: FIVE_TAGS,
        releaseDate: "2026-09-10",
        releaseTime: "18:00",
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Edited title");
      expect(result.data.format).toBe("stream");
      expect(result.data.tags).toHaveLength(5);
      expect(result.data.release?.startsAt).toEqual(
        new Date("2026-09-10T18:00:00")
      );
      // No `script` key on the edit shape — editing defers to the script page.
      expect("script" in result.data).toBe(false);
    }
  });

  it("treats an empty release date as a cleared release", () => {
    const result = ideaEditSchema.safeParse(baseInput({ releaseDate: "" }));
    expect(result.success && result.data.release).toBeNull();
  });

  it("rejects more than five tags on edit too", () => {
    const result = ideaEditSchema.safeParse(
      baseInput({ tags: "a, b, c, d, e, f" })
    );
    expect(result.success).toBe(false);
  });
});

describe("ideaStatusSchema", () => {
  it("accepts a known status", () => {
    const result = ideaStatusSchema.safeParse({
      id: "abc",
      status: "scripted",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = ideaStatusSchema.safeParse({ id: "abc", status: "vibing" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty id", () => {
    const result = ideaStatusSchema.safeParse({ id: "", status: "idea" });
    expect(result.success).toBe(false);
  });
});
