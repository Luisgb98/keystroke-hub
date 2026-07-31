import { afterEach, describe, expect, it } from "vitest";

import { measureColumns } from "./use-board-drag";

function buildBoard(statuses: (string | null)[]): HTMLElement {
  const board = document.createElement("div");
  statuses.forEach((status, index) => {
    const column = document.createElement("div");
    column.dataset.slot = "stage-column";
    if (status !== null) column.dataset.status = status;
    column.getBoundingClientRect = () =>
      ({
        left: index * 100,
        right: index * 100 + 100,
        top: 10,
        bottom: 510,
      }) as DOMRect;
    board.append(column);
  });
  document.body.append(board);
  return board;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("measureColumns", () => {
  it("reads each column's stage and live box, in DOM order", () => {
    const board = buildBoard(["idea", "scripted"]);

    expect(measureColumns(board)).toEqual([
      { status: "idea", left: 0, right: 100, top: 10, bottom: 510 },
      { status: "scripted", left: 100, right: 200, top: 10, bottom: 510 },
    ]);
  });

  it("skips elements whose data-status isn't a pipeline stage", () => {
    const board = buildBoard(["idea", null, "parked"]);

    expect(measureColumns(board)).toEqual([
      { status: "idea", left: 0, right: 100, top: 10, bottom: 510 },
    ]);
  });

  it("measures nothing before the board has mounted", () => {
    expect(measureColumns(null)).toEqual([]);
  });
});
