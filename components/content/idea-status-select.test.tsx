import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateIdeaStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ updateIdeaStatus }));

const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

import { IdeaStatusSelect } from "./idea-status-select";

async function changeStatus(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string
) {
  await user.click(screen.getByRole("combobox", { name: "Status" }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("IdeaStatusSelect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the idea's current status", () => {
    render(<IdeaStatusSelect ideaId="idea-1" status="scripted" />);
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent(
      "Scripted"
    );
  });

  it("commits a status change through updateIdeaStatus", async () => {
    updateIdeaStatus.mockResolvedValue({});
    const user = userEvent.setup();
    render(<IdeaStatusSelect ideaId="idea-42" status="idea" />);

    await changeStatus(user, "Scripted");

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith("idea-42", "scripted")
    );
  });

  // #102: the trigger used to read straight off the `status` prop, so it kept
  // showing the *old* status — disabled, since it disables while pending —
  // until the revalidated page arrived. On /content/ideas that is seconds, and
  // "commits inline" has to look like it committed. Mirrors PipelineBoard's
  // handling of this same mutation.
  it("shows the picked status immediately, without waiting for the server", async () => {
    // A promise that never settles: the optimistic value is only observable
    // while the transition is still in flight.
    updateIdeaStatus.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<IdeaStatusSelect ideaId="idea-1" status="idea" />);

    await changeStatus(user, "Scripted");

    const trigger = screen.getByRole("combobox", { name: "Status" });
    await waitFor(() => expect(trigger).toHaveTextContent("Scripted"));
    expect(trigger).not.toHaveTextContent("Idea");
    // Still guarded against a second overlapping write.
    expect(trigger).toBeDisabled();
  });

  it("toasts an error when the update fails", async () => {
    updateIdeaStatus.mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const user = userEvent.setup();
    render(<IdeaStatusSelect ideaId="idea-1" status="idea" />);

    await changeStatus(user, "Scripted");

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That idea no longer exists.")
    );
  });

  it("nudges with a plain toast when publishing leaves items unchecked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 2 });
    const user = userEvent.setup();
    render(<IdeaStatusSelect ideaId="idea-1" status="edited" />);

    await changeStatus(user, "Published");

    await waitFor(() =>
      expect(toastFn).toHaveBeenCalledWith(
        "Published with 2 unchecked checklist items"
      )
    );
  });

  it("does not nudge when publishing with everything checked", async () => {
    updateIdeaStatus.mockResolvedValue({ uncheckedCount: 0 });
    const user = userEvent.setup();
    render(<IdeaStatusSelect ideaId="idea-1" status="edited" />);

    await changeStatus(user, "Published");

    await waitFor(() =>
      expect(updateIdeaStatus).toHaveBeenCalledWith(
        expect.any(String),
        "published"
      )
    );
    expect(toastFn).not.toHaveBeenCalled();
  });
});
