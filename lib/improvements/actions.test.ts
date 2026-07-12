// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];
  function nextSelect(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  }

  const insertValues = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn();
  const updateReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    updateSet,
    updateReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  createImprovement,
  recordImprovementOutcome,
  updateImprovementDetails,
  updateImprovementStatus,
} from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.updateReturning.mockResolvedValue([
    { id: "improvement-1", projectId: null },
  ]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("createImprovement", () => {
  const validForm = { title: "Automate the changelog", rationale: "" };

  it("verifies the session before writing", async () => {
    await createImprovement(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(createImprovement(undefined, form(validForm))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates an improvement and revalidates the backlog", async () => {
    const state = await createImprovement(undefined, form(validForm));
    expect(state.success).toBe(true);
    expect(state.improvementId).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith("/projects/improvements");
  });

  it("returns field errors without writing when the title is blank", async () => {
    const state = await createImprovement(
      undefined,
      form({ ...validForm, title: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects linking to an archived project without writing", async () => {
    dbMock.selectQueue.push([
      { id: "project-1", archivedAt: new Date("2026-01-01T00:00:00Z") },
    ]);
    const state = await createImprovement(
      undefined,
      form({ ...validForm, projectId: "project-1" })
    );
    expect(state.error).toBe("Archived projects can't take new links.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown project without writing", async () => {
    dbMock.selectQueue.push([]);
    const state = await createImprovement(
      undefined,
      form({ ...validForm, projectId: "missing" })
    );
    expect(state.error).toBe("That project no longer exists.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates with a valid project link", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    const state = await createImprovement(
      undefined,
      form({ ...validForm, projectId: "project-1" })
    );
    expect(state.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });
});

describe("updateImprovementDetails", () => {
  const validForm = { id: "improvement-1", title: "Renamed", rationale: "" };

  beforeEach(() => {
    dbMock.selectQueue.push([{ projectId: null }]);
  });

  it("verifies the session before writing", async () => {
    await updateImprovementDetails(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates title/rationale and revalidates", async () => {
    const result = await updateImprovementDetails(undefined, form(validForm));
    expect(result).toEqual({ success: true, improvementId: "improvement-1" });
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      title: "Renamed",
      rationale: null,
      projectId: null,
    });
  });

  it("returns an error (not a throw) when the improvement no longer exists", async () => {
    dbMock.selectQueue.length = 0;
    dbMock.selectQueue.push([]);
    const result = await updateImprovementDetails(undefined, form(validForm));
    expect(result.error).toBe("That improvement no longer exists.");
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("updateImprovementStatus", () => {
  it("verifies the session before writing", async () => {
    await updateImprovementStatus("improvement-1", "discussed");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates the status and revalidates", async () => {
    const result = await updateImprovementStatus("improvement-1", "done");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ status: "done" });
  });

  it("rejects accepted/rejected without writing", async () => {
    const result = await updateImprovementStatus("improvement-1", "accepted");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error when the improvement no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await updateImprovementStatus("missing", "discussed");
    expect(result).toEqual({ error: "That improvement no longer exists." });
  });
});

describe("recordImprovementOutcome", () => {
  it("verifies the session before writing", async () => {
    await recordImprovementOutcome("improvement-1", "accepted", "Ship it");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("sets status and outcome in one write", async () => {
    const result = await recordImprovementOutcome(
      "improvement-1",
      "rejected",
      "Not now"
    );
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      status: "rejected",
      outcome: "Not now",
    });
  });

  it("rejects a status outside accepted/rejected", async () => {
    const result = await recordImprovementOutcome(
      "improvement-1",
      "proposed",
      ""
    );
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error when the improvement no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await recordImprovementOutcome(
      "missing",
      "accepted",
      "Ship it"
    );
    expect(result).toEqual({ error: "That improvement no longer exists." });
  });
});
