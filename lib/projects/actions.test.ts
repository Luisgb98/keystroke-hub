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

const searchLinkableIdeasMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/projects", () => ({
  searchLinkableIdeas: searchLinkableIdeasMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  archiveProject,
  createProject,
  linkIdeaToProject,
  saveProjectNotes,
  searchLinkableIdeas,
  unarchiveProject,
  unlinkIdeaFromProject,
  updateProjectDetails,
  updateProjectStatus,
} from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.updateReturning.mockResolvedValue([{ id: "project-1" }]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("createProject", () => {
  const validForm = { name: "Keystroke Hub", description: "" };

  it("verifies the session before writing", async () => {
    await createProject(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(createProject(undefined, form(validForm))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates a project and revalidates the list", async () => {
    const state = await createProject(undefined, form(validForm));
    expect(state.success).toBe(true);
    expect(state.projectId).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith("/projects");
  });

  it("returns field errors without writing when the name is blank", async () => {
    const state = await createProject(
      undefined,
      form({ ...validForm, name: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.name).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateProjectDetails", () => {
  const validForm = { id: "project-1", name: "Renamed", description: "" };

  it("verifies the session before writing", async () => {
    await updateProjectDetails(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates name and description and revalidates", async () => {
    const result = await updateProjectDetails(undefined, form(validForm));
    expect(result).toEqual({ success: true, projectId: "project-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("returns an error (not a throw) when the project no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await updateProjectDetails(undefined, form(validForm));
    expect(result.error).toBe("That project no longer exists.");
  });
});

describe("updateProjectStatus", () => {
  it("verifies the session before writing", async () => {
    await updateProjectStatus("project-1", "paused");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates the status and revalidates", async () => {
    const result = await updateProjectStatus("project-1", "paused");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ status: "paused" });
  });

  it("rejects an unknown status without writing", async () => {
    const result = await updateProjectStatus("project-1", "vibing");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error when the project no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await updateProjectStatus("missing", "paused");
    expect(result).toEqual({ error: "That project no longer exists." });
  });
});

describe("saveProjectNotes", () => {
  it("verifies the session before writing", async () => {
    await saveProjectNotes("project-1", "Some notes");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("saves notes and revalidates", async () => {
    const result = await saveProjectNotes("project-1", "Some notes");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ notes: "Some notes" });
  });

  it("returns an error when the project no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await saveProjectNotes("missing", "note");
    expect(result).toEqual({ error: "That project no longer exists." });
  });
});

describe("archiveProject / unarchiveProject", () => {
  it("sets archivedAt and revalidates", async () => {
    const result = await archiveProject("project-1");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      archivedAt: expect.any(Date),
    });
  });

  it("clears archivedAt on unarchive", async () => {
    const result = await unarchiveProject("project-1");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ archivedAt: null });
  });

  it("returns an error when the project no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await archiveProject("missing");
    expect(result).toEqual({ error: "That project no longer exists." });
  });
});

describe("linkIdeaToProject", () => {
  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    await linkIdeaToProject("project-1", "idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("sets the idea's projectId", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.updateReturning.mockResolvedValueOnce([{ id: "idea-1" }]);

    const result = await linkIdeaToProject("project-1", "idea-1");

    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ projectId: "project-1" });
  });

  it("rejects linking to an archived project", async () => {
    dbMock.selectQueue.push([
      { id: "project-1", archivedAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    const result = await linkIdeaToProject("project-1", "idea-1");

    expect(result).toEqual({
      error: "Archived projects can't take new links.",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error when the project no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await linkIdeaToProject("missing", "idea-1");
    expect(result).toEqual({ error: "That project no longer exists." });
  });

  it("returns an error when the idea no longer exists", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await linkIdeaToProject("project-1", "missing");
    expect(result).toEqual({ error: "That idea no longer exists." });
  });
});

describe("unlinkIdeaFromProject", () => {
  it("verifies the session and clears projectId scoped by project", async () => {
    await unlinkIdeaFromProject("project-1", "idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(dbMock.updateSet).toHaveBeenCalledWith({ projectId: null });
  });
});

describe("searchLinkableIdeas", () => {
  it("verifies the session before querying", async () => {
    searchLinkableIdeasMock.mockResolvedValue([]);
    await searchLinkableIdeas("");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("delegates to the data-layer query with the same argument", async () => {
    searchLinkableIdeasMock.mockResolvedValue([{ id: "idea-1" }]);
    const result = await searchLinkableIdeas("keystroke");
    expect(searchLinkableIdeasMock).toHaveBeenCalledWith("keystroke");
    expect(result).toEqual([{ id: "idea-1" }]);
  });
});
