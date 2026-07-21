import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const detachEventFromStream = vi.hoisted(() => vi.fn());
const searchAttachableEvents = vi.hoisted(() => vi.fn());
const attachEventToStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({
  detachEventFromStream,
  searchAttachableEvents,
  attachEventToStream,
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { StreamEventSection } from "./stream-event-section";

describe("StreamEventSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Unscheduled' with an attach action when there's no event", () => {
    render(<StreamEventSection streamId="s-1" event={null} />);
    expect(screen.getByText("Unscheduled.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Attach an event" })
    ).toBeInTheDocument();
  });

  it("shows the linked event's date with a link to the calendar day view", () => {
    render(
      <StreamEventSection
        streamId="s-1"
        event={{
          id: "evt-1",
          title: "Stream night",
          startsAt: new Date("2026-08-01T19:00:00"),
          endsAt: new Date("2026-08-01T21:00:00"),
          allDay: false,
        }}
      />
    );
    const link = screen.getByRole("link", { name: "Aug 1, 2026 19:00" });
    expect(link).toHaveAttribute("href", "/calendar?view=day&date=2026-08-01");
  });

  it("opens the attach picker", async () => {
    searchAttachableEvents.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<StreamEventSection streamId="s-1" event={null} />);

    await user.click(screen.getByRole("button", { name: "Attach an event" }));

    expect(
      screen.getByRole("dialog", { name: "Attach an event" })
    ).toBeVisible();
  });

  it("detaches the linked event", async () => {
    detachEventFromStream.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <StreamEventSection
        streamId="s-1"
        event={{
          id: "evt-1",
          title: "Stream night",
          startsAt: new Date("2026-08-01T19:00:00"),
          endsAt: new Date("2026-08-01T21:00:00"),
          allDay: false,
        }}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Unschedule this stream" })
    );

    await waitFor(() =>
      expect(detachEventFromStream).toHaveBeenCalledWith("s-1")
    );
  });

  it("toasts an error when detaching fails", async () => {
    detachEventFromStream.mockResolvedValue({
      error: "That stream no longer exists.",
    });
    const user = userEvent.setup();
    render(
      <StreamEventSection
        streamId="s-1"
        event={{
          id: "evt-1",
          title: "Stream night",
          startsAt: new Date("2026-08-01T19:00:00"),
          endsAt: new Date("2026-08-01T21:00:00"),
          allDay: false,
        }}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Unschedule this stream" })
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That stream no longer exists.")
    );
  });
});
