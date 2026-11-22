// Allen's interval relations over validity windows (card L6). The cases are
// gaptime's own (tests/unit/intervals.test.ts at commit
// 9835236c1d6d571a724213c958b62c157285b26c, Apache-2.0), ported to timestamp
// strings: instant n is n days after 2026-01-01. Its assertValidInterval
// tests become wellFormed tests, since a malformed window is reported here,
// not thrown on; the cases after them are this port's own.
import { describe, expect, it } from "vitest";
import {
  ALLEN_RELATIONS,
  allenRelation,
  compareEnds,
  overlaps,
  type ValidityWindow,
  wellFormed,
  windowContains,
} from "../../../src/lint/intervals.ts";

/** Instant n: n days after 2026-01-01, as a contract timestamp. */
const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().replace(".000Z", "Z");
const w = (from: number, to: number | null): ValidityWindow => ({
  from: t(from),
  to: to === null ? null : t(to),
});

describe("compareEnds", () => {
  it("puts an open end after every instant and level with another open end", () => {
    expect(compareEnds(null, t(10))).toBeGreaterThan(0);
    expect(compareEnds(t(10), null)).toBeLessThan(0);
    expect(compareEnds(null, null)).toBe(0);
    expect(compareEnds(t(0), t(0))).toBe(0);
  });
});

describe("wellFormed", () => {
  it("accepts a start before a finite end", () => {
    expect(wellFormed(w(1, 2))).toBe(true);
  });

  it("accepts an open end", () => {
    expect(wellFormed(w(1, null))).toBe(true);
  });

  it("rejects a start equal to the end (zero length)", () => {
    expect(wellFormed(w(5, 5))).toBe(false);
  });

  it("rejects an inverted window", () => {
    expect(wellFormed(w(9, 3))).toBe(false);
  });
});

describe("allenRelation", () => {
  it("classifies all thirteen relations correctly", () => {
    expect(allenRelation(w(0, 1), w(2, 3))).toBe("before");
    expect(allenRelation(w(2, 3), w(0, 1))).toBe("after");
    expect(allenRelation(w(0, 2), w(2, 4))).toBe("meets");
    expect(allenRelation(w(2, 4), w(0, 2))).toBe("metBy");
    expect(allenRelation(w(0, 3), w(2, 5))).toBe("overlaps");
    expect(allenRelation(w(2, 5), w(0, 3))).toBe("overlappedBy");
    expect(allenRelation(w(0, 2), w(0, 4))).toBe("starts");
    expect(allenRelation(w(0, 4), w(0, 2))).toBe("startedBy");
    expect(allenRelation(w(1, 2), w(0, 4))).toBe("during");
    expect(allenRelation(w(0, 4), w(1, 2))).toBe("contains");
    expect(allenRelation(w(2, 4), w(0, 4))).toBe("finishes");
    expect(allenRelation(w(0, 4), w(2, 4))).toBe("finishedBy");
    expect(allenRelation(w(0, 4), w(0, 4))).toBe("equals");
  });

  it("treats two open-ended windows starting apart as finishedBy / finishes", () => {
    expect(allenRelation(w(0, null), w(5, null))).toBe("finishedBy");
    expect(allenRelation(w(5, null), w(0, null))).toBe("finishes");
  });

  it("returns equals for two identical open windows", () => {
    expect(allenRelation(w(3, null), w(3, null))).toBe("equals");
  });

  it("only ever returns members of the canonical relation list", () => {
    const samples: Array<[number, number | null, number, number | null]> = [
      [0, 1, 2, 3],
      [0, null, 5, null],
      [1, 4, 1, 4],
      [0, 10, 3, 6],
    ];
    for (const [af, at, bf, bt] of samples) {
      expect(ALLEN_RELATIONS).toContain(allenRelation(w(af, at), w(bf, bt)));
    }
    expect(ALLEN_RELATIONS).toHaveLength(13);
    expect(new Set(ALLEN_RELATIONS).size).toBe(13);
  });

  it("compares below the millisecond, as the contract's timestamps are compared", () => {
    const a = { from: "2026-01-01T00:00:00.0001Z", to: "2026-01-01T00:00:00.0005Z" };
    const b = { from: "2026-01-01T00:00:00.0005Z", to: null };
    expect(allenRelation(a, b)).toBe("meets");
    expect(overlaps(a, b)).toBe(false);
  });
});

describe("overlaps", () => {
  it("is true for genuinely overlapping windows", () => {
    expect(overlaps(w(0, 3), w(2, 5))).toBe(true);
    expect(overlaps(w(1, 2), w(0, 4))).toBe(true);
    expect(overlaps(w(0, 4), w(0, 4))).toBe(true);
  });

  it("is false for touching half-open windows (meets)", () => {
    expect(overlaps(w(0, 2), w(2, 4))).toBe(false);
  });

  it("is false for disjoint windows", () => {
    expect(overlaps(w(0, 1), w(2, 3))).toBe(false);
  });

  it("handles open ends as positive infinity", () => {
    expect(overlaps(w(0, null), w(100, null))).toBe(true);
    expect(overlaps(w(0, 50), w(100, null))).toBe(false);
  });

  it("is false for a window covering no time, unlike gaptime's", () => {
    expect(overlaps(w(5, 5), w(0, 10))).toBe(false);
    expect(overlaps(w(0, 10), w(7, 3))).toBe(false);
  });
});

describe("windowContains", () => {
  it("includes the start and excludes the end (half-open)", () => {
    expect(windowContains(w(0, 10), t(0))).toBe(true);
    expect(windowContains(w(0, 10), t(9))).toBe(true);
    expect(windowContains(w(0, 10), t(10))).toBe(false);
    expect(windowContains(w(0, 10), t(-1))).toBe(false);
  });

  it("treats an open end as unbounded", () => {
    expect(windowContains(w(0, null), t(1000))).toBe(true);
  });
});
