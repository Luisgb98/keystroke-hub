import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkIdeaToEvent = vi.hoisted(() => vi.fn());
const unlinkIdeaFromEvent = vi.hoisted(() => vi.fn());
const searchLinkableIdeas = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/link-actions", () => ({
  linkIdeaToEvent,
  unlinkIdeaFromEvent,
  searchLinkableIdeas,
}));

const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError, success: toastSuccess }),
}));

import type { LinkedIdeaSummary } from "@/lib/calendar/types";
import { EventLinkedIdeas } from "./event-linked-ideas";

function makeIdea(
  overrides: Partial<LinkedIdeaSummary> = {}
): LinkedIdeaSummary {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    status: "idea",
    hasScript: false,
    ...overrides,
  };
}

describe("EventLinkedIdeas", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty-state message when nothing is linked", () => {
    render(<EventLinkedIdeas eventId="evt-1" linkedIdeas={[]} />);
    expect(screen.getByText("No ideas linked yet.")).toBeInTheDocument();
  });

  it("renders each linked idea's title and status", () => {
    render(
      <EventLinkedIdeas
        eventId="evt-1"
        linkedIdeas={[
          makeIdea({ title: "Boss rush", status: "scripted" }),
          makeIdea({ id: "idea-2", title: "Glitch tutorial" }),
        ]}
      />
    );
    expect(screen.getByText("Boss rush")).toBeInTheDocument();
    expect(screen.getByText("Scripted")).toBeInTheDocument();
    expect(screen.getByText("Glitch tutorial")).toBeInTheDocument();
  });

  it("deep-links the script indicator, labeled by whether a script exists", () => {
    render(
      <EventLinkedIdeas
        eventId="evt-1"
        linkedIdeas={[
          makeIdea({ id: "idea-9", title: "Boss rush", hasScript: true }),
        ]}
      />
    );
    const link = screen.getByRole("link", {
      name: 'Open script for "Boss rush"',
    });
    expect(link).toHaveAttribute("href", "/content/ideas/idea-9/script");
  });

  it("opens the link picker on 'Link an idea'", async () => {
    searchLinkableIdeas.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<EventLinkedIdeas eventId="evt-1" linkedIdeas={[]} />);

    await user.click(screen.getByRole("button", { name: "Link an idea" }));
    expect(
      screen.getByRole("dialog", { name: "Link an idea" })
    ).toBeInTheDocument();
  });

  it("unlinks an idea and offers an undo toast", async () => {
    unlinkIdeaFromEvent.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <EventLinkedIdeas
        eventId="evt-1"
        linkedIdeas={[makeIdea({ title: "Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink "Boss rush"' })
    );

    await waitFor(() =>
      expect(unlinkIdeaFromEvent).toHaveBeenCalledWith("evt-1", "idea-1")
    );
    expect(toastFn).toHaveBeenCalledWith(
      '"Boss rush" unlinked',
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
      <EventLinkedIdeas
        eventId="evt-1"
        linkedIdeas={[makeIdea({ title: "Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink "Boss rush"' })
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
      <EventLinkedIdeas
        eventId="evt-1"
        linkedIdeas={[makeIdea({ title: "Boss rush" })]}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Unlink "Boss rush"' })
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That link isn't valid.")
    );
    expect(toastFn).not.toHaveBeenCalled();
  });
});
