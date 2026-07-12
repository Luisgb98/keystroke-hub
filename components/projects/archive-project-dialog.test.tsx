import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const archiveProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/actions", () => ({ archiveProject }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { Project } from "@/lib/db/schema";
import { ArchiveProjectDialog } from "./archive-project-dialog";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Keystroke Hub",
    description: null,
    status: "active",
    notes: "",
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ArchiveProjectDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <ArchiveProjectDialog
        project={makeProject()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("archives on confirm and closes", async () => {
    archiveProject.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArchiveProjectDialog
        project={makeProject({ id: "project-7", name: "Old project" })}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(archiveProject).toHaveBeenCalledWith("project-7")
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith('"Old project" archived');
  });

  it("toasts an error and stays open-eligible when archiving fails", async () => {
    archiveProject.mockResolvedValue({
      error: "That project no longer exists.",
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ArchiveProjectDialog
        project={makeProject()}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That project no longer exists.")
    );
  });
});
