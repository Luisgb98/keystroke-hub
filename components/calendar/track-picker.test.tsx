import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrackPicker } from "./track-picker";

describe("TrackPicker", () => {
  it("renders all three tracks with their icon and label", () => {
    render(<TrackPicker value={undefined} onChange={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const name of [/work/i, /content/i, /stream/i]) {
      const option = screen.getByRole("radio", { name });
      expect(option).toBeInTheDocument();
      expect(option.querySelector("svg")).toBeInTheDocument();
    }
  });

  it("has no default selection", () => {
    render(<TrackPicker value={undefined} onChange={vi.fn()} />);

    for (const option of screen.getAllByRole("radio")) {
      expect(option).toHaveAttribute("aria-checked", "false");
    }
  });

  it("reflects the selected value exclusively", () => {
    render(<TrackPicker value="work" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /work/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /content/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: /stream/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("selects stream exclusively too", () => {
    render(<TrackPicker value="stream" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /stream/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /content/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("calls onChange with the clicked track", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TrackPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /content/i }));
    expect(onChange).toHaveBeenCalledWith("content");

    await user.click(screen.getByRole("radio", { name: /stream/i }));
    expect(onChange).toHaveBeenCalledWith("stream");
  });

  it("keeps every option at a tappable height", () => {
    render(<TrackPicker value={undefined} onChange={vi.fn()} />);

    for (const option of screen.getAllByRole("radio")) {
      expect(option.className).toContain("min-h-11");
    }
  });
});
