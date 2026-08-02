import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TRACK_KINDS, type TrackKind } from "@/lib/calendar/track-kind";
import { TRACK_LABEL } from "@/components/calendar/track-styles";

import { TrackShowcase } from "./track-showcase";

const SURFACE: Record<TrackKind, string> = {
  work: "bg-track-work",
  content: "bg-track-content",
  stream: "bg-track-stream",
};

describe("TrackShowcase", () => {
  it("shows all three worlds side by side", () => {
    render(<TrackShowcase />);

    for (const kind of TRACK_KINDS) {
      expect(screen.getByText(TRACK_LABEL[kind])).toBeInTheDocument();
    }
  });

  it("pairs every card's color with an icon and a label, never color alone", () => {
    const { container } = render(<TrackShowcase />);

    for (const kind of TRACK_KINDS) {
      const card = container.querySelector(`.${SURFACE[kind]}`);
      expect(card, `${kind} card`).not.toBeNull();
      expect(card!.querySelector("svg"), `${kind} icon`).not.toBeNull();
      expect(card!.textContent).toContain(TRACK_LABEL[kind]);
    }
  });

  it("gives the stream card its own purple surface", () => {
    const { container } = render(<TrackShowcase />);

    const card = container.querySelector(".bg-track-stream");
    expect(card).toHaveClass("border-track-stream-border");
    expect(card).not.toHaveClass("bg-track-content");
  });
});
