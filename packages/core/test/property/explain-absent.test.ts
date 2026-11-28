// Why not this item (card E2.17), against Plane.read. Two properties, each
// on the simulator's fixtures (fixtures/workloads, replayed under the three
// presets with the store's search and with the core pipeline and a limit)
// and on generated policies, items, grants and actors:
//
// 1. The named stage is what the read did. Just before each read, the stage
//    the read will stop every projected item at (readOutcomes) is counted,
//    and the counts must equal the ones the read's own event records:
//    returned, candidates, each filter category, the rank cut and the items
//    out of reach; the items it names returned are exactly those the read
//    returns. A stage applied in another order than the read's (validity
//    before status, say) miscounts as soon as an item fails two.
// 2. Forbidden and missing answer alike. explainAbsent answers an actor
//    exactly when ADR 0047's by-id rule lets it ask for the item, and then
//    with the stage of property 1, never `reach` or `access`; anyone else
//    gets, word for word but for the id, the answer of an id the log never
//    held. A member told of a closed item is told no instant of it, and no
//    answer names a grant. No answer appends an event.
// Coverage guards require every stage, refusals and answers.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../src/actor.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import { type ReadStage, readOutcomes } from "../../src/plane/explain-absent.ts";
import { accessTime } from "../../src/plane/read.ts";
import { readCounts } from "../../src/plane/read-reason.ts";
import { type Actor, createPlane, type Plane, type PlaneDeps } from "../../src/plane.ts";
import { evaluateRead, readableScope } from "../../src/policy/evaluate.ts";
import { loadPreset } from "../../src/policy/load.ts";
import { itemExpiry } from "../../src/policy/retention.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { Workload } from "../../src/simulate.ts";
import {
  arbGatedItemWithTtl,
  arbGatedItemWithValidTo,
  arbInstant,
  arbPolicyWithTtls,
  arbScope,
  SCOPE_LEVELS,
  seedFor,
} from "../generators.ts";

const REPO = join(import.meta.dirname, "../../../..");
const UNKNOWN = "01960000-0000-7000-8000-000000000999";
const RUNS = 150;

type Counted = Record<ReadStage, number>;
const zero = (): Counted => ({
  reach: 0,
  match: 0,
  status: 0,
  ttl: 0,
  access: 0,
  validity: 0,
  "rank-cut": 0,
  returned: 0,
});

/** Every stage seen, and how answers went, over a whole test: the coverage guards read it. */
interface Seen {
  stages: Counted;
  answered: Counted;
  refused: number;
}
const seenOf = (): Seen => ({ stages: zero(), answered: zero(), refused: 0 });

/**
 * The two properties for one read by `actor` with `text` at `at` on `plane`:
 * the outcomes and every answer just before it, then the read itself.
 */
async function checkRead(
  deps: PlaneDeps,
  plane: Plane,
  actor: Actor,
  query: { text?: string; at: string; valid_at?: string },
  seen: Seen,
) {
  const when = accessTime(deps.db, query.at);
  const validAt = query.valid_at ?? query.at;
  const outcomes = await readOutcomes(deps, actor, query, when, validAt);
  const before = plane.events().length;
  const none = await plane.explainAbsent(actor, UNKNOWN, query);
  expect(none.answered).toBe(false);
  const answers = new Map<string, Awaited<ReturnType<Plane["explainAbsent"]>>>();
  const projected = new Map(currentItems(deps.db).map((i) => [i.id, i]));
  for (const id of outcomes.keys()) answers.set(id, await plane.explainAbsent(actor, id, query));
  expect(plane.events().length, "explainAbsent appends no event").toBe(before);

  const r = await plane.read(actor, query);
  const counts = readCounts(r.event);
  if (counts === null) throw new Error(`unparsed read reason: ${r.event.reason}`);
  const n = zero();
  for (const o of outcomes.values()) n[o.stage]++;
  for (const [k, v] of Object.entries(n)) seen.stages[k as ReadStage] += v;
  // Property 1: the outcomes count what the read's event records.
  expect({
    returned: n.returned,
    candidates: outcomes.size - n.reach - n.match,
    not_active: n.status,
    expired: n.ttl,
    excluded: n.access,
    outside_validity: n.validity,
    cut: counts.cut === undefined ? undefined : n["rank-cut"],
    out_of_reach: n.reach,
  }).toEqual({
    returned: counts.returned,
    candidates: counts.candidates,
    not_active: counts.not_active,
    expired: counts.expired,
    excluded: counts.excluded,
    outside_validity: counts.outside_validity,
    cut: counts.cut,
    out_of_reach: counts.out_of_reach,
  });
  if (counts.cut === undefined) expect(n["rank-cut"]).toBe(0);
  const returned = [...outcomes].filter(([, o]) => o.stage === "returned").map(([id]) => id);
  expect(returned.sort()).toEqual(r.items.map((i) => i.id).sort());

  // Property 2: answered exactly as ADR 0047's by-id rule allows, else as the unknown id.
  for (const [id, answer] of answers) {
    const outcome = outcomes.get(id);
    // The projection's item, as the read judged it.
    const item = projected.get(id) as MemoryItem;
    const entitled =
      readableScope(deps.policy, actor, item.scope) ||
      evaluateRead(deps.policy, actor, item, when, validAt).admitted;
    if (!entitled) {
      seen.refused++;
      expect(answer).toEqual({
        ...none,
        item_id: id,
        reason: none.reason.replaceAll(UNKNOWN, id),
      });
      continue;
    }
    expect(answer.answered).toBe(true);
    expect(outcome?.stage).not.toBe("reach");
    expect(outcome?.stage).not.toBe("access");
    seen.answered[outcome?.stage as ReadStage]++;
    if (outcome?.stage === "returned") {
      expect(answer.absent).toBe(false);
      expect(answer.stage).toBeNull();
    } else {
      expect(answer.absent).toBe(true);
      expect(answer.stage).toBe(outcome?.stage);
    }
    expect(answer.policy_id).toBe(outcome?.policy_id);
    // No instant of the item, no grant, no owner but the asker's own.
    const shown = JSON.stringify(answer);
    const expiry = itemExpiry(deps.policy, item)?.at;
    for (const instant of [item.valid_from, item.valid_to, expiry])
      if (instant && instant !== answer.at && instant !== answer.valid_at)
        expect(shown).not.toContain(instant);
    for (const g of item.grants) if (g.to !== actor.id) expect(shown).not.toContain(g.to);
    if (item.owner !== actor.id) expect(shown).not.toContain(item.owner);
  }
  return r;
}

const WORKLOADS = readdirSync(join(REPO, "fixtures/workloads"))
  .filter((f) => f.endsWith(".json"))
  .sort();
const RETRIEVALS: (PlaneDeps["retrieval"] | undefined)[] = [
  undefined,
  { pipeline: "core", limit: 1 },
];

describe("why not this item, on the simulator's fixtures", () => {
  const seen = seenOf();
  for (const file of WORKLOADS)
    for (const preset of ["strict", "medium", "permissive"] as const)
      for (const retrieval of RETRIEVALS)
        test(`${file} under ${preset}, ${retrieval ? "core pipeline, limit 1" : "store search"}`, async () => {
          const workload = Workload.parse(
            JSON.parse(readFileSync(join(REPO, "fixtures/workloads", file), "utf8")),
          );
          const db = openSqlite(":memory:");
          migrate(db);
          try {
            let n = 0;
            const newId = () => `01970000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
            const deps: PlaneDeps = {
              db,
              adapter: createFakeAdapter(),
              policy: loadPreset(preset),
              newId,
              ...(retrieval ? { retrieval } : {}),
            };
            const plane = createPlane(deps);
            const actors = Object.values(workload.actors) as Actor[];
            const outsider: Actor = {
              id: "person:outsider",
              level: "person",
              memberships: ["person:outsider"],
            };
            for (const step of workload.steps) {
              const as = workload.actors[step.as] as Actor;
              if (step.op === "write") await plane.write(as, step.item as MemoryItem, step.at);
              else if (step.op === "retain") await plane.retain(as, step.scope, step.at);
              else if (step.op === "promote")
                await plane.promote(as, step.item_id, step.to_scope, step.at);
              else if (step.op === "read")
                // Every actor of the workload, and one outside it, asks before the read is made.
                for (const actor of [as, ...actors, outsider])
                  await checkRead(deps, plane, actor, { text: step.text, at: step.at }, seen);
            }
            // The same reads with no text, and a historical validity time, at the end.
            const last = workload.steps.at(-1)?.at as string;
            for (const actor of [...actors, outsider]) {
              await checkRead(deps, plane, actor, { at: last }, seen);
              await checkRead(
                deps,
                plane,
                actor,
                { at: last, valid_at: "2026-01-01T00:00:00.000Z" },
                seen,
              );
            }
          } finally {
            db.close();
          }
        });
  test("the fixtures reach the match, status, ttl and returned stages, answered, and refusals", () => {
    for (const stage of ["match", "returned", "reach"] as const)
      expect(seen.stages[stage], stage).toBeGreaterThan(0);
    for (const stage of ["match", "validity", "returned", "rank-cut"] as const)
      expect(seen.answered[stage], `answered ${stage}`).toBeGreaterThan(0);
    expect(seen.refused).toBeGreaterThan(0);
  });
});

/** Some words, so queries match some items and not others. */
const WORDS = ["deploy", "key", "tea", "freeze"] as const;

const arbItemCase = fc
  .tuple(
    fc.oneof(arbGatedItemWithValidTo, arbGatedItemWithTtl),
    fc.oneof(
      { arbitrary: fc.constant("active" as const), weight: 4 },
      { arbitrary: fc.constantFrom("candidate" as const, "retired" as const), weight: 1 },
    ),
    fc.boolean(),
    fc.subarray([...WORDS], { minLength: 1 }),
  )
  .map(([item, status, ownClass, words]) => ({
    ...item,
    status,
    content:
      item.class === "procedural"
        ? { body: `steps on ${words.join(" ")}`, tools: [] }
        : `a note on ${words.join(" ")}`,
    grants: item.grants.map((g, i) => (ownClass && i === 0 ? { ...g, class: item.class } : g)),
  }));

const IDS = ["person:omar", "person:sara", "agent:pi", "agent:claude-code", "person:zed"] as const;

describe("why not this item, on generated reads", () => {
  const NAME = "the named stage is what the read did, and forbidden and missing answer alike";
  test(NAME, async () => {
    const seen = seenOf();
    await fc.assert(
      fc.asyncProperty(
        arbPolicyWithTtls,
        fc.array(arbItemCase, { minLength: 1, maxLength: 4 }),
        fc.array(
          fc.record({
            id: fc.constantFrom(...IDS),
            level: fc.constantFrom(...SCOPE_LEVELS),
            memberships: fc.uniqueArray(arbScope, { maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        arbInstant,
        fc.option(arbInstant, { nil: undefined }),
        fc.option(fc.constantFrom(...WORDS, "deploy key", "nothing"), { nil: undefined }),
        fc.constantFrom(...RETRIEVALS, { pipeline: "core" as const }),
        async (policy: Policy, drawn, askers, at, validAt, text, retrieval) => {
          const items = drawn.map((item, n) => ({
            ...item,
            id: `01960000-0000-7000-8000-${String(n + 1).padStart(12, "0")}`,
          })) as MemoryItem[];
          // The first asker owns the first item and is a member of its scope.
          const own = items[0] as MemoryItem;
          const actors: Actor[] = askers.map((a, k) =>
            k === 0
              ? { ...a, id: own.owner, memberships: [...new Set([...a.memberships, own.scope])] }
              : a,
          );
          const db = openSqlite(":memory:");
          migrate(db);
          try {
            let n = 100;
            const newId = () => `01960000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
            const adapter = createFakeAdapter();
            const deps: PlaneDeps = {
              db,
              adapter,
              policy,
              newId,
              ...(retrieval ? { retrieval } : {}),
            };
            const plane = createPlane(deps);
            for (const item of items) {
              await adapter.write(item);
              appendEvent(db, {
                id: newId(),
                ts: "2026-01-01T00:00:00Z",
                op: "write",
                item_id: item.id,
                actor: item.owner,
                scope_from: null,
                scope_to: item.scope,
                decision: "allow",
                reason: "seeded",
                policy_id: "seed",
                item,
                schema_version: 1,
              });
            }
            for (const actor of actors)
              await checkRead(
                deps,
                plane,
                actor,
                {
                  at,
                  ...(text === undefined ? {} : { text }),
                  ...(validAt ? { valid_at: validAt } : {}),
                },
                seen,
              );
          } finally {
            db.close();
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(NAME) },
    );
    const stages = ["reach", "match", "status", "ttl", "access", "validity", "returned"] as const;
    for (const s of stages) expect(seen.stages[s], `stage ${s}`).toBeGreaterThan(0);
    for (const s of ["match", "status", "ttl", "validity", "returned"] as const)
      expect(seen.answered[s], `answered ${s}`).toBeGreaterThan(0);
    expect(seen.refused).toBeGreaterThan(0);
  });

  test("an invalid actor, time or id is refused before the log is touched", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: loadPreset("medium"),
      newId: () => UNKNOWN,
    });
    const actor: Actor = { id: "person:a", level: "person", memberships: ["person:a"] };
    const at = "2026-10-01T00:00:00.000Z";
    await expect(plane.explainAbsent(actor, "not-an-id", { at })).rejects.toThrow(InvalidCallError);
    await expect(plane.explainAbsent(actor, UNKNOWN, { at: "yesterday" })).rejects.toThrow(
      InvalidCallError,
    );
    await expect(plane.explainAbsent(actor, UNKNOWN, { at, valid_at: "later" })).rejects.toThrow(
      InvalidCallError,
    );
    await expect(
      plane.explainAbsent({ id: "" } as unknown as Actor, UNKNOWN, { at }),
    ).rejects.toThrow(InvalidCallError);
    expect(plane.events()).toEqual([]);
    db.close();
  });
});
