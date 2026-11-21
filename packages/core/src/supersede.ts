// Supersession (card L6): the head of a supersession chain over lineage, and
// the plan a surface shows a person before an accepted close is applied.
//
// `resolveSupersessionHead` is copied from Remnic
// (https://github.com/joshuaswarren/remnic, commit
// ce22909cc219e36d0e31b1158a4ab74f175008a0,
// packages/remnic-core/src/shared-context/supersession-chain.ts, MIT,
// copyright (c) 2025 Joshua Warren; the notice is in NOTICE), with its tests
// (test/unit/supersede.test.ts). Modified here: an item lists every id it
// supersedes (`lineage`, schema.ts) where Remnic's names one (`supersedes`),
// so each lineage id is a link; the head is `head_id`; ids are not trimmed and
// blank ids are not special, since the contract's ids are UUIDv7s.
//
// `planSupersession` reads the projection (no store, no clock, no model) as
// the asking actor may see it, and `acceptedClosures` turns the closes a
// person accepted into the new versions a surface writes through
// Plane.write, so the write gate decides each and the log records it. The
// read path does not call any of this: what a read returns is unchanged.
import { z } from "zod";
import { type Actor, InvalidCallError } from "./actor.ts";
import type { Db } from "./db/db.ts";
import { currentItems } from "./events.ts";
import { itemById } from "./items.ts";
import { proposeSupersession, SupersessionProposal } from "./lint/supersession.ts";
import { readableAt } from "./policy/evaluate.ts";
import type { MemoryItem, Policy } from "./schema.ts";

/** What the resolver reads of an item: its id and the ids it supersedes. */
export interface SupersessionLink {
  id: string;
  /** Ids of the versions this one supersedes (MemoryItem.lineage). */
  lineage: readonly string[];
}

export const MAX_SUPERSESSION_DEPTH = 32;

/** The resolver's answer: the head and the chain to it, or a typed error and the chain walked. */
export const SupersessionChain = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), head_id: z.string(), chain: z.array(z.string()) }),
  z.strictObject({
    ok: z.literal(false),
    error: z.enum(["unknown_id", "cycle_detected", "depth_exceeded"]),
    chain: z.array(z.string()),
  }),
]);
export type SupersessionChainResult = z.infer<typeof SupersessionChain>;

/**
 * Resolve the live head of the supersession chain that starts at `startId`.
 *
 * Direction: forward. A successor of id X is an item whose lineage lists X.
 * The head is the item that nothing supersedes.
 *
 * Fork policy: when two items supersede the same id, the lexicographically
 * smallest successor id wins. This keeps the result dependent only on the
 * item set, never on array order.
 *
 * Errors are values, not throws: `unknown_id` for a start no item holds,
 * `cycle_detected` when the walk meets an id it has seen (an item naming
 * itself included), `depth_exceeded` when the chain would grow past
 * `maxDepth` ids (32 by default). Only a malformed `maxDepth` throws.
 *
 * Pure: reads the input, mutates nothing, performs no I/O.
 */
export function resolveSupersessionHead(input: {
  items: readonly SupersessionLink[];
  startId: string;
  maxDepth?: number;
}): SupersessionChainResult {
  const { items, maxDepth, startId: start } = input;
  if (maxDepth !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 1)) {
    throw new RangeError(`maxDepth must be a positive integer, got ${maxDepth}`);
  }
  const depth = maxDepth ?? MAX_SUPERSESSION_DEPTH;

  // Build the id set and the successor map.
  const ids = new Set<string>();
  const successorOf = new Map<string, string>();
  for (const item of items) {
    ids.add(item.id);
    for (const target of item.lineage) {
      // Fork resolution: keep the smallest successor id for determinism.
      const best = successorOf.get(target);
      if (best === undefined || item.id < best) successorOf.set(target, item.id);
    }
  }

  if (!ids.has(start)) return { ok: false, error: "unknown_id", chain: [] };

  const chain = [start];
  const visited = new Set<string>([start]);
  let current = start;
  for (;;) {
    const next = successorOf.get(current);
    if (next === undefined) return { ok: true, head_id: current, chain };
    if (visited.has(next)) return { ok: false, error: "cycle_detected", chain };
    if (chain.length + 1 > depth) return { ok: false, error: "depth_exceeded", chain };
    chain.push(next);
    visited.add(next);
    current = next;
  }
}

/** What a surface shows before anything is applied (card L6). */
export const SupersessionPlan = z.strictObject({
  /** The item asked about: the new version, whose lineage names the candidates. */
  item_id: z.string(),
  /** The head of its chain among what the actor may read; an error stops the proposals. */
  head: SupersessionChain,
  /** The proposals for the item against every ancestor the actor may read, by id. */
  proposals: z.array(SupersessionProposal),
});
export type SupersessionPlan = z.infer<typeof SupersessionPlan>;

/**
 * The plan for `itemId` as `actor` may see the projection at `at` (the
 * read's access time, `accessTime`). Only items the actor can read at `at`
 * (readableAt: a readable scope or a live grant) take part, so the plan
 * names nothing the actor could not read: an item it cannot read is
 * `unknown_id`, and an ancestor reached only through one is not a
 * candidate. The head is resolved over the readable items that are not
 * retired (a retired version supersedes nothing, as in items.ts), with the
 * asked item among them whatever its status. A cycle or a chain deeper than
 * 32 is reported and proposes nothing: the lineage needs a person first.
 * Otherwise the candidates are the asked item's ancestors, walked through
 * readable items breadth first, and the proposals are `proposeSupersession`'s.
 */
export function planSupersession(
  db: Db,
  policy: Policy,
  actor: Actor,
  itemId: string,
  at: string,
): SupersessionPlan {
  const readable = new Map(
    currentItems(db)
      .filter((i) => readableAt(policy, actor, i, at))
      .map((i) => [i.id, i]),
  );
  const start = readable.get(itemId);
  if (start === undefined)
    return { item_id: itemId, head: { ok: false, error: "unknown_id", chain: [] }, proposals: [] };
  const links = [...readable.values()].filter((i) => i.status !== "retired" || i.id === itemId);
  const head = resolveSupersessionHead({ items: links, startId: itemId });
  if (!head.ok) return { item_id: itemId, head, proposals: [] };

  const seen = new Set([itemId]);
  const queue = [...start.lineage];
  const ancestors: MemoryItem[] = [];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (seen.has(id)) continue;
    seen.add(id);
    const ancestor = readable.get(id);
    if (ancestor === undefined) continue;
    ancestors.push(ancestor);
    queue.push(...ancestor.lineage);
  }
  return { item_id: itemId, head, proposals: proposeSupersession(start, ancestors) };
}

/**
 * The candidate with an accepted close applied, as the new version a
 * governed update writes in place (ADR 0005, decision D1): the same id, its
 * valid_to the proposed end, its version plus one, no store_ref (the
 * adapter's is recorded). Status and everything else are unchanged, so
 * nothing is retired; Plane.write still sets the provenance from the
 * writing actor (decision D4), as for any rewrite.
 */
export function closedVersion(candidate: MemoryItem, proposal: SupersessionProposal): MemoryItem {
  if (proposal.action !== "close" || proposal.valid_to === null)
    throw new InvalidCallError(`supersession: the proposal for ${proposal.item_id} is not a close`);
  if (proposal.item_id !== candidate.id)
    throw new InvalidCallError(
      `supersession: the proposal is about ${proposal.item_id}, not ${candidate.id}`,
    );
  return {
    ...candidate,
    valid_to: proposal.valid_to,
    version: candidate.version + 1,
    store_ref: null,
  } as MemoryItem;
}

/**
 * The new versions to write for the closes `accept` names, each once, in the
 * plan's order. An id the plan proposes no close for (a review, nothing, or
 * an item the actor cannot read) is refused with InvalidCallError before
 * anything is written, so a call applies all it names or nothing.
 */
export function acceptedClosures(
  db: Db,
  plan: SupersessionPlan,
  accept: readonly string[],
): MemoryItem[] {
  const wanted = new Set(accept);
  const closes = plan.proposals.filter((p) => p.action === "close" && wanted.has(p.item_id));
  const missing = [...wanted].filter((id) => !closes.some((p) => p.item_id === id));
  if (missing.length > 0)
    throw new InvalidCallError(
      `supersession: no close is proposed for ${missing.join(", ")} by ${plan.item_id}; only a proposed close can be accepted`,
    );
  return closes.map((p) => {
    const candidate = itemById(db, p.item_id);
    if (candidate === undefined)
      throw new InvalidCallError(`supersession: item ${p.item_id} is no longer projected`);
    return closedVersion(candidate, p);
  });
}
