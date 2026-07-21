import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/lib/calendar/types";

const rescheduleEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calendar/actions", () => ({ rescheduleEvent }));

const toast = vi.hoisted(() => {
  const fn = vi.fn() as unknown as {
    (...args: unknown[]): void;
    error: ReturnType<typeof vi.fn>;
  };
  fn.error = vi.fn();
  return fn;
});
vi.mock("sonner", () => ({ toast }));

import { useEventReschedule } from "./use-event-reschedule";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    track: "work",
    title: "Sprint planning",
    description: null,
    startsAt: new Date("2026-07-08T09:00:00"),
    endsAt: new Date("2026-07-08T10:00:00"),
    allDay: false,
    conflictNote: null,
    linkedIdeas: [],
    ...overrides,
  };
}

const shifted = {
  startsAt: new Date("2026-07-08T10:00:00"),
  endsAt: new Date("2026-07-08T11:00:00"),
};

function Harness({ event }: { event: CalendarEvent }) {
  const { events, reschedule, isPending } = useEventReschedule([event]);
  const current = events[0];
  return (
    <div>
      <span data-testid="start">{current.startsAt.toISOString()}</span>
      <span data-testid="pending">{String(isPending)}</span>
      <button type="button" onClick={() => reschedule(event, shifted)}>
        drag
      </button>
      <button
        type="button"
        onClick={() =>
          reschedule(event, { startsAt: event.startsAt, endsAt: event.endsAt })
        }
      >
        drop-at-origin
      </button>
    </div>
  );
}

describe("useEventReschedule", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies the shift optimistically before the mutation resolves", async () => {
    let resolvePromise: (value: { error?: string }) => void = () => {};
    rescheduleEvent.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const user = userEvent.setup();
    render(<Harness event={makeEvent()} />);

    await user.click(screen.getByText("drag"));

    await waitFor(() =>
      expect(screen.getByTestId("start")).toHaveTextContent(
        shifted.startsAt.toISOString()
      )
    );

    await act(async () => {
      resolvePromise({});
    });
  });

  it("calls rescheduleEvent with the new bounds and shows a success toast", async () => {
    rescheduleEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(<Harness event={makeEvent()} />);

    await user.click(screen.getByText("drag"));

    await waitFor(() =>
      expect(rescheduleEvent).toHaveBeenCalledWith(
        "evt-1",
        shifted.startsAt,
        shifted.endsAt
      )
    );
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rolls back and shows an error toast when the mutation fails", async () => {
    rescheduleEvent.mockResolvedValue({
      error: "That event no longer exists.",
    });
    const user = userEvent.setup();
    render(<Harness event={makeEvent()} />);

    await user.click(screen.getByText("drag"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("That event no longer exists.")
    );
    await waitFor(() =>
      expect(screen.getByTestId("start")).toHaveTextContent(
        makeEvent().startsAt.toISOString()
      )
    );
  });

  it("is a no-op when the shift matches the event's current bounds", async () => {
    const user = userEvent.setup();
    render(<Harness event={makeEvent()} />);

    await user.click(screen.getByText("drop-at-origin"));

    expect(rescheduleEvent).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
