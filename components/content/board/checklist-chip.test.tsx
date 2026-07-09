import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChecklistChip } from "./checklist-chip";

describe("ChecklistChip", () => {
  it("renders nothing when there are no checklist items", () => {
    const { container } = render(
      <ChecklistChip
        ideaTitle="Boss rush"
        done={0}
        total={0}
        onOpen={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the done/total count", () => {
    render(
      <ChecklistChip
        ideaTitle="Boss rush"
        done={2}
        total={4}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <ChecklistChip ideaTitle="Boss rush" done={2} total={4} onOpen={onOpen} />
    );

    await user.click(
      screen.getByRole("button", {
        name: 'Open publish checklist for "Boss rush" (2 of 4 done)',
      })
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has no complete-state icon while incomplete", () => {
    render(
      <ChecklistChip
        ideaTitle="Boss rush"
        done={2}
        total={4}
        onOpen={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: /Boss rush/ });
    expect(button.querySelector("svg")).not.toBeInTheDocument();
  });

  it("shows a complete-state icon once every item is done", () => {
    render(
      <ChecklistChip
        ideaTitle="Boss rush"
        done={4}
        total={4}
        onOpen={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: /Boss rush/ });
    expect(button.querySelector("svg")).toBeInTheDocument();
  });
});
