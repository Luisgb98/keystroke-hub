import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({ execute: executeMock }),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  it("returns 200 and ok status when the query succeeds", async () => {
    executeMock.mockResolvedValueOnce(undefined);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns 503 and an error message when the query throws", async () => {
    executeMock.mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "connection refused",
    });
  });
});
