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
    streamId: null,
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

/**
 * The single-day clamp (#115). A move preserves duration and so can't break
 * the rule on its own; resizing the end edge can, and is pulled back to 23:59
 * of the start's day rather than refused mid-gesture.
 */
describe("useEventReschedule — single-day content", () => {
  /** 22:00 Madrid on the 8th, dragged out to 02:00 on the 9th. */
  const overrun = {
    startsAt: new Date("2026-07-08T20:00:00Z"),
    endsAt: new Date("2026-07-09T00:00:00Z"),
  };

  function OverrunHarness({ event }: { event: CalendarEvent }) {
    const { reschedule } = useEventReschedule([event]);
    return (
      <button type="button" onClick={() => reschedule(event, overrun)}>
        resize
      </button>
    );
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["a content event", { track: "content" as const, streamId: null }],
    ["a stream block", { track: "content" as const, streamId: "stream-1" }],
  ])("clamps %s to the end of its start day", async (_label, overrides) => {
    rescheduleEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OverrunHarness event={makeEvent(overrides)} />);

    await user.click(screen.getByText("resize"));

    await waitFor(() => expect(rescheduleEvent).toHaveBeenCalled());
    const [, startsAt, endsAt] = rescheduleEvent.mock.calls[0];
    expect(startsAt).toEqual(overrun.startsAt);
    // 23:59 Madrid on the 8th — never midnight on the 9th, which reads as a
    // different wall-clock day.
    expect(endsAt.toISOString()).toBe("2026-07-08T21:59:00.000Z");
  });

  it("leaves a work event free to span days", async () => {
    rescheduleEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OverrunHarness event={makeEvent()} />);

    await user.click(screen.getByText("resize"));

    await waitFor(() => expect(rescheduleEvent).toHaveBeenCalled());
    const [, , endsAt] = rescheduleEvent.mock.calls[0];
    expect(endsAt).toEqual(overrun.endsAt);
  });

  it("does not touch a content shift that already fits its day", async () => {
    rescheduleEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(<Harness event={makeEvent({ track: "content", streamId: null })} />);

    await user.click(screen.getByText("drag"));

    await waitFor(() =>
      expect(rescheduleEvent).toHaveBeenCalledWith(
        "evt-1",
        shifted.startsAt,
        shifted.endsAt
      )
    );
  });
});
