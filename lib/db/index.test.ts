import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const neonMock = vi.fn(() => ({ mockSql: true }));
const drizzleMock = vi.fn(() => ({ mockDb: true }));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: drizzleMock }));

describe("getDb", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    neonMock.mockClear();
    drizzleMock.mockClear();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("throws a descriptive error when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const { getDb } = await import("./index");

    expect(() => getDb()).toThrow(/DATABASE_URL is not set/);
  });

  it("returns the same instance across calls (singleton)", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@example.com/db";
    const { getDb } = await import("./index");

    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    expect(neonMock).toHaveBeenCalledTimes(1);
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it("passes the connection string to the neon driver", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@example.com/db";
    const { getDb } = await import("./index");

    getDb();

    expect(neonMock).toHaveBeenCalledWith(
      "postgres://user:pass@example.com/db"
    );
  });
});
