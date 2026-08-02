import { Radio } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IDEA_FORMAT_ICON } from "@/components/content/idea-format-styles";
import { TRACK_KINDS } from "@/lib/calendar/track-kind";

import { TRACK_ICON, TRACK_LABEL, TRACK_SURFACE_CLASSES } from "./track-styles";

describe("track visuals", () => {
  it.each(TRACK_KINDS)("gives %s an icon, a label and a surface", (kind) => {
    // Color is never the only signal — every kind carries all three.
    expect(TRACK_ICON[kind]).toBeTruthy();
    expect(TRACK_LABEL[kind]).toBeTruthy();
    expect(TRACK_SURFACE_CLASSES[kind]).toBeTruthy();
  });

  it("gives each kind its own icon, label and surface", () => {
    const icons = TRACK_KINDS.map((kind) => TRACK_ICON[kind]);
    const labels = TRACK_KINDS.map((kind) => TRACK_LABEL[kind]);
    const surfaces = TRACK_KINDS.map((kind) => TRACK_SURFACE_CLASSES[kind]);
    expect(new Set(icons).size).toBe(TRACK_KINDS.length);
    expect(new Set(labels).size).toBe(TRACK_KINDS.length);
    expect(new Set(surfaces).size).toBe(TRACK_KINDS.length);
  });

  it("reuses the icon the app already spends on streams", () => {
    expect(TRACK_ICON.stream).toBe(Radio);
    expect(TRACK_ICON.stream).toBe(IDEA_FORMAT_ICON.stream);
  });

  it("labels the stream track 'Stream'", () => {
    expect(TRACK_LABEL.stream).toBe("Stream");
  });

  it.each(TRACK_KINDS)("builds %s's surface only from track tokens", (kind) => {
    // No raw color, no semantic token — see docs/design-system.md.
    for (const className of TRACK_SURFACE_CLASSES[kind].split(/\s+/)) {
      expect(className).toMatch(
        new RegExp(`^(?:border|bg|text)-track-${kind}(?:-[a-z]+)?$`)
      );
    }
  });
});
