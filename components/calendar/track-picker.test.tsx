import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TrackPicker } from "./track-picker";

describe("TrackPicker", () => {
  it("renders both tracks with their icon and label", () => {
    render(<TrackPicker value={undefined} onChange={vi.fn()} />);

    const work = screen.getByRole("radio", { name: /work/i });
    const content = screen.getByRole("radio", { name: /content/i });
    expect(work).toBeInTheDocument();
    expect(content).toBeInTheDocument();
    expect(work.querySelector("svg")).toBeInTheDocument();
    expect(content.querySelector("svg")).toBeInTheDocument();
  });

  it("has no default selection", () => {
    render(<TrackPicker value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /work/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: /content/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
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
  });

  it("calls onChange with the clicked track", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TrackPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /content/i }));
    expect(onChange).toHaveBeenCalledWith("content");
  });
});
