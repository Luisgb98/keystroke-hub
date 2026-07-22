import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createIdea = vi.hoisted(() => vi.fn());
const updateIdea = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/actions", () => ({ createIdea, updateIdea }));

const toastFn = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { success: toastSuccess, custom: toastFn }),
}));

import type { Idea } from "@/lib/db/schema";
import { IdeaEditor } from "./idea-editor";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "either",
    status: "idea",
    tags: [],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IdeaEditor — create mode", () => {
  afterEach(() => vi.clearAllMocks());

  it("defaults the release time to 19:00 and offers an inline script field", () => {
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    expect(screen.getByText("New idea")).toBeInTheDocument();
    expect(screen.getByLabelText("Release time")).toHaveValue("19:00");
    expect(screen.getByLabelText("Script (optional)")).toBeInTheDocument();
  });

  it("submits the script and release date/time in the capture payload", async () => {
    createIdea.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<IdeaEditor mode="create" open onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Title"), "Glitch tutorial");
    await user.type(screen.getByLabelText("Script (optional)"), "# Intro");
    await user.type(screen.getByLabelText("Release date"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    const [, formData] = createIdea.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Glitch tutorial");
    expect(formData.get("script")).toBe("# Intro");
    expect(formData.get("releaseDate")).toBe("2026-08-01");
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

describe("IdeaEditor — edit mode", () => {
  afterEach(() => vi.clearAllMocks());

  it("prefills every field from the idea and its release event", () => {
    render(
      <IdeaEditor
        mode="edit"
        idea={makeIdea({
          title: "Boss rush",
          notes: "cover phase 3",
          format: "video",
          tags: ["speedrun", "glitch"],
        })}
        releaseStartsAt={new Date("2026-09-10T18:30:00")}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("Edit idea")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Boss rush");
    expect(screen.getByLabelText("Notes")).toHaveValue("cover phase 3");
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
        releaseStartsAt={new Date("2026-09-10T18:30:00")}
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
});
