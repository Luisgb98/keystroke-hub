import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkIdeaToEvent = vi.hoisted(() => vi.fn());
const unlinkIdeaFromEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/link-actions", () => ({
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
}));

const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

import type { ScheduledEventSummary } from "@/lib/data/idea-event-links";
import { IdeaScheduledEvents } from "./idea-scheduled-events";

function makeEvent(
  overrides: Partial<ScheduledEventSummary> = {}
): ScheduledEventSummary {
  return {
    id: "evt-1",
    title: "Stream: Boss rush",
    startsAt: new Date("2026-08-01T14:00:00"),
    endsAt: new Date("2026-08-01T15:00:00"),
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
