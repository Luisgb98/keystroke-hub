import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createGame = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/game-actions", () => ({ createGame }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: toastError }),
}));

import type { GameOption } from "@/lib/data/games";

import { GamePicker, canAddGame, filterGames } from "./game-picker";

const GAMES: GameOption[] = [
  { id: "g-poe", name: "Path of Exile" },
  { id: "g-poe2", name: "Path of Exile 2" },
  { id: "g-hades", name: "Hades" },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("filterGames", () => {
  it("returns the whole library for an empty query", () => {
    expect(filterGames(GAMES, "")).toEqual(GAMES);
    expect(filterGames(GAMES, "   ")).toEqual(GAMES);
  });

  it("matches anywhere in the name, case-insensitively", () => {
    expect(filterGames(GAMES, "exile").map((g) => g.id)).toEqual([
      "g-poe",
      "g-poe2",
    ]);
    expect(filterGames(GAMES, "HAD").map((g) => g.id)).toEqual(["g-hades"]);
  });

  it("ignores padding, so a stray space still finds the match", () => {
    expect(filterGames(GAMES, "  hades ").map((g) => g.id)).toEqual([
      "g-hades",
    ]);
  });

  it("returns nothing when the query matches nothing", () => {
    expect(filterGames(GAMES, "tetris")).toEqual([]);
  });
});

describe("canAddGame", () => {
  it("offers to add a name the library doesn't have", () => {
    expect(canAddGame(GAMES, "Tetris")).toBe(true);
  });

  it("never offers to add a name that already exists, whatever the casing or spacing", () => {
    expect(canAddGame(GAMES, "path of exile")).toBe(false);
    expect(canAddGame(GAMES, "  PATH  OF   EXILE ")).toBe(false);
  });

  it("still offers a longer name that merely contains an existing one", () => {
    expect(canAddGame(GAMES, "Path of Exile 3")).toBe(true);
  });

  it("offers nothing for a blank query", () => {
    expect(canAddGame(GAMES, "  ")).toBe(false);
    expect(canAddGame([], "")).toBe(false);
  });
});

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Game" }));
  // cmdk's input carries `role="combobox"` like the trigger does, so it is
  // located by its label rather than by role.
  return screen.findByLabelText("Search games");
}

describe("GamePicker", () => {
  it("shows the picked game on the trigger, and 'No game' when nothing is picked", () => {
    const { rerender } = render(
      <GamePicker games={GAMES} value={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole("combobox", { name: "Game" })).toHaveTextContent(
      "No game"
    );

    rerender(<GamePicker games={GAMES} value="g-hades" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Game" })).toHaveTextContent(
      "Hades"
    );
  });

  it("submits the picked id through a hidden field, and '' for no game", () => {
    const { container, rerender } = render(
      <GamePicker games={GAMES} name="gameId" value={null} onChange={vi.fn()} />
    );
    const hidden = container.querySelector('input[name="gameId"]');
    expect(hidden).toHaveValue("");

    rerender(
      <GamePicker
        games={GAMES}
        name="gameId"
        value="g-poe"
        onChange={vi.fn()}
      />
    );
    expect(container.querySelector('input[name="gameId"]')).toHaveValue(
      "g-poe"
    );
  });

  it("filters the list as you type, so a long library is a few keystrokes away", async () => {
    const user = userEvent.setup();
    render(<GamePicker games={GAMES} value={null} onChange={vi.fn()} />);

    const search = await openPicker(user);
    expect(await screen.findByText("Hades")).toBeVisible();

    await user.type(search, "exile");

    await waitFor(() => expect(screen.queryByText("Hades")).toBeNull());
    expect(screen.getByText("Path of Exile")).toBeVisible();
    expect(screen.getByText("Path of Exile 2")).toBeVisible();
  });

  it("picks a game by click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GamePicker games={GAMES} value={null} onChange={onChange} />);

    await openPicker(user);
    await user.click(await screen.findByText("Hades"));

    expect(onChange).toHaveBeenCalledWith("g-hades");
  });

  it("is fully keyboard-operable: type, arrow, Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GamePicker games={GAMES} value={null} onChange={onChange} />);

    const search = await openPicker(user);
    // The search field takes focus on open — no pointer needed to start typing.
    expect(search).toHaveFocus();

    await user.keyboard("exile");
    await waitFor(() => expect(screen.queryByText("Hades")).toBeNull());
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^g-poe/);
  });

  it("offers to clear the game once one is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GamePicker games={GAMES} value="g-hades" onChange={onChange} />);

    await openPicker(user);
    await user.click(await screen.findByText("No game"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("invites adding the first game instead of showing a dead end", async () => {
    const user = userEvent.setup();
    render(<GamePicker games={[]} value={null} onChange={vi.fn()} />);

    await openPicker(user);

    expect(
      await screen.findByText(/type a name to add your first one/i)
    ).toBeVisible();
  });

  it("adds an unknown name from the picker and selects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    createGame.mockResolvedValue({ game: { id: "g-tetris", name: "Tetris" } });
    render(<GamePicker games={GAMES} value={null} onChange={onChange} />);

    const search = await openPicker(user);
    await user.type(search, "  Tetris ");

    const add = await screen.findByText(/Add “Tetris”/);
    await user.click(add);

    await waitFor(() => expect(createGame).toHaveBeenCalledWith("Tetris"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("g-tetris"));
  });

  it("never offers to add a name already in the library, whatever the casing", async () => {
    const user = userEvent.setup();
    render(<GamePicker games={GAMES} value={null} onChange={vi.fn()} />);

    const search = await openPicker(user);
    await user.type(search, "  path of exile  ");

    await waitFor(() =>
      expect(screen.getByText("Path of Exile")).toBeVisible()
    );
    expect(screen.queryByText(/^Add /)).toBeNull();
  });

  it("reports a failed add rather than silently selecting nothing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    createGame.mockResolvedValue({ error: "Nope." });
    render(<GamePicker games={GAMES} value={null} onChange={onChange} />);

    const search = await openPicker(user);
    await user.type(search, "Tetris");
    await user.click(await screen.findByText(/Add “Tetris”/));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope."));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps a just-added game selectable before the server list catches up", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    createGame.mockResolvedValue({ game: { id: "g-tetris", name: "Tetris" } });
    render(<GamePicker games={GAMES} value={null} onChange={onChange} />);

    let search = await openPicker(user);
    await user.type(search, "Tetris");
    await user.click(await screen.findByText(/Add “Tetris”/));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("g-tetris"));

    // The `games` prop hasn't refreshed yet — reopening must still show it,
    // and must not offer to add it a second time.
    search = await openPicker(user);
    await user.type(search, "Tetris");
    expect(await screen.findByText("Tetris")).toBeVisible();
    expect(screen.queryByText(/^Add /)).toBeNull();
  });
});
