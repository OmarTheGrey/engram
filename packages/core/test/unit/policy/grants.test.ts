// The grant-change gate's pure functions (card E9.4, ADR 0034, proposed):
// grant equality, how a reason names a grant, and the evaluator's order and
// result. The plane's acceptance is test/unit/plane/grants.test.ts.
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/plane.ts";
import { WRITE_GRANT_ID } from "../../../src/policy/evaluate.ts";
import {
  evaluateGrantChange,
  GRANT_CHANGE_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  grantText,
  sameGrant,
} from "../../../src/policy/grants.ts";
import type { Grant } from "../../../src/schema.ts";
import { id, item, testPolicy } from "../plane/helpers.ts";

const AT = "2026-11-19T10:00:00Z";
const omar: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["team:platform"],
  source: "user",
};
const g: Grant = {
  to: "person:sara",
  class: "semantic",
  mode: "read",
  expires: "2026-12-01T00:00:00Z",
};

describe("sameGrant", () => {
  test("compares the expiry as an instant, not as text", () => {
    expect(sameGrant(g, { ...g, expires: "2026-12-01T00:00:00.000Z" })).toBe(true);
    expect(sameGrant(g, { ...g, expires: "2026-12-01T00:00:00.001Z" })).toBe(false);
  });
  test("tells every other field apart, an absent one included", () => {
    expect(sameGrant(g, { ...g, to: "person:ali" })).toBe(false);
    expect(sameGrant(g, { ...g, mode: "read_write" })).toBe(false);
    const { class: _c, ...noClass } = g;
    expect(sameGrant(g, noClass)).toBe(false);
    const { expires: _e, ...noExpiry } = g;
    expect(sameGrant(noExpiry, noExpiry)).toBe(true);
    expect(sameGrant(g, noExpiry)).toBe(false);
  });
});

describe("grantText", () => {
  test("names every field, and what an absent one means", () => {
    expect(grantText(g)).toBe(
      "grant to person:sara (class semantic, mode read, expires 2026-12-01T00:00:00Z)",
    );
    expect(grantText({ to: "agent:pi", mode: "read" })).toBe(
      "grant to agent:pi (class any, mode read, expires never)",
    );
  });
});

describe("evaluateGrantChange", () => {
  const owned = item(1, { owner: omar.id });

  test("an allowed change keeps the other grants first, then the added ones", () => {
    const other = { ...g, to: "person:ali" };
    const d = evaluateGrantChange(
      testPolicy(),
      omar,
      id(1),
      { ...owned, grants: [g, other] },
      { add: [{ ...g, to: "agent:claude-code/*" }], remove: [g] },
      AT,
    );
    expect(d).toMatchObject({ decision: "allow", policy_id: GRANT_CHANGE_ID, visible: true });
    expect(d.grants?.map((x) => x.to)).toEqual(["person:ali", "agent:claude-code/*"]);
    expect(d.reason).toContain("version 1 to 2");
  });

  test("says so when the policy does not honour grants", () => {
    const policy = testPolicy();
    const d = evaluateGrantChange(
      { ...policy, read: { ...policy.read, honour_grants: false } },
      omar,
      id(1),
      owned,
      { add: [g] },
      AT,
    );
    expect(d.decision).toBe("allow");
    expect(d.reason).toContain("does not honour grants");
  });

  test("membership is checked first, then the source, then the owner, then the grants", () => {
    const outsider = { ...omar, memberships: [] };
    expect(
      evaluateGrantChange(testPolicy(), outsider, id(1), owned, { add: [{ ...g, to: "*" }] }, AT),
    ).toMatchObject({ policy_id: GRANT_OWNER_ID, visible: false });
    const agent = { ...omar, id: "person:sara", source: "model" as const };
    expect(
      evaluateGrantChange(testPolicy(), agent, id(1), owned, { add: [{ ...g, to: "*" }] }, AT),
    ).toMatchObject({ policy_id: GRANT_SOURCE_ID, visible: true });
    const sara = { ...omar, id: "person:sara" };
    expect(
      evaluateGrantChange(testPolicy(), sara, id(1), owned, { add: [{ ...g, to: "*" }] }, AT),
    ).toMatchObject({ policy_id: GRANT_OWNER_ID, visible: true });
    expect(
      evaluateGrantChange(testPolicy(), omar, id(1), owned, { add: [{ ...g, to: "*" }] }, AT),
    ).toMatchObject({ policy_id: WRITE_GRANT_ID, grants: null });
  });
});
