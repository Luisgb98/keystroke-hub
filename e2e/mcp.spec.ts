import { expect, test, type APIRequestContext } from "@playwright/test";

import { E2E_MCP_AUTH_TOKEN } from "./support/credentials";
import {
  clearEventsWithPrefix,
  getTestEventId,
  insertTestEvent,
} from "./support/events-db";
import { clearTestIdeas } from "./support/ideas-db";
import { clearTestStreams } from "./support/streams-db";

/**
 * The MCP endpoint over real HTTP (issue #109 — see docs/mcp.md).
 *
 * Deliberately spoken as raw JSON-RPC rather than through an SDK client: what
 * these cases have to prove is that a *standard* Streamable HTTP client can
 * drive the app, which means asserting on the wire itself — the auth gate, the
 * response envelope, and the rows that end up in the database.
 */

const PREFIX = "[e2e-mcp]";
const IDEA_TITLE = `${PREFIX} Speedrun any% commentary`;
const STREAM_TITLE = `${PREFIX} League start`;
const WORK_EVENT_TITLE = `${PREFIX} Sprint planning`;

const PROTOCOL_VERSION = "2025-06-18";

let requestId = 0;

interface RpcMessage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;
}

/**
 * One JSON-RPC round trip. The server may answer with a JSON body or a
 * one-frame SSE stream (both are legal Streamable HTTP responses), so this
 * accepts either — exactly as a real client's transport does.
 */
async function rpc(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown>,
  { token = E2E_MCP_AUTH_TOKEN }: { token?: string | null } = {}
): Promise<{ status: number; message: RpcMessage; raw: string }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await request.post("/api/mcp", {
    headers,
    data: { jsonrpc: "2.0", id: ++requestId, method, params },
    timeout: 20_000,
  });

  const raw = await response.text();
  if (response.status() !== 200)
    return { status: response.status(), message: {}, raw };

  const contentType = response.headers()["content-type"] ?? "";
  if (contentType.includes("text/event-stream")) {
    const frame = raw.split("\n").find((line) => line.startsWith("data:"));
    expect(frame, `no SSE data frame in: ${raw}`).toBeDefined();
    return {
      status: 200,
      message: JSON.parse(frame!.slice("data:".length).trim()),
      raw,
    };
  }
  return { status: 200, message: JSON.parse(raw), raw };
}

/** Calls a tool and asserts it succeeded, returning the JSON payload it produced. */
async function callTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { status, message, raw } = await rpc(request, "tools/call", {
    name,
    arguments: args,
  });
  expect(status, raw).toBe(200);
  expect(message.error, raw).toBeUndefined();
  expect(message.result?.isError, `${name} failed: ${raw}`).toBeFalsy();
  return JSON.parse(message.result.content[0].text);
}

/** Calls a tool expecting a refusal, returning the structured error body. */
async function callToolExpectingError(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { message, raw } = await rpc(request, "tools/call", {
    name,
    arguments: args,
  });
  expect(
    message.result?.isError,
    `${name} unexpectedly succeeded: ${raw}`
  ).toBe(true);
  return JSON.parse(message.result.content[0].text);
}

test.describe("MCP server", () => {
  // Serial: every case seeds and clears rows under the same title prefix, so
  // running them in parallel would have one case's cleanup delete the rows
  // another is still working on (the same reason board/scripts/agenda are
  // serial).
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.DATABASE_URL,
    "DATABASE_URL is not set — the MCP round-trips write real rows. Set it " +
      "locally (see .env.example) to exercise them."
  );

  test.beforeEach(async () => {
    await clearTestIdeas(PREFIX);
    await clearTestStreams(PREFIX);
    await clearEventsWithPrefix(PREFIX);
  });

  test.afterAll(async () => {
    await clearTestIdeas(PREFIX);
    await clearTestStreams(PREFIX);
    await clearEventsWithPrefix(PREFIX);
  });

  test("refuses every request without a valid bearer token", async ({
    request,
  }) => {
    const anonymous = await rpc(request, "tools/list", {}, { token: null });
    expect(anonymous.status).toBe(401);
    expect(JSON.parse(anonymous.raw)).toMatchObject({ error: "unauthorized" });

    const wrong = await rpc(request, "tools/list", {}, { token: "not-it" });
    expect(wrong.status).toBe(401);
  });

  test("initializes and advertises the content tool surface", async ({
    request,
  }) => {
    const init = await rpc(request, "initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "keystroke-hub-e2e", version: "1.0.0" },
    });
    expect(init.status).toBe(200);
    expect(init.message.result.serverInfo.name).toBe("keystroke-hub");

    const list = await rpc(request, "tools/list", {});
    const names: string[] = list.message.result.tools.map(
      (tool: { name: string }) => tool.name
    );
    expect(names).toContain("create_idea");
    expect(names).toContain("save_script");
    expect(names).toContain("create_stream");
    expect(names).toContain("list_content_events");
    // Work life has no door here.
    expect(names.some((name) => name.includes("meeting"))).toBe(false);
  });

  test("captures an idea, writes its script, and schedules its release onto the calendar", async ({
    request,
  }) => {
    const created = await callTool(request, "create_idea", {
      title: IDEA_TITLE,
      description: "Cover the wrong warp",
      format: "video",
      tags: ["Speedrun", "glitch", "speedrun"],
    });
    const ideaId: string = created.ideaId;
    expect(ideaId).toBeTruthy();

    // The tag input went through the app's own normalisation — trimmed,
    // lowercased, deduped — exactly as a capture typed into the dialog.
    const afterCapture = await callTool(request, "get_idea", { ideaId });
    expect(afterCapture.tags).toEqual(["speedrun", "glitch"]);
    expect(afterCapture.release).toBeNull();
    expect(afterCapture.script).toBeNull();

    await callTool(request, "save_script", {
      ideaId,
      content: "# Intro\n\nSay hi, then run.",
    });
    const withScript = await callTool(request, "get_script", { ideaId });
    expect(withScript.content).toBe("# Intro\n\nSay hi, then run.");

    await callTool(request, "set_idea_status", {
      ideaId,
      status: "scripted",
    });

    // A date with no time is the 19:00 publish slot, same as the UI's default.
    await callTool(request, "schedule_idea_release", {
      ideaId,
      releaseDate: "2026-09-04",
    });

    const scheduled = await callTool(request, "get_idea", { ideaId });
    expect(scheduled.status).toBe("scripted");
    expect(scheduled.release).toMatchObject({
      date: "2026-09-04",
      time: "19:00",
    });

    // And it is on the calendar, exactly as if it had been scheduled in the app.
    const calendar = await callTool(request, "list_content_events", {
      from: "2026-09-04",
      to: "2026-09-04",
    });
    const release = calendar.events.find(
      (event: { id: string }) => event.id === scheduled.release.eventId
    );
    expect(release).toBeDefined();
    expect(release.title).toBe(`Release: ${IDEA_TITLE}`);
    expect(release.startsAt.time).toBe("19:00");

    // Moving it moves the calendar block with it.
    await callTool(request, "schedule_idea_release", {
      ideaId,
      releaseDate: "2026-09-05",
      releaseTime: "20:30",
    });
    const moved = await callTool(request, "list_content_events", {
      from: "2026-09-05",
      to: "2026-09-05",
    });
    expect(
      moved.events.find(
        (event: { id: string }) => event.id === scheduled.release.eventId
      ).startsAt.time
    ).toBe("20:30");

    await callTool(request, "delete_idea", { ideaId });
    const gone = await callToolExpectingError(request, "get_idea", { ideaId });
    expect(gone.message).toBe("That idea no longer exists.");
  });

  test("plans a stream, schedules it, and ticks its checklist", async ({
    request,
  }) => {
    const created = await callTool(request, "create_stream", {
      title: STREAM_TITLE,
      notes: "Build plan and league mechanics",
    });
    const streamId: string = created.streamId;
    expect(streamId).toBeTruthy();

    const unscheduled = await callTool(request, "list_streams");
    expect(
      unscheduled.unscheduled.some((s: { id: string }) => s.id === streamId)
    ).toBe(true);

    await callTool(request, "schedule_stream", {
      streamId,
      date: "2026-09-11",
      time: "19:00",
    });

    const scheduled = await callTool(request, "get_stream", { streamId });
    expect(scheduled.scheduled).not.toBeNull();
    expect(scheduled.scheduled.startsAt.time).toBe("19:00");
    // The planner's fixed 2h slot.
    expect(scheduled.scheduled.endsAt.time).toBe("21:00");

    // A session behind the block is what makes it a Stream on the calendar —
    // the invariant that must hold however the block was created.
    const calendar = await callTool(request, "list_content_events", {
      from: "2026-09-11",
      to: "2026-09-11",
    });
    const block = calendar.events.find(
      (event: { id: string }) => event.id === scheduled.scheduled.eventId
    );
    expect(block.kind).toBe("stream");
    expect(block.streamId).toBe(streamId);

    await callTool(request, "add_checklist_item", {
      streamId,
      label: `${PREFIX} Tweet the go-live`,
    });
    const withItem = await callTool(request, "get_stream", { streamId });
    const item = withItem.checklist.find(
      (candidate: { label: string }) =>
        candidate.label === `${PREFIX} Tweet the go-live`
    );
    expect(item.done).toBe(false);

    await callTool(request, "set_checklist_item", {
      streamId,
      itemId: item.id,
      done: true,
    });
    const ticked = await callTool(request, "get_stream", { streamId });
    expect(
      ticked.checklist.find((c: { id: string }) => c.id === item.id).done
    ).toBe(true);

    // Deleting the stream takes its block with it — no orphan promising a
    // session that no longer exists.
    await callTool(request, "delete_stream", { streamId });
    const afterDelete = await callTool(request, "list_content_events", {
      from: "2026-09-11",
      to: "2026-09-11",
    });
    expect(
      afterDelete.events.some(
        (event: { id: string }) => event.id === scheduled.scheduled.eventId
      )
    ).toBe(false);
  });

  test("cannot see or touch the work track", async ({ request }) => {
    await insertTestEvent({
      title: WORK_EVENT_TITLE,
      track: "work",
      startsAt: new Date("2026-09-18T07:00:00.000Z"),
      endsAt: new Date("2026-09-18T08:00:00.000Z"),
    });

    const calendar = await callTool(request, "list_content_events", {
      from: "2026-09-18",
      to: "2026-09-18",
    });
    expect(
      calendar.events.some(
        (event: { title: string }) => event.title === WORK_EVENT_TITLE
      )
    ).toBe(false);

    // The id is only reachable here because the spec read it out of the
    // database directly; no MCP tool would ever hand one out. Even named
    // explicitly, it must be refused.
    const workEventId = await getTestEventId(WORK_EVENT_TITLE);
    expect(workEventId).toBeDefined();

    const refused = await callToolExpectingError(
      request,
      "reschedule_content_event",
      {
        eventId: workEventId!,
        startDate: "2026-09-19",
        startTime: "09:00",
        endTime: "10:00",
      }
    );
    expect(refused.message).toContain("work track");

    const refusedDelete = await callToolExpectingError(
      request,
      "delete_content_event",
      { eventId: workEventId! }
    );
    expect(refusedDelete.message).toContain("work track");

    // Still there, untouched.
    await expect(getTestEventId(WORK_EVENT_TITLE)).resolves.toBe(workEventId);
  });

  test("reports validation failures as structured, actionable errors", async ({
    request,
  }) => {
    const tooManyTags = await callToolExpectingError(request, "create_idea", {
      title: `${PREFIX} Too many tags`,
      tags: ["one", "two", "three", "four", "five", "six"],
    });
    expect(tooManyTags.error).toBe("invalid_request");
    expect(tooManyTags.fieldErrors.tags[0]).toContain("publishing standard");

    const noTitle = await callToolExpectingError(request, "create_idea", {
      title: "   ",
    });
    expect(noTitle.fieldErrors.title).toBeDefined();

    // Never a stack trace or a database error.
    expect(JSON.stringify(tooManyTags)).not.toContain("at Object.");
  });
});
