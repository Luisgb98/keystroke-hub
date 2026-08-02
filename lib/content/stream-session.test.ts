// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const insertValues = vi.fn(() => Promise.resolve());
  const batch = vi.fn((queries: unknown[]) => Promise.all(queries));
  return {
    insertValues,
    batch,
    insert: vi.fn(() => ({ values: insertValues })),
  };
});
vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

const getTemplateItems = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/streams", () => ({ getTemplateItems }));

import { insertStreamSession } from "./stream-session";

beforeEach(() => {
  getTemplateItems.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("insertStreamSession", () => {
  it("pins the session to the content track", async () => {
    await insertStreamSession({ eventId: "evt-1", title: "Ranked run" });

    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt-1",
        eventTrack: "content",
        title: "Ranked run",
      })
    );
  });

  it("returns the id of the session it created", async () => {
    const streamId = await insertStreamSession({
      eventId: "evt-1",
      title: "Ranked run",
    });
    expect(streamId).toBeTruthy();
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: streamId })
    );
  });

  it("inserts the stream on its own when the template is empty", async () => {
    await insertStreamSession({ eventId: "evt-1", title: "Ranked run" });
    expect(dbMock.batch).not.toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
  });

  it("snapshots the current template onto the new session", async () => {
    getTemplateItems.mockResolvedValue([
      { id: "t-1", label: "Check mic", position: 0 },
      { id: "t-2", label: "Test scene", position: 1 },
    ]);

    const streamId = await insertStreamSession({
      eventId: "evt-1",
      title: "Ranked run",
    });

    expect(dbMock.batch).toHaveBeenCalledTimes(1);
    expect(dbMock.batch.mock.calls[0][0]).toHaveLength(2);
    expect(dbMock.insertValues).toHaveBeenCalledWith([
      expect.objectContaining({ streamId, label: "Check mic", position: 0 }),
      expect.objectContaining({ streamId, label: "Test scene", position: 1 }),
    ]);
  });

  it("batches a caller's leading query in front of its own writes", async () => {
    getTemplateItems.mockResolvedValue([
      { id: "t-1", label: "Check mic", position: 0 },
    ]);
    const leading = Promise.resolve("event-insert");

    await insertStreamSession({
      eventId: "evt-1",
      title: "Ranked run",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leading: leading as any,
    });

    const [queries] = dbMock.batch.mock.calls[0];
    expect(queries).toHaveLength(3);
    expect(queries[0]).toBe(leading);
  });

  it("still batches a lone leading query with the stream insert", async () => {
    const leading = Promise.resolve("event-insert");
    await insertStreamSession({
      eventId: "evt-1",
      title: "Ranked run",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      leading: leading as any,
    });

    expect(dbMock.batch).toHaveBeenCalledTimes(1);
    expect(dbMock.batch.mock.calls[0][0]).toHaveLength(2);
  });
});
