// No lint event shows a viewer what Plane.read would not (post-merge review of
// 2026-11-13, cards L1 and E2.2; ADR 0009's post-merge amendment). A lint
// event is shown to every member of the linted scope (visible.ts), so its
// evidence may carry nothing about an item outside that scope beyond what the
// in-scope item records itself: no content hash, no status and no retiring
// rule of an item the viewer cannot read. Generated worlds of items across
// four scopes, citing each other by provenance ref and lineage, some retired
// under assorted rules, some granted to the viewer; a linter who reaches
// three of the scopes lints each, and every lint event the viewer may see is
// checked against what Plane.read returned to the viewer.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import { strictContentHash } from "../../src/content-hash.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { visibleEvents } from "../../src/visible.ts";
import { seedFor } from "../generators.ts";
import { AT, fresh, id, item, testPolicy } from "../unit/plane/helpers.ts";

const RUNS = 200;
const SCOPES = ["person:dana", "team:core", "team:other", "person:sam"] as const;
const POOL = ["alpha note", "beta note", "gamma note"] as const;
const HASHES = [...POOL.map((c) => strictContentHash(c)), `sha256:${"0".repeat(64)}`];
const RETIRED_BY = ["test/x", "test/promotion/superseded", "test/retention/team/semantic"];

const LINTER: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:core", "team:other"],
  source: "user",
};
const VIEWER: Actor = {
  id: "person:sam",
  level: "person",
  memberships: ["person:sam", "team:core"],
  source: "user",
};

const arbSeed = (n: number) =>
  fc.record({
    scope: fc.constantFrom(...SCOPES),
    content: fc.constantFrom(...POOL),
    ref: fc.option(fc.nat({ max: n - 1 }), { nil: undefined }),
    hash: fc.constantFrom(...HASHES),
    lineage: fc.uniqueArray(fc.nat({ max: n - 1 }), { maxLength: 2 }),
    retired: fc.option(fc.constantFrom(...RETIRED_BY), { nil: undefined }),
    rewrite: fc.option(fc.constantFrom(...POOL), { nil: undefined }),
    granted: fc.option(fc.constantFrom("2026-12-01T00:00:00Z", "2026-10-01T00:00:00Z"), {
      nil: undefined,
    }),
  });
const arbWorld = fc
  .integer({ min: 2, max: 8 })
  .chain((n) => fc.array(arbSeed(n), { minLength: n, maxLength: n }));

let next = 0;
const eventId = () => id(700_000 + ++next);

/** Writes the world straight into a fresh log (the gate is not under test), then lints it. */
async function lintedWorld(world: fc.RecordValue<ReturnType<typeof arbSeed>>[]) {
  const env = fresh(testPolicy({ lints: { enabled: [...LINTS], thresholds: {} } }));
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
      item: it,
      schema_version: 1,
    });
  const built = world.map((s, i) => {
    const owner = s.scope.startsWith("person:") ? s.scope : "person:dana";
    return item(i + 1, {
      scope: s.scope,
      owner,
      content: s.content,
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
          : [{ to: VIEWER.id, class: "semantic", mode: "read", expires: s.granted }],
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
  const lints: MemoryEvent[] = [];
  for (const scope of LINTER.memberships)
    lints.push(...(await env.plane.lint(LINTER, AT, scope)).events);
  return { env, lints };
}

const LINTS = [
  "expired-validity",
  "source-changed",
  "scope-class-mismatch",
  "missing-provenance",
  "orphan",
  "duplicate",
] as const;

describe("lint events a viewer may see", () => {
  const name =
    "carry no content hash, status or retiring rule of an out-of-scope item Plane.read does not return";
  test(name, async () => {
    let shownFindings = 0;
    await fc.assert(
      fc.asyncProperty(arbWorld, async (world) => {
        const { env, lints } = await lintedWorld(world);
        const read = await env.plane.read(VIEWER, { at: AT });
        const returned = new Set(read.items.map((i) => i.id));
        const projected = currentItems(env.db);
        const shown = visibleEvents(VIEWER, lints, {
          policy: env.policy,
          at: AT,
          current: (itemId) => projected.find((i) => i.id === itemId),
        });
        for (const event of shown) {
          if (event.decision !== "allow") continue;
          shownFindings++;
          // What the linted scope's own items record may be shown to its members.
          const own = new Set(
            projected.filter((i) => i.scope === event.scope_to).map((i) => i.provenance.hash),
          );
          for (const hidden of projected) {
            if (hidden.scope === event.scope_to || returned.has(hidden.id)) continue;
            const hash = strictContentHash(hidden.content);
            if (!own.has(hash)) expect(event.reason, hidden.id).not.toContain(hash);
            expect(event.reason).not.toMatch(
              new RegExp(`${hidden.id} names (an item retired|a retired item)`),
            );
            for (const rule of RETIRED_BY)
              expect(event.reason).not.toContain(`${hidden.id} names an item retired by ${rule}`);
          }
        }
      }),
      { numRuns: RUNS, seed: seedFor(name) },
    );
    // The worlds raise findings the viewer sees, so the property is not vacuous.
    expect(shownFindings).toBeGreaterThan(0);
  });
});
