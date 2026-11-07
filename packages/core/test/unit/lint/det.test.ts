// Card L1 (layer 1, with the fault catalogue): the deterministic lints as
// pure functions, each against a case it must flag and a near-miss it must
// not; then Plane.lint over every fixture in fixtures/faults/, which the
// lint must flag exactly as the fixture declares.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { type FaultFixture, faultFixtures, fixtureText } from "../../../scripts/faults.ts";
import { InvalidCallError } from "../../../src/actor.ts";
import { strictContentHash } from "../../../src/content-hash.ts";
import { appendEvent } from "../../../src/events.ts";
import {
  duplicates,
  expiredValidity,
  isDeterministicLint,
  type LintContext,
  lintScope,
  missingProvenance,
  orphan,
  refItemId,
  scopeClassMismatch,
  sourceChanged,
} from "../../../src/lint/det.ts";
import { DETERMINISTIC_LINT_IDS } from "../../../src/lint.ts";
import { LINT_MEMBERSHIP_ID } from "../../../src/plane.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "../plane/helpers.ts";

const FAULTS = join(import.meta.dirname, "../../../../../fixtures/faults");

function ctx(items: MemoryItem[], over: Partial<LintContext> = {}): LintContext {
  return {
    policy: testPolicy(),
    at: AT,
    items: new Map(items.map((i) => [i.id, i])),
    retiredBy: new Map(),
    canReach: () => true,
    ...over,
  };
}

const ref = (target: string, hash = `sha256:${"0".repeat(64)}`) => ({
  provenance: { kind: "user" as const, ref: target, hash, actor: "person:omar" },
});

describe("refItemId", () => {
  test("names an item for a bare UUIDv7 or item:<id>, nothing for any other ref", () => {
    expect(refItemId(id(1))).toBe(id(1));
    expect(refItemId(`item:${id(1)}`)).toBe(id(1));
    expect(refItemId("doc/1")).toBeNull();
    expect(refItemId("pi:tool_call/7")).toBeNull();
  });
});

describe("expired-validity", () => {
  test("flags an active item whose valid_to is not after the lint time", () => {
    const f = expiredValidity(item(1, { valid_to: AT }), ctx([]));
    expect(f?.lint_id).toBe("expired-validity");
    expect(f?.evidence).toContain(`valid_to ${AT}`);
  });
  test("flags an item past its own ttl", () => {
    const it = item(1, { valid_from: "2026-10-25T11:00:00Z", ttl: 3600 });
    expect(expiredValidity(it, ctx([]))?.message).toContain("passed its ttl");
  });
  test("does not flag an item valid one second longer, or one second short of its ttl", () => {
    expect(expiredValidity(item(1, { valid_to: "2026-10-25T12:00:01Z" }), ctx([]))).toBeNull();
    const it = item(2, { valid_from: "2026-10-25T11:00:01Z", ttl: 3600 });
    expect(expiredValidity(it, ctx([]))).toBeNull();
  });
});

describe("source-changed", () => {
  test("flags an item whose source now hashes to something else", () => {
    const src = item(1, { content: "new text" });
    const it = item(2, ref(src.id, strictContentHash("old text")));
    const f = sourceChanged(it, ctx([src, it]));
    expect(f?.evidence).toEqual([
      `source ${src.id}`,
      `recorded ${strictContentHash("old text")}`,
      `current ${strictContentHash("new text")}`,
    ]);
  });
  test("does not flag a source changed only in whitespace, a ref that is no item, or a source out of reach", () => {
    const src = item(1, { content: " old   text " });
    const it = item(2, ref(src.id, strictContentHash("old text")));
    expect(sourceChanged(it, ctx([src, it]))).toBeNull();
    expect(sourceChanged(item(3, ref("doc/1")), ctx([src]))).toBeNull();
    const moved = item(4, ref(src.id, strictContentHash("other")));
    expect(
      sourceChanged(moved, ctx([src, moved], { canReach: (i) => i.id !== src.id })),
    ).toBeNull();
  });
});

describe("scope-class-mismatch", () => {
  test("flags a class its scope's rule now forbids, and a scope level with no rule", () => {
    expect(scopeClassMismatch(item(1, { class: "episodic" }), ctx([]))?.severity).toBe("error");
    const policy = testPolicy({ write: testPolicy().write.filter((r) => r.scope !== "team") });
    expect(scopeClassMismatch(item(2), ctx([], { policy }))?.message).toContain("no write rule");
  });
  test("does not flag an allowed class", () => {
    expect(scopeClassMismatch(item(1), ctx([]))).toBeNull();
  });
});

describe("missing-provenance", () => {
  const prov = (p: Partial<MemoryItem["provenance"]>) =>
    item(1, { provenance: { ...item(1).provenance, ...p } });
  test("flags model without model, compaction without session_entry_id, and a blank ref", () => {
    expect(missingProvenance(prov({ kind: "model" }))?.evidence).toEqual([
      "kind model names no model",
    ]);
    expect(missingProvenance(prov({ kind: "compaction", model: "m/x" }))?.evidence).toEqual([
      "kind compaction names no session_entry_id",
    ]);
    expect(missingProvenance(prov({ ref: "  " }))?.evidence).toEqual(["ref is blank"]);
  });
  test("does not flag complete provenance, or a user write with no model", () => {
    expect(missingProvenance(prov({ kind: "model", model: "m/x" }))).toBeNull();
    expect(
      missingProvenance(prov({ kind: "compaction", model: "m/x", session_entry_id: "e1" })),
    ).toBeNull();
    expect(missingProvenance(item(1))).toBeNull();
  });
});

describe("orphan", () => {
  test("flags a ref to a retired item and a lineage id never logged", () => {
    const gone = item(1, { status: "retired" });
    const it = item(2, { ...ref(gone.id), lineage: [id(99)] });
    const f = orphan(
      it,
      ctx([gone, it], { retiredBy: new Map([[gone.id, { op: "retire", policy_id: "test/x" }]]) }),
    );
    expect(f?.evidence).toEqual([
      `provenance.ref ${gone.id} names an item retired by test/x`,
      `lineage ${id(99)} names no item you can reach`,
    ]);
  });
  test("flags a lineage id evicted, and one out of the actor's reach", () => {
    const evicted = item(1, { status: "retired" });
    const hidden = item(3, { scope: "person:sam" });
    const it = item(2, { lineage: [evicted.id, hidden.id] });
    const f = orphan(
      it,
      ctx([evicted, hidden, it], {
        retiredBy: new Map([
          [evicted.id, { op: "evict", policy_id: "test/retention/team/semantic" }],
        ]),
        canReach: (i) => i.scope !== "person:sam",
      }),
    );
    expect(f?.evidence).toHaveLength(2);
  });
  test("does not flag a lineage id retired by its own supersession, an active ref, or a ref that is no item", () => {
    const old = item(1, { status: "retired" });
    const live = item(3);
    const it = item(2, { ...ref(live.id), lineage: [old.id] });
    const retiredBy = new Map([[old.id, { op: "retire", policy_id: "test/promotion/superseded" }]]);
    expect(orphan(it, ctx([old, live, it], { retiredBy }))).toBeNull();
    expect(orphan(item(4), ctx([]))).toBeNull();
  });
});

describe("duplicate", () => {
  test("flags every later item of one scope and class with the same strict hash", () => {
    const out = duplicates([
      item(3, { content: "a  b" }),
      item(1, { content: "a b" }),
      item(2, { content: "a b\n" }),
    ]);
    expect(out.map((f) => f.item_id)).toEqual([id(2), id(3)]);
    expect(out[0]?.evidence[0]).toBe(`duplicate of ${id(1)}`);
  });
  test("does not flag another case, class or scope", () => {
    expect(
      duplicates([
        item(1, { content: "A b" }),
        item(2, { content: "a b" }),
        item(3, { content: "a b", class: "episodic" }),
        item(4, { content: "a b", scope: "team:other" }),
      ]),
    ).toEqual([]);
  });
});

describe("lintScope", () => {
  test("runs only the enabled deterministic lints over the scope's active items, in lint order", () => {
    const items = [
      item(1, { class: "episodic", valid_to: AT }),
      item(2, { status: "retired", valid_to: AT }),
      item(3, { scope: "team:other", valid_to: AT }),
    ];
    const out = lintScope(ctx(items), "team:platform", [
      "scope-class-mismatch",
      "expired-validity",
      "contradiction",
    ]);
    expect(out.map((f) => [f.lint_id, f.item_id])).toEqual([
      ["expired-validity", id(1)],
      ["scope-class-mismatch", id(1)],
    ]);
    expect(lintScope(ctx(items), "team:platform", [])).toEqual([]);
  });
  test("isDeterministicLint knows the six ids and no model lint", () => {
    expect(DETERMINISTIC_LINT_IDS.every(isDeterministicLint)).toBe(true);
    expect(isDeterministicLint("contradiction")).toBe(false);
  });
});

/** A plane under the fixture's policy whose log is the fixture's events. */
function load(f: FaultFixture) {
  const env = fresh(f.policy);
  for (const { seq: _seq, ...e } of f.events) appendEvent(env.db, e);
  return env;
}

const fixtureFiles = readdirSync(FAULTS)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("the fault catalogue", () => {
  test("has a flag and a near-miss fixture for every deterministic lint", () => {
    expect(fixtureFiles).toEqual(
      DETERMINISTIC_LINT_IDS.flatMap((l) => [`${l}.flag.json`, `${l}.near-miss.json`]).sort(),
    );
  });

  test("is what packages/core/scripts/faults.ts generates (make fixtures)", async () => {
    const built = await faultFixtures();
    for (const file of fixtureFiles)
      expect(readFileSync(join(FAULTS, file), "utf8").replaceAll("\r\n", "\n"), file).toBe(
        fixtureText(built[file.replace(/\.json$/, "")] as FaultFixture),
      );
  });

  for (const file of fixtureFiles) {
    const f = JSON.parse(readFileSync(join(FAULTS, file), "utf8")) as FaultFixture;
    test(`${f.lint_id} ${f.kind === "flag" ? "flags" : "does not flag"} ${file}`, async () => {
      const { plane } = load(f);
      const report = await plane.lint(f.actor, f.at, f.scope);
      expect(report.decision).toBe("allow");
      expect(report.findings.map((x) => x.item_id)).toEqual(f.flags);
      expect(report.findings.every((x) => x.lint_id === f.lint_id)).toBe(true);
      if (f.kind === "flag") expect(f.flags.length).toBeGreaterThan(0);
      else expect(f.flags).toEqual([]);
    });
  }
});

describe("Plane.lint", () => {
  const actor = {
    id: "person:omar",
    level: "person" as const,
    memberships: ["person:omar", "team:platform"],
    source: "user" as const,
  };
  const enabled = (lints: string[]): Policy =>
    testPolicy({ lints: { enabled: lints, thresholds: {} } });

  test("records each finding as one lint event whose reason carries the lint, severity and evidence", async () => {
    const { plane, db } = fresh(enabled(["expired-validity"]));
    const r = await plane.write(actor, item(1, { valid_to: "2026-10-20T00:00:00Z" }), AT);
    expect(r.item).not.toBeNull();
    const before = plane.events().length;
    const report = await plane.lint(actor, AT, "team:platform");
    expect(report.findings).toHaveLength(1);
    const [event] = report.events;
    expect(event).toMatchObject({
      op: "lint",
      decision: "allow",
      item_id: id(1),
      actor: actor.id,
      scope_to: "team:platform",
      policy_id: "test/lint/expired-validity",
      ts: AT,
    });
    expect(event?.reason).toMatch(/^expired-validity \(warn\): .*; evidence: valid_to /);
    expect(report.findings[0]).toMatchObject({ id: event?.id, tier: "deterministic" });
    expect(plane.events().length).toBe(before + 1);
    expect(db).toBeDefined();
  });

  test("runs no lint the policy does not enable", async () => {
    const { plane } = fresh(enabled(["duplicate"]));
    await plane.write(actor, item(1, { valid_to: "2026-10-20T00:00:00Z" }), AT);
    const report = await plane.lint(actor, AT, "team:platform");
    expect(report).toEqual({ decision: "allow", findings: [], events: [] });
  });

  test("refuses a non-member with one deny event and no findings", async () => {
    const { plane } = fresh(enabled(["expired-validity"]));
    await plane.write(actor, item(1, { valid_to: "2026-10-20T00:00:00Z" }), AT);
    const outsider = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
    const report = await plane.lint(outsider, AT, "team:platform");
    expect(report.decision).toBe("deny");
    expect(report.findings).toEqual([]);
    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      op: "lint",
      decision: "deny",
      item_id: null,
      policy_id: LINT_MEMBERSHIP_ID,
    });
  });

  test("refuses a member the read matrix forbids from reading the scope, as Plane.read does", async () => {
    const { plane } = fresh(enabled(["expired-validity"]));
    const w = await plane.write(
      actor,
      item(1, { scope: "person:omar", owner: "person:omar", valid_to: "2026-10-20T00:00:00Z" }),
      AT,
    );
    expect(w.item).not.toBeNull();
    // A team-level actor listed as a member of person:omar: the test policy's
    // matrix lets a team reader read team and org scopes, never person.
    const teamReader = {
      id: "team:platform",
      level: "team" as const,
      memberships: ["person:omar", "team:platform"],
    };
    const read = await plane.read(teamReader, { text: "", at: AT });
    expect(read.items.map((i) => i.id)).not.toContain(id(1));
    const report = await plane.lint(teamReader, AT, "person:omar");
    expect(report.decision).toBe("deny");
    expect(report.findings).toEqual([]);
    expect(report.events).toHaveLength(1);
    expect(report.events[0]).toMatchObject({
      op: "lint",
      decision: "deny",
      item_id: null,
      policy_id: LINT_MEMBERSHIP_ID,
    });
    expect(report.events[0]?.reason).toMatch(/may not read person:omar/);
  });

  test("refuses an invalid scope, actor or time before the log is touched", async () => {
    const { plane } = fresh();
    await expect(plane.lint(actor, AT, "everyone")).rejects.toBeInstanceOf(InvalidCallError);
    await expect(plane.lint(actor, "yesterday", "org")).rejects.toBeInstanceOf(InvalidCallError);
    await expect(plane.lint({ id: "" } as never, AT, "org")).rejects.toBeInstanceOf(
      InvalidCallError,
    );
    expect(plane.events()).toEqual([]);
  });
});
