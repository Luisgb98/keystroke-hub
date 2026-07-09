import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const attachEventToStream = vi.hoisted(() => vi.fn());
const searchAttachableEvents = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({
  attachEventToStream,
  searchAttachableEvents,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { AttachableEvent } from "@/lib/data/streams";
import { EventAttachPicker } from "./event-attach-picker";

const events: AttachableEvent[] = [
  {
    id: "evt-1",
    title: "Stream night",
    startsAt: new Date("2026-08-01T19:00:00"),
    endsAt: new Date("2026-08-01T21:00:00"),
    allDay: false,
  },
];

describe("EventAttachPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    searchAttachableEvents.mockResolvedValue(events);
    render(
      <EventAttachPicker streamId="s-1" open={false} onOpenChange={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads and renders matching events when opened", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    render(<EventAttachPicker streamId="s-1" open onOpenChange={vi.fn()} />);

    await waitFor(() =>
      expect(searchAttachableEvents).toHaveBeenCalledWith("")
    );
    expect(await screen.findByText("Stream night")).toBeInTheDocument();
  });

  it("re-queries as the search text changes", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    const user = userEvent.setup();
    render(<EventAttachPicker streamId="s-1" open onOpenChange={vi.fn()} />);
    await screen.findByText("Stream night");

    await user.type(screen.getByLabelText("Search events"), "night");

    await waitFor(() =>
      expect(searchAttachableEvents).toHaveBeenLastCalledWith("night")
    );
  });

  it("shows a 'no matching events' message for an empty result set with a query", async () => {
    searchAttachableEvents.mockResolvedValue([]);
    render(<EventAttachPicker streamId="s-1" open onOpenChange={vi.fn()} />);
    expect(
      await screen.findByText("No events left to attach.")
    ).toBeInTheDocument();
  });

  it("attaches the selected event and closes the picker", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    attachEventToStream.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EventAttachPicker streamId="s-1" open onOpenChange={onOpenChange} />
    );
    await screen.findByText("Stream night");

    await user.click(screen.getByText("Stream night"));

    await waitFor(() =>
      expect(attachEventToStream).toHaveBeenCalledWith("s-1", "evt-1")
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith('Attached to "Stream night"');
  });

  it("toasts an error and keeps the picker open when attaching fails", async () => {
    searchAttachableEvents.mockResolvedValue(events);
    attachEventToStream.mockResolvedValue({
      error: "That event is already attached to another stream.",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EventAttachPicker streamId="s-1" open onOpenChange={onOpenChange} />
    );
    await screen.findByText("Stream night");

    await user.click(screen.getByText("Stream night"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "That event is already attached to another stream."
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
