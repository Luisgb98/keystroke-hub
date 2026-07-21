import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const searchAllMock = vi.hoisted(() => vi.fn());
const getRecentPaletteItemsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search/actions", () => ({
  searchAll: searchAllMock,
  getRecentPaletteItems: getRecentPaletteItemsMock,
}));

import type { SearchResultGroups } from "@/lib/data/search";
import type { SearchResult } from "@/lib/search/types";

import { CommandPalette } from "./command-palette";

function emptyGroups(): SearchResultGroups {
  return {
    ideas: [],
    scripts: [],
    dailyLogs: [],
    meetingNotes: [],
    projects: [],
    improvements: [],
  };
}

const ideaResult: SearchResult = {
  id: "idea-1",
  type: "idea",
  world: "content",
  title: "Speedrun commentary",
  snippet: "Cover the wrong warp",
  href: "/content/ideas/idea-1",
  updatedAt: new Date("2026-07-01T00:00:00Z"),
};

const projectResult: SearchResult = {
  id: "project-1",
  type: "project",
  world: "work",
  title: "Keystroke Hub",
  href: "/projects/project-1",
  updatedAt: new Date("2026-07-02T00:00:00Z"),
};

describe("CommandPalette", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    render(<CommandPalette open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows recents before typing, each labeled with its world and type", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([ideaResult]);
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Speedrun commentary")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Content · Idea")).toBeInTheDocument();
  });

  it("always lists the Navigate group before typing", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Navigate")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Dashboard/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Journal/ })).toBeInTheDocument();
  });

  it("searches after a debounce and groups results by entity", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    searchAllMock.mockResolvedValue({
      ...emptyGroups(),
      ideas: [ideaResult],
      projects: [projectResult],
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    await user.type(screen.getByRole("combobox"), "keystroke");

    await waitFor(
      () => expect(searchAllMock).toHaveBeenCalledWith("keystroke"),
      {
        timeout: 1000,
      }
    );
    expect(await screen.findByText("Ideas")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Keystroke Hub")).toBeInTheDocument();

    await user.click(screen.getByText("Keystroke Hub"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/projects/project-1");
  });

  it("filters the Navigate group by label while typing", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    searchAllMock.mockResolvedValue(emptyGroups());
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "journal");

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Journal/ })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole("option", { name: /Dashboard/ })
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    searchAllMock.mockResolvedValue(emptyGroups());
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "zzz-no-such-item-zzz");

    expect(
      await screen.findByText('No results for "zzz-no-such-item-zzz".')
    ).toBeInTheDocument();
  });

  it("drops a stale response that resolves after a newer one", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    let resolveFirst!: (value: SearchResultGroups) => void;
    let resolveSecond!: (value: SearchResultGroups) => void;
    const firstPromise = new Promise<SearchResultGroups>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise<SearchResultGroups>((resolve) => {
      resolveSecond = resolve;
    });
    searchAllMock
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => secondPromise);

    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} />);
    const input = screen.getByRole("combobox");

    await user.type(input, "first");
    await waitFor(() => expect(searchAllMock).toHaveBeenCalledTimes(1), {
      timeout: 1000,
    });

    await user.clear(input);
    await user.type(input, "second");
    await waitFor(() => expect(searchAllMock).toHaveBeenCalledTimes(2), {
      timeout: 1000,
    });

    // Resolve out of order: the newer ("second") request resolves first.
    resolveSecond({ ...emptyGroups(), projects: [projectResult] });
    expect(await screen.findByText("Projects")).toBeInTheDocument();

    // The stale ("first") request resolving afterward must not overwrite it.
    resolveFirst({ ...emptyGroups(), ideas: [ideaResult] });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.queryByText("Ideas")).not.toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("clicking a Navigate item closes the palette and navigates", async () => {
    getRecentPaletteItemsMock.mockResolvedValue([]);
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    const journalOption = await screen.findByRole("option", {
      name: /Journal/,
    });
    fireEvent.click(journalOption);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/journal");
  });
});
