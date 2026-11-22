// Allen's interval relations over validity windows (card L6). Ported from
// gaptime (https://github.com/davccavalcante/gaptime, commit
// 9835236c1d6d571a724213c958b62c157285b26c, src/temporal/intervals.ts,
// Apache-2.0, copyright 2026 David C Cavalcante / Takk Innovate Studio): the
// thirteen relations, their canonical order, the endpoint comparison that
// classifies a pair, and the half-open overlap test, with its unit tests
// (packages/core/test/unit/lint/intervals.test.ts). Rewritten here over the
// contract's timestamp strings instead of epoch milliseconds, compared at
// full precision through `compareTimestamps` (ADR 0005, decision D7), with
// an open end (`valid_to` null) as positive infinity.
//
// Two divergences from gaptime. A window that is empty or inverted
// (`valid_from` not before `valid_to`) is not thrown on: `wellFormed` says
// so, and `overlaps` is false for it, since a window covering no time
// overlaps nothing (gaptime's overlap test would call [5, 5) inside [0, 10)
// overlapping). And `allenRelation` is defined only for well-formed windows;
// its callers check first.
import { compareTimestamps } from "../time.ts";

/** The thirteen mutually exclusive, jointly exhaustive relations, read "a <relation> b". */
export const ALLEN_RELATIONS = [
  "before",
  "after",
  "meets",
  "metBy",
  "overlaps",
  "overlappedBy",
  "starts",
  "startedBy",
  "during",
  "contains",
  "finishes",
  "finishedBy",
  "equals",
] as const;
export type AllenRelation = (typeof ALLEN_RELATIONS)[number];

/** A half-open validity window [from, to): `to` null is an open end, after every instant. */
export interface ValidityWindow {
  readonly from: string;
  readonly to: string | null;
}

/** An item's validity window. */
export const windowOf = (item: {
  valid_from: string;
  valid_to: string | null;
}): ValidityWindow => ({
  from: item.valid_from,
  to: item.valid_to,
});

/** Compares two ends, an open end (null) after every instant and equal to another open end. */
export function compareEnds(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return compareTimestamps(a, b);
}

/** Compares an instant with an end: negative, zero or positive as `at` is before, at or after it. */
const compareToEnd = (at: string, end: string | null) =>
  end === null ? -1 : compareTimestamps(at, end);

/** The window covers some time: its start is before its end (always, for an open end). */
export function wellFormed(w: ValidityWindow): boolean {
  return compareToEnd(w.from, w.to) < 0;
}

/**
 * How window `a` relates to window `b`. Half-open: when `a` ends exactly
 * where `b` starts the relation is `meets`, and the two do not overlap.
 * Defined for well-formed windows only (`wellFormed`).
 */
export function allenRelation(a: ValidityWindow, b: ValidityWindow): AllenRelation {
  if (compareToEnd(b.from, a.to) > 0) return "before";
  if (compareToEnd(a.from, b.to) > 0) return "after";
  if (compareToEnd(b.from, a.to) === 0) return "meets";
  if (compareToEnd(a.from, b.to) === 0) return "metBy";

  const starts = compareTimestamps(a.from, b.from);
  const ends = compareEnds(a.to, b.to);
  if (starts === 0 && ends === 0) return "equals";
  if (starts === 0) return ends < 0 ? "starts" : "startedBy";
  if (ends === 0) return starts > 0 ? "finishes" : "finishedBy";
  if (starts > 0 && ends < 0) return "during";
  if (starts < 0 && ends > 0) return "contains";
  if (starts < 0) return "overlaps";
  return "overlappedBy";
}

/**
 * `a` and `b` share some stretch of time: each starts before the other ends.
 * The relations overlaps, overlappedBy, starts, startedBy, during, contains,
 * finishes, finishedBy and equals; never meets, metBy, before or after, and
 * never a window that is not well-formed.
 */
export function overlaps(a: ValidityWindow, b: ValidityWindow): boolean {
  return (
    wellFormed(a) &&
    wellFormed(b) &&
    compareToEnd(a.from, b.to) < 0 &&
    compareToEnd(b.from, a.to) < 0
  );
}

/** The instant `at` is inside the window: from <= at < to. */
export function windowContains(w: ValidityWindow, at: string): boolean {
  return compareTimestamps(w.from, at) <= 0 && compareToEnd(at, w.to) < 0;
}
