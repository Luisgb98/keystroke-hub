// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import {
  MCP_TOKEN_ENV,
  bearerTokenOf,
  isAuthorizedMcpRequest,
  unauthorizedMcpResponse,
} from "./auth";

const TOKEN = "mcp-test-token-0123456789";

function request(authorization?: string): Request {
  return new Request("https://example.test/api/mcp", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => {
  delete process.env[MCP_TOKEN_ENV];
});

describe("bearerTokenOf", () => {
  it("reads the token out of a bearer header", () => {
    expect(bearerTokenOf(request(`Bearer ${TOKEN}`))).toBe(TOKEN);
  });

  it("accepts the scheme in any casing, per RFC 6750", () => {
    expect(bearerTokenOf(request(`bearer ${TOKEN}`))).toBe(TOKEN);
    expect(bearerTokenOf(request(`BEARER ${TOKEN}`))).toBe(TOKEN);
  });

  it("returns null for a missing header or a different scheme", () => {
    expect(bearerTokenOf(request())).toBeNull();
    expect(bearerTokenOf(request(`Basic ${TOKEN}`))).toBeNull();
    expect(bearerTokenOf(request("Bearer"))).toBeNull();
  });
});

describe("isAuthorizedMcpRequest", () => {
  it("accepts the configured token", () => {
    process.env[MCP_TOKEN_ENV] = TOKEN;
    expect(isAuthorizedMcpRequest(request(`Bearer ${TOKEN}`))).toBe(true);
  });

  it("rejects a wrong token", () => {
    process.env[MCP_TOKEN_ENV] = TOKEN;
    expect(isAuthorizedMcpRequest(request("Bearer wrong-token"))).toBe(false);
  });

  it("rejects a token that is merely a prefix of the real one", () => {
    process.env[MCP_TOKEN_ENV] = TOKEN;
    expect(
      isAuthorizedMcpRequest(request(`Bearer ${TOKEN.slice(0, -1)}`))
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    process.env[MCP_TOKEN_ENV] = TOKEN;
    expect(isAuthorizedMcpRequest(request())).toBe(false);
  });

  // Comparing hashes rather than the raw strings is what lets timingSafeEqual
  // handle mismatched lengths at all — it throws on unequal buffers.
  it("rejects tokens of a different length without throwing", () => {
    process.env[MCP_TOKEN_ENV] = TOKEN;
    expect(() => isAuthorizedMcpRequest(request("Bearer x"))).not.toThrow();
    expect(isAuthorizedMcpRequest(request("Bearer x"))).toBe(false);
  });

  it("fails closed when the env var is unset or empty", () => {
    expect(isAuthorizedMcpRequest(request(`Bearer ${TOKEN}`))).toBe(false);
    process.env[MCP_TOKEN_ENV] = "";
    expect(isAuthorizedMcpRequest(request("Bearer "))).toBe(false);
  });
});

describe("unauthorizedMcpResponse", () => {
  it("is a structured 401 that challenges for a bearer token", async () => {
    const response = unauthorizedMcpResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    await expect(response.json()).resolves.toMatchObject({
      error: "unauthorized",
    });
  });
});
