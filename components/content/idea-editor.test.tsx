import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createIdea = vi.hoisted(() => vi.fn());
const updateIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ createIdea, updateIdea }));

const createGame = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/game-actions", () => ({ createGame }));

const toastFn = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { success: toastSuccess, custom: toastFn }),
}));

import type { Idea } from "@/lib/db/schema";
import { IdeaEditor } from "./idea-editor";
import { appTodayParam, formatInAppZone } from "@/lib/time";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    description: null,
    format: "either",
    status: "idea",
    tags: [],
    projectId: null,
    gameId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * react-day-picker labels the current day "Today, Saturday, August 1st, 2026"
 * and every other day without the prefix, and the popover opens on the current
 * month — so a hardcoded date only resolves on some days of some months. Drive
 * the calendar off today instead, which is always present and always labelled
 * this way.
 */
const GAMES = [
  { id: "g-poe", name: "Path of Exile" },
  { id: "g-hades", name: "Hades" },
];

function todayCellName(): RegExp {
  return new RegExp(
    `^Today, ${formatInAppZone(new Date(), "EEEE, MMMM do, yyyy")}$`
  );
}

describe("IdeaEditor — create mode", () => {
  afterEach(() => vi.clearAllMocks());

  it("defaults the release time to 19:00 and offers an inline script field", () => {
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(screen.getByText("New idea")).toBeInTheDocument();
    expect(screen.getByLabelText("Release time")).toHaveValue("19:00");
    // #93 reworked the field's chrome (counter, cap, expand) but kept it
    // inline and labelled — capture with a ready script stays one dialog.
    expect(screen.getByLabelText("Script (optional)")).toBeInTheDocument();
  });

  // #88: capture asks for the publish-facing description, not vague "Notes" —
  // the label, the placeholder, and the submitted field name all say so.
  it("asks for a Description, never Notes, and submits it under that name", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    const field = screen.getByLabelText("Description");
    expect(field).toHaveAttribute(
      "placeholder",
      "The description you'll publish with the video"
    );
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.type(field, "Cover the wrong warp");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("description")).toBe("Cover the wrong warp");
    expect(formData.get("notes")).toBeNull();
  });

  it("submits the script and release date/time in the capture payload", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.type(screen.getByLabelText("Script (optional)"), "# Intro");
    // Typed from the same helper it's asserted against: a literal date here
    // only agrees with `appTodayParam()` on the one day it was written.
    await user.type(screen.getByLabelText("Release date"), appTodayParam());
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Glitch tutorial");
    expect(formData.get("script")).toBe("# Intro");
    expect(formData.get("releaseDate")).toBe(appTodayParam());
    expect(formData.get("releaseTime")).toBe("19:00");
  });

  it("picking the release date in the calendar enables the time and submits both", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText("Release time")).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Open publish day calendar" })
    );
    await user.click(
      await screen.findByRole("button", { name: todayCellName() })
    );

    expect(screen.getByLabelText("Release date")).toHaveValue(appTodayParam());
    expect(screen.getByLabelText("Release time")).toBeEnabled();

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("releaseDate")).toBe(appTodayParam());
    expect(formData.get("releaseTime")).toBe("19:00");
  });

  it("tracks the tag count against the five-tag standard", async () => {
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(screen.getByText("0/5")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tags"), "a, b, c");
    expect(screen.getByText("3/5")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tags"), ", d, e, f");
    expect(screen.getByText("6/5")).toBeInTheDocument();
  });
});

// #93: the dialog is a capture surface, not the script editor. Pasting a full
// Markdown script must leave it exactly as tall as it was — the field caps and
// scrolls internally, and a counter stands in for the text you can't see.
// jsdom measures nothing, so these assert the classes and state that produce
// the cap; the real height check lives in e2e/ideas.spec.ts.
describe("IdeaEditor — capture script field", () => {
  afterEach(() => vi.clearAllMocks());

  /** A script well past the collapsed field's height, with the newlines that must survive the round trip. */
  const LONG_SCRIPT = [
    "# Cold open",
    "",
    "Hook them in the first five seconds.",
    "",
    "## Beat one",
    "",
    ...Array.from({ length: 40 }, (_, i) => `- Line ${i + 1} of the outline`),
    "",
    "## Outro",
    "",
    "Ask for the subscribe.",
  ].join("\n");

  function scriptField() {
    return screen.getByLabelText("Script (optional)");
  }

  it("caps its height and scrolls internally instead of growing with the paste", () => {
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    // The shared Textarea is `field-sizing-content` with no ceiling; the cap
    // is applied here at the call site, not in the primitive.
    expect(scriptField()).toHaveClass(
      "max-h-40",
      "overflow-y-auto",
      "overscroll-contain",
      "resize-none"
    );
  });

  it("renders the script in a monospace style fitting Markdown", () => {
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(scriptField()).toHaveClass("font-mono");
  });

  it("reports the script's size so a long paste is visible without scrolling it", async () => {
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    const counter = screen.getByText("0 words");
    expect(counter).toHaveAttribute("aria-live", "polite");

    await user.click(scriptField());
    await user.paste(LONG_SCRIPT);

    expect(screen.getByText("259 words")).toBeInTheDocument();
    expect(screen.queryByText("0 words")).not.toBeInTheDocument();
  });

  it("offers Expand only once the script outgrows the collapsed field, and toggles the cap", async () => {
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Expand/ })
    ).not.toBeInTheDocument();

    await user.click(scriptField());
    await user.paste("# Intro\n\nTwo lines only.");
    expect(
      screen.queryByRole("button", { name: /Expand/ })
    ).not.toBeInTheDocument();

    await user.clear(scriptField());
    await user.click(scriptField());
    await user.paste(LONG_SCRIPT);

    const expand = screen.getByRole("button", { name: /Expand/ });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("aria-controls", "idea-script");

    await user.click(expand);
    expect(scriptField()).toHaveClass("max-h-[45dvh]");
    expect(scriptField()).not.toHaveClass("max-h-40");

    const collapse = screen.getByRole("button", { name: /Collapse/ });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await user.click(collapse);
    expect(scriptField()).toHaveClass("max-h-40");
  });

  it("submits the pasted script byte-identical — no trimming, no reflowing", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.click(scriptField());
    await user.paste(LONG_SCRIPT);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("script")).toBe(LONG_SCRIPT);
  });

  it("surfaces an over-cap script rejection at the field itself, and opens it up", async () => {
    const message =
      "That script is too long — keep it under 200,000 characters.";
    createIdea.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { script: [message] },
    });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.click(scriptField());
    await user.paste(LONG_SCRIPT);
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Before #93 the only feedback was the generic form-level error.
    const error = await screen.findByText(message);
    expect(error).toHaveAttribute("role", "alert");
    expect(scriptField()).toHaveAttribute("aria-invalid", "true");
    // The offending text has to be reachable to trim it down.
    expect(scriptField()).toHaveClass("max-h-[45dvh]");
    expect(
      screen.getByRole("button", { name: /Collapse/ })
    ).toBeInTheDocument();
  });

  it("caps the Description the same way and renders its own error", async () => {
    const message = "Keep the description under 4000 characters";
    createIdea.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { description: [message] },
    });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    const description = screen.getByLabelText("Description");
    expect(description).toHaveClass(
      "max-h-32",
      "overflow-y-auto",
      "overscroll-contain"
    );

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(message)).toHaveAttribute("role", "alert");
    expect(description).toHaveAttribute("aria-invalid", "true");
  });

  it("starts collapsed again the next time the dialog opens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <IdeaEditor mode="create" open onOpenChange={vi.fn()} />
    );

    await user.click(scriptField());
    await user.paste(LONG_SCRIPT);
    await user.click(screen.getByRole("button", { name: /Expand/ }));
    expect(scriptField()).toHaveClass("max-h-[45dvh]");

    rerender(<IdeaEditor mode="create" open={false} onOpenChange={vi.fn()} />);
    rerender(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(scriptField()).toHaveValue("");
    expect(scriptField()).toHaveClass("max-h-40");
    expect(screen.getByText("0 words")).toBeInTheDocument();
  });
});

describe("IdeaEditor — the game field (#105)", () => {
  afterEach(() => vi.clearAllMocks());

  it("captures with no game by default, submitting an empty id", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <IdeaEditor mode="create" games={GAMES} open onOpenChange={vi.fn()} />
    );

    expect(screen.getByRole("combobox", { name: "Game" })).toHaveTextContent(
      "No game"
    );
    await user.type(screen.getByLabelText("Title"), "Boss rush");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalled());
    const formData = createIdea.mock.calls[0][1] as FormData;
    expect(formData.get("gameId")).toBe("");
  });

  it("submits the picked game's id", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <IdeaEditor mode="create" games={GAMES} open onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText("Title"), "Boss rush");
    await user.click(screen.getByRole("combobox", { name: "Game" }));
    await user.click(await screen.findByText("Hades"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalled());
    const formData = createIdea.mock.calls[0][1] as FormData;
    expect(formData.get("gameId")).toBe("g-hades");
  });

  it("prefills the idea's game in edit mode and can clear it", async () => {
    updateIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea({ id: "idea-7", gameId: "g-poe" })}
        games={GAMES}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole("combobox", { name: "Game" })).toHaveTextContent(
      "Path of Exile"
    );

    await user.click(screen.getByRole("combobox", { name: "Game" }));
    await user.click(await screen.findByText("No game"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateIdea).toHaveBeenCalled());
    // Bound to the idea id, so the FormData is the third argument.
    const [, , formData] = updateIdea.mock.calls[0] as [
      string,
      unknown,
      FormData,
    ];
    expect(formData.get("gameId")).toBe("");
  });

  it("is a themed popup, not a native select — the game is a real combobox", () => {
    render(
      <IdeaEditor mode="create" games={GAMES} open onOpenChange={vi.fn()} />
    );
    const picker = screen.getByRole("combobox", { name: "Game" });
    expect(picker.tagName).toBe("BUTTON");
    expect(picker).toHaveAttribute("aria-expanded", "false");
  });
});

describe("IdeaEditor — edit mode", () => {
  afterEach(() => vi.clearAllMocks());

  it("prefills every field from the idea and its release event", () => {
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea({
          title: "Boss rush",
          description: "cover phase 3",
          format: "video",
          tags: ["speedrun", "glitch"],
        })}
        // 18:30 in Madrid (CEST, +2) as an absolute instant — the prefill
        // must read it back in the app zone, not the process one (#95).
        releaseStartsAt={new Date("2026-09-10T16:30:00.000Z")}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("Edit idea")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Boss rush");
    expect(screen.getByLabelText("Description")).toHaveValue("cover phase 3");
    expect(screen.getByRole("radio", { name: "Video" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText("Tags")).toHaveValue("speedrun, glitch");
    expect(screen.getByLabelText("Release date")).toHaveValue("2026-09-10");
    expect(screen.getByLabelText("Release time")).toHaveValue("18:30");
  });

  it("links out to the script page instead of an inline script field", () => {
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea({ id: "idea-9" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.queryByLabelText("Script (optional)")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit script/ })).toHaveAttribute(
      "href",
      "/content/ideas/idea-9/script"
    );
  });

  it("clears the release date and disables the time when Clear is used", async () => {
    const user = userEvent.setup();
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea()}
        releaseStartsAt={new Date("2026-09-10T16:30:00.000Z")}
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /Clear/ }));

    expect(screen.getByLabelText("Release date")).toHaveValue("");
    expect(screen.getByLabelText("Release time")).toBeDisabled();
  });

  it("submits through updateIdea bound to the idea id", async () => {
    updateIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea({ id: "idea-42", title: "Boss rush" })}
        open
        onOpenChange={vi.fn()}
      />
    );

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Boss rush redux");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateIdea).toHaveBeenCalledTimes(1));
    const [id, , formData] = updateIdea.mock.calls[0] as [
      string,
      unknown,
      FormData,
    ];
    expect(id).toBe("idea-42");
    expect(formData.get("title")).toBe("Boss rush redux");
  });

  it("closes and toasts on a successful edit", async () => {
    updateIdea.mockResolvedValue({ success: true });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea()}
        open
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith("Idea updated");
  });

  // #102: submitting used to be a `useActionState` form action, so a rejection
  // stayed in the action state until the next submit. Now the dialog owns its
  // result and clears it on open, so a fresh open never wears an old error.
  it("drops a previous attempt's errors when reopened", async () => {
    updateIdea.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    const { rerender } = render(
      <IdeaEditor mode="edit" idea={makeIdea()} open onOpenChange={vi.fn()} />
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();

    rerender(
      <IdeaEditor
        mode="edit"
        idea={makeIdea()}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    rerender(
      <IdeaEditor mode="edit" idea={makeIdea()} open onOpenChange={vi.fn()} />
    );

    expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).not.toHaveAttribute("aria-invalid");
  });

  // #102: the close used to be issued from the render pass that noticed
  // `state.success`, which writes the *parent's* state mid-render. React let
  // the save through but logged "Cannot update a component (IdeaCard) while
  // rendering a different component (IdeaEditor)" every time. Only a real
  // stateful parent reproduces it — an `onOpenChange={vi.fn()}` spy has no
  // state to update, so every other test here stayed green through the bug.
  it("closes without asking React to update its parent mid-render", async () => {
    updateIdea.mockResolvedValue({ success: true });
    const consoleError = vi.spyOn(console, "error");
    const user = userEvent.setup();

    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <IdeaEditor
            mode="edit"
            idea={makeIdea()}
            releaseStartsAt={new Date("2026-09-10T16:30:00.000Z")}
            open={open}
            onOpenChange={setOpen}
          />
          <span data-testid="host-open">{String(open)}</span>
        </>
      );
    }

    render(<Host />);
    // Change the release hour — the exact flow the error was reported on.
    await user.clear(screen.getByLabelText("Release time"));
    await user.type(screen.getByLabelText("Release time"), "21:00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByTestId("host-open")).toHaveTextContent("false")
    );
    expect(
      consoleError.mock.calls.filter(([first]) =>
        String(first).includes("Cannot update a component")
      )
    ).toEqual([]);
    consoleError.mockRestore();
  });

  it("renders the format radios on the shared button system", () => {
    // #84's button pass: they used to hand-roll geometry, hover and focus.
    // They keep their radio semantics but inherit the Button treatment.
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);
    const video = screen.getByRole("radio", { name: "Video" });

    expect(video).toHaveAttribute("data-slot", "button");
    expect(video).toHaveClass("focus-visible:ring-ring/50");
  });

  it("keeps the checked format content-track colored, not accent colored", () => {
    // A picked format belongs to the content track; it must not borrow
    // --primary and start reading as the dialog's default action.
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);
    const video = screen.getByRole("radio", { name: "Video" });
    const either = screen.getByRole("radio", { name: "Either" });

    expect(either).toHaveAttribute("aria-checked", "true");
    expect(either).toHaveClass(
      "bg-track-content",
      "text-track-content-foreground",
      "border-track-content-border"
    );
    expect(either.className).not.toMatch(/(^|\s)bg-primary(\s|$)/);
    expect(video.className).not.toContain("bg-track-content");
  });
});
