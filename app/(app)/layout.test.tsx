import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySession, getUntriagedCount, usePathname } = vi.hoisted(() => ({
  verifySession: vi.fn(),
  getUntriagedCount: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ verifySession }));
vi.mock("@/lib/inbox/queries", () => ({ getUntriagedCount }));
vi.mock("next/navigation", () => ({ usePathname }));

import { BOTTOM_NAV_SPACER_CLASSES } from "@/components/shell/bottom-nav-styles";

// The shell's providers and nav internals have their own suites — this one is
// only about the layout's scroll contract (issue #87), so they're stubbed to
// keep the rendered tree to the elements under test.
vi.mock("@/components/inbox/inbox-capture-provider", () => ({
  InboxCaptureProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/command-palette/command-palette-provider", () => ({
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/shell/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));
vi.mock("@/components/shell/bottom-nav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

import AppShellLayout from "./layout";

async function renderShell(children: React.ReactNode = <p>Page body</p>) {
  render(await AppShellLayout({ children }));
  return {
    shell: screen.getByTestId("sidebar").parentElement as HTMLElement,
    main: screen.getByRole("main"),
  };
}

describe("AppShellLayout", () => {
  beforeEach(() => {
    verifySession.mockResolvedValue(undefined);
    getUntriagedCount.mockResolvedValue(0);
    usePathname.mockReturnValue("/");
  });

  it("renders the sidebar, the page body and the bottom nav", async () => {
    const { main } = await renderShell();

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument();
    expect(main).toHaveTextContent("Page body");
  });

  // Issue #87: the sidebar must never stretch or scroll away, so the shell is
  // capped at the viewport height and clips its own overflow.
  it("locks the shell to the viewport height so the sidebar can't grow", async () => {
    const { shell } = await renderShell();

    expect(shell.className).toContain("h-dvh");
    expect(shell.className).toContain("overflow-hidden");
    expect(shell.className).not.toContain("min-h-full");
  });

  it("makes <main> the app's vertical scrollport, shrinkable below its content", async () => {
    const { main } = await renderShell();

    expect(main.className).toContain("overflow-y-auto");
    // Without `min-h-0`, flexbox's `min-height: auto` would let <main> grow
    // past the locked shell instead of scrolling inside it.
    expect(main.className).toContain("min-h-0");
    expect(main.className).not.toContain("min-h-full");
  });

  it("keeps the mobile bottom-nav clearance on the scrollport", async () => {
    const { main } = await renderShell();

    // The bottom nav is `fixed`, so the padding has to live on whatever
    // scrolls — now <main> rather than the body. The exact measurement comes
    // from the bar's own style module, so shrinking the bar (#114 took it from
    // 4.5rem to 4rem) can't leave a stale gap here.
    expect(main.className).toContain(BOTTOM_NAV_SPACER_CLASSES);
  });

  it("degrades the inbox count to 0 when the database is unreachable", async () => {
    getUntriagedCount.mockRejectedValue(new Error("no database"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(renderShell()).resolves.toBeTruthy();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
