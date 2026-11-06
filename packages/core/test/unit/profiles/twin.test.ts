// Card E9.2's acceptance: the twin profile (ADR 0021) loads, and a
// cross-person read is denied in the fixture. The fixture's writes and reads
// go through the real Plane over the fake store; the profile is read from
// packages/pi-package/profiles/, the path the layout note maps `profiles/` to.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, Policy } from "../../../src/schema.ts";
import { fresh, id, item } from "../plane/helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const FIXTURE = new URL("../../../../../fixtures/profiles/twin-reads.json", import.meta.url);

interface Fixture {
  at: string;
  actors: Record<string, Actor>;
  writes: {
    n: number;
    as: string;
    scope: string;
    content: string;
    class?: "episodic" | "semantic";
    confidence?: number;
    grants?: Partial<Grant>[];
    expect: "allow" | "deny";
    policy_id?: string;
  }[];
  reads: { name: string; as: string; returns: number[] }[];
}

const twin = (): Policy => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const fixture = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;

/** The plane after the fixture's writes, each checked against its expected decision. */
async function written() {
  const f = fixture();
  const env = fresh(twin());
  for (const w of f.writes) {
    const actor = f.actors[w.as] as Actor;
    const result = await env.plane.write(
      actor,
      item(w.n, {
        scope: w.scope,
        owner: actor.id,
        content: w.content,
        class: w.class ?? "semantic",
        confidence: w.confidence ?? 0.9,
        grants: (w.grants ?? []) as Grant[],
      }),
      f.at,
    );
    expect(result.event.decision, `write ${w.n}`).toBe(w.expect);
    if (w.policy_id) expect(result.event.policy_id, `write ${w.n}`).toBe(w.policy_id);
  }
  return { ...env, f };
}

describe("acceptance (card E9.2): the twin profile loads", () => {
  test("it parses and covers every level", () => {
    const policy = twin();
    expect(policy.id).toBe("profile.twin");
    expect(policy.write.map((r) => r.scope).sort()).toEqual(["org", "person", "role", "team"]);
    expect(policy.read.honour_grants).toBe(true);
  });

  test("a role context never reads a person scope, and a role takes no personal classes or sources", () => {
    const policy = twin();
    expect(policy.read.matrix.find((r) => r.reader === "role")?.may_read).not.toContain("person");
    const role = policy.write.find((r) => r.scope === "role");
    expect(role?.forbidden_classes).toContain("episodic");
    expect(role?.allowed_sources).not.toContain("model");
    expect(role?.allowed_sources).not.toContain("compaction");
  });
});

describe("acceptance (card E9.2): a cross-person read is denied in the fixture", () => {
  test("every fixture write gets its decision", async () => {
    await written();
  });

  test.each(fixture().reads.map((r) => [r.name, r] as const))("%s", async (_name, r) => {
    const { plane, f } = await written();
    const read = await plane.read(f.actors[r.as] as Actor, { at: f.at });
    expect(read.items.map((i) => i.id).sort()).toEqual(r.returns.map(id).sort());
  });

  test("Sam, a teammate, sees nothing of Dana's person scope without a live grant", async () => {
    const { plane, f } = await written();
    const sam = f.actors.sam as Actor;
    const read = await plane.read(sam, { at: f.at });
    const scopes = new Set(read.items.map((i) => i.scope));
    expect(read.items.map((i) => i.id)).toEqual([id(3)]);
    expect(read.explanations.map((e) => e.policy_id)).toEqual(["profile.twin/read/grants"]);
    expect(scopes).toEqual(new Set(["person:dana"]));
    // After the grant expires, nothing.
    const later = await plane.read(sam, { at: "2027-02-01T00:00:00.000Z" });
    expect(later.items).toEqual([]);
  });

  test("an agent cannot widen a person's memory into a role: the promotion needs a user source", async () => {
    const { plane, f } = await written();
    const agent = f.actors["dana-agent"] as Actor;
    const lifted = await plane.promote(agent, id(1), "role:lead", f.at);
    expect(lifted.decision).toBe("deny");
    expect(lifted.event.policy_id).toBe("engram/promote/widening-source");
  });
});
