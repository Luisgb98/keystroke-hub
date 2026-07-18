import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./command-palette", () => ({
  CommandPalette: ({ open }: { open: boolean }) => (
    <div data-testid="palette-open">{String(open)}</div>
  ),
}));

import {
  CommandPaletteProvider,
  useCommandPalette,
} from "./command-palette-provider";

function Consumer() {
  const { open } = useCommandPalette();
  return <div data-testid="consumer-open">{String(open)}</div>;
}

describe("CommandPaletteProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts closed", () => {
    render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("false");
    expect(screen.getByTestId("palette-open")).toHaveTextContent("false");
  });

  it("opens on Cmd-K, and a second press closes it (toggle)", () => {
    render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("true");

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("false");
  });

  it("opens on Ctrl-K too", () => {
    render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("true");
  });

  it("ignores a plain 'k' or a modifier with a different key", () => {
    render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );

    fireEvent.keyDown(window, { key: "k" });
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("false");

    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(screen.getByTestId("consumer-open")).toHaveTextContent("false");
  });

  it("calls preventDefault on the triggering keydown, beating a browser's own Ctrl-K binding", () => {
    render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );

    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("removes the keydown listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <CommandPaletteProvider>
        <Consumer />
      </CommandPaletteProvider>
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("throws when useCommandPalette is used outside the provider", () => {
    function Bare() {
      useCommandPalette();
      return null;
    }
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<Bare />)).toThrow(
      "useCommandPalette must be used within a CommandPaletteProvider"
    );

    consoleError.mockRestore();
  });
});
