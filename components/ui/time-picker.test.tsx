import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { isTimeValue, TimePicker, timeOptions } from "./time-picker";

describe("timeOptions", () => {
  it("covers a full day on the given step", () => {
    const half = timeOptions(30);

    expect(half).toHaveLength(48);
    expect(half[0]).toBe("00:00");
    expect(half[1]).toBe("00:30");
    expect(half.at(-1)).toBe("23:30");
  });

  it("zero-pads every hour and minute", () => {
    expect(timeOptions(60)).toContain("09:00");
    expect(timeOptions(15)).toContain("00:15");
    expect(timeOptions(15)).toHaveLength(96);
  });
});

describe("isTimeValue", () => {
  it("accepts valid 24h times", () => {
    expect(isTimeValue("00:00")).toBe(true);
    expect(isTimeValue("09:30")).toBe(true);
    expect(isTimeValue("23:59")).toBe(true);
  });

  it("rejects partial and out-of-range times", () => {
    expect(isTimeValue("")).toBe(false);
    expect(isTimeValue("9:30")).toBe(false);
    expect(isTimeValue("24:00")).toBe(false);
    expect(isTimeValue("12:60")).toBe(false);
    expect(isTimeValue("12")).toBe(false);
  });
});

describe("TimePicker", () => {
  it("shows the current value and stays typeable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker aria-label="Start time" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Start time");
    expect(input).toHaveValue("");

    await user.type(input, "1");

    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("picking a listed time emits it and closes the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TimePicker
        aria-label="Start time"
        value="09:00"
        onChange={onChange}
        triggerLabel="Choose start time"
      />
    );

    await user.click(screen.getByRole("button", { name: "Choose start time" }));
    await user.click(await screen.findByRole("option", { name: "14:30" }));

    expect(onChange).toHaveBeenCalledWith("14:30");
  });

  it("marks the current value as the selected option", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start time" value="09:00" />);

    await user.click(screen.getByRole("button", { name: "Choose time" }));

    expect(
      await screen.findByRole("option", { name: "09:00" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "09:30" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("opens focused on the current time, not the first option", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start time" value="19:00" />);

    await user.click(screen.getByRole("button", { name: "Choose time" }));

    // Landing on 00:00 would also scroll the list back to midnight, burying
    // the value the field already holds.
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "19:00" })).toHaveFocus()
    );
  });

  it("offers times on the requested step", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start time" value="" step={60} />);

    await user.click(screen.getByRole("button", { name: "Choose time" }));

    expect(await screen.findAllByRole("option")).toHaveLength(24);
  });

  it("runs uncontrolled off defaultValue for plain forms", async () => {
    const user = userEvent.setup();
    render(
      <form>
        <TimePicker aria-label="Time" name="time" defaultValue="19:00" />
      </form>
    );

    const input = screen.getByLabelText("Time");
    expect(input).toHaveValue("19:00");
    expect(input).toHaveAttribute("name", "time");

    await user.click(screen.getByRole("button", { name: "Choose time" }));
    await user.click(await screen.findByRole("option", { name: "21:00" }));

    expect(input).toHaveValue("21:00");
  });

  it("clearing the field empties the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker aria-label="Time" value="19:00" onChange={onChange} />);

    await user.clear(screen.getByLabelText("Time"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables both the field and the clock trigger", () => {
    render(<TimePicker aria-label="Time" value="19:00" disabled />);

    expect(screen.getByLabelText("Time")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose time" })).toBeDisabled();
  });
});
