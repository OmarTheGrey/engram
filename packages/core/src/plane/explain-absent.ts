// Why not this item (card E2.17): for one item and one read, the first stage
// of the read that kept the item out of what it returned, from the
// predicates the read itself decides with, in the order it applies them. The
// idea of caura's recall explanation (core-api/src/core_api/services/
// recall_explain.py, Apache-2.0, commit 8dbb7f40a76c; idea only,
// docs/conventions/absorption.md): a recall explains what it left out as
// well as what it returned. Nothing of its code is taken.
//
// The read (plane/read.ts) runs in this order, and so does the answer:
// 1. reach: a projected item outside the reader's reach (no readable scope,
//    no grant whose `to` names the reader) is never a candidate;
// 2. match: with query text, an item neither the store's search (in the
//    reader's readable member scopes) nor the plane's term match returned is
//    not a candidate; under the core retrieval pipeline, an item with no
//    query term;
// 3. the read filter, evaluateRead's first failing check: status, then ttl,
//    then access (a grant whose class or expiry does not admit it), then the
//    validity window at the read's valid_at;
// 4. the rank cut: under the core pipeline with a limit, an admitted item
//    ranked below the limit.
// An item past every stage is returned: the answer says so (absent false)
// with the rule that admits it. The card listed the stages as "scope,
// grant, validity, status, rank cut"; the answer follows the read's own
// order instead, since the first rule that excluded an item is the one the
// read applied first (a `decision` log entry of card E2.17).
//
// What the answer reveals (RD1's rule, visible.ts; ADR 0047). It is given
// only to an actor entitled to know the item exists: one who may ask for it
// by id (idShownTo: the item is projected and in a scope the actor may read
// as a member, or the read filter admits it to the actor at the read's
// times). Anyone else, and every id the log never held, gets the same
// refusal, word for word but for the id, so the answer is never an existence
// oracle. An entitled actor is never told of the reach or access stages:
// such an actor reads the item's scope or is admitted by a grant, so neither
// can have excluded it. A member told that the filter closed the item learns
// the stage and its rule only, never an instant of the item (its validity
// window or ttl expiry), as who-can-read withholds them (review finding
// E2.13-1). An admitted item's answer names the admitting rule, never a grant.
//
// The answer is a new response type, never stored and never an Explanation
// (so no schema_version bump), and the call appends no event, as explain
// and who-can-read append none: it decides nothing. Plane.read is unchanged.
//
// Which read it explains (review of card E2.17, finding 1): the read with
// the same query over the projection as it stands, at the read's own access
// time (accessTime), before any sweep or adoption. A surface's read with a
// store first runs the store owner's retention sweep and adopts the store's
// records (syncBeforeRead); this call runs neither, since both append
// events. So, for the store's owner, an item past its ttl answers `ttl`
// where the read after its sweep would count it not active (`status`), a
// store record not yet adopted answers as an unknown id until a read adopts
// it, and an edited record is matched on the content the plane holds.
//
// One snapshot (finding 2): the access time and the projection are taken
// together under the log's lock, and both the entitlement and every stage
// are computed from that one projection; the store's search, awaited after
// the lock is released, matches the snapshot's items as the read's does,
// and a write landing meanwhile is not seen.
import { z } from "zod";
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { currentItems } from "../events.ts";
import type { PlaneDeps, ReadQuery } from "../plane.ts";
import { evaluateRead, reachable, readableScope } from "../policy/evaluate.ts";
import { Id, type MemoryItem, Timestamp } from "../schema.ts";
import { idShownTo } from "../visible.ts";
import { accessTime, matching } from "./read.ts";
import { matchesQuery, queryTerms, retrieve } from "./retrieve.ts";

/** The rule of the match stage: the read's query text did not make the item a candidate. */
export const ABSENT_MATCH_ID = "engram/read/match";
/** The rule of the rank cut: the core retrieval pipeline's read limit. */
export const ABSENT_RANK_CUT_ID = "engram/read/rank-cut";

/** The stages an answer may name, in the read's order. */
export const ABSENCE_STAGES = ["match", "status", "ttl", "validity", "rank-cut"] as const;

export const AbsenceExplanation = z
  .strictObject({
    answered: z.boolean().meta({
      description:
        "False when the plane refuses to answer: for an id the log never held and for an item the asker may not know exists alike. Every other field but item_id, at, valid_at and reason is then null.",
    }),
    item_id: z.string().meta({ description: "The item id asked about, as given." }),
    at: Timestamp.meta({
      description:
        "The read's access time: the time status, ttl and grants are judged at, never before the log's head.",
    }),
    valid_at: Timestamp.meta({
      description: "The time the read judges validity windows at: its valid_at, else its at.",
    }),
    absent: z.boolean().nullable().meta({
      description:
        "True when the read would leave the item out, false when it would return it; null on a refusal.",
    }),
    stage: z.enum(ABSENCE_STAGES).nullable().meta({
      description:
        "The first stage that kept the item out, in the read's order: match (the query text did not make it a candidate), status (not active), ttl (past its ttl), validity (outside its validity window at valid_at), rank-cut (admitted, but below the core pipeline's read limit). Null when it is returned, or on a refusal.",
    }),
    policy_id: z.string().nullable().meta({
      description:
        "The rule of that stage, or the rule that admits a returned item; null on a refusal.",
    }),
    reason: z.string().meta({ description: "Why, in words; or why the plane refused." }),
  })
  .meta({
    description:
      "Why not this item (card E2.17): the first stage of a read that kept an item out of what it returned, from the read's own predicates. Answered only to an actor who may ask for the item by id (ADR 0047); anyone else gets the refusal an unknown id gets. Never stored; no event.",
  });
export type AbsenceExplanation = z.infer<typeof AbsenceExplanation>;

/**
 * Every stage the read can stop an item at, as the read applies them:
 * the answer's stages, the two an entitled actor is never told of (`reach`,
 * `access`), and `returned`. The test oracle counts these against the read
 * event's reason.
 */
export type ReadStage =
  | "reach"
  | "match"
  | "status"
  | "ttl"
  | "access"
  | "validity"
  | "rank-cut"
  | "returned";

/** Where the read stops `item`, and the rule there; computed for anyone, shown by explainAbsent only as allowed. */
export interface ReadOutcome {
  stage: ReadStage;
  policy_id: string;
}

const FILTER_STAGE = {
  "not-active": "status",
  expired: "ttl",
  excluded: "access",
  "outside-validity": "validity",
} as const;

/** The read's validity time for `query`, as filteredRead takes it, the call checked. */
function readTimes(actor: Actor, query: ReadQuery, method: string) {
  checkCall(actor, query?.at, method);
  if (query.valid_at !== undefined) checkCall(actor, query.valid_at, `${method} (valid_at)`);
  return { validAt: query.valid_at ?? query.at };
}

/**
 * Where a read by `actor` with `query` stops each projected item, by id, at
 * the read's access time `at` and validity time `validAt`: the read's own
 * candidate rule, filter and cut (plane/read.ts), with no event and no store
 * write. Not a disclosure: explainAbsent decides what an actor is told.
 */
export async function readOutcomes(
  deps: PlaneDeps,
  actor: Actor,
  query: Pick<ReadQuery, "text">,
  at: string,
  validAt: string,
  projected: readonly MemoryItem[] = currentItems(deps.db),
): Promise<Map<string, ReadOutcome>> {
  const { policy } = deps;
  const live = projected.filter((i) => reachable(policy, actor, i));
  const core = deps.retrieval?.pipeline === "core";
  const terms = queryTerms(query.text);
  const scopes = [
    ...new Set(actor.memberships.filter((s) => readableScope(policy, actor, s))),
  ].sort();
  const searched = core ? undefined : await matching(deps, live, scopes, query.text);
  const matched = new Set(
    (core
      ? live.filter((i) => matchesQuery(i, terms))
      : searched
        ? live.filter((i) => searched.order.includes(i.id))
        : live
    ).map((i) => i.id),
  );
  const out = new Map<string, ReadOutcome>();
  const admitted: MemoryItem[] = [];
  const admittedBy = new Map<string, string>();
  for (const item of projected) {
    if (!live.includes(item)) {
      out.set(item.id, { stage: "reach", policy_id: "" });
      continue;
    }
    if (!matched.has(item.id)) {
      out.set(item.id, { stage: "match", policy_id: ABSENT_MATCH_ID });
      continue;
    }
    const decision = evaluateRead(policy, actor, item, at, validAt);
    if (!decision.admitted) {
      const check = decision.check as keyof typeof FILTER_STAGE;
      out.set(item.id, { stage: FILTER_STAGE[check], policy_id: decision.policy_id });
      continue;
    }
    admitted.push(item);
    admittedBy.set(item.id, decision.policy_id);
  }
  const limit = deps.retrieval?.limit;
  const kept =
    core && limit !== undefined
      ? new Set(retrieve(admitted, query.text, at, limit).map((r) => r.item.id))
      : undefined;
  for (const item of admitted)
    out.set(
      item.id,
      kept === undefined || kept.has(item.id)
        ? { stage: "returned", policy_id: admittedBy.get(item.id) as string }
        : { stage: "rank-cut", policy_id: ABSENT_RANK_CUT_ID },
    );
  return out;
}

/** The words of a refusal: the same for an unknown id and an item the asker may not know exists. */
export const absenceRefusal = (actor: Actor, itemId: string) =>
  `${actor.id} cannot ask why item ${itemId} is not in a read: the plane answers only for an item its asker may read by id, in a scope it may read as a member or admitted to it by the read filter`;

/** Each stage's words: the stage and its rule, never an instant of the item. */
function stageReason(stage: (typeof ABSENCE_STAGES)[number], limit: number | undefined): string {
  switch (stage) {
    case "match":
      return "not a candidate: the read's query text did not match it";
    case "status":
      return "the read filter admits only active items, and it is not active";
    case "ttl":
      return "the read filter admits no item past its ttl, and it is past its ttl";
    case "validity":
      return "outside its validity window at the time the read judges validity at";
    case "rank-cut":
      return `admitted, but ranked below the read limit of ${limit} of the core retrieval pipeline`;
  }
}

/**
 * Plane.explainAbsent (card E2.17): why the read `actor` would make now with
 * `query` leaves out the item under `itemId`, or that it returns it, as the
 * module comment says; a refusal, in the words of an unknown id, for an
 * actor not entitled to know the item exists. An invalid actor, time or id
 * is refused with InvalidCallError before the log is touched.
 */
export async function explainAbsent(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  query: ReadQuery,
): Promise<AbsenceExplanation> {
  const { validAt } = readTimes(actor, query, "explainAbsent");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.explainAbsent: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  // The access time and the projection in one snapshot, under the log's lock (see the module comment).
  const { at, projected } = deps.db.transaction(() => ({
    at: accessTime(deps.db, query.at),
    projected: currentItems(deps.db),
  }));
  const byId = new Map(projected.map((i) => [i.id, i]));
  const view = { policy: deps.policy, at, validAt, current: (id: string) => byId.get(id) };
  const base = { item_id: itemId, at, valid_at: validAt };
  if (!idShownTo(actor, itemId, view))
    return {
      ...base,
      answered: false,
      absent: null,
      stage: null,
      policy_id: null,
      reason: absenceRefusal(actor, itemId),
    };
  const outcome = (await readOutcomes(deps, actor, query, at, validAt, projected)).get(itemId);
  if (outcome === undefined || outcome.stage === "reach" || outcome.stage === "access")
    // Unreachable for an entitled actor (see the module comment); kept a refusal, never a leak.
    return {
      ...base,
      answered: false,
      absent: null,
      stage: null,
      policy_id: null,
      reason: absenceRefusal(actor, itemId),
    };
  if (outcome.stage === "returned")
    return {
      ...base,
      answered: true,
      absent: false,
      stage: null,
      policy_id: outcome.policy_id,
      reason: `not absent: the read returns it, admitted by ${outcome.policy_id}`,
    };
  return {
    ...base,
    answered: true,
    absent: true,
    stage: outcome.stage,
    policy_id: outcome.policy_id,
    reason: `absent at the ${outcome.stage} stage: ${stageReason(outcome.stage, deps.retrieval?.limit)}`,
  };
}
