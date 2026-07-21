import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { MeetingSearch } from "./meeting-search";

describe("MeetingSearch", () => {
  it("renders the current value", () => {
    render(<MeetingSearch value="roadmap" />);
    expect(screen.getByLabelText("Search meeting notes")).toHaveValue(
      "roadmap"
    );
  });

  it("navigates with the query after debouncing", async () => {
    const user = userEvent.setup();
    render(<MeetingSearch value="" />);

    await user.type(screen.getByLabelText("Search meeting notes"), "roadmap");

    await waitFor(
      () =>
        expect(replace).toHaveBeenLastCalledWith(
          "/projects/meetings?q=roadmap"
        ),
      { timeout: 1000 }
    );
  });

  it("navigates to the bare path when cleared", async () => {
    const user = userEvent.setup();
    render(<MeetingSearch value="roadmap" />);

    await user.clear(screen.getByLabelText("Search meeting notes"));

    await waitFor(
      () => expect(replace).toHaveBeenLastCalledWith("/projects/meetings"),
      { timeout: 1000 }
    );
  });
});
