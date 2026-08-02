// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { buildIdeaFilterCondition } from "./ideas";

const dialect = new PgDialect();

/** Renders a condition to its parameterized SQL text + params, without a live DB. */
function render(filters: Parameters<typeof buildIdeaFilterCondition>[0]) {
  const condition = buildIdeaFilterCondition(filters);
  if (!condition) return { sql: undefined, params: undefined };
  return dialect.sqlToQuery(condition);
}

describe("buildIdeaFilterCondition", () => {
  it("returns undefined when no filters are set", () => {
    expect(buildIdeaFilterCondition({})).toBeUndefined();
  });

  it("maps `q` to a case-insensitive title match with wildcards", () => {
    const { sql, params } = render({ q: "speedrun" });
    expect(sql).toContain("ilike");
    expect(sql).toContain('"title"');
    expect(params).toEqual(["%speedrun%"]);
  });

  it("maps `format` to an equality check", () => {
    const { sql, params } = render({ format: "video" });
    expect(sql).toContain('"format" = $1');
    expect(params).toEqual(["video"]);
  });

  it("maps `status` to an equality check", () => {
    const { sql, params } = render({ status: "scripted" });
    expect(sql).toContain('"status" = $1');
    expect(params).toEqual(["scripted"]);
  });

  it("maps `game` to an equality check on the library id (#105)", () => {
    const { sql, params } = render({ game: "game-1" });
    expect(sql).toContain('"game_id" = $1');
    expect(params).toEqual(["game-1"]);
  });

  it("maps `tag` to an array containment check", () => {
    const { sql, params } = render({ tag: "vod" });
    expect(sql).toContain("@>");
    expect(params).toEqual(['{"vod"}']);
  });

  it("combines every provided filter with AND", () => {
    const { sql, params } = render({
      q: "glitch",
      format: "video",
      status: "idea",
      tag: "speedrun",
      game: "game-1",
    });
    expect(sql).toContain(" and ");
    expect(params).toEqual([
      "%glitch%",
      "video",
      "idea",
      '{"speedrun"}',
      "game-1",
    ]);
  });

  it("composes the game filter with the existing ones (#105)", () => {
    const { sql, params } = render({ status: "published", game: "game-1" });
    expect(sql).toContain(" and ");
    expect(params).toEqual(["published", "game-1"]);
  });
});
