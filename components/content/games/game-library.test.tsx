import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createGame = vi.hoisted(() => vi.fn());
const renameGame = vi.hoisted(() => vi.fn());
const deleteGame = vi.hoisted(() => vi.fn());
const getGameUsage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/game-actions", () => ({
  createGame,
  renameGame,
  deleteGame,
  getGameUsage,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { GameWithUsage } from "@/lib/data/games";

import { GameLibrary, usageLabel } from "./game-library";

function makeGame(overrides: Partial<GameWithUsage> = {}): GameWithUsage {
  return {
    id: "g-poe",
    name: "Path of Exile",
    ideaCount: 0,
    streamCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  createGame.mockResolvedValue({ game: { id: "g-new", name: "Hades" } });
  renameGame.mockResolvedValue({});
  deleteGame.mockResolvedValue({});
  getGameUsage.mockResolvedValue({ ideaCount: 0, streamCount: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("usageLabel", () => {
  it("pluralizes each side and joins them", () => {
    expect(usageLabel(2, 1)).toBe("2 ideas · 1 stream");
    expect(usageLabel(1, 3)).toBe("1 idea · 3 streams");
  });

  it("omits a side that's at zero", () => {
    expect(usageLabel(0, 2)).toBe("2 streams");
    expect(usageLabel(4, 0)).toBe("4 ideas");
  });

  it("says so plainly when nothing uses the game", () => {
    expect(usageLabel(0, 0)).toBe("Not used yet");
  });
});

describe("GameLibrary", () => {
  it("invites a first entry when the library is empty", () => {
    render(<GameLibrary games={[]} />);
    expect(screen.getByText(/No games yet/i)).toBeVisible();
  });

  it("lists each game with what it's used on", () => {
    render(
      <GameLibrary games={[makeGame({ ideaCount: 3, streamCount: 1 })]} />
    );
    expect(screen.getByText("Path of Exile")).toBeVisible();
    expect(screen.getByText("3 ideas · 1 stream")).toBeVisible();
  });

  it("adds a game, normalizing what was typed", async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={[]} />);

    await user.type(screen.getByLabelText("Add a game"), "  Hades  ");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createGame).toHaveBeenCalledWith("Hades"));
  });

  it("keeps the Add button out of reach for a blank name", async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={[]} />);

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(screen.getByLabelText("Add a game"), "   ");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("renames inline and reports the rename", async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={[makeGame()]} />);

    await user.click(
      screen.getByRole("button", { name: 'Rename "Path of Exile"' })
    );
    const field = screen.getByLabelText('Rename "Path of Exile"');
    await user.clear(field);
    await user.type(field, "Path of Exile 2{Enter}");

    await waitFor(() =>
      expect(renameGame).toHaveBeenCalledWith("g-poe", "Path of Exile 2")
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Game renamed")
    );
  });

  it("surfaces a rejected rename instead of pretending it landed", async () => {
    const user = userEvent.setup();
    renameGame.mockResolvedValue({
      error: '"Hades" is already in your library.',
    });
    render(<GameLibrary games={[makeGame()]} />);

    await user.click(
      screen.getByRole("button", { name: 'Rename "Path of Exile"' })
    );
    const field = screen.getByLabelText('Rename "Path of Exile"');
    await user.clear(field);
    await user.type(field, "Hades{Enter}");

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        '"Hades" is already in your library.'
      )
    );
  });

  it("abandons a rename on Escape without writing", async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={[makeGame()]} />);

    await user.click(
      screen.getByRole("button", { name: 'Rename "Path of Exile"' })
    );
    await user.type(
      screen.getByLabelText('Rename "Path of Exile"'),
      "Something else{Escape}"
    );

    expect(renameGame).not.toHaveBeenCalled();
    expect(screen.getByText("Path of Exile")).toBeVisible();
  });

  it("says what a delete would untag before anything happens", async () => {
    const user = userEvent.setup();
    getGameUsage.mockResolvedValue({ ideaCount: 2, streamCount: 1 });
    render(<GameLibrary games={[makeGame()]} />);

    await user.click(
      screen.getByRole("button", { name: 'Delete "Path of Exile"' })
    );

    const confirm = await screen.findByRole("alertdialog");
    expect(
      await within(confirm).findByText(/2 ideas · 1 stream tagged with it/i)
    ).toBeVisible();
    expect(within(confirm).getByText(/Nothing is deleted/i)).toBeVisible();
    // Nothing has happened yet — the confirmation is a real gate.
    expect(deleteGame).not.toHaveBeenCalled();
  });

  it("deletes once confirmed, and not when cancelled", async () => {
    const user = userEvent.setup();
    render(<GameLibrary games={[makeGame()]} />);

    await user.click(
      screen.getByRole("button", { name: 'Delete "Path of Exile"' })
    );
    let confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(deleteGame).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: 'Delete "Path of Exile"' })
    );
    confirm = await screen.findByRole("alertdialog");
    const action = within(confirm).getByRole("button", { name: "Delete" });
    await waitFor(() => expect(action).toBeEnabled());
    await user.click(action);

    await waitFor(() => expect(deleteGame).toHaveBeenCalledWith("g-poe"));
  });
});
