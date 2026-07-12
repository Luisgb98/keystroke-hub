// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchIssueMetadata } from "./api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchIssueMetadata", () => {
  it("returns title/state on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        title: "GitHub Issue linking on work items",
        state: "open",
        repository_url: "https://api.github.com/repos/Luisgb98/keystroke-hub",
      })
    );

    const result = await fetchIssueMetadata("luisgb98", "keystroke-hub", 27);

    expect(result).toEqual({
      ok: true,
      metadata: {
        owner: "Luisgb98",
        repo: "keystroke-hub",
        title: "GitHub Issue linking on work items",
        state: "open",
      },
    });
  });

  it("falls back to the requested owner/repo when repository_url is missing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "Untitled", state: "closed" })
    );

    const result = await fetchIssueMetadata("owner", "repo", 1);

    expect(result).toEqual({
      ok: true,
      metadata: {
        owner: "owner",
        repo: "repo",
        title: "Untitled",
        state: "closed",
      },
    });
  });

  it("treats a merged PR (state: closed) as closed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "A PR", state: "closed" })
    );

    const result = await fetchIssueMetadata("owner", "repo", 5);

    expect(result.ok).toBe(true);
    expect(result.ok && result.metadata.state).toBe("closed");
  });

  it("returns not_found on 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 404));
    const result = await fetchIssueMetadata("owner", "repo", 1);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns rate_limited on 403", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 403));
    const result = await fetchIssueMetadata("owner", "repo", 1);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("returns rate_limited on 429", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 429));
    const result = await fetchIssueMetadata("owner", "repo", 1);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("returns unavailable on other non-ok statuses", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, 500));
    const result = await fetchIssueMetadata("owner", "repo", 1);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns unavailable on a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const result = await fetchIssueMetadata("owner", "repo", 1);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("sends the bearer token when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "T", state: "open" })
    );

    await fetchIssueMetadata("owner", "repo", 1);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("omits the Authorization header when GITHUB_TOKEN is unset", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "T", state: "open" })
    );

    await fetchIssueMetadata("owner", "repo", 1);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
