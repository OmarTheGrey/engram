// Card L8: Plane.lint, at its default reach, names or describes only what the
// read filter admits. Generated worlds of items across three scopes, some
// candidates, some retired under assorted rules, some not yet valid, some
// past their ttl or their valid_to, some granted to the linter with a live or
// an expired grant, citing each other by provenance ref and lineage, with
// content from a small pool so duplicates occur. The linter lints each of
// her two scopes with every deterministic lint, and three claims hold:
//
// 1. Every finding is about an item the read filter admits her, save
//    expired-validity's, whose subject is an item of the scope whose validity
//    ended or whose ttl ran out.
// 2. No finding names an item the filter refuses her, other than an id its
//    subject records (its provenance ref, its lineage) named as "no active
//    item you can reach", nor its content hash, its status or its retiring
//    rule.
// 3. Rewriting the content of every refused item changes no finding.
//
// Each finding is one lint event with its reason (AGENTS.md rule 3).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import { strictContentHash } from "../../src/content-hash.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import { refItemId } from "../../src/lint/det.ts";
import { evaluateRead } from "../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { seedFor } from "../generators.ts";
import { AT, fresh, id, item, testPolicy } from "../unit/plane/helpers.ts";

const RUNS = 200;
const SCOPES = ["person:dana", "team:core", "team:other"] as const;
const POOL = ["alpha note", "beta note", "gamma note"] as const;
const HASHES = [...POOL.map((c) => strictContentHash(c)), `sha256:${"0".repeat(64)}`];
const RETIRED_BY = ["test/x", "test/promotion/superseded", "test/retention/team/semantic"];
const UNREACHED = "names no active item you can reach";
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

const LINTER: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:core"],
  source: "user",
};

const arbSeed = (n: number) =>
  fc.record({
    scope: fc.constantFrom(...SCOPES),
    content: fc.constantFrom(...POOL),
    ref: fc.option(fc.nat({ max: n - 1 }), { nil: undefined }),
    hash: fc.constantFrom(...HASHES),
    lineage: fc.uniqueArray(fc.nat({ max: n - 1 }), { maxLength: 2 }),
    candidate: fc.boolean(),
    retired: fc.option(fc.constantFrom(...RETIRED_BY), { nil: undefined }),
    rewrite: fc.option(fc.constantFrom(...POOL), { nil: undefined }),
    // Not yet valid, ended by valid_to, past a one-minute ttl, or held.
    when: fc.constantFrom("held", "held", "later", "ended", "ttl"),
    granted: fc.option(fc.constantFrom("2026-12-01T00:00:00Z", "2026-10-01T00:00:00Z"), {
      nil: undefined,
    }),
  });
const arbWorld = fc
  .integer({ min: 2, max: 8 })
  .chain((n) => fc.array(arbSeed(n), { minLength: n, maxLength: n }));

type Seed = ReturnType<typeof arbSeed> extends fc.Arbitrary<infer T> ? T : never;

const WHEN: Record<Seed["when"], Partial<Pick<MemoryItem, "valid_from" | "valid_to" | "ttl">>> = {
  held: {},
  later: { valid_from: "2026-11-01T00:00:00Z" },
  ended: { valid_to: "2026-10-20T00:00:00Z" },
  ttl: { valid_from: "2026-10-01T00:00:00Z", ttl: 60 },
};

/**
 * Writes the world straight into a fresh log (the gate is not under test),
 * every version of an item in `withheld` with other content, then lints each
 * of the linter's scopes.
 */
async function lintedWorld(world: Seed[], withheld: ReadonlySet<string> = new Set()) {
  const env = fresh(testPolicy({ lints: { enabled: [...LINTS], thresholds: {} } }));
  let n = 0;
  const eventId = () => id(700_000 + ++n);
  const append = (it: MemoryItem) =>
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
      item: withheld.has(it.id)
        ? ({ ...it, content: `withheld ${it.id} v${it.version}` } as MemoryItem)
        : it,
      schema_version: 1,
    });
  const built = world.map((s, i) => {
    const owner = s.scope.startsWith("person:") ? s.scope : "person:dana";
    return item(i + 1, {
      scope: s.scope,
      owner,
      content: s.content,
      status: s.candidate ? "candidate" : "active",
      lineage: s.lineage.filter((l) => l !== i).map((l) => id(l + 1)),
      provenance: {
        kind: "user",
        ref: s.ref === undefined || s.ref === i ? "doc/1" : id(s.ref + 1),
        hash: s.hash,
        actor: owner,
      },
      grants:
        s.granted === undefined
          ? []
          : [{ to: LINTER.id, class: "semantic", mode: "read", expires: s.granted }],
      ...WHEN[s.when],
    });
  });
  for (const it of built) append(it);
  world.forEach((s, i) => {
    const it = built[i] as MemoryItem;
    if (s.rewrite !== undefined) append({ ...it, content: s.rewrite, version: 2 } as MemoryItem);
    if (s.retired !== undefined)
      appendEvent(env.db, {
        id: eventId(),
        ts: AT,
        op: "retire",
        item_id: it.id,
        actor: it.owner,
        scope_from: it.scope,
        scope_to: null,
        decision: "allow",
        reason: "seeded",
        policy_id: s.retired,
        schema_version: 1,
      });
  });
  const reports = [];
  for (const scope of LINTER.memberships)
    reports.push({ scope, report: await env.plane.lint(LINTER, AT, scope) });
  return { env, reports, projected: currentItems(env.db) };
}

describe("Plane.lint at its default reach (card L8)", () => {
  const name =
    "names or describes no item the read filter refuses the linter, and its findings do not depend on one's content";
  test(name, async () => {
    let findings = 0;
    let refusedNamed = 0;
    await fc.assert(
      fc.asyncProperty(arbWorld, async (world) => {
        const { env, reports, projected } = await lintedWorld(world);
        const admitted = (it: MemoryItem) => evaluateRead(env.policy, LINTER, it, AT).admitted;
        const byId = new Map(projected.map((i) => [i.id, i]));
        const refused = projected.filter((i) => !admitted(i));
        const admittedHashes = new Set(
          projected.filter(admitted).map((i) => strictContentHash(i.content)),
        );
        for (const { scope, report } of reports) {
          expect(report.decision).toBe("allow");
          expect(report.events).toHaveLength(report.findings.length);
          report.findings.forEach((f, i) => {
            findings++;
            const event = report.events[i];
            expect(event).toMatchObject({ id: f.id, op: "lint", item_id: f.item_id });
            expect(event?.reason).toBe(
              `${f.lint_id} (${f.severity}): ${f.message}; evidence: ${f.evidence.join("; ")}`,
            );
            const subject = byId.get(f.item_id as string) as MemoryItem;
            // Claim 1.
            if (f.lint_id === "expired-validity")
              expect([subject.scope, subject.status]).toEqual([scope, "active"]);
            else expect(admitted(subject), f.lint_id).toBe(true);
            // Claim 2.
            const recorded = new Set([...subject.lineage, refItemId(subject.provenance.ref)]);
            const text = [f.message, ...f.evidence];
            expect(text.join("\n")).not.toMatch(/retired/);
            for (const hidden of refused) {
              for (const line of text)
                if (hidden.id !== subject.id && line.includes(hidden.id)) {
                  refusedNamed++;
                  expect(recorded.has(hidden.id), line).toBe(true);
                  expect(line).toMatch(new RegExp(`${hidden.id} ${UNREACHED}$`));
                }
              const hash = strictContentHash(hidden.content);
              if (!admittedHashes.has(hash) && hash !== subject.provenance.hash)
                expect(text.join("\n"), hidden.id).not.toContain(hash);
            }
          });
        }
        // Claim 3.
        const again = await lintedWorld(world, new Set(refused.map((i) => i.id)));
        expect(again.reports).toEqual(reports);
      }),
      { numRuns: RUNS, seed: seedFor(name) },
    );
    // The worlds raise findings, some naming a refused item, so the claims are not vacuous.
    expect(findings).toBeGreaterThan(0);
    expect(refusedNamed).toBeGreaterThan(0);
  });
});
