import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateStreamDetails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ updateStreamDetails }));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

const createGame = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/game-actions", () => ({ createGame }));

import type { Stream } from "@/lib/db/schema";
import { StreamDetailsForm } from "./stream-details-form";

function makeStream(overrides: Partial<Stream> = {}): Stream {
  return {
    id: "stream-1",
    title: "Boss rush stream",
    notes: null,
    retroNotes: null,
    gameId: null,
    eventId: null,
    eventTrack: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const GAMES = [
  { id: "g-poe", name: "Path of Exile" },
  { id: "g-hades", name: "Hades" },
];

function renderForm(stream: Stream = makeStream()) {
  return render(
    <StreamDetailsForm stream={stream} isPast={false} games={GAMES}>
      <div data-testid="between">Scheduled and checklist live here</div>
    </StreamDetailsForm>
  );
}

const saveButton = () => screen.getByRole("button", { name: "Save changes" });

describe("StreamDetailsForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefills the topic, prep notes and retro", () => {
    renderForm(
      makeStream({
        title: "Boss rush",
        notes: "Warm up voice",
        retroNotes: "Chat was active",
      })
    );
    expect(screen.getByLabelText("Topic")).toHaveValue("Boss rush");
    expect(screen.getByLabelText("Prep notes")).toHaveValue("Warm up voice");
    expect(screen.getByLabelText("How did it go?")).toHaveValue(
      "Chat was active"
    );
  });

  it("renders the sections it wraps between the prep notes and the retro", () => {
    renderForm();
    const fields = screen.getAllByRole("textbox");
    const between = screen.getByTestId("between");
    // Reading order must survive the move from siblings to children (#102):
    // topic, prep notes, [scheduled + checklist], retro.
    expect(between.compareDocumentPosition(fields[1])).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
    expect(between.compareDocumentPosition(fields[2])).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("is the only save button on the page, and saves all three fields at once", async () => {
    updateStreamDetails.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderForm(makeStream({ id: "stream-9" }));

    expect(screen.getAllByRole("button", { name: /^Save/ })).toHaveLength(1);

    await user.clear(screen.getByLabelText("Topic"));
    await user.type(screen.getByLabelText("Topic"), "Renamed stream");
    await user.type(screen.getByLabelText("Prep notes"), "Check the mic");
    await user.type(screen.getByLabelText("How did it go?"), "Went long");
    await user.click(saveButton());

    await waitFor(() => expect(updateStreamDetails).toHaveBeenCalledTimes(1));
    expect(updateStreamDetails).toHaveBeenCalledWith({
      id: "stream-9",
      title: "Renamed stream",
      notes: "Check the mic",
      retroNotes: "Went long",
      gameId: "",
    });
    expect(toastMock.success).toHaveBeenCalledWith("Saved");
  });

  it("stays disabled until something is actually edited, and goes quiet again after a save", async () => {
    updateStreamDetails.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderForm();

    expect(saveButton()).toBeDisabled();

    await user.type(screen.getByLabelText("How did it go?"), "Good run");
    expect(saveButton()).toBeEnabled();

    await user.click(saveButton());

    // Re-baselined off what was sent, so the button settles without waiting for
    // `revalidatePath`'s refresh to hand back new props.
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it("saves when Enter is pressed in the topic field", async () => {
    updateStreamDetails.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Topic"), " redux{Enter}");

    await waitFor(() => expect(updateStreamDetails).toHaveBeenCalledTimes(1));
  });

  it("shows the new value, without a Base UI warning, when a save revalidates the page", async () => {
    const consoleError = vi.spyOn(console, "error");
    const user = userEvent.setup();
    const { rerender } = renderForm(makeStream({ title: "Before" }));

    // What the real page does after `updateStreamDetails`: `revalidatePath`
    // re-renders the server component, so the same client component is handed a
    // `stream` with the new title (#102).
    rerender(
      <StreamDetailsForm stream={makeStream({ title: "After" })} isPast={false}>
        <div data-testid="between" />
      </StreamDetailsForm>
    );

    expect(screen.getByLabelText("Topic")).toHaveValue("After");
    expect(
      consoleError.mock.calls.filter(([first]) =>
        String(first).includes("changing the default value state")
      )
    ).toEqual([]);

    // An unrelated revalidation (a checklist toggle refreshes this route too)
    // must not throw away what's being typed.
    await user.type(screen.getByLabelText("Prep notes"), "Half-typed note");
    rerender(
      <StreamDetailsForm stream={makeStream({ title: "After" })} isPast={false}>
        <div data-testid="between" />
      </StreamDetailsForm>
    );
    expect(screen.getByLabelText("Prep notes")).toHaveValue("Half-typed note");
  });

  it("shows a field error on invalid input", async () => {
    updateStreamDetails.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByLabelText("Topic"));
    await user.click(saveButton());

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    // A field error belongs next to the field, not in a toast.
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("toasts an error the fields can't explain", async () => {
    updateStreamDetails.mockResolvedValue({
      error: "That stream no longer exists.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("How did it go?"), "Nice one");
    await user.click(saveButton());

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "That stream no longer exists."
      )
    );
  });

  it("promotes the retro section once the stream is in the past", () => {
    render(
      <StreamDetailsForm stream={makeStream()} isPast>
        <div />
      </StreamDetailsForm>
    );
    expect(
      document.querySelector('[data-slot="stream-retro-notes"]')
    ).toHaveClass("border-track-content-border");
  });

  it("prefills the picked game and saves a change to it (#105)", async () => {
    const user = userEvent.setup();
    renderForm(makeStream({ gameId: "g-poe" }));

    const picker = screen.getByRole("combobox", { name: "Game" });
    expect(picker).toHaveTextContent("Path of Exile");

    await user.click(picker);
    await user.click(await screen.findByText("Hades"));

    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    await waitFor(() =>
      expect(updateStreamDetails).toHaveBeenCalledWith(
        expect.objectContaining({ id: "stream-1", gameId: "g-hades" })
      )
    );
  });

  it("clears the game, which saves as 'no game' rather than being ignored (#105)", async () => {
    const user = userEvent.setup();
    renderForm(makeStream({ gameId: "g-poe" }));

    await user.click(screen.getByRole("combobox", { name: "Game" }));
    await user.click(await screen.findByText("No game"));

    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    await waitFor(() =>
      expect(updateStreamDetails).toHaveBeenCalledWith(
        expect.objectContaining({ gameId: "" })
      )
    );
  });

  it("leaves Save disabled until the game actually changes (#105)", () => {
    renderForm(makeStream({ gameId: "g-poe" }));
    expect(saveButton()).toBeDisabled();
  });
});
