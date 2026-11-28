// The record of processing (card E9.16): GDPR Article 30(1)'s fields as far
// as the policy states them, per scope level, counts and categories only.
import { describe, expect, it } from "vitest";
import { policySha256, ROPA_FORMAT, ropaRecord } from "../../../src/audit/ropa.ts";
import { currentItems } from "../../../src/events.ts";
import { loadPreset } from "../../../src/policy/load.ts";
import { AT, fresh, item, testPolicy } from "../plane/helpers.ts";

const omar = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
  source: "user" as const,
};
const CANARY = "CANARY-e916-ropa";

describe("ropaRecord", () => {
  it("gives each level's categories, recipients and time limits from the policy", () => {
    const policy = testPolicy({
      retention: [
        { scope: "person", class: "semantic", ttl: 86_400, budget: 50, eviction: "recency" },
      ],
    });
    const r = ropaRecord(policy);
    expect(r.format).toBe(ROPA_FORMAT);
    expect(r.levels.map((l) => l.level)).toEqual(["person", "role", "team", "org"]);
    const person = r.levels[0];
    expect(person?.forbidden_classes).toEqual(["episodic"]);
    expect(person?.categories.map((c) => c.class)).toEqual(["semantic", "procedural"]);
    expect(person?.categories[0]?.allowed_sources).toEqual(["document", "model", "user"]);
    expect(person?.recipients).toEqual({ reader_levels: ["person"], grants_honoured: true });
    expect(r.levels[2]?.recipients.reader_levels).toEqual(["person", "team"]);
    expect(person?.time_limits).toEqual([
      { class: "semantic", ttl: 86_400, budget: 50, eviction: "recency" },
    ]);
    expect(person?.counts).toBeNull();
    expect(r.levels[3]?.categories.every((c) => c.requires_review)).toBe(true);
    expect(r.not_held.map((n) => n.point)).toEqual(["a", "b", "e"]);
    expect(r.erasure.mode).toBe("redact");
    expect(r.policy).toEqual({ id: "test", version: 1, sha256: policySha256(policy) });
    expect(r.notes.join(" ")).toMatch(/not the record itself and not a certification/);
  });

  it("counts the projection by level, class and status, with no content, id or scope", async () => {
    const w = fresh();
    await w.plane.write(omar, item(1, { scope: "person:omar", content: `${CANARY} 1` }), AT);
    await w.plane.write(omar, item(2, { content: `${CANARY} 2` }), AT);
    await w.plane.write(omar, item(3, { content: `${CANARY} 3`, status: "candidate" }), AT);
    const items = currentItems(w.db);
    const r = ropaRecord(w.policy, items);
    expect(r.levels[0]?.counts).toEqual({ semantic: { active: 1 } });
    expect(r.levels[2]?.counts).toEqual({ semantic: { active: 1, candidate: 1 } });
    expect(r.levels[3]?.counts).toEqual({});
    const text = JSON.stringify(r);
    for (const leak of [CANARY, "person:omar", "team:platform", ...items.map((i) => i.id)])
      expect(text).not.toContain(leak);
  });

  it("counts consent opt-outs without naming their scopes, and names the measures turned on", () => {
    const strict = loadPreset("strict");
    const r = ropaRecord({
      ...strict,
      consent: { opt_outs: [{ scope: "person:omar" }, { scope: "person:sara" }] },
      erasure: { mode: "shred" },
    });
    expect(r.consent_opt_outs).toBe(2);
    expect(JSON.stringify(r)).not.toContain("person:omar");
    expect(r.erasure.mode).toBe("shred");
    expect(r.measures[0]).toMatch(/write gate/);
  });

  it("is the same bytes for the same policy and projection", () => {
    const p = loadPreset("medium");
    expect(JSON.stringify(ropaRecord(p, []))).toBe(
      JSON.stringify(ropaRecord(loadPreset("medium"), [])),
    );
  });
});
