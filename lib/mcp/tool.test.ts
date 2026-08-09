// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  defineTool,
  fail,
  fromCoreResult,
  ok,
  registerTools,
  type McpToolResult,
} from "./tool";

function payload(result: McpToolResult): unknown {
  return JSON.parse(result.content[0].text);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ok", () => {
  it("serializes the payload as pretty JSON", () => {
    const result = ok({ ideaId: "idea-1" });
    expect(result.isError).toBeUndefined();
    expect(payload(result)).toEqual({ ideaId: "idea-1" });
    expect(result.content[0].text).toContain("\n");
  });
});

describe("fail", () => {
  it("is flagged as an error and says which rule was broken", () => {
    const result = fail("Check the highlighted fields.", {
      title: ["Title is required"],
    });
    expect(result.isError).toBe(true);
    expect(payload(result)).toEqual({
      error: "invalid_request",
      message: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
  });

  it("drops empty field-error entries rather than shipping noise", () => {
    const result = fail("Nope", { title: [], tags: undefined });
    expect(payload(result)).toEqual({
      error: "invalid_request",
      message: "Nope",
    });
  });
});

describe("fromCoreResult", () => {
  it("turns a core error into a tool error, field errors and all", () => {
    const result = fromCoreResult({
      error: "Check the highlighted fields.",
      fieldErrors: { tags: ["Too many"] },
    });
    expect(result.isError).toBe(true);
    expect(payload(result)).toMatchObject({
      fieldErrors: { tags: ["Too many"] },
    });
  });

  it("returns the payload on success", () => {
    const result = fromCoreResult({ success: true }, { ideaId: "idea-1" });
    expect(result.isError).toBeUndefined();
    expect(payload(result)).toEqual({ ideaId: "idea-1" });
  });
});

describe("registerTools", () => {
  const tool = defineTool(
    "echo",
    {
      title: "Echo",
      description: "Echoes its argument.",
      inputSchema: z.object({ value: z.string() }),
    },
    async ({ value }) => ok({ value })
  );

  function fakeServer() {
    const registered = new Map<
      string,
      (args: Record<string, unknown>) => Promise<McpToolResult>
    >();
    const server = {
      registerTool: vi.fn((name: string, _config: unknown, cb: unknown) => {
        registered.set(
          name,
          cb as (args: Record<string, unknown>) => Promise<McpToolResult>
        );
      }),
    };
    return { server, registered };
  }

  it("registers each tool under its name with its config", () => {
    const { server } = fakeServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerTools(server as any, [tool]);
    expect(server.registerTool).toHaveBeenCalledWith(
      "echo",
      expect.objectContaining({ title: "Echo" }),
      expect.any(Function)
    );
  });

  it("passes parsed arguments straight through to the handler", async () => {
    const { server, registered } = fakeServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerTools(server as any, [tool]);
    const result = await registered.get("echo")!({ value: "hi" });
    expect(payload(result)).toEqual({ value: "hi" });
  });

  // A raw stack trace or a Postgres error string reaching an MCP client would
  // leak internals from a public repo's deployment — it never should.
  it("converts a thrown error into a structured tool error, never a stack trace", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const exploding = defineTool(
      "boom",
      {
        title: "Boom",
        description: "Throws.",
        inputSchema: z.object({}),
      },
      async () => {
        throw new Error('relation "ideas" does not exist');
      }
    );
    const { server, registered } = fakeServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerTools(server as any, [exploding]);

    const result = await registered.get("boom")!({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("relation");
    expect(result.content[0].text).not.toContain("Error:");
    expect(logged).toHaveBeenCalled();
  });
});
