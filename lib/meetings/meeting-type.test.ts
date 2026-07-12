import { describe, expect, it } from "vitest";

import {
  INITIAL_MEETING_TYPE,
  isMeetingType,
  MEETING_TYPE_LABEL,
  MEETING_TYPES,
} from "./meeting-type";

describe("meeting-type", () => {
  it("defines the fixed vocabulary with 'other' as the escape hatch", () => {
    expect(MEETING_TYPES).toEqual([
      "standup",
      "planning",
      "retro",
      "one_on_one",
      "review",
      "other",
    ]);
  });

  it("defaults to 'other'", () => {
    expect(INITIAL_MEETING_TYPE).toBe("other");
    expect(MEETING_TYPES).toContain(INITIAL_MEETING_TYPE);
  });

  it("has a label for every type", () => {
    for (const type of MEETING_TYPES) {
      expect(MEETING_TYPE_LABEL[type]).toBeTruthy();
    }
  });

  it("validates known types and rejects unknown ones", () => {
    expect(isMeetingType("standup")).toBe(true);
    expect(isMeetingType("one_on_one")).toBe(true);
    expect(isMeetingType("other")).toBe(true);
    expect(isMeetingType("brainstorm")).toBe(false);
    expect(isMeetingType(42)).toBe(false);
    expect(isMeetingType(undefined)).toBe(false);
  });
});
