import { describe, expect, it } from "vitest";

import {
  TRACK_KINDS,
  isTrackKind,
  trackForKind,
  trackKindOf,
} from "./track-kind";

describe("TRACK_KINDS", () => {
  it("lists exactly the three kinds a block can read as", () => {
    expect(TRACK_KINDS).toEqual(["work", "content", "stream"]);
  });
});

describe("isTrackKind", () => {
  it.each(TRACK_KINDS)("accepts %s", (kind) => {
    expect(isTrackKind(kind)).toBe(true);
  });

  it.each([undefined, null, "", "Stream", "streams", 1])(
    "rejects %s",
    (value) => {
      expect(isTrackKind(value)).toBe(false);
    }
  );
});

describe("trackForKind", () => {
  it("stores a stream on the content track", () => {
    // The strict two-world boundary is unchanged: a stream is content work,
    // so it syncs through the content calendar and can carry idea links.
    expect(trackForKind("stream")).toBe("content");
  });

  it("leaves the two real track values alone", () => {
    expect(trackForKind("work")).toBe("work");
    expect(trackForKind("content")).toBe("content");
  });
});

describe("trackKindOf", () => {
  it("reads a content event with a session behind it as a stream", () => {
    expect(trackKindOf({ track: "content", streamId: "s-1" })).toBe("stream");
  });

  it("reads a content event with no session as content", () => {
    expect(trackKindOf({ track: "content", streamId: null })).toBe("content");
  });

  it("reads a work event as work", () => {
    expect(trackKindOf({ track: "work", streamId: null })).toBe("work");
  });

  it("never reads a work event as a stream, even if one somehow points at it", () => {
    // The DB forbids it (`streams_event_track_content`), but the display layer
    // must not be the thing that depends on that holding.
    expect(trackKindOf({ track: "work", streamId: "s-1" })).toBe("work");
  });

  it("round-trips: every kind survives store-then-read", () => {
    for (const kind of TRACK_KINDS) {
      const stored = {
        track: trackForKind(kind),
        streamId: kind === "stream" ? "s-1" : null,
      };
      expect(trackKindOf(stored)).toBe(kind);
    }
  });
});
