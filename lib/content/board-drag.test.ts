import { describe, expect, it } from "vitest";

import {
  resolveDropColumn,
  resolveDropMove,
  type ColumnBounds,
} from "./board-drag";
import type { IdeaStatus } from "./idea-status";

/** Three 100px-wide columns side by side, 500px tall — the shape a real board has. */
function columns(): ColumnBounds[] {
  const stages: IdeaStatus[] = ["idea", "scripted", "recorded"];
  return stages.map((status, index) => ({
    status,
    left: index * 100,
    right: index * 100 + 100,
    top: 50,
    bottom: 550,
  }));
}

describe("resolveDropColumn", () => {
  it("resolves the column the pointer is inside", () => {
    expect(resolveDropColumn({ x: 50, y: 300 }, columns())).toBe("idea");
    expect(resolveDropColumn({ x: 150, y: 300 }, columns())).toBe("scripted");
    expect(resolveDropColumn({ x: 250, y: 300 }, columns())).toBe("recorded");
  });

  it("resolves a pointer on a column edge, so neighbouring columns leave no dead gap", () => {
    expect(resolveDropColumn({ x: 100, y: 300 }, columns())).toBe("idea");
    expect(resolveDropColumn({ x: 0, y: 50 }, columns())).toBe("idea");
    expect(resolveDropColumn({ x: 299, y: 550 }, columns())).toBe("recorded");
  });

  it("resolves the top (header) and bottom of a column, not just the card area", () => {
    expect(resolveDropColumn({ x: 150, y: 55 }, columns())).toBe("scripted");
    expect(resolveDropColumn({ x: 150, y: 545 }, columns())).toBe("scripted");
  });

  it("returns null when the pointer is outside every column", () => {
    expect(resolveDropColumn({ x: 400, y: 300 }, columns())).toBeNull();
    expect(resolveDropColumn({ x: 150, y: 10 }, columns())).toBeNull();
    expect(resolveDropColumn({ x: 150, y: 900 }, columns())).toBeNull();
    expect(resolveDropColumn({ x: -20, y: 300 }, columns())).toBeNull();
  });

  it("returns null for an empty column list", () => {
    expect(resolveDropColumn({ x: 50, y: 50 }, [])).toBeNull();
  });

  it("ignores zero-area columns, so an unmeasured board can't capture the origin", () => {
    const unmeasured: ColumnBounds[] = [
      { status: "idea", left: 0, right: 0, top: 0, bottom: 0 },
      { status: "scripted", left: 0, right: 100, top: 0, bottom: 0 },
    ];
    expect(resolveDropColumn({ x: 0, y: 0 }, unmeasured)).toBeNull();
  });
});

describe("resolveDropMove", () => {
  it("returns the target status when the card lands in another column", () => {
    expect(resolveDropMove({ x: 250, y: 300 }, columns(), "idea")).toBe(
      "recorded"
    );
  });

  it("returns null when the card lands back in its own column", () => {
    expect(
      resolveDropMove({ x: 150, y: 300 }, columns(), "scripted")
    ).toBeNull();
  });

  it("returns null when the drop misses the board", () => {
    expect(resolveDropMove({ x: 900, y: 300 }, columns(), "idea")).toBeNull();
  });
});
