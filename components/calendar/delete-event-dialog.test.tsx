import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calendar/actions", () => ({ deleteEvent }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import type { CalendarEvent } from "@/lib/calendar/types";
import { DeleteEventDialog } from "./delete-event-dialog";

const event: CalendarEvent = {
  id: "evt-1",
  track: "work",
  title: "Sprint planning",
  description: null,
  startsAt: new Date("2026-07-08T09:00:00"),
  endsAt: new Date("2026-07-08T10:00:00"),
  allDay: false,
  conflictNote: null,
};

describe("DeleteEventDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("confirms deletion, toasts, and calls onDeleted", async () => {
    deleteEvent.mockResolvedValue({});
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteEventDialog
        event={event}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    expect(screen.getByText(/Sprint planning/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteEvent).toHaveBeenCalledWith("evt-1");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("cancels without deleting", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteEventDialog
        event={event}
        open
        onOpenChange={onOpenChange}
        onDeleted={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("toasts an error and does not call onDeleted when the event is already gone", async () => {
    deleteEvent.mockResolvedValue({ error: "That event no longer exists." });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteEventDialog
        event={event}
        open
        onOpenChange={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That event no longer exists.")
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
