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
