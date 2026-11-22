// Card L6, review item L6-9: a plan proposes at most one close. Two
// candidates that would both be closed both start before the new item and
// overlap it, so both cover the instant just before it starts and overlap
// each other; the clash rule then sends the earlier one (or both, starting
// together) to review. So a call can never accept two closes, and the
// route's stop on a store refusal is reached with at most one write behind
// it; the write loop is tested with two closes on its own
// (packages/server/test/supersede.test.ts).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { proposeSupersession, type SupersessionCandidate } from "../../src/lint/supersession.ts";
import { seedFor } from "../generators.ts";

const ONE = "a plan proposes at most one close";

/** Instant n: n days after 2026-01-01. */
const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().replace(".000Z", "Z");
const uuid = (n: number) => `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`;

const arbWindow = fc
  .tuple(fc.integer({ min: 0, max: 60 }), fc.option(fc.integer({ min: 0, max: 60 })))
  .map(([from, length]) => ({
    valid_from: t(from),
    valid_to: length === null ? null : t(from + length),
  }));

const arbCandidate = (n: number) =>
  fc
    .tuple(arbWindow, fc.constantFrom("active", "active", "candidate", "retired"))
    .map(
      ([w, status]): SupersessionCandidate =>
        ({ id: uuid(n), status, ...w }) as SupersessionCandidate,
    );

describe("the supersession proposal (card L6, L6-9)", () => {
  test(ONE, () => {
    fc.assert(
      fc.property(
        arbWindow,
        fc
          .integer({ min: 0, max: 10 })
          .chain((k) => fc.tuple(...Array.from({ length: k }, (_, i) => arbCandidate(i + 1)))),
        (w, candidates) => {
          const next = { id: uuid(99), status: "active", ...w } as SupersessionCandidate;
          const closes = proposeSupersession(next, candidates).filter((p) => p.action === "close");
          expect(closes.length).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 5000, seed: seedFor(ONE) },
    );
  });
});
