import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { todayParam } from "@/lib/journal/dates";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DayHeader } from "./day-header";

describe("DayHeader", () => {
  it("shows the formatted day label", () => {
    render(<DayHeader logDate="2026-07-08" />);
    expect(screen.getByText("Wednesday, July 8, 2026")).toBeInTheDocument();
  });

  it("Previous day navigates back one day", async () => {
    const user = userEvent.setup();
    render(<DayHeader logDate="2026-07-08" />);

    await user.click(screen.getByRole("button", { name: "Previous day" }));

    expect(push).toHaveBeenCalledWith("/journal?date=2026-07-07");
  });

  it("Next day navigates forward one day", async () => {
    const user = userEvent.setup();
    render(<DayHeader logDate="2026-07-08" />);

    await user.click(screen.getByRole("button", { name: "Next day" }));

    expect(push).toHaveBeenCalledWith("/journal?date=2026-07-09");
  });

  it("shows a Today shortcut when viewing a different day", async () => {
    const user = userEvent.setup();
    render(<DayHeader logDate="2026-07-08" />);

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(push).toHaveBeenCalledWith(`/journal?date=${todayParam()}`);
  });

  it("hides the Today shortcut when already viewing today", () => {
    render(<DayHeader logDate={todayParam()} />);
    expect(
      screen.queryByRole("button", { name: "Today" })
    ).not.toBeInTheDocument();
  });

  it("jumping to a date via the date input navigates there", () => {
    render(<DayHeader logDate="2026-07-08" />);

    fireEvent.change(screen.getByLabelText("Jump to date"), {
      target: { value: "2026-08-15" },
    });

    expect(push).toHaveBeenCalledWith("/journal?date=2026-08-15");
  });

  it("a half-typed date does not navigate anywhere", () => {
    push.mockClear();
    render(<DayHeader logDate="2026-07-08" />);

    const input = screen.getByLabelText("Jump to date");
    for (const partial of ["2026-08", "2026-08-", "2026-08-1"]) {
      fireEvent.change(input, { target: { value: partial } });
    }

    expect(push).not.toHaveBeenCalled();
    // The draft is still shown, so the next keystroke completes the date.
    expect(input).toHaveValue("2026-08-1");

    fireEvent.change(input, { target: { value: "2026-08-15" } });
    expect(push).toHaveBeenCalledWith("/journal?date=2026-08-15");
  });

  it("selecting a day in the calendar navigates immediately", async () => {
    push.mockClear();
    const user = userEvent.setup();
    render(<DayHeader logDate="2026-07-08" />);

    await user.click(screen.getByRole("button", { name: "Open day calendar" }));
    await user.click(
      await screen.findByRole("button", { name: "Monday, July 20th, 2026" })
    );

    expect(push).toHaveBeenCalledWith("/journal?date=2026-07-20");
  });
});

describe("phone layout (#114)", () => {
  it("gives the long date its own row on a phone and puts it back beside the picker from md up", () => {
    // Sharing a row with the 10rem picker at 390px left "Tuesday, August 25,
    // 2026" wrapping mid-date.
    render(<DayHeader logDate="2026-08-25" />);
    const label = screen.getByText("Tuesday, August 25, 2026");
    expect(label).toHaveClass("order-1");
    expect(label).toHaveClass("w-full");
    expect(label).toHaveClass("md:order-none");
    expect(label).toHaveClass("md:ml-auto");
    expect(label).toHaveClass("md:w-auto");
  });
});
