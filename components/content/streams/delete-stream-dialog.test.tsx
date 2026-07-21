import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const deleteStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ deleteStream }));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import type { Stream } from "@/lib/db/schema";
import { DeleteStreamDialog } from "./delete-stream-dialog";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: "stream-1",
    title: "Boss rush stream",
    notes: null,
    retroNotes: null,
    eventId: null,
    eventTrack: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("DeleteStreamDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <DeleteStreamDialog
        stream={makeStream()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("deletes on confirm and navigates back to the list", async () => {
    deleteStream.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteStreamDialog
        stream={makeStream({ id: "stream-7", title: "Old stream" })}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteStream).toHaveBeenCalledWith("stream-7"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(push).toHaveBeenCalledWith("/content/streams");
    expect(toastSuccess).toHaveBeenCalledWith('"Old stream" deleted');
  });

  it("toasts an error and stays without navigating when deletion fails", async () => {
    deleteStream.mockResolvedValue({ error: "That stream no longer exists." });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DeleteStreamDialog
        stream={makeStream()}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("That stream no longer exists.")
    );
    expect(push).not.toHaveBeenCalled();
  });
});
