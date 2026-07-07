import { expect, test } from "@playwright/test";

test.describe("database health check", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "DATABASE_URL is not set — skipping the real Neon connection check. Set " +
      "it locally (see .env.example) or on a Vercel preview to exercise this."
  );

  test("GET /api/health returns ok", async ({ request }) => {
    // Neon's free tier suspends idle compute; the first query after idle can
    // take a few seconds to wake up, so this allows more time than the
    // default action timeout.
    const response = await request.get("/api/health", { timeout: 15_000 });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
