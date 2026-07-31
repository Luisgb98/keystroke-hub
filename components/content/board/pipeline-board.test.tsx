import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateIdeaStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ updateIdeaStatus }));

const getIdeaChecklistItems = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/checklist-actions", () => ({
  getIdeaChecklistItems,
  toggleIdeaChecklistItem: vi.fn(),
  addIdeaChecklistItem: vi.fn(),
  removeIdeaChecklistItem: vi.fn(),
}));

// sonner's `toast` is callable *and* carries `.error`/`.success` methods —
// mirror that shape so both call styles pipeline-board uses are covered.
const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

import type { Idea } from "@/lib/db/schema";
import { PipelineBoard } from "./pipeline-board";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    description: null,
    format: "either",
    status: "scripted",
    tags: [],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

const COLUMN_WIDTH = 100;
const COLUMN_HEIGHT = 500;

/**
 * jsdom lays nothing out, so the drop hit-test has no geometry to read. Stub
 * each column as a 100px-wide, 500px-tall box in pipeline order — the same
 * shape a real board has, and the only thing `measureColumns` looks at.
 */
function stubColumnGeometry(container: HTMLElement) {
  container
    .querySelectorAll<HTMLElement>('[data-slot="stage-column"]')
    .forEach((column, index) => {
      vi.spyOn(column, "getBoundingClientRect").mockReturnValue({
        x: index * COLUMN_WIDTH,
        y: 0,
        left: index * COLUMN_WIDTH,
        right: index * COLUMN_WIDTH + COLUMN_WIDTH,
        top: 0,
        bottom: COLUMN_HEIGHT,
        width: COLUMN_WIDTH,
        height: COLUMN_HEIGHT,
        toJSON: () => ({}),
      } as DOMRect);
    });
}

/** Centre x of the nth column in `IDEA_STATUSES` order (idea, scripted, recorded, edited, published). */
function columnCenterX(index: number) {
  return index * COLUMN_WIDTH + COLUMN_WIDTH / 2;
}

/** Scoped to the board, since the floating drag preview also carries the title. */
function cardElement(title: string) {
  const board = document.querySelector(
    '[data-slot="pipeline-board"]'
  ) as HTMLElement;
  return within(board)
    .getByText(title)
    .closest('[data-slot="board-card"]') as HTMLElement;
}

/** Press a card, cross the drag threshold, and hover a column — leaves the card airborne. */
function liftCard(title: string, fromColumnIndex: number) {
  fireEvent.pointerDown(cardElement(title), {
    pointerId: 1,
    clientX: columnCenterX(fromColumnIndex),
    clientY: 100,
  });
  act(() => {
    window.dispatchEvent(
      new window.PointerEvent("pointermove", {
        pointerId: 1,
        clientX: columnCenterX(fromColumnIndex) + 20,
        clientY: 100,
        bubbles: true,
      })
    );
  });
}

function movePointerTo(x: number, y = 100) {
  act(() => {
    window.dispatchEvent(
      new window.PointerEvent("pointermove", {
        pointerId: 1,
        clientX: x,
        clientY: y,
        bubbles: true,
      })
    );
  });
}

function releasePointerAt(x: number, y = 100) {
  act(() => {
    window.dispatchEvent(
      new window.PointerEvent("pointerup", {
        pointerId: 1,
        clientX: x,
        clientY: y,
        bubbles: true,
      })
    );
  });
}

function stageColumn(label: string) {
  return screen
    .getByRole("heading", { name: label })
    .closest('[data-slot="stage-column"]') as HTMLElement;
}

describe("PipelineBoard", () => {
  beforeEach(() => {
    getIdeaChecklistItems.mockResolvedValue([]);
    updateIdeaStatus.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders exactly one column per pipeline stage", () => {
    const { container } = render(<PipelineBoard ideas={[]} />);
    expect(screen.getByText("Idea")).toBeInTheDocument();
    expect(screen.getByText("Scripted")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="stage-column"]')
    ).toHaveLength(5);
  });

  it("groups ideas into their matching stage columns", () => {
    render(
      <PipelineBoard
        ideas={[
          makeIdea({
            id: "idea-1",
            title: "Scripted idea",
            status: "scripted",
          }),
          makeIdea({ id: "idea-2", title: "Fresh idea", status: "idea" }),
        ]}
      />
    );
    expect(screen.getByText("Scripted idea")).toBeInTheDocument();
    expect(screen.getByText("Fresh idea")).toBeInTheDocument();
  });

  it("optimistically moves a card to the target column while the request is pending", async () => {
    // A controllable, never-auto-resolving promise: `useOptimistic` only
    // shows the optimistic value *during* the pending transition — once
    // `updateIdeaStatus` settles without the `ideas` prop itself changing
    // (as happens here, since this is a static unit-test prop rather than a
    // server revalidation), React reverts to the base value. So this test
    // asserts the jump mid-flight, not after settling.
    let resolveUpdate: (result: { error?: string }) => void = () => {};
    updateIdeaStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "scripted" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Recorded" }));

    const recordedColumn = screen
      .getByRole("heading", { name: "Recorded" })
      .closest('[data-slot="stage-column"]') as HTMLElement;
    await waitFor(() =>
      expect(
        within(recordedColumn).getByText("Speedrun commentary")
      ).toBeInTheDocument()
    );

    resolveUpdate({});
    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "recorded")
    );
  });

  it("toasts an error when the move fails", async () => {
    updateIdeaStatus.mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "scripted" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(await screen.findByRole("menuitem", { name: "Recorded" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
    );
  });

  it("renders a checklist chip when progress is provided", () => {
    const idea = makeIdea({ title: "Boss rush", status: "recorded" });
    render(
      <PipelineBoard
        ideas={[idea]}
        checklistProgress={new Map([[idea.id, { done: 2, total: 4 }]])}
      />
    );
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("shows a nudge toast (with an open-checklist action) when publishing with unchecked items", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 2 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith(
        "Published with 2 unchecked checklist items",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Open checklist" }),
        })
      )
    );
  });

  it("opens the checklist dialog when the nudge toast's action runs", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 1 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );
    await waitFor(() => expect(toastFn).toHaveBeenCalled());

    const [, options] = toastFn.mock.calls[0];
    options.action.onClick();

    expect(
      await screen.findByRole("dialog", { name: "Publish checklist" })
    ).toBeInTheDocument();
  });

  it("does not toast when publishing with everything checked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 0 });
    const user = userEvent.setup();
    const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
    render(<PipelineBoard ideas={[idea]} />);

    await user.click(
      screen.getByRole("button", { name: 'Move "Speedrun commentary"' })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Published" })
    );

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "published")
    );
    expect(toastFn).not.toHaveBeenCalled();
  });

  describe("drag and drop (#89)", () => {
    it("moves a dropped card to the column it landed on", async () => {
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(2));
      releasePointerAt(columnCenterX(2));

      await waitFor(() =>
        expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "recorded")
      );
    });

    it("lights up the column under the pointer and floats a preview of the card", () => {
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).not.toBeInTheDocument();

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(3));

      expect(stageColumn("Edited")).toHaveAttribute("data-drop-target", "true");
      expect(stageColumn("Recorded")).toHaveAttribute(
        "data-drop-target",
        "false"
      );
      expect(cardElement("Speedrun commentary")).toHaveAttribute(
        "data-dragging",
        "true"
      );
      const preview = document.querySelector(
        '[data-slot="board-drag-preview"]'
      );
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveTextContent("Speedrun commentary");

      releasePointerAt(columnCenterX(3));
      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).not.toBeInTheDocument();
    });

    it("drops onto an empty column", async () => {
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      // Nothing is scripted yet — the column shows its empty-state copy and is
      // still a valid target.
      expect(
        screen.getByText("Nothing scripted — pick an idea and write.")
      ).toBeInTheDocument();

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(1));
      releasePointerAt(columnCenterX(1));

      await waitFor(() =>
        expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "scripted")
      );
    });

    it("does nothing when a card is dropped back on its own column", () => {
      const idea = makeIdea({
        title: "Speedrun commentary",
        status: "scripted",
      });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 1);
      releasePointerAt(columnCenterX(1) + 10);

      expect(updateIdeaStatus).not.toHaveBeenCalled();
    });

    it("does nothing when a card is dropped outside every column", () => {
      const idea = makeIdea({
        title: "Speedrun commentary",
        status: "scripted",
      });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 1);
      movePointerTo(900);
      expect(stageColumn("Published")).toHaveAttribute(
        "data-drop-target",
        "false"
      );

      releasePointerAt(900);

      expect(updateIdeaStatus).not.toHaveBeenCalled();
    });

    it("abandons the drag on Escape, leaving the card where it was", () => {
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(4));
      act(() => {
        window.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Escape" })
        );
      });

      expect(updateIdeaStatus).not.toHaveBeenCalled();
      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).not.toBeInTheDocument();
      expect(
        within(stageColumn("Idea")).getByText("Speedrun commentary")
      ).toBeInTheDocument();
    });

    it("abandons the drag on pointercancel", () => {
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(4));
      act(() => {
        window.dispatchEvent(
          new window.PointerEvent("pointercancel", {
            pointerId: 1,
            clientX: columnCenterX(4),
            clientY: 100,
            bubbles: true,
          })
        );
      });

      expect(updateIdeaStatus).not.toHaveBeenCalled();
      expect(
        within(stageColumn("Idea")).getByText("Speedrun commentary")
      ).toBeInTheDocument();
    });

    it("nudges about the publish checklist when a card is dropped on Published", async () => {
      updateIdeaStatus.mockResolvedValue({ uncheckedCount: 2 });
      const idea = makeIdea({ title: "Speedrun commentary", status: "edited" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 3);
      movePointerTo(columnCenterX(4));
      releasePointerAt(columnCenterX(4));

      await waitFor(() =>
        expect(toastFn).toHaveBeenCalledWith(
          "Published with 2 unchecked checklist items",
          expect.objectContaining({
            action: expect.objectContaining({ label: "Open checklist" }),
          })
        )
      );
    });

    it("toasts and reverts when the dropped move fails on the server", async () => {
      updateIdeaStatus.mockResolvedValue({
        error: "That idea no longer exists.",
      });
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      liftCard("Speedrun commentary", 0);
      movePointerTo(columnCenterX(2));
      releasePointerAt(columnCenterX(2));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
      );
      // The transition settled without a revalidated `ideas` prop, so React
      // discarded the optimistic move — the card is back in its own column.
      await waitFor(() =>
        expect(
          within(stageColumn("Idea")).getByText("Speedrun commentary")
        ).toBeInTheDocument()
      );
    });

    it("lifts a card on touch only after the long press, then drops it", async () => {
      vi.useFakeTimers();
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      fireEvent.pointerDown(cardElement("Speedrun commentary"), {
        pointerId: 1,
        pointerType: "touch",
        clientX: columnCenterX(0),
        clientY: 100,
      });
      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(
          new window.PointerEvent("pointermove", {
            pointerId: 1,
            pointerType: "touch",
            clientX: columnCenterX(2),
            clientY: 100,
            bubbles: true,
          })
        );
        window.dispatchEvent(
          new window.PointerEvent("pointerup", {
            pointerId: 1,
            pointerType: "touch",
            clientX: columnCenterX(2),
            clientY: 100,
            bubbles: true,
          })
        );
      });
      // Flush the move's transition without letting fake timers stall it.
      await act(async () => {});

      expect(updateIdeaStatus).toHaveBeenCalledWith(idea.id, "recorded");
    });

    it("lets a touch swipe scroll the board instead of lifting a card", () => {
      vi.useFakeTimers();
      const idea = makeIdea({ title: "Speedrun commentary", status: "idea" });
      const { container } = render(<PipelineBoard ideas={[idea]} />);
      stubColumnGeometry(container);

      fireEvent.pointerDown(cardElement("Speedrun commentary"), {
        pointerId: 1,
        pointerType: "touch",
        clientX: columnCenterX(0),
        clientY: 100,
      });
      // A swipe that starts before the long-press fires reads as a scroll, so
      // the card is never lifted and the board scrolls natively.
      act(() => {
        window.dispatchEvent(
          new window.PointerEvent("pointermove", {
            pointerId: 1,
            pointerType: "touch",
            clientX: columnCenterX(0) - 60,
            clientY: 100,
            bubbles: true,
          })
        );
        vi.advanceTimersByTime(400);
      });

      expect(
        document.querySelector('[data-slot="board-drag-preview"]')
      ).not.toBeInTheDocument();

      releasePointerAt(columnCenterX(0) - 60);
      expect(updateIdeaStatus).not.toHaveBeenCalled();
    });
  });
});
