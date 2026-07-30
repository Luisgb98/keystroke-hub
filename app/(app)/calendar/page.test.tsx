import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getEventsInRange, getDb, push } = vi.hoisted(() => ({
  getEventsInRange: vi.fn(),
  getDb: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/data/events", () => ({ getEventsInRange }));
vi.mock("@/lib/db", () => ({ getDb }));
vi.mock("@/lib/calendar/actions", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import CalendarPage from "./page";

/** `getDb().select().from(table)` — just enough of the chain for the sync row. */
function stubDb(connections: unknown[]) {
  getDb.mockReturnValue({
    select: () => ({ from: () => Promise.resolve(connections) }),
  });
}

async function renderPage(params: { view?: string; date?: string } = {}) {
  const { container } = render(
    await CalendarPage({ searchParams: Promise.resolve(params) })
  );
  return container.firstElementChild as HTMLElement;
}

describe("CalendarPage", () => {
  beforeEach(() => {
    getEventsInRange.mockResolvedValue([]);
    stubDb([]);
  });

  it("renders the heading and the requested view", async () => {
    await renderPage({ view: "month", date: "2026-07-08" });

    expect(
      screen.getByRole("heading", { level: 1, name: "Calendar" })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  // Issue #87: this page is the one that hands its scrolling to the view below
  // instead of letting <main> scroll (see docs/calendar.md#scroll-contract).
  it("caps the page column to the shell and clips its own overflow", async () => {
    const wrapper = await renderPage({ view: "week", date: "2026-07-08" });

    expect(wrapper.className).toContain("flex-1");
    // `min-h-0` is what stops flexbox's `min-height: auto` from stretching the
    // column to its content — the failure mode that brings page scroll back.
    expect(wrapper.className).toMatch(/\bmin-h-0\b/);
    expect(wrapper.className).toContain("overflow-hidden");
    expect(wrapper.className).not.toContain("overflow-y-auto");
  });

  it("keeps the header outside the view's scrollport", async () => {
    const wrapper = await renderPage({ view: "day", date: "2026-07-08" });

    const scrollports = wrapper.querySelectorAll(
      '[data-slot="calendar-scroll"]'
    );
    expect(scrollports).toHaveLength(1);
    expect(scrollports[0]).not.toHaveTextContent("Today");
  });

  it("still renders with an empty grid when the database is unreachable", async () => {
    getEventsInRange.mockRejectedValue(new Error("no database"));
    getDb.mockImplementation(() => {
      throw new Error("no database");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const wrapper = await renderPage({ view: "day", date: "2026-07-08" });

    // The 24-hour grid is a fixed height, so the empty state still fills the
    // viewport and still scrolls (issue #87's empty-state criterion).
    expect(wrapper.querySelector('[data-slot="day-column"]')).toHaveStyle({
      height: "96rem",
    });
    consoleError.mockRestore();
  });
});
