// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/google/oauth", () => ({
  exchangeCodeForTokens: vi.fn(),
  getAppBaseUrl: () => "http://localhost:3000",
  verifyOAuthState: vi.fn(),
}));
vi.mock("@/lib/google/client", () => ({
  createGoogleCalendarClient: vi.fn(() => ({ listCalendars: vi.fn() })),
}));
vi.mock("@/lib/sync/actions", () => ({ stashPendingConnection: vi.fn() }));

import { NextRequest } from "next/server";

import { createGoogleCalendarClient } from "@/lib/google/client";
import { exchangeCodeForTokens, verifyOAuthState } from "@/lib/google/oauth";
import { stashPendingConnection } from "@/lib/sync/actions";
import { GET } from "./route";

function callbackRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/google/oauth/callback");
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/google/oauth/callback", () => {
  it("redirects with an error when Google reports one", async () => {
    const response = await GET(callbackRequest({ error: "access_denied" }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "error=google_auth_failed"
    );
    expect(verifyOAuthState).not.toHaveBeenCalled();
  });

  it("redirects with an error when code or state is missing", async () => {
    const response = await GET(callbackRequest({ code: "abc" }));
    expect(response.headers.get("location")).toContain(
      "error=google_auth_failed"
    );
  });

  it("redirects with invalid_state when the state doesn't verify", async () => {
    vi.mocked(verifyOAuthState).mockResolvedValue(null);
    const response = await GET(callbackRequest({ code: "abc", state: "bad" }));
    expect(response.headers.get("location")).toContain("error=invalid_state");
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("redirects with no_refresh_token when Google omits it", async () => {
    vi.mocked(verifyOAuthState).mockResolvedValue("work");
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      accessToken: "a",
      refreshToken: null,
      expiresAt: new Date(),
    });
    const response = await GET(callbackRequest({ code: "abc", state: "good" }));
    expect(response.headers.get("location")).toContain(
      "error=no_refresh_token"
    );
  });

  it("stashes the pending connection and redirects to the picker on success", async () => {
    vi.mocked(verifyOAuthState).mockResolvedValue("work");
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: new Date(),
    });
    vi.mocked(createGoogleCalendarClient).mockReturnValue({
      listCalendars: vi
        .fn()
        .mockResolvedValue([
          { id: "owner@example.com", summary: "Owner", primary: true },
        ]),
    } as never);

    const response = await GET(callbackRequest({ code: "abc", state: "good" }));

    expect(stashPendingConnection).toHaveBeenCalledWith(
      "work",
      "a",
      "r",
      expect.any(Date),
      "owner@example.com"
    );
    expect(response.headers.get("location")).toContain("connect=pending");
  });

  it("redirects with a generic error when the exchange throws", async () => {
    vi.mocked(verifyOAuthState).mockResolvedValue("work");
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(
      new Error("network error")
    );

    const response = await GET(callbackRequest({ code: "abc", state: "good" }));

    expect(response.headers.get("location")).toContain(
      "error=google_auth_failed"
    );
  });
});
