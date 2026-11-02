// The read event's reason round-trips (plan docs/tasks/gate-b-plan.md,
// decision 5; card E8.6): the counts the read path writes into the reason are
// exactly what readCounts parses back, for any counts, so no surface parses
// the reason by hand. And the reason a real read records parses to the counts
// that read returned. A plane built with the core retrieval pipeline and a
// read limit also records how many admitted items the limit cut (PR #25
// review round 3, V-6); a reason without that clause still parses, to counts
// without `cut`.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  formatReadReason,
  parseReadReason,
  type ReadCounts,
  readCounts,
} from "../../src/plane/read-reason.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import { seedFor } from "../generators.ts";
import { AT, fresh, id, item } from "../unit/plane/helpers.ts";

const RUNS = 1000;
// Any safe integer; a filtered category at most a quarter of the largest, so
// the filtered total, their sum, is a safe integer too.
const count = fc.maxSafeNat();
const QUARTER = Math.floor(Number.MAX_SAFE_INTEGER / 4);
const category = fc.nat({ max: QUARTER });

const arbCounts: fc.Arbitrary<ReadCounts> = fc
  .record({
    returned: count,
    candidates: count,
    outside_validity: category,
    not_active: category,
    expired: category,
    excluded: category,
    out_of_reach: count,
  })
  .chain((c) =>
    fc.option(count, { nil: undefined }).map((cut) => ({
      ...c,
      filtered: c.outside_validity + c.not_active + c.expired + c.excluded,
      ...(cut === undefined ? {} : { cut }),
    })),
  );

describe("the read reason", () => {
  const roundTrip = "parses back to exactly the counts it was written from";
  test(roundTrip, () => {
    fc.assert(
      fc.property(arbCounts, (counts) => {
        expect(parseReadReason(formatReadReason(counts))).toEqual(counts);
      }),
      { numRuns: RUNS, seed: seedFor(roundTrip) },
    );
  });

  test("round-trips all zeros and the largest counts", () => {
    const zero = {
      returned: 0,
      candidates: 0,
      filtered: 0,
      outside_validity: 0,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 0,
    };
    const large = {
      returned: Number.MAX_SAFE_INTEGER,
      candidates: Number.MAX_SAFE_INTEGER,
      filtered: 4 * QUARTER,
      outside_validity: QUARTER,
      not_active: QUARTER,
      expired: QUARTER,
      excluded: QUARTER,
      out_of_reach: Number.MAX_SAFE_INTEGER,
    };
    for (const counts of [zero, large])
      expect(parseReadReason(formatReadReason(counts))).toEqual(counts);
  });

  const distinct = "distinct counts give distinct reasons";
  test(distinct, () => {
    fc.assert(
      fc.property(arbCounts, arbCounts, (a, b) => {
        fc.pre(JSON.stringify(a) !== JSON.stringify(b));
        expect(formatReadReason(a)).not.toBe(formatReadReason(b));
      }),
      { numRuns: RUNS, seed: seedFor(distinct) },
    );
  });

  test("names one item and several items in the reach clause", () => {
    const base = { returned: 0, candidates: 0, filtered: 0, outside_validity: 0 };
    const rest = { not_active: 0, expired: 0, excluded: 0 };
    expect(formatReadReason({ ...base, ...rest, out_of_reach: 1 })).toMatch(/1 projected item /);
    expect(formatReadReason({ ...base, ...rest, out_of_reach: 2 })).toMatch(/2 projected items /);
  });

  test("returns null for a reason it did not write", () => {
    expect(parseReadReason("")).toBeNull();
    expect(parseReadReason("returned 1 of 2 candidates")).toBeNull();
    const ok = formatReadReason({
      returned: 1,
      candidates: 2,
      filtered: 1,
      outside_validity: 1,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 0,
    });
    expect(parseReadReason(`${ok}.`)).toBeNull();
    expect(parseReadReason(` ${ok}`)).toBeNull();
    // A filtered total that is not the sum of its categories was not written by the plane.
    expect(parseReadReason(ok.replace("; 1 filtered", "; 2 filtered"))).toBeNull();
  });

  test("readCounts reads a read event only", () => {
    const reason = formatReadReason({
      returned: 0,
      candidates: 0,
      filtered: 0,
      outside_validity: 0,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 0,
    });
    expect(readCounts({ op: "read", reason })).not.toBeNull();
    expect(readCounts({ op: "write", reason })).toBeNull();
  });

  test("a real read's event parses to the counts that read returned", async () => {
    const owner: Actor = {
      id: "person:omar",
      level: "person",
      memberships: ["person:omar", "team:platform", "team:payments"],
    };
    const reader: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };
    const { plane } = fresh();
    const seed = [
      item(1, { scope: "team:platform" }),
      item(2, { scope: "team:platform", valid_to: "2026-10-20T00:00:00Z" }),
      item(3, { scope: "team:platform", valid_from: "2026-11-01T00:00:00Z" }),
      item(4, { scope: "team:payments" }),
    ];
    for (const it of seed) expect((await plane.write(owner, it, AT)).event.decision).toBe("allow");
    const result = await plane.read(reader, { at: AT });
    expect(readCounts(result.event)).toEqual({
      returned: 1,
      candidates: 3,
      filtered: 2,
      outside_validity: 2,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 1,
    });
    expect(readCounts(result.event)?.filtered).toBe(result.filtered);
    expect(result.items.map((i) => i.id)).toEqual([id(1)]);
  });

  test("a reason with the read limit's cut, and one without it, both parse", () => {
    const base: ReadCounts = {
      returned: 20,
      candidates: 115,
      filtered: 0,
      outside_validity: 0,
      not_active: 0,
      expired: 0,
      excluded: 0,
      out_of_reach: 3,
    };
    const cutReason = formatReadReason({ ...base, cut: 95 });
    expect(cutReason).toBe(
      "returned 20 of 115 candidates; 0 filtered (0 outside the validity window, 0 not active, 0 past their ttl, 0 by a grant's class or expiry); 95 cut by the read limit; 3 projected items outside the reader's reach were not candidates",
    );
    expect(parseReadReason(cutReason)).toEqual({ ...base, cut: 95 });
    expect(formatReadReason(base)).not.toContain("cut by the read limit");
    expect(parseReadReason(formatReadReason(base))).toEqual(base);
    expect(parseReadReason(cutReason.replace("95 cut", "95  cut"))).toBeNull();
  });

  test("a core-pipeline read with a limit records what the limit cut; one without a limit does not", async () => {
    const owner: Actor = {
      id: "person:omar",
      level: "person",
      memberships: ["person:omar", "team:platform"],
    };
    const reader: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };
    const env = fresh();
    const seed = [1, 2, 3, 4, 5].map((n) =>
      item(n, { scope: "team:platform", content: `deploys ${n}` }),
    );
    seed.push(
      item(6, { scope: "team:platform", content: "deploys", valid_to: "2026-10-20T00:00:00Z" }),
    );
    for (const it of seed) {
      expect((await env.plane.write(owner, it, AT)).event.decision).toBe("allow");
    }
    let n = 0;
    const planeWith = (limit?: number) =>
      createPlane({
        db: env.db,
        adapter: env.adapter,
        policy: env.policy,
        newId: () => id(600_000 + ++n),
        retrieval: { pipeline: "core", ...(limit === undefined ? {} : { limit }) },
      });
    const capped = await planeWith(2).read(reader, { text: "deploys", at: AT });
    expect(capped.items).toHaveLength(2);
    expect(readCounts(capped.event)).toEqual({
      returned: 2,
      candidates: 6,
      filtered: 1,
      outside_validity: 1,
      not_active: 0,
      expired: 0,
      excluded: 0,
      cut: 3,
      out_of_reach: 0,
    });
    const open = await planeWith().read(reader, { text: "deploys", at: AT });
    expect(open.items).toHaveLength(5);
    expect(readCounts(open.event)).not.toHaveProperty("cut");
    expect(open.event.reason).not.toContain("cut by the read limit");
  });
});
