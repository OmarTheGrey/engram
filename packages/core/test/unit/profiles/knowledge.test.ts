// Card E9.1's acceptance: the knowledge profile (Govern) loads, and the fixture
// writes behave per policy. Every write goes through the real Plane over the
// fake store; the profile is read from packages/pi-package/profiles/, the
// path the layout note maps `profiles/` to.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { LINT_IDS } from "../../../src/lint.ts";
import type { Actor } from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { fresh, id, item } from "../plane/helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/knowledge.yaml", import.meta.url);
const FIXTURE = new URL("../../../../../fixtures/profiles/knowledge-writes.json", import.meta.url);
const AT = "2026-10-25T12:00:00.000Z";

interface Case {
  name: string;
  scope: string;
  source: NonNullable<Actor["source"]>;
  class?: MemoryItem["class"];
  confidence?: number;
  valid_to?: string;
  expect: { decision: "allow" | "deny"; status?: MemoryItem["status"]; policy_id: string };
}

const knowledge = (): Policy => parsePolicy(readFileSync(PROFILE, "utf8"), "knowledge.yaml");
const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as { writer: Actor; cases: Case[] };

describe("acceptance (card E9.1): the knowledge profile loads", () => {
  test("it parses, covers every level, and lists the conflict and validity lints", () => {
    const policy = knowledge();
    expect(policy.id).toBe("profile.knowledge");
    expect(policy.write.map((r) => r.scope).sort()).toEqual(["org", "person", "role", "team"]);
    for (const lint of ["contradiction", "duplicate", "expired-validity", "source-changed"])
      expect(policy.lints.enabled).toContain(lint);
    for (const lint of policy.lints.enabled) expect(LINT_IDS).toContain(lint);
  });

  test("org takes first-hand sources only, and team and org require review", () => {
    const policy = knowledge();
    const rule = (scope: string) => policy.write.find((r) => r.scope === scope);
    expect(rule("org")?.allowed_sources.sort()).toEqual(["document", "user"]);
    expect(rule("org")?.requires_review).toBe(true);
    expect(rule("team")?.requires_review).toBe(true);
    for (const scope of ["role", "team", "org"])
      expect(rule(scope)?.forbidden_classes).toContain("episodic");
  });
});

describe("acceptance (card E9.1): the fixture writes behave per policy", () => {
  const { writer, cases } = fixture();
  test.each(cases.map((c, i) => [c.name, c, i] as const))("%s", async (_name, c, i) => {
    const { plane } = fresh(knowledge());
    const written = item(i + 1, {
      scope: c.scope,
      owner: writer.id,
      class: c.class ?? "semantic",
      confidence: c.confidence ?? 0.9,
      ...(c.valid_to ? { valid_to: c.valid_to } : {}),
    });
    const result = await plane.write({ ...writer, source: c.source }, written, AT);
    expect(result.event.decision).toBe(c.expect.decision);
    expect(result.event.policy_id).toBe(c.expect.policy_id);
    expect(result.item?.status ?? null).toBe(c.expect.status ?? null);
  });
});

describe("knowledge reaches org only through review", () => {
  const dana: Actor = {
    id: "person:dana",
    level: "person",
    memberships: ["person:dana", "org"],
    source: "user",
  };
  const lea: Actor = { id: "person:lea", level: "person", memberships: ["org"], source: "user" };

  test("an org candidate is not read until a reviewer promotes it", async () => {
    const { plane } = fresh(knowledge());
    await plane.write(
      dana,
      item(1, { scope: "org", owner: dana.id, content: "expenses are due on the fifth" }),
      AT,
    );
    expect((await plane.read(lea, { text: "expenses", at: AT })).items).toEqual([]);
    const asked = await plane.promote(dana, id(1), "org", AT);
    expect(asked.decision).toBe("ask");
    const approved = await plane.promote(lea, id(1), "org", AT, { review: true });
    expect(approved.decision).toBe("allow");
    expect((await plane.read(lea, { text: "expenses", at: AT })).items.map((i) => i.id)).toEqual([
      id(1),
    ]);
  });

  test("a person's note the model wrote cannot be promoted into org, even by a reviewer", async () => {
    const { plane } = fresh(knowledge());
    const note = item(2, {
      scope: "person:dana",
      owner: dana.id,
      content: "the vendor contract renews in May",
    });
    await plane.write({ ...dana, source: "model" }, note, AT);
    const lifted = await plane.promote(dana, id(2), "org", AT, { review: false });
    expect(lifted.decision).not.toBe("allow");
    expect(lifted.item).toBeNull();
  });

  test("an item outside its validity window is excluded at read", async () => {
    const { plane } = fresh(knowledge());
    const stale = item(3, {
      scope: "person:dana",
      owner: dana.id,
      content: "the office moves in October",
      valid_to: "2026-10-02T00:00:00.000Z",
    });
    await plane.write(dana, stale, AT);
    const read = await plane.read(dana, { text: "office", at: AT });
    expect(read.items).toEqual([]);
    expect(read.filtered).toBe(1);
  });
});
