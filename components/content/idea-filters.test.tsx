import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { IdeaFilters, visibleTags } from "./idea-filters";

describe("IdeaFilters", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders every format and status as a filter chip", () => {
    render(<IdeaFilters value={{}} availableTags={[]} />);

    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stream" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Either" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Idea" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Published" })
    ).toBeInTheDocument();
  });

  it("reflects the active filters via aria-pressed", () => {
    render(
      <IdeaFilters
        value={{ format: "video", status: "idea" }}
        availableTags={[]}
      />
    );

    expect(screen.getByRole("button", { name: "Video" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Stream" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Idea" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("navigates with the format param when a format chip is clicked", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{}} availableTags={[]} />);

    await user.click(screen.getByRole("button", { name: "Video" }));

    expect(replace).toHaveBeenCalledWith("/content/ideas?format=video");
  });

  it("clears the filter when the active chip is clicked again", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{ format: "video" }} availableTags={[]} />);

    await user.click(screen.getByRole("button", { name: "Video" }));

    expect(replace).toHaveBeenCalledWith("/content/ideas");
  });

  it("renders tag chips only when tags are in use", () => {
    const { rerender } = render(<IdeaFilters value={{}} availableTags={[]} />);
    expect(screen.queryByText("#speedrun")).not.toBeInTheDocument();

    rerender(<IdeaFilters value={{}} availableTags={["speedrun"]} />);
    expect(screen.getByText("#speedrun")).toBeInTheDocument();
  });

  it("navigates with the tag param when a tag chip is clicked", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{}} availableTags={["speedrun"]} />);

    await user.click(screen.getByText("#speedrun"));

    expect(replace).toHaveBeenCalledWith("/content/ideas?tag=speedrun");
  });

  it("renders a chip per game only when the library has entries (#105)", () => {
    const { rerender } = render(<IdeaFilters value={{}} availableTags={[]} />);
    expect(screen.queryByText("Path of Exile")).not.toBeInTheDocument();

    rerender(
      <IdeaFilters
        value={{}}
        availableTags={[]}
        availableGames={[{ id: "g-poe", name: "Path of Exile" }]}
      />
    );
    expect(screen.getByText("Path of Exile")).toBeInTheDocument();
  });

  it("navigates with the game param, and clears it on a second click (#105)", async () => {
    const user = userEvent.setup();
    const games = [{ id: "g-poe", name: "Path of Exile" }];
    const { rerender } = render(
      <IdeaFilters value={{}} availableTags={[]} availableGames={games} />
    );

    await user.click(screen.getByText("Path of Exile"));
    expect(replace).toHaveBeenCalledWith("/content/ideas?game=g-poe");

    rerender(
      <IdeaFilters
        value={{ game: "g-poe" }}
        availableTags={[]}
        availableGames={games}
      />
    );
    // By role, not text: once active, the game is also echoed as a removable
    // chip under the search box (#122), whose text would match too.
    await user.click(screen.getByRole("button", { name: "Path of Exile" }));
    expect(replace).toHaveBeenLastCalledWith("/content/ideas");
  });

  it("composes the game filter with the existing ones (#105)", async () => {
    const user = userEvent.setup();
    render(
      <IdeaFilters
        value={{ format: "video", tag: "speedrun" }}
        availableTags={["speedrun"]}
        availableGames={[{ id: "g-poe", name: "Path of Exile" }]}
      />
    );

    await user.click(screen.getByText("Path of Exile"));

    expect(replace).toHaveBeenCalledWith(
      "/content/ideas?format=video&tag=speedrun&game=g-poe"
    );
  });

  it("counts an active game filter towards showing 'Reset filters' (#105)", () => {
    render(
      <IdeaFilters
        value={{ game: "g-poe" }}
        availableTags={[]}
        availableGames={[{ id: "g-poe", name: "Path of Exile" }]}
      />
    );
    expect(
      screen.getByRole("button", { name: /Reset filters/ })
    ).toBeInTheDocument();
  });

  it("combines multiple active filters into one query string", async () => {
    const user = userEvent.setup();
    render(
      <IdeaFilters value={{ format: "video" }} availableTags={["speedrun"]} />
    );

    await user.click(screen.getByRole("button", { name: "Idea" }));

    expect(replace).toHaveBeenCalledWith(
      "/content/ideas?format=video&status=idea"
    );
  });

  it("only shows 'Reset filters' when a filter is active", () => {
    const { rerender } = render(<IdeaFilters value={{}} availableTags={[]} />);
    expect(
      screen.queryByRole("button", { name: "Reset filters" })
    ).not.toBeInTheDocument();

    rerender(<IdeaFilters value={{ q: "glitch" }} availableTags={[]} />);
    expect(
      screen.getByRole("button", { name: "Reset filters" })
    ).toBeInTheDocument();
  });

  it("reset filters navigates to the bare ideas path", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{ q: "glitch" }} availableTags={[]} />);

    await user.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(replace).toHaveBeenCalledWith("/content/ideas");
  });

  it("debounces search input before navigating", () => {
    vi.useFakeTimers();
    render(<IdeaFilters value={{}} availableTags={[]} />);

    fireEvent.change(screen.getByLabelText("Search ideas"), {
      target: { value: "glitch" },
    });
    expect(replace).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(replace).toHaveBeenCalledWith("/content/ideas?q=glitch");
  });
});

describe("filter chips as touch targets (#114)", () => {
  it("gives every chip a 44px height on a phone, and the dense one from md up", () => {
    // These are the page's main way to narrow a long idea list, and they sit
    // in a horizontally-scrolling row — a 31px pill was a miss waiting to
    // happen.
    render(<IdeaFilters value={{}} availableTags={["speedrun"]} />);
    const chip = screen.getByRole("button", { name: "Video" });

    expect(chip).toHaveClass("min-h-11");
    expect(chip).toHaveClass("md:min-h-0");
  });
});

describe("filters behind a bottom sheet on a phone (#122)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const games = [{ id: "g-poe", name: "Path of Exile" }];

  it("lays the inline groups out as wrapping rows, hidden below md", () => {
    render(<IdeaFilters value={{}} availableTags={["speedrun"]} />);
    const group = screen.getByRole("group", { name: "Filter by format" });

    // No more sideways scrolling: the game and tag rows grow with the library.
    expect(group).toHaveClass("flex-wrap");
    expect(group).not.toHaveClass("overflow-x-auto");
    expect(group.closest(".hidden")).toHaveClass("md:flex");
  });

  it("offers a phone-only Filters button that counts the active chip filters", () => {
    render(
      <IdeaFilters
        value={{ q: "boss", format: "video", tag: "speedrun" }}
        availableTags={["speedrun"]}
      />
    );
    const trigger = screen.getByRole("button", { name: /Filters/ });

    expect(trigger).toHaveClass("md:hidden");
    // Search text is already visible in the input — only chips are counted.
    expect(trigger).toHaveTextContent("2");
  });

  it("captions each group inside the sheet but not inline", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{}} availableTags={["speedrun"]} />);
    expect(screen.queryByText("Format")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    // Inline, the rows read as one bar under the search box; in the sheet a
    // tag group can run to dozens of chips and needs a name to scan past.
    for (const caption of ["Format", "Status", "Tag"]) {
      expect(within(sheet).getByText(caption)).toBeInTheDocument();
    }
  });

  it("hides the page's Reset button on a phone once the active row shows chips", () => {
    const { rerender } = render(
      <IdeaFilters value={{ format: "video" }} availableTags={[]} />
    );
    expect(screen.getByRole("button", { name: "Reset filters" })).toHaveClass(
      "hidden",
      "md:inline-flex"
    );

    // A search-only narrowing has no chip to drop, so Reset stays.
    rerender(<IdeaFilters value={{ q: "boss" }} availableTags={[]} />);
    expect(
      screen.getByRole("button", { name: "Reset filters" })
    ).not.toHaveClass("hidden");
  });

  it("shows no count while nothing is filtered", () => {
    render(<IdeaFilters value={{}} availableTags={[]} />);
    expect(
      screen.getByRole("button", { name: /Filters/ })
    ).not.toHaveTextContent(/\d/);
  });

  it("opens the sheet with every group, and applies a chip without closing it", async () => {
    const user = userEvent.setup();
    render(
      <IdeaFilters
        value={{}}
        availableTags={["speedrun"]}
        availableGames={games}
      />
    );

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    for (const name of [
      "Filter by format",
      "Filter by status",
      "Filter by game",
      "Filter by tag",
    ]) {
      expect(within(sheet).getByRole("group", { name })).toBeInTheDocument();
    }

    await user.click(within(sheet).getByRole("button", { name: "Video" }));
    expect(replace).toHaveBeenCalledWith("/content/ideas?format=video");
    // Still open: picking a second filter shouldn't cost another tap.
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("echoes the active filters as removable chips, one navigation per removal", async () => {
    const user = userEvent.setup();
    render(
      <IdeaFilters
        value={{
          format: "video",
          status: "scripted",
          game: "g-poe",
          tag: "speedrun",
        }}
        availableTags={["speedrun"]}
        availableGames={games}
      />
    );
    const row = screen.getByRole("group", { name: "Active filters" });

    expect(row).toHaveClass("md:hidden");
    expect(
      within(row)
        .getAllByRole("button")
        .map((chip) => chip.textContent)
    ).toEqual(["Video", "Scripted", "Path of Exile", "#speedrun"]);

    await user.click(
      within(row).getByRole("button", { name: "Remove filter: Scripted" })
    );
    expect(replace).toHaveBeenCalledWith(
      "/content/ideas?format=video&tag=speedrun&game=g-poe"
    );
  });

  it("skips an active game the library no longer knows", () => {
    render(
      <IdeaFilters
        value={{ game: "g-gone" }}
        availableTags={[]}
        availableGames={games}
      />
    );
    expect(
      screen.queryByRole("group", { name: "Active filters" })
    ).not.toBeInTheDocument();
  });

  it("clears everything from inside the sheet", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{ format: "video" }} availableTags={[]} />);

    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    await user.click(within(sheet).getByRole("button", { name: "Clear all" }));

    expect(replace).toHaveBeenCalledWith("/content/ideas");
  });
});

describe("the inline tag row starts collapsed (#122)", () => {
  const tags = Array.from({ length: 30 }, (_, i) => `tag${i + 1}`);

  it("shows the first twelve plus the active one if it sorted past them", () => {
    expect(visibleTags(tags, undefined)).toHaveLength(12);
    expect(visibleTags(tags, "tag20")).toEqual([...tags.slice(0, 12), "tag20"]);
    expect(visibleTags(tags, "tag3")).toEqual(tags.slice(0, 12));
    expect(visibleTags(tags, "not-a-tag")).toEqual(tags.slice(0, 12));
    expect(visibleTags(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it("expands inline on 'Show all' and collapses again", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{}} availableTags={tags} />);
    const row = screen.getByRole("group", { name: "Filter by tag" });

    expect(within(row).getByText("#tag12")).toBeInTheDocument();
    expect(within(row).queryByText("#tag13")).not.toBeInTheDocument();

    await user.click(
      within(row).getByRole("button", { name: "Show all 30 tags" })
    );
    expect(within(row).getByText("#tag30")).toBeInTheDocument();

    await user.click(
      within(row).getByRole("button", { name: "Show fewer tags" })
    );
    expect(within(row).queryByText("#tag30")).not.toBeInTheDocument();
  });

  it("offers no toggle when every tag already fits", () => {
    render(<IdeaFilters value={{}} availableTags={["a", "b"]} />);
    expect(
      screen.queryByRole("button", { name: /Show all/ })
    ).not.toBeInTheDocument();
  });

  it("shows every tag in the sheet, which scrolls", async () => {
    const user = userEvent.setup();
    render(<IdeaFilters value={{}} availableTags={tags} />);
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    const sheet = await screen.findByRole("dialog", { name: "Filters" });

    expect(within(sheet).getByText("#tag30")).toBeInTheDocument();
    expect(
      within(sheet).queryByRole("button", { name: /Show all/ })
    ).not.toBeInTheDocument();
  });
});
