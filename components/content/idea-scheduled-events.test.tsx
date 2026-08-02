import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkIdeaToEvent = vi.hoisted(() => vi.fn());
const unlinkIdeaFromEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/link-actions", () => ({
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
}));

const rescheduleIdeaRelease = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ rescheduleIdeaRelease }));

const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError, success: toastSuccess }),
}));

import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import { IdeaScheduledEvents } from "./idea-scheduled-events";

function makeEvent(
  overrides: Partial<ScheduledEventSummary> = {}
): ScheduledEventSummary {
  return {
    id: "evt-1",
    title: "Stream: Boss rush",
    // 14:00–15:00 in Madrid (CEST, +2) as absolute instants — see #95.
    startsAt: new Date("2026-08-01T12:00:00.000Z"),
    endsAt: new Date("2026-08-01T13:00:00.000Z"),
    allDay: false,
    ...overrides,
  };
}

describe("IdeaScheduledEvents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there are no scheduled events", () => {
    const { container } = render(
      <IdeaScheduledEvents ideaId="idea-1" scheduledEvents={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links each chip to the calendar day it's scheduled on", () => {
    render(
      <IdeaScheduledEvents ideaId="idea-1" scheduledEvents={[makeEvent()]} />
    );
    const link = screen.getByRole("link", { name: "Aug 1, 14:00" });
    expect(link).toHaveAttribute("href", "/calendar?view=day&date=2026-08-01");
  });

  it("formats an all-day event without a time", () => {
    render(
      <IdeaScheduledEvents
        ideaId="idea-1"
        scheduledEvents={[makeEvent({ allDay: true })]}
      />
    );
    expect(screen.getByRole("link", { name: "Aug 1" })).toBeInTheDocument();
  });

  it("unlinks and offers an undo toast", async () => {
    unlinkIdeaFromEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <IdeaScheduledEvents
        ideaId="idea-1"
        scheduledEvents={[makeEvent({ title: "Stream: Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink from "Stream: Boss rush"' })
    );

    await waitFor(() =>
      expect(unlinkIdeaFromEvent).toHaveBeenCalledWith("evt-1", "idea-1")
    );
    expect(toastFn).toHaveBeenCalledWith(
      'Removed from "Stream: Boss rush"',
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo" }),
      })
    );
  });

  it("re-links via the undo toast action", async () => {
    unlinkIdeaFromEvent.mockResolvedValue({});
    linkIdeaToEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <IdeaScheduledEvents
        ideaId="idea-1"
        scheduledEvents={[makeEvent({ title: "Stream: Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink from "Stream: Boss rush"' })
    );
    await waitFor(() => expect(toastFn).toHaveBeenCalled());

    const [, options] = toastFn.mock.calls[0];
    await options.action.onClick();

    await waitFor(() =>
      expect(linkIdeaToEvent).toHaveBeenCalledWith("evt-1", "idea-1")
    );
  });

  // #102: shifting a release is the most frequent edit a content schedule
  // takes, and it used to mean opening the whole edit dialog. Only the idea's
  // own release chip gets this — the others point at events it merely links to.
  describe("the release chip", () => {
    const RELEASE = makeEvent({
      id: "evt-release",
      title: "Release: Boss rush",
    });

    function renderRelease(
      events: ScheduledEventSummary[] = [RELEASE]
    ): ReturnType<typeof render> {
      return render(
        <IdeaScheduledEvents
          ideaId="idea-1"
          scheduledEvents={events}
          releaseEventId="evt-release"
        />
      );
    }

    it("reschedules in place instead of linking to the calendar", () => {
      renderRelease();

      expect(
        screen.getByRole("button", {
          name: "Reschedule release, currently Aug 1, 14:00",
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Aug 1, 14:00" })
      ).not.toBeInTheDocument();
    });

    it("leaves every other chip pointing at its calendar day", () => {
      renderRelease([
        RELEASE,
        makeEvent({
          id: "evt-2",
          title: "Stream: practice",
          startsAt: new Date("2026-08-04T12:00:00.000Z"),
          endsAt: new Date("2026-08-04T13:00:00.000Z"),
        }),
      ]);

      expect(
        screen.getByRole("link", { name: "Aug 4, 14:00" })
      ).toHaveAttribute("href", "/calendar?view=day&date=2026-08-04");
    });

    it("prefills the popover with the release's current slot", async () => {
      const user = userEvent.setup();
      renderRelease();

      await user.click(screen.getByRole("button", { name: /Reschedule/ }));

      expect(await screen.findByLabelText("New day")).toHaveValue("2026-08-01");
      // Read back in the app zone, not the UTC the test process runs in (#95).
      expect(screen.getByLabelText("New time")).toHaveValue("14:00");
    });

    it("saves the new slot and toasts where the release landed", async () => {
      rescheduleIdeaRelease.mockResolvedValue({});
      const user = userEvent.setup();
      renderRelease();

      await user.click(screen.getByRole("button", { name: /Reschedule/ }));
      const day = await screen.findByLabelText("New day");
      await user.clear(day);
      await user.type(day, "2026-08-05");
      await user.clear(screen.getByLabelText("New time"));
      await user.type(screen.getByLabelText("New time"), "21:00");
      await user.click(screen.getByRole("button", { name: "Move release" }));

      await waitFor(() =>
        expect(rescheduleIdeaRelease).toHaveBeenCalledWith(
          "idea-1",
          "2026-08-05",
          "21:00"
        )
      );
      expect(toastSuccess).toHaveBeenCalledWith(
        "Release moved to Aug 5, 21:00"
      );
    });

    it("keeps the popover open and surfaces the error when the move fails", async () => {
      rescheduleIdeaRelease.mockResolvedValue({
        error: "Pick a real day and time.",
      });
      const user = userEvent.setup();
      renderRelease();

      await user.click(screen.getByRole("button", { name: /Reschedule/ }));
      await user.click(
        await screen.findByRole("button", { name: "Move release" })
      );

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("Pick a real day and time.")
      );
      // Still there to correct — closing would throw the attempt away.
      expect(screen.getByLabelText("New day")).toBeInTheDocument();
    });

    it("re-seeds from the stored slot when reopened after an abandoned edit", async () => {
      const user = userEvent.setup();
      renderRelease();

      await user.click(screen.getByRole("button", { name: /Reschedule/ }));
      const time = await screen.findByLabelText("New time");
      await user.clear(time);
      await user.type(time, "23:45");

      await user.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByLabelText("New time")).not.toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /Reschedule/ }));

      expect(await screen.findByLabelText("New time")).toHaveValue("14:00");
    });

    it("can still be unlinked like any other chip", async () => {
      unlinkIdeaFromEvent.mockResolvedValue({});
      const user = userEvent.setup();
      renderRelease();

      await user.click(
        screen.getByRole("button", { name: 'Unlink from "Release: Boss rush"' })
      );

      await waitFor(() =>
        expect(unlinkIdeaFromEvent).toHaveBeenCalledWith(
          "evt-release",
          "idea-1"
        )
      );
    });
  });

  it("toasts an error instead of unlinking when the action fails", async () => {
    unlinkIdeaFromEvent.mockResolvedValue({ error: "That link isn't valid." });
    const user = userEvent.setup();
    render(
      <IdeaScheduledEvents
        ideaId="idea-1"
        scheduledEvents={[makeEvent({ title: "Stream: Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink from "Stream: Boss rush"' })
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That link isn't valid.")
    );
    expect(toastFn).not.toHaveBeenCalled();
  });
});
