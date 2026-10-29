// The read event's reason, written and parsed in one place (plan
// docs/tasks/gate-b-plan.md, decision 5; ADR 0027, decision 7). The read path
// (read.ts) writes its counts into the event's reason with formatReadReason;
// a surface that shows them (the inspector's explain view, card E8.6) gets
// them back with readCounts, so no surface parses the reason by hand. A
// property test round-trips every count through both.
//
// The categories: of the candidates (items in the reader's reach that match
// the query), `returned` were admitted; `filtered` were removed by the read
// filter, the sum of `outside_validity` (the validity window at the read
// time), `not_active` (a status other than active), `expired` (past their
// ttl before any sweep) and `excluded` (reached through a grant whose class
// or expiry fails); `out_of_reach` projected items were outside the reader's
// reach and never candidates (decision D5: the reader is not told this
// number, the event is).
import { z } from "zod";
import type { MemoryEvent } from "../schema.ts";

const count = z.int().nonnegative();

/** The counts a read event's reason carries (see the module comment). */
export const ReadCounts = z
  .strictObject({
    returned: count,
    candidates: count,
    filtered: count,
    outside_validity: count,
    not_active: count,
    expired: count,
    excluded: count,
    out_of_reach: count,
  })
  .meta({
    description:
      "The counts a read event's reason records: returned of candidates, the filtered total and its categories, and the projected items outside the reader's reach (never candidates).",
  });
export type ReadCounts = z.infer<typeof ReadCounts>;

/** The reason a read event carries for `counts`; `filtered` is the sum of its four categories. */
export function formatReadReason(counts: ReadCounts): string {
  const c = counts;
  return (
    `returned ${c.returned} of ${c.candidates} candidates; ${c.filtered} filtered ` +
    `(${c.outside_validity} outside the validity window, ${c.not_active} not active, ` +
    `${c.expired} past their ttl, ` +
    `${c.excluded} by a grant's class or expiry); ` +
    `${c.out_of_reach} projected ${c.out_of_reach === 1 ? "item" : "items"} outside the reader's reach ` +
    "were not candidates"
  );
}

const REASON =
  /^returned (\d+) of (\d+) candidates; (\d+) filtered \((\d+) outside the validity window, (\d+) not active, (\d+) past their ttl, (\d+) by a grant's class or expiry\); (\d+) projected (item|items) outside the reader's reach were not candidates$/;

/**
 * The counts in a reason formatReadReason wrote, or null for any other text
 * (an older read event, or one whose filtered total is not its categories' sum).
 */
export function parseReadReason(reason: string): ReadCounts | null {
  const m = REASON.exec(reason);
  if (m === null) return null;
  const [returned, candidates, filtered, outside_validity, not_active, expired, excluded, out] = m
    .slice(1, 9)
    .map(Number) as [number, number, number, number, number, number, number, number];
  const counts: ReadCounts = {
    returned,
    candidates,
    filtered,
    outside_validity,
    not_active,
    expired,
    excluded,
    out_of_reach: out,
  };
  if (filtered !== outside_validity + not_active + expired + excluded) return null;
  if (m[9] !== (out === 1 ? "item" : "items")) return null;
  return counts;
}

/** The counts of a read event; null for any other event or a reason the plane did not write. */
export function readCounts(event: Pick<MemoryEvent, "op" | "reason">): ReadCounts | null {
  return event.op === "read" ? parseReadReason(event.reason) : null;
}
