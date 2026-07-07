import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { formatDateParam } from "@/lib/calendar/range";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CalendarHeader } from "./calendar-header";

describe("CalendarHeader", () => {
  it("renders the formatted range label for the current view/date", () => {
    render(<CalendarHeader view="month" date={new Date("2026-07-08")} />);
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("Next pushes the URL for the following period", async () => {
    const user = userEvent.setup();
    render(<CalendarHeader view="day" date={new Date("2026-07-08")} />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(push).toHaveBeenCalledWith("/calendar?view=day&date=2026-07-09");
  });

  it("Previous pushes the URL for the prior period", async () => {
    const user = userEvent.setup();
    render(<CalendarHeader view="week" date={new Date("2026-07-08")} />);

    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(push).toHaveBeenCalledWith("/calendar?view=week&date=2026-07-01");
  });

  it("Today pushes the URL for today, keeping the current view", async () => {
    const user = userEvent.setup();
    render(<CalendarHeader view="week" date={new Date("2026-01-01")} />);

    await user.click(screen.getByRole("button", { name: "Today" }));

    // Matches the app's own local-date formatting (lib/calendar/range.ts) —
    // `toISOString()` is UTC and drifts a day off near local midnight in
    // timezones ahead of UTC.
    const today = formatDateParam(new Date());
    expect(push).toHaveBeenCalledWith(`/calendar?view=week&date=${today}`);
  });

  it("switching tabs pushes the URL for the selected view, keeping the current date", async () => {
    const user = userEvent.setup();
    render(<CalendarHeader view="week" date={new Date("2026-07-08")} />);

    await user.click(screen.getByRole("tab", { name: "Month" }));

    expect(push).toHaveBeenCalledWith("/calendar?view=month&date=2026-07-08");
  });
});
