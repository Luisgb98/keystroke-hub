import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { IdeaFilters } from "./idea-filters";

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
    await user.click(screen.getByText("Path of Exile"));
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
