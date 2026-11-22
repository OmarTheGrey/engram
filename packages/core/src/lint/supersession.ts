// The supersession proposal (card L6): given a new item and its candidate
// predecessors, which older items should get an end date and which need a
// person's review. Pure: no store, no clock, no model; it proposes and never
// applies. An accepted close is applied by a surface as an ordinary governed
// update through Plane.write (supersede.ts, `closedVersion`), so the gate
// decides and an event is logged; nothing here retires anything.
//
// The interval logic is ported from Graphiti (https://github.com/getzep/graphiti,
// commit 9b8a4630092084734b080f2e6f409c2c23bdcc3a,
// graphiti_core/utils/maintenance/edge_operations.py, `_apply_temporal_invalidation`
// and `resolve_edge_contradictions`, Apache-2.0, copyright 2024 Zep Software,
// Inc.): a candidate whose window is disjoint from the new item's is left
// alone, and a candidate that began strictly before the new item is ended at
// the new item's valid_from. Engram departs from it where Graphiti acts on a
// case a person should judge, so each of these is flagged for review instead:
//
//   - a candidate that starts after the new item: Graphiti ends the new item
//     at the candidate's start; Engram never ends the new item by itself;
//   - a candidate that starts at the same instant: the windows do not say
//     which is newer;
//   - a candidate that outlasts a bounded new item (Allen `contains`):
//     Graphiti closes it, which would also end the old fact after the new one
//     stops being true;
//   - a new item that is not active (a candidate held for review): closing
//     its predecessor would leave nothing valid while it waits;
//   - a window that covers no time (valid_to not after valid_from), the new
//     item's or the candidate's;
//   - a candidate whose window overlaps another candidate's that starts at or
//     after it: the history is already contradictory, and closing at the new
//     item's start would not mend it (the later of the two is the one the new
//     item supersedes; both are flagged when they start together).
//
// So a close is proposed exactly for a candidate that starts before the new
// item, overlaps it, ends no later than it (Allen `overlaps` or `finishedBy`,
// an open end counting as the latest), and overlaps no other candidate
// starting at or after it, when both windows cover time and the new item is
// active. Applying every close then leaves no two of these items overlapping
// unless one of the two was flagged (test/property/supersede.test.ts).
import { z } from "zod";
import type { MemoryItem } from "../schema.ts";
import { Timestamp } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import {
  ALLEN_RELATIONS,
  type AllenRelation,
  allenRelation,
  overlaps,
  wellFormed,
  windowOf,
} from "./intervals.ts";

/** What the proposal reads of an item: a MemoryItem has every field. */
export type SupersessionCandidate = Pick<MemoryItem, "id" | "status" | "valid_from" | "valid_to">;

/** One proposal about one candidate (card L6). */
export const SupersessionProposal = z.strictObject({
  /** The candidate the proposal is about. */
  item_id: z.string(),
  /** `close`: set its valid_to to `valid_to`; `review`: a person decides. */
  action: z.enum(["close", "review"]),
  /** The candidate's window relative to the new item's (Allen); null when either covers no time. */
  relation: z.enum(ALLEN_RELATIONS).nullable(),
  /** The proposed end of a close, the new item's valid_from; null for a review. */
  valid_to: Timestamp.nullable(),
  reason: z.string(),
});
export type SupersessionProposal = z.infer<typeof SupersessionProposal>;

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The relations under which closing the candidate at the new item's start is a clean supersession. */
const CLOSES: ReadonlySet<AllenRelation> = new Set(["overlaps", "finishedBy"]);
const SAME_START: ReadonlySet<AllenRelation> = new Set(["starts", "startedBy", "equals"]);

/**
 * The proposals for `next` against `candidates`, one at most per candidate,
 * ordered by item id. A retired candidate, `next` itself and a repeated id
 * get none, nor does a candidate whose window is disjoint from the new
 * item's and from every other candidate's. A retired `next` supersedes
 * nothing (as a retired holder's lineage does not, items.ts), so it gets
 * none at all.
 */
export function proposeSupersession(
  next: SupersessionCandidate,
  candidates: readonly SupersessionCandidate[],
): SupersessionProposal[] {
  if (next.status === "retired") return [];
  const seen = new Set([next.id]);
  const live: SupersessionCandidate[] = [];
  for (const c of [...candidates].sort(byId)) {
    if (seen.has(c.id) || c.status === "retired") continue;
    seen.add(c.id);
    live.push(c);
  }
  const nextWindow = windowOf(next);
  const out: SupersessionProposal[] = [];
  const review = (c: SupersessionCandidate, relation: AllenRelation | null, reason: string) =>
    out.push({ item_id: c.id, action: "review", relation, valid_to: null, reason });

  for (const c of live) {
    const own = windowOf(c);
    if (!wellFormed(own)) {
      review(
        c,
        null,
        `its window [${c.valid_from}, ${c.valid_to}) covers no time, so ${next.id} cannot be said to supersede it`,
      );
      continue;
    }
    if (!wellFormed(nextWindow)) {
      review(
        c,
        null,
        `the window of ${next.id}, [${next.valid_from}, ${next.valid_to}), covers no time, so it supersedes nothing by its dates`,
      );
      continue;
    }
    const relation = allenRelation(own, nextWindow);
    // Another candidate overlapping this one from the same start or later:
    // this one's history is already contradictory (the lowest id named).
    const clash = live.find(
      (o) =>
        o !== c && compareTimestamps(o.valid_from, c.valid_from) >= 0 && overlaps(own, windowOf(o)),
    );
    const clashReason = (o: SupersessionCandidate) =>
      `its window overlaps that of ${o.id}, which starts ${compareTimestamps(o.valid_from, c.valid_from) === 0 ? "at the same instant" : "after it"}, so its history is contradictory before ${next.id} arrives`;
    if (!overlaps(own, nextWindow)) {
      if (clash) review(c, relation, clashReason(clash));
      continue;
    }
    if (next.status !== "active") {
      review(
        c,
        relation,
        `${next.id} is ${next.status}, not active: closing this window would leave nothing valid while it waits`,
      );
    } else if (SAME_START.has(relation)) {
      review(
        c,
        relation,
        `it starts at ${c.valid_from}, as ${next.id} does, so the windows do not say which is newer`,
      );
    } else if (relation === "contains") {
      review(
        c,
        relation,
        `it stays valid after ${next.id} ends at ${next.valid_to}, so closing it at ${next.valid_from} would also end it after ${next.id} stops being true`,
      );
    } else if (!CLOSES.has(relation)) {
      review(
        c,
        relation,
        `it starts after ${next.id}, at ${c.valid_from} against ${next.valid_from}: it may be the newer fact, and the helper never ends ${next.id}`,
      );
    } else if (clash) {
      review(c, relation, clashReason(clash));
    } else {
      out.push({
        item_id: c.id,
        action: "close",
        relation,
        valid_to: next.valid_from,
        reason: `${next.id} supersedes it from ${next.valid_from}: it started before, at ${c.valid_from}, and ${next.id} covers it to its end (${c.valid_to ?? "open"}), so its valid_to becomes ${next.valid_from}`,
      });
    }
  }
  return out;
}

/**
 * `items` with every close among `proposals` applied: the item's valid_to
 * set to the proposed end, nothing else changed (status, version and the
 * rest are a governed update's to set, supersede.ts `closedVersion`). A
 * review changes nothing. New objects; the input is not mutated.
 */
export function applyClosures<T extends SupersessionCandidate>(
  items: readonly T[],
  proposals: readonly SupersessionProposal[],
): T[] {
  const ends = new Map(
    proposals.flatMap((p) => (p.action === "close" ? [[p.item_id, p.valid_to] as const] : [])),
  );
  return items.map((i) => (ends.has(i.id) ? { ...i, valid_to: ends.get(i.id) ?? null } : { ...i }));
}
