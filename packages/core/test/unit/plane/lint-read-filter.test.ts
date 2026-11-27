// Card L8: Plane.lint names or describes only what the read filter admits.
// Each case is a counterexample to the reach card L1 gave the lints
// (readableAt: scope or a live grant, whatever the item's status or
// validity): a member lints his scope, and the finding names or describes an
// item Plane.read refuses him, a candidate, a retired item, an item past its
// ttl reached by a grant, an item not yet valid. Under the read filter each
// such item reads as absent: no finding is about it, none names its content
// hash, status or retiring rule, and an id the linted item records itself is
// named only as "no active item you can reach". Every finding stays one lint
// event with its reason (AGENTS.md rule 3).
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { InvalidCallError } from "../../../src/actor.ts";
import { strictContentHash } from "../../../src/content-hash.ts";
import { appendEvent, currentItems } from "../../../src/events.ts";
import { type LintReport, planModelLints } from "../../../src/plane/lint.ts";
import { evaluateRead } from "../../../src/policy/evaluate.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const OMAR: Actor = {
  id: "person:omar",
  level: "person",
  memberships: ["person:omar", "team:platform"],
  source: "user",
};
const SCOPE = "team:platform";
const SUPERSEDED = "test/promotion/superseded";
const LINTS = [
  "expired-validity",
  "source-changed",
  "scope-class-mismatch",
  "missing-provenance",
  "orphan",
  "duplicate",
  "near-duplicate-tier",
  "injection-signature",
];
const UNREACHED = "names no active item you can reach";
const STALE = strictContentHash("what the source said when it was cited");

const policy = (): Policy => testPolicy({ lints: { enabled: [...LINTS], thresholds: {} } });

let next = 0;
const eventId = () => id(800_000 + ++next);

/** Writes `items` straight into a fresh log (the gate is not under test), then retires `retired`. */
function world(items: MemoryItem[], retired: Record<string, string> = {}) {
  const env = fresh(policy());
  for (const it of items)
    appendEvent(env.db, {
      id: eventId(),
      ts: AT,
      op: "write",
      item_id: it.id,
      actor: it.owner,
      scope_from: null,
      scope_to: it.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "test/fixture",
      item: it,
      schema_version: 1,
    });
  for (const [itemId, policyId] of Object.entries(retired)) {
    const it = items.find((i) => i.id === itemId) as MemoryItem;
    appendEvent(env.db, {
      id: eventId(),
      ts: AT,
      op: "retire",
      item_id: itemId,
      actor: it.owner,
      scope_from: it.scope,
      scope_to: null,
      decision: "allow",
      reason: "seeded",
      policy_id: policyId,
      schema_version: 1,
    });
  }
  return env;
}

/** The item as the log projects it, and whether the read filter admits it for Omar at AT. */
function refused(env: ReturnType<typeof world>, itemId: string): MemoryItem {
  const projected = currentItems(env.db).find((i) => i.id === itemId) as MemoryItem;
  expect(evaluateRead(env.policy, OMAR, projected, AT).admitted, itemId).toBe(false);
  return projected;
}

/** Each finding is one lint event whose reason carries its lint, severity and evidence. */
function oneEventPerFinding(report: LintReport) {
  expect(report.decision).toBe("allow");
  expect(report.events).toHaveLength(report.findings.length);
  report.findings.forEach((f, i) => {
    const e = report.events[i];
    expect(e).toMatchObject({
      id: f.id,
      op: "lint",
      decision: "allow",
      item_id: f.item_id,
      scope_to: SCOPE,
      policy_id: `test/lint/${f.lint_id}`,
    });
    expect(e?.reason).toBe(
      `${f.lint_id} (${f.severity}): ${f.message}; evidence: ${f.evidence.join("; ")}`,
    );
  });
}

/** Nothing in the report is about `hidden`, names its content hash, or says more of its id than UNREACHED. */
function saysNothingOf(report: LintReport, hidden: MemoryItem) {
  const text = JSON.stringify(report);
  expect(text, hidden.id).not.toContain(strictContentHash(hidden.content));
  expect(report.findings.map((f) => f.item_id)).not.toContain(hidden.id);
  for (const f of report.findings) {
    expect(f.message).not.toContain(hidden.id);
    for (const line of f.evidence)
      if (line.includes(hidden.id)) expect(line).toMatch(new RegExp(`${hidden.id} ${UNREACHED}$`));
  }
  expect(text).not.toMatch(/retired/);
}

const said = (report: LintReport) =>
  report.findings.map((f) => [f.lint_id, f.item_id, f.evidence] as const);

const cites = (target: string, over: Partial<MemoryItem> = {}) => ({
  provenance: { kind: "user" as const, ref: target, hash: STALE, actor: "person:omar" },
  ...over,
});

describe("Plane.lint as a member names or describes nothing the read filter refuses (card L8)", () => {
  test("a candidate of the linted scope: no source-changed with its hash, and a ref to it reads as absent", async () => {
    const candidate = item(1, { status: "candidate", content: "an unreviewed candidate fact" });
    const env = world([candidate, item(2, cites(candidate.id, { lineage: [candidate.id] }))]);
    refused(env, candidate.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    saysNothingOf(report, candidate);
    expect(said(report)).toEqual([
      [
        "orphan",
        id(2),
        [`provenance.ref ${candidate.id} ${UNREACHED}`, `lineage ${candidate.id} ${UNREACHED}`],
      ],
    ]);
  });

  test("a retired item: neither its current hash, its status nor its retiring rule", async () => {
    const gone = item(1, { content: "a fact since retired by hand" });
    const env = world([gone, item(2, cites(gone.id, { lineage: [gone.id] }))], {
      [gone.id]: "test/x",
    });
    refused(env, gone.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    saysNothingOf(report, gone);
    expect(said(report)).toEqual([
      [
        "orphan",
        id(2),
        [`provenance.ref ${gone.id} ${UNREACHED}`, `lineage ${gone.id} ${UNREACHED}`],
      ],
    ]);
  });

  test("a lineage id naming an item retired by its own supersession is still no orphan", async () => {
    const old = item(1, { content: "the old version" });
    const env = world([old, item(2, { content: "the new version", lineage: [old.id] })], {
      [old.id]: SUPERSEDED,
    });
    refused(env, old.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    expect(report.findings).toEqual([]);
  });

  test("an item reached only by an expired grant, and one past its ttl reached by a live grant", async () => {
    const grant = (expires: string) => [
      { to: OMAR.id, class: "semantic" as const, mode: "read" as const, expires },
    ];
    const sam = { scope: "person:sam", owner: "person:sam" };
    const lapsed = item(1, {
      ...sam,
      content: "sam's note, grant lapsed",
      grants: grant("2026-10-01T00:00:00Z"),
    });
    const stale = item(2, {
      ...sam,
      content: "sam's note, past its ttl",
      grants: grant("2026-12-01T00:00:00Z"),
      valid_from: "2026-10-01T00:00:00Z",
      ttl: 60,
    });
    const env = world([lapsed, stale, item(3, cites(lapsed.id)), item(4, cites(stale.id))]);
    refused(env, lapsed.id);
    refused(env, stale.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    saysNothingOf(report, lapsed);
    saysNothingOf(report, stale);
    expect(said(report)).toEqual([
      ["orphan", id(3), [`provenance.ref ${lapsed.id} ${UNREACHED}`]],
      ["orphan", id(4), [`provenance.ref ${stale.id} ${UNREACHED}`]],
    ]);
  });

  test("an item not yet valid: no finding is about it, none names it as a duplicate's original, and a ref to it is no orphan (it is not gone, review L8-3) nor a source-changed naming its hash", async () => {
    const later = { valid_from: "2026-11-01T00:00:00Z" };
    const SAME = "the release train leaves on thursdays";
    const first = item(1, { ...later, content: SAME });
    const third = item(3, { ...later, content: SAME });
    const env = world([first, item(2, { content: SAME }), third, item(4, cites(first.id))]);
    refused(env, first.id);
    refused(env, third.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    for (const hidden of [first, third]) {
      expect(report.findings.map((f) => f.item_id)).not.toContain(hidden.id);
      expect(report.findings.flatMap((f) => [f.message, ...f.evidence]).join("\n")).not.toMatch(
        new RegExp(`${hidden.id}(?! ${UNREACHED})`),
      );
    }
    // An item of the scope refused only on time is not gone (review L8-3), and its hash is never shown.
    expect(said(report)).toEqual([]);
  });

  test("an item of the linted scope whose validity ended is still expired-validity's finding, and only its", async () => {
    const ended = item(1, { valid_to: "2026-10-20T00:00:00Z", content: "a fact that ended" });
    const lapsed = item(2, {
      valid_from: "2026-10-01T00:00:00Z",
      ttl: 60,
      content: "a fact past its ttl",
    });
    const env = world([ended, lapsed, item(3, { content: "a fact that ended" })]);
    refused(env, ended.id);
    refused(env, lapsed.id);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    expect(report.findings.map((f) => [f.lint_id, f.item_id])).toEqual([
      ["expired-validity", id(1)],
      ["expired-validity", id(2)],
    ]);
    // Its evidence is the item's own validity instants, never its content hash.
    expect(JSON.stringify(report)).not.toContain(strictContentHash("a fact that ended"));
  });
});

describe("the registered reach (card L8)", () => {
  test("reach scope-registered is card L1's reach, which the registered H3 runs pass", async () => {
    const gone = item(1, { content: "a fact since retired by hand" });
    const env = world([gone, item(2, cites(gone.id, { lineage: [gone.id] }))], {
      [gone.id]: "test/x",
    });
    const report = await env.plane.lint(OMAR, AT, SCOPE, { reach: "scope-registered" });
    oneEventPerFinding(report);
    expect(report.findings.map((f) => f.lint_id)).toEqual(["source-changed", "orphan"]);
    expect(report.findings[1]?.evidence).toEqual([
      `provenance.ref ${gone.id} names an item retired by test/x`,
      `lineage ${gone.id} names an item retired by test/x`,
    ]);
  });

  test("an unknown reach is refused before the log is touched", async () => {
    const env = world([item(1)]);
    const before = env.plane.events().length;
    await expect(env.plane.lint(OMAR, AT, SCOPE, { reach: "everything" as never })).rejects.toThrow(
      /invalid reach "everything"/,
    );
    expect(env.plane.events()).toHaveLength(before);
  });

  test("a null reach, options that are no object, and an unknown reach to planModelLints are refused (review L8-1)", async () => {
    const env = world([item(1)]);
    const before = env.plane.events().length;
    for (const options of [{ reach: null }, "scope-registered", null, 7, ["scope-registered"]])
      await expect(
        env.plane.lint(OMAR, AT, SCOPE, options as never),
        JSON.stringify(options),
      ).rejects.toBeInstanceOf(InvalidCallError);
    expect(env.plane.events()).toHaveLength(before);
    const setup = { model: "scripted/lint-1", seed: 1 };
    for (const options of [{ reach: "x" }, { reach: null }, "read-filter"])
      expect(() => planModelLints(env.deps, OMAR, AT, SCOPE, setup, options as never)).toThrow(
        /planModelLints: invalid (reach|options)/,
      );
    expect(planModelLints(env.deps, OMAR, AT, SCOPE, setup, {})).toEqual([]);
  });
});

describe("what the read filter refuses only on time, and supersession across scopes (review L8-3, L8-4)", () => {
  test("a source of the linted scope not yet valid, or whose validity ended, is no orphan under either reach", async () => {
    const later = item(1, { valid_from: "2026-11-01T00:00:00Z", content: "a dated source" });
    const ended = item(2, { valid_to: "2026-10-20T00:00:00Z", content: "an ended source" });
    const env = world([
      later,
      ended,
      item(3, cites(later.id, { lineage: [later.id] })),
      item(4, cites(ended.id, { lineage: [ended.id] })),
    ]);
    refused(env, later.id);
    refused(env, ended.id);
    for (const reach of ["read-filter", "scope-registered"] as const) {
      const report = await env.plane.lint(OMAR, AT, SCOPE, { reach });
      oneEventPerFinding(report);
      expect(
        report.findings.filter((f) => f.lint_id === "orphan"),
        reach,
      ).toEqual([]);
    }
    // At the default neither source's content is named: no source-changed shows its hash.
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    expect(report.findings.map((f) => [f.lint_id, f.item_id])).toEqual([
      ["expired-validity", ended.id],
    ]);
    expect(JSON.stringify(report)).not.toContain(strictContentHash("a dated source"));
  });

  test("a superseded predecessor outside the linted scope, reached by a live grant, reads as absent like any retired one", async () => {
    const grant = [
      {
        to: OMAR.id,
        class: "semantic" as const,
        mode: "read" as const,
        expires: "2026-12-01T00:00:00Z",
      },
    ];
    const sam = { scope: "person:sam", owner: "person:sam", grants: grant };
    const superseded = item(1, { ...sam, content: "sam's superseded note" });
    const retired = item(2, { ...sam, content: "sam's retired note" });
    const items = [
      superseded,
      retired,
      item(3, { lineage: [superseded.id] }),
      item(4, { lineage: [retired.id] }),
    ];
    const retire = { [superseded.id]: SUPERSEDED, [retired.id]: "test/x" };
    const env = world(items, retire);
    const report = await env.plane.lint(OMAR, AT, SCOPE);
    oneEventPerFinding(report);
    expect(said(report)).toEqual([
      ["orphan", id(3), [`lineage ${superseded.id} ${UNREACHED}`]],
      ["orphan", id(4), [`lineage ${retired.id} ${UNREACHED}`]],
    ]);
    // The registered reach keeps card L1's behaviour, the H3 runs' reach.
    const registered = await world(items, retire).plane.lint(OMAR, AT, SCOPE, {
      reach: "scope-registered",
    });
    expect(registered.findings.map((f) => [f.lint_id, f.item_id])).toEqual([["orphan", id(4)]]);
  });
});
