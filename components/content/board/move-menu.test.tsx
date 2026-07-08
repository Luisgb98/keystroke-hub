import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MoveMenu } from "./move-menu";

describe("MoveMenu", () => {
  it("lists every other stage, excluding the current one", async () => {
    const user = userEvent.setup();
    render(
      <MoveMenu
        ideaTitle="Speedrun commentary"
        currentStatus="scripted"
        onMove={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );

    expect(await screen.findByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByText("Outlined")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Parked")).toBeInTheDocument();
    expect(screen.queryByText("Scripted")).not.toBeInTheDocument();
  });

  it("calls onMove with the selected stage", async () => {
    const onMove = vi.fn();
    const user = userEvent.setup();
    render(
      <MoveMenu
        ideaTitle="Speedrun commentary"
        currentStatus="scripted"
        onMove={onMove}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(await screen.findByText("Parked"));

    expect(onMove).toHaveBeenCalledWith("parked");
  });

  it("has no next-stage emphasis after the final stage", async () => {
    const user = userEvent.setup();
    render(
      <MoveMenu
        ideaTitle="Speedrun commentary"
        currentStatus="parked"
        onMove={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );

    // Every stage is offered, just none visually emphasized as "next".
    expect(await screen.findByText("Spark")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});
