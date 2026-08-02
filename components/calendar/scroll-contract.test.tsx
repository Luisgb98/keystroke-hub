import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getMonthGridDays, getWeekDays } from "@/lib/calendar/range";
import type { CalendarEvent } from "@/lib/calendar/types";

const createEvent = vi.hoisted(() => vi.fn());
const updateEvent = vi.hoisted(() => vi.fn());
const deleteEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/calendar/actions", () => ({
  createEvent,
  updateEvent,
  deleteEvent,
}));

import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";

/**
 * Issue #87: the calendar page never scrolls — each view scrolls inside its
 * own grid instead. That only holds if every flex item between the view root
 * and the scrollport can shrink below its content (`min-h-0`, or a non-visible
 * `overflow`), so these assertions guard the structure rather than the pixels
 * (which only e2e can measure). See docs/calendar.md#scroll-contract.
 */
const anchor = new Date("2026-07-08T10:00:00");

function allDayEvent(): CalendarEvent {
  return {
    id: "all-day",
    track: "work",
    title: "Offsite",
    description: null,
    startsAt: new Date("2026-07-08T00:00:00"),
    endsAt: new Date("2026-07-08T00:00:00"),
    allDay: true,
    conflictNote: null,
    linkedIdeas: [],
    streamId: null,
  };
}

/** A view root has to fill the page column *and* be allowed to shrink inside it. */
function expectCappedFlexItem(element: HTMLElement) {
  expect(element.className).toContain("flex-1");
  expect(element.className).toMatch(/\bmin-h-0\b/);
}

/** A scrollport has to actually scroll *and* be allowed to shrink. */
function expectScrollport(element: HTMLElement) {
  expect(element.className).toContain("overflow-y-auto");
  expect(element.className).toMatch(/\bmin-h-0\b/);
  expect(element.className).toContain("flex-1");
}

function scrollports(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="calendar-scroll"]')
  );
}

describe("calendar scroll contract", () => {
  describe("DayView", () => {
    it("exposes a single shrinkable scrollport under a capped root", () => {
      const { container } = render(
        <DayView day={anchor} events={[]} now={anchor} />
      );

      const root = container.firstElementChild as HTMLElement;
      expectCappedFlexItem(root);
      expect(root.className).toContain("overflow-hidden");

      const [scrollport, ...rest] = scrollports(container);
      expect(rest).toHaveLength(0);
      expectScrollport(scrollport);
    });

    it("keeps the all-day row outside the scrollport so it stays pinned", () => {
      const { container } = render(
        <DayView day={anchor} events={[allDayEvent()]} now={anchor} />
      );

      const [scrollport] = scrollports(container);
      expect(scrollport).not.toHaveTextContent("Offsite");
      expect(container.firstElementChild).toHaveTextContent("Offsite");
    });
  });

  describe("WeekView", () => {
    it("gives the phone list and the desktop grid one shrinkable scrollport each", () => {
      const { container } = render(
        <WeekView days={getWeekDays(anchor)} events={[]} now={anchor} />
      );

      // Both layouts live in the DOM at once and toggle via breakpoints, so
      // both scrollports are present here (see docs/calendar.md).
      const found = scrollports(container);
      expect(found).toHaveLength(2);
      for (const scrollport of found) expectScrollport(scrollport);

      const [phoneList, desktopGrid] = found;
      expect(phoneList.className).toContain("md:hidden");
      expectCappedFlexItem(phoneList);

      const desktopRoot = desktopGrid.closest(".md\\:flex") as HTMLElement;
      expectCappedFlexItem(desktopRoot);
      expect(desktopRoot.className).toContain("overflow-hidden");
    });

    it("keeps the weekday header and all-day row outside the desktop scrollport", () => {
      const { container } = render(
        <WeekView
          days={getWeekDays(anchor)}
          events={[allDayEvent()]}
          now={anchor}
        />
      );

      const [, desktopGrid] = scrollports(container);
      expect(desktopGrid).not.toHaveTextContent("Wed");
      expect(desktopGrid).not.toHaveTextContent("Offsite");
    });
  });

  describe("MonthView", () => {
    it("scrolls the 6-row cell grid, not the weekday header", () => {
      const { container } = render(
        <MonthView
          days={getMonthGridDays(anchor)}
          anchorMonth={anchor}
          events={[]}
          now={anchor}
        />
      );

      const root = container.firstElementChild as HTMLElement;
      expectCappedFlexItem(root);
      expect(root.className).toContain("overflow-hidden");

      const [scrollport, ...rest] = scrollports(container);
      expect(rest).toHaveLength(0);
      expectScrollport(scrollport);
      // All 42 cells scroll together; the weekday labels stay put.
      expect(
        scrollport.querySelectorAll('[data-slot="month-cell"]')
      ).toHaveLength(42);
      expect(scrollport).not.toHaveTextContent("Mon");
    });
  });
});
