import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateStreamDetails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ updateStreamDetails }));

import type { Stream } from "@/lib/db/schema";
import { StreamDetailsForm } from "./stream-details-form";

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

describe("StreamDetailsForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefills the topic and prep notes", () => {
    render(
      <StreamDetailsForm
        stream={makeStream({ title: "Boss rush", notes: "Warm up voice" })}
      />
    );
    expect(screen.getByLabelText("Topic")).toHaveValue("Boss rush");
    expect(screen.getByLabelText("Prep notes")).toHaveValue("Warm up voice");
  });

  it("submits the updated title and notes with the stream id", async () => {
    updateStreamDetails.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<StreamDetailsForm stream={makeStream({ id: "stream-9" })} />);

    await user.clear(screen.getByLabelText("Topic"));
    await user.type(screen.getByLabelText("Topic"), "Renamed stream");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateStreamDetails).toHaveBeenCalledTimes(1));
    const [, formData] = updateStreamDetails.mock.calls[0] as [
      unknown,
      FormData,
    ];
    expect(formData.get("id")).toBe("stream-9");
    expect(formData.get("title")).toBe("Renamed stream");
  });

  it("shows the new value, without a Base UI warning, when a save revalidates the page", async () => {
    const consoleError = vi.spyOn(console, "error");
    const user = userEvent.setup();
    const { rerender } = render(
      <StreamDetailsForm stream={makeStream({ title: "Before" })} />
    );

    // What the real page does after `updateStreamDetails`: `revalidatePath`
    // re-renders the server component, so the same client component is handed a
    // `stream` with the new title (#102).
    rerender(<StreamDetailsForm stream={makeStream({ title: "After" })} />);

    expect(screen.getByLabelText("Topic")).toHaveValue("After");
    expect(
      consoleError.mock.calls.filter(([first]) =>
        String(first).includes("changing the default value state")
      )
    ).toEqual([]);

    // An unrelated revalidation (a checklist toggle refreshes this route too)
    // must not throw away what's being typed.
    await user.clear(screen.getByLabelText("Prep notes"));
    await user.type(screen.getByLabelText("Prep notes"), "Half-typed note");
    rerender(<StreamDetailsForm stream={makeStream({ title: "After" })} />);
    expect(screen.getByLabelText("Prep notes")).toHaveValue("Half-typed note");
  });

  it("shows a field error on invalid input", async () => {
    updateStreamDetails.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<StreamDetailsForm stream={makeStream()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });
});
