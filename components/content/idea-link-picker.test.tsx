import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const linkIdeaToEvent = vi.hoisted(() => vi.fn());
const searchLinkableIdeas = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/link-actions", () => ({
  linkIdeaToEvent,
  searchLinkableIdeas,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { LinkableIdea } from "@/lib/data/idea-event-links";
import { IdeaLinkPicker } from "./idea-link-picker";

const ideas: LinkableIdea[] = [
  { id: "idea-1", title: "Boss rush", format: "video", status: "idea" },
  {
    id: "idea-2",
    title: "Glitch tutorial",
    format: "stream",
    status: "scripted",
  },
];

describe("IdeaLinkPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    searchLinkableIdeas.mockResolvedValue(ideas);
    render(
      <IdeaLinkPicker eventId="evt-1" open={false} onOpenChange={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads and renders matching ideas when opened", async () => {
    searchLinkableIdeas.mockResolvedValue(ideas);
    render(<IdeaLinkPicker eventId="evt-1" open onOpenChange={vi.fn()} />);

    await waitFor(() =>
      expect(searchLinkableIdeas).toHaveBeenCalledWith("evt-1", "")
    );
    expect(await screen.findByText("Boss rush")).toBeInTheDocument();
    expect(screen.getByText("Glitch tutorial")).toBeInTheDocument();
  });

  it("re-queries as the search text changes", async () => {
    searchLinkableIdeas.mockResolvedValue(ideas);
    const user = userEvent.setup();
    render(<IdeaLinkPicker eventId="evt-1" open onOpenChange={vi.fn()} />);
    await screen.findByText("Boss rush");

    await user.type(screen.getByLabelText("Search ideas"), "glitch");

    await waitFor(() =>
      expect(searchLinkableIdeas).toHaveBeenLastCalledWith("evt-1", "glitch")
    );
  });

  it("shows a 'no matching ideas' message for an empty result set with a query", async () => {
    searchLinkableIdeas.mockResolvedValue([]);
    render(<IdeaLinkPicker eventId="evt-1" open onOpenChange={vi.fn()} />);
    expect(
      await screen.findByText("No ideas left to link.")
    ).toBeInTheDocument();
  });

  it("links the selected idea and closes the picker", async () => {
    searchLinkableIdeas.mockResolvedValue(ideas);
    linkIdeaToEvent.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<IdeaLinkPicker eventId="evt-1" open onOpenChange={onOpenChange} />);
    await screen.findByText("Boss rush");

    await user.click(screen.getByText("Boss rush"));

    await waitFor(() =>
      expect(linkIdeaToEvent).toHaveBeenCalledWith("evt-1", "idea-1")
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith('"Boss rush" linked');
  });

  it("toasts an error and keeps the picker open when linking fails", async () => {
    searchLinkableIdeas.mockResolvedValue(ideas);
    linkIdeaToEvent.mockResolvedValue({ error: "That idea no longer exists." });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<IdeaLinkPicker eventId="evt-1" open onOpenChange={onOpenChange} />);
    await screen.findByText("Boss rush");

    await user.click(screen.getByText("Boss rush"));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
