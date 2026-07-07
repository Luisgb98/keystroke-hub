import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEventDrag } from "./use-event-drag";

interface HarnessProps {
  onDragMove: (delta: { dx: number; dy: number }) => void;
  onDragEnd: (delta: { dx: number; dy: number }) => void;
  onDragCancel: () => void;
  disabled?: boolean;
}

function Harness({
  onDragMove,
  onDragEnd,
  onDragCancel,
  disabled,
}: HarnessProps) {
  const { onPointerDown, isDragging, consumeClickAfterDrag } = useEventDrag({
    onDragMove,
    onDragEnd,
    onDragCancel,
    disabled,
  });

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={() => {
        if (consumeClickAfterDrag()) return;
        onDragMove({ dx: 0, dy: 0 }); // reuse as a "click fired" signal
      }}
      data-dragging={isDragging}
    >
      handle
    </button>
  );
}

function pointerEvent(
  type: string,
  init: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
  }
) {
  return new window.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useEventDrag", () => {
  it("does not engage a drag for movement under the threshold", () => {
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 102, clientY: 101 })
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 102, clientY: 101 })
      );
    });

    expect(onDragMove).not.toHaveBeenCalledWith(
      expect.not.objectContaining({ dx: 0, dy: 0 })
    );
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it("engages a mouse drag past the threshold and reports the live delta", () => {
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 130, clientY: 140 })
      );
    });

    expect(onDragMove).toHaveBeenCalledWith({ dx: 30, dy: 40 });
  });

  it("commits the final delta on pointerup after an engaged drag", () => {
    const onDragEnd = vi.fn();
    render(
      <Harness
        onDragMove={vi.fn()}
        onDragEnd={onDragEnd}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 20, clientY: 0 })
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 50, clientY: 5 })
      );
    });

    expect(onDragEnd).toHaveBeenCalledWith({ dx: 50, dy: 5 });
  });

  it("suppresses the trailing click after an engaged drag commits", () => {
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 20, clientY: 0 })
      );
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 20, clientY: 0 })
      );
    });
    onDragMove.mockClear();
    fireEvent.click(screen.getByText("handle"));

    // The harness's onClick calls onDragMove({dx:0,dy:0}) as a "click fired"
    // signal unless consumeClickAfterDrag() swallows it.
    expect(onDragMove).not.toHaveBeenCalled();
  });

  it("does not suppress a plain click that never engaged a drag", () => {
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointerup", { clientX: 1, clientY: 0 })
      );
    });
    fireEvent.click(screen.getByText("handle"));

    expect(onDragMove).toHaveBeenCalledWith({ dx: 0, dy: 0 });
  });

  it("cancels an engaged drag on Escape without committing", () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();
    render(
      <Harness
        onDragMove={vi.fn()}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 20, clientY: 0 })
      );
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape" })
      );
    });

    expect(onDragCancel).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel without committing", () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();
    render(
      <Harness
        onDragMove={vi.fn()}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 20, clientY: 0 })
      );
      window.dispatchEvent(
        pointerEvent("pointercancel", { clientX: 20, clientY: 0 })
      );
    });

    expect(onDragCancel).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it("does not engage a touch drag before the long-press timer fires", () => {
    vi.useFakeTimers();
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", {
          clientX: 20,
          clientY: 0,
          pointerType: "touch",
        })
      );
    });

    expect(onDragMove).not.toHaveBeenCalled();
  });

  it("engages a touch drag once the long-press timer fires", () => {
    vi.useFakeTimers();
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", {
          clientX: 10,
          clientY: 5,
          pointerType: "touch",
        })
      );
    });

    expect(onDragMove).toHaveBeenCalledWith({ dx: 10, dy: 5 });
  });

  it("cancels a pending long-press if the touch moves like a scroll first", () => {
    vi.useFakeTimers();
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", {
          clientX: 0,
          clientY: 40,
          pointerType: "touch",
        })
      );
      vi.advanceTimersByTime(400);
    });

    expect(onDragMove).not.toHaveBeenCalled();
  });

  it("ignores pointerdown while disabled", () => {
    const onDragMove = vi.fn();
    render(
      <Harness
        onDragMove={onDragMove}
        onDragEnd={vi.fn()}
        onDragCancel={vi.fn()}
        disabled
      />
    );

    fireEvent.pointerDown(screen.getByText("handle"), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    act(() => {
      window.dispatchEvent(
        pointerEvent("pointermove", { clientX: 20, clientY: 0 })
      );
    });

    expect(onDragMove).not.toHaveBeenCalled();
  });
});
