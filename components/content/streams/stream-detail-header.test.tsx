import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const deleteStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ deleteStream }));

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn() }),
}));

import type { Stream } from "@/lib/db/schema";
import { StreamDetailHeader } from "./stream-detail-header";

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

describe("StreamDetailHeader", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens a delete confirmation and calls deleteStream on confirm", async () => {
    deleteStream.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <StreamDetailHeader
        stream={makeStream({ id: "stream-7", title: "Old stream" })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: 'Delete "Old stream"' })
    );
    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toBeVisible();

    await user.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteStream).toHaveBeenCalledWith("stream-7"));
  });
});
