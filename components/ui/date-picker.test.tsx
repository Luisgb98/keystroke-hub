import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Calendar, appToday } from "./calendar";
import { DatePicker, formatDateValue, parseDateValue } from "./date-picker";

describe("parseDateValue", () => {
  it("parses a yyyy-MM-dd string as a local date", () => {
    const parsed = parseDateValue("2026-08-15");

    expect(parsed).toBeInstanceOf(Date);
    // Local getters, not UTC ones: a UTC-parsed "2026-08-15" reads as the 14th
    // anywhere west of Greenwich, which is exactly the drift this avoids.
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(7);
    expect(parsed?.getDate()).toBe(15);
  });

  it("round-trips through formatDateValue without shifting the day", () => {
    expect(formatDateValue(parseDateValue("2026-01-01")!)).toBe("2026-01-01");
    expect(formatDateValue(parseDateValue("2026-12-31")!)).toBe("2026-12-31");
    expect(formatDateValue(parseDateValue("2026-03-29")!)).toBe("2026-03-29");
  });

  it("rejects empty, partial, and impossible dates", () => {
    expect(parseDateValue("")).toBeUndefined();
    expect(parseDateValue("2026-08")).toBeUndefined();
    expect(parseDateValue("2026-08-1")).toBeUndefined();
    expect(parseDateValue("not a date")).toBeUndefined();
    expect(parseDateValue("2026-02-30")).toBeUndefined();
    expect(parseDateValue("2026-13-01")).toBeUndefined();
  });
});

describe("DatePicker", () => {
  it("renders the value as typed text and keeps typing working", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        aria-label="Start"
        value=""
        onChange={onChange}
        triggerLabel="Open start calendar"
      />
    );

    await user.type(screen.getByLabelText("Start"), "2");

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows the current value in the field", () => {
    render(<DatePicker aria-label="Start" value="2026-08-15" />);

    expect(screen.getByLabelText("Start")).toHaveValue("2026-08-15");
  });

  it("picking a day in the popover emits that day, never the one before", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        aria-label="Start"
        value="2026-08-15"
        onChange={onChange}
        triggerLabel="Open start calendar"
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Open start calendar" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Thursday, August 20th, 2026" })
    );

    expect(onChange).toHaveBeenCalledWith("2026-08-20");
  });

  it("opens the calendar on the month of the current value", async () => {
    const user = userEvent.setup();
    render(<DatePicker aria-label="Start" value="2026-08-15" />);

    await user.click(screen.getByRole("button", { name: "Open calendar" }));

    expect(await screen.findByText("August 2026")).toBeInTheDocument();
  });

  it("runs uncontrolled off defaultValue so it can sit in a plain form", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <DatePicker aria-label="Date" name="date" defaultValue="2026-08-15" />
      </form>
    );

    const input = screen.getByLabelText("Date");
    expect(input).toHaveValue("2026-08-15");
    expect(input).toHaveAttribute("name", "date");

    await user.clear(input);
    await user.type(input, "2026-09-01");

    expect(input).toHaveValue("2026-09-01");
  });

  it("clearing the field empties the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker aria-label="Date" value="2026-08-15" onChange={onChange} />
    );

    await user.clear(screen.getByLabelText("Date"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables both the field and the calendar trigger", () => {
    render(<DatePicker aria-label="Date" value="2026-08-15" disabled />);

    expect(screen.getByLabelText("Date")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Open calendar" })
    ).toBeDisabled();
  });
});

/**
 * The calendar's "today" is the owner's today, not the runtime's.
 *
 * `DayPicker` defaults to `new Date()`, which on Vercel means UTC — and for
 * two hours every night UTC is still on the previous day while the app zone
 * (Europe/Madrid) has already rolled over. The clock is pinned inside that
 * window here, so this holds whatever time the suite happens to run at; it
 * went red in CI at 22:12 UTC before the fix.
 */
describe("today, in the app timezone", () => {
  const IN_THE_WINDOW = new Date("2026-08-25T22:30:00Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the app-zone day, not the process day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(IN_THE_WINDOW);

    // 22:30 UTC on the 25th is 00:30 on the 26th in Madrid.
    const today = appToday();
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(7);
    expect(today.getDate()).toBe(26);
  });

  it("marks that day as Today in the grid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(IN_THE_WINDOW);

    // The calendar itself, not through the popover: the fix lives in
    // `Calendar`'s `today` default, and driving Base UI's popover open under
    // fake timers buys nothing but a stalled animation frame.
    render(<Calendar mode="single" />);

    expect(
      screen.getByRole("button", {
        name: "Today, Wednesday, August 26th, 2026",
      })
    ).toBeInTheDocument();
    // …and the day the server's own clock is still on is not it.
    expect(
      screen.queryByRole("button", {
        name: "Today, Tuesday, August 25th, 2026",
      })
    ).not.toBeInTheDocument();
  });

  it("opens on the app-zone month when no date is selected", () => {
    vi.useFakeTimers();
    // 22:30 UTC on Aug 31 is already September for the owner.
    vi.setSystemTime(new Date("2026-08-31T22:30:00Z"));

    expect(appToday().getMonth()).toBe(8);
  });
});
