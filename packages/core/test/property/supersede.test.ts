// Card L6's acceptance: the supersession head resolver terminates on every
// generated lineage, and applying every proposal never leaves two active
// items of one key (one supersession chain) with overlapping validity
// unless the helper flagged one of the two for a person's review.
//
// Three properties. The resolver over arbitrary lineage (cycles, self
// references, dangling ids, forks, chains past 32) always answers, and its
// answer is the forward walk Remnic's contract describes. The proposal over
// arbitrary windows and statuses, its closes applied: every pair of active
// items still overlapping holds a flagged item, every close ends a candidate
// that started earlier at the new item's start, nothing changes status, and
// a rerun proposes no close. And versions arriving in order through the
// real Plane, each closing its predecessors by accepting every close the
// plan proposes, written by Plane.write: no two active versions overlap at
// the end, and nothing was flagged.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems } from "../../src/events.ts";
import { overlaps, windowOf } from "../../src/lint/intervals.ts";
import {
  applyClosures,
  proposeSupersession,
  type SupersessionCandidate,
} from "../../src/lint/supersession.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import type { MemoryItem } from "../../src/schema.ts";
import {
  acceptedClosures,
  MAX_SUPERSESSION_DEPTH,
  planSupersession,
  resolveSupersessionHead,
  type SupersessionLink,
} from "../../src/supersede.ts";
import { compareTimestamps } from "../../src/time.ts";
import { seedFor } from "../generators.ts";
import { testPolicy } from "../unit/plane/helpers.ts";

const RESOLVER = "the resolver terminates on every generated lineage";
const PROPOSALS = "applying every close leaves no unflagged overlap among active items";
const STREAM = "versions arriving in order, each closing its predecessors, never overlap";

/** Instant n: n days after 2026-01-01. */
const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().replace(".000Z", "Z");
const uuid = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

/** The smallest id among the items whose lineage lists `id`: the resolver's successor. */
const successor = (items: readonly SupersessionLink[], id: string) =>
  items
    .filter((i) => i.lineage.includes(id))
    .map((i) => i.id)
    .sort()[0];

const POOL = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Items with distinct ids from POOL, each listing any ids of POOL, itself and absent ones included. */
const arbSmallLineage = fc
  .uniqueArray(fc.constantFrom(...POOL), { minLength: 1, maxLength: POOL.length })
  .chain((ids) =>
    fc.tuple(
      fc.constant(ids),
      fc.array(fc.array(fc.constantFrom(...POOL, "gone"), { maxLength: 3 }), {
        minLength: ids.length,
        maxLength: ids.length,
      }),
    ),
  )
  .map(([ids, lineages]) =>
    ids.map((id, i): SupersessionLink => ({ id, lineage: lineages[i] ?? [] })),
  );

/** A chain of up to 80 versions, each naming its parent and maybe a shortcut or a back edge. */
const arbLongLineage = fc
  .integer({ min: 1, max: 80 })
  .chain((n) =>
    fc.array(fc.option(fc.integer({ min: 0, max: n - 1 }), { freq: 4 }), {
      minLength: n,
      maxLength: n,
    }),
  )
  .map((extra) =>
    extra.map((e, i): SupersessionLink => {
      const lineage = i === 0 ? [] : [`v${String(i - 1).padStart(2, "0")}`];
      if (e !== null) lineage.push(`v${String(e).padStart(2, "0")}`);
      return { id: `v${String(i).padStart(2, "0")}`, lineage };
    }),
  );

describe("supersession head resolver (card L6)", () => {
  test(RESOLVER, () => {
    fc.assert(
      fc.property(
        fc.oneof(arbSmallLineage, arbLongLineage),
        fc.nat(),
        fc.option(fc.integer({ min: 1, max: 40 })),
        (items, pick, maxDepth) => {
          const ids = items.map((i) => i.id);
          const startId = [...ids, "missing"][pick % (ids.length + 1)] as string;
          const depth = maxDepth ?? MAX_SUPERSESSION_DEPTH;
          const result = resolveSupersessionHead({
            items,
            startId,
            ...(maxDepth === null ? {} : { maxDepth }),
          });
          // The same answer whatever the order of the items.
          expect(
            resolveSupersessionHead({
              items: [...items].reverse(),
              startId,
              ...(maxDepth === null ? {} : { maxDepth }),
            }),
          ).toEqual(result);
          if (!ids.includes(startId)) {
            expect(result).toEqual({ ok: false, error: "unknown_id", chain: [] });
            return;
          }
          const { chain } = result;
          expect(chain[0]).toBe(startId);
          expect(chain.length).toBeLessThanOrEqual(depth);
          expect(new Set(chain).size).toBe(chain.length);
          for (let i = 0; i + 1 < chain.length; i++)
            expect(chain[i + 1]).toBe(successor(items, chain[i] as string));
          const last = chain[chain.length - 1] as string;
          const next = successor(items, last);
          if (result.ok) {
            expect(result.head_id).toBe(last);
            expect(next).toBeUndefined();
          } else if (result.error === "cycle_detected") {
            expect(chain).toContain(next);
          } else {
            expect(result.error).toBe("depth_exceeded");
            expect(chain.length).toBe(depth);
            expect(next).toBeDefined();
            expect(chain).not.toContain(next);
          }
        },
      ),
      { numRuns: 2000, seed: seedFor(RESOLVER) },
    );
  });
});

/** A window over days 0 to 6, its end open, later, equal or earlier (a window covering no time). */
const arbVersion = (n: number, statuses: SupersessionCandidate["status"][]) =>
  fc
    .record({
      from: fc.integer({ min: 0, max: 6 }),
      to: fc.option(fc.integer({ min: 0, max: 7 }), { freq: 3 }),
      status: fc.constantFrom(...statuses),
    })
    .map(
      ({ from, to, status }): SupersessionCandidate => ({
        id: uuid(n),
        status,
        valid_from: t(from),
        valid_to: to === null ? null : t(to),
      }),
    );

const arbHistory = fc
  .tuple(
    arbVersion(99, ["active", "active", "active", "candidate"]),
    fc
      .integer({ min: 0, max: 6 })
      .chain((k) =>
        fc.tuple(
          ...Array.from({ length: k }, (_, i) =>
            arbVersion(i + 1, ["active", "active", "candidate", "retired"]),
          ),
        ),
      ),
  )
  .map(([next, candidates]) => ({ next, candidates: [...candidates] }));

describe("supersession proposals (card L6)", () => {
  test(PROPOSALS, () => {
    let closes = 0;
    let reviews = 0;
    fc.assert(
      fc.property(arbHistory, ({ next, candidates }) => {
        const proposals = proposeSupersession(next, candidates);
        const flagged = new Set(
          proposals.filter((p) => p.action === "review").map((p) => p.item_id),
        );
        closes += proposals.filter((p) => p.action === "close").length;
        reviews += flagged.size;
        const after = applyClosures(candidates, proposals);
        // Nothing retired, nothing but valid_to changed, and only by a close
        // to the new item's start of a candidate that started before it.
        for (const [i, c] of candidates.entries()) {
          const a = after[i] as SupersessionCandidate;
          expect(a.status).toBe(c.status);
          expect(a.valid_from).toBe(c.valid_from);
          if (a.valid_to !== c.valid_to) {
            expect(a.valid_to).toBe(next.valid_from);
            expect(compareTimestamps(c.valid_from, next.valid_from)).toBeLessThan(0);
          }
        }
        // Every pair of active items still overlapping holds a flagged item.
        const active = [next, ...after].filter((i) => i.status === "active");
        for (const [i, x] of active.entries())
          for (const y of active.slice(i + 1))
            if (overlaps(windowOf(x), windowOf(y)))
              expect(flagged.has(x.id) || flagged.has(y.id)).toBe(true);
        // Applied once, the closes are done: a rerun proposes no close.
        expect(proposeSupersession(next, after).filter((p) => p.action === "close")).toEqual([]);
      }),
      { numRuns: 3000, seed: seedFor(PROPOSALS) },
    );
    // Both outcomes are exercised, not only one.
    expect(closes).toBeGreaterThan(100);
    expect(reviews).toBeGreaterThan(100);
  });

  test("a retired new item proposes nothing", () => {
    fc.assert(
      fc.property(arbHistory, ({ next, candidates }) => {
        expect(proposeSupersession({ ...next, status: "retired" }, candidates)).toEqual([]);
      }),
      { numRuns: 300, seed: seedFor("a retired new item proposes nothing") },
    );
  });
});

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana"],
  source: "user",
};

const version = (n: number, from: number, lineage: string[]): MemoryItem =>
  ({
    id: uuid(n),
    class: "semantic",
    scope: "person:dana",
    owner: dana.id,
    content: `Dana's desk is in room ${n}.`,
    provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: dana.id },
    confidence: 0.9,
    valid_from: t(from),
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage,
    status: "active",
    store_ref: null,
    schema_version: 1,
  }) as MemoryItem;

describe("supersession through the Plane (card L6)", () => {
  test(STREAM, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
        async (gaps, fullLineage) => {
          const db = openSqlite(":memory:");
          migrate(db);
          let n = 0;
          const plane = createPlane({
            db,
            adapter: createFakeAdapter(),
            policy: testPolicy(),
            newId: () => uuid(1000 + ++n),
          });
          const at = t(400);
          let day = 0;
          const ids: string[] = [];
          for (const [i, gap] of [0, ...gaps].entries()) {
            day += gap;
            // Nearest first: the parent alone, or every earlier version.
            const lineage = fullLineage[i] ? [...ids].reverse() : ids.slice(-1);
            const { event } = await plane.write(dana, version(i + 1, day, lineage), at);
            expect(event.decision).toBe("allow");
            ids.push(uuid(i + 1));
            const plan = planSupersession(db, testPolicy(), dana, uuid(i + 1), at);
            expect(plan.head).toEqual({ ok: true, head_id: uuid(i + 1), chain: [uuid(i + 1)] });
            expect(plan.proposals.filter((p) => p.action === "review")).toEqual([]);
            const accept = plan.proposals.map((p) => p.item_id);
            for (const closed of acceptedClosures(db, plan, accept)) {
              const written = await plane.write(dana, closed, at);
              expect(written.event.decision).toBe("allow");
              expect(written.event.op).toBe("write");
            }
          }
          const active = currentItems(db).filter((i) => i.status === "active");
          expect(active).toHaveLength(ids.length);
          for (const [i, x] of active.entries())
            for (const y of active.slice(i + 1))
              expect(overlaps(windowOf(x), windowOf(y))).toBe(false);
          db.close();
        },
      ),
      { numRuns: 40, seed: seedFor(STREAM) },
    );
  });
});
