// The read event's reason round-trips (plan docs/tasks/gate-b-plan.md,
// decision 5; card E8.6): the counts the read path writes into the reason are
// exactly what readCounts parses back, for any counts, so no surface parses
// the reason by hand. And the reason a real read records parses to the counts
// that read returned.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  formatReadReason,
  parseReadReason,
  type ReadCounts,
  readCounts,
} from "../../src/plane/read-reason.ts";
import type { Actor } from "../../src/plane.ts";
import { seedFor } from "../generators.ts";
import { AT, fresh, id, item } from "../unit/plane/helpers.ts";

const RUNS = 1000;
const count = fc.nat({ max: 100_000 });

const arbCounts: fc.Arbitrary<ReadCounts> = fc
  .record({
    returned: count,
    candidates: count,
    outside_validity: count,
    not_active: count,
    expired: count,
    excluded: count,
    out_of_reach: count,
  })
  .map((c) => ({ ...c, filtered: c.outside_validity + c.not_active + c.expired + c.excluded }));

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
});
