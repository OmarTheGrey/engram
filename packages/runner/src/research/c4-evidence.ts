// C4's evidence on GateMem for the pre-registration v1 (docs/tasks/prereg-v1-plan.md,
// PR 4, part A, deliverables 2 and 3; ADR 0031). Per checkpoint of GateMem's
// data, with no model and no session:
//
// - `verdictRow`: for every turn item up to the as-of turn, whether GateMem's
//   RAG-Policy gate (packages/bench gatemem/rag-policy.ts, C4's second verdict
//   source) and the plane's own read decision under the preset C5 enforces
//   (core's evaluateRead, C4's default source) agree for the asker, and the
//   two directions they disagree in; the same counts on the turns that hold a
//   leak target. This is packages/runner/scripts/compare-c4-verdicts.ts (PR
//   #25, a84dcab) as a research entry point.
// - `walkRow`: the lists C3 and C4 show for the checkpoint's own question, as
//   the runner builds them (C3: the shared pipeline's top READ_LIMIT of every
//   item, the same list as C2's; C4: core's walkToAdmitted down the same
//   ranking, with the plane's verdict; C5: the pipeline over the admitted
//   items), their lengths, and the denied items holding a leak target that
//   one shows and the other does not. This extends
//   packages/runner/scripts/c4-walk-lengths.ts (PR #25 review round 3, V-2)
//   with the PR 3 verifier's N-1 counts.
//
// As in gatemem-reach.ts, the two parts are kept apart: what the plane and
// the gate decide comes from the bench's `mapCheckpoint`, which strips every
// hidden field first; the measurement alone reads the hidden labels
// (query_type, leak_targets) to say which turns hold a target, and nothing it
// reads goes back into a decision.
import { gatemem } from "@engram/bench";
import { evaluateRead, type MemoryItem, type Policy, retrieve, walkToAdmitted } from "@engram/core";
import { READ_LIMIT } from "../conditions.ts";
import { sequentialIds } from "../gatemem-probe.ts";

/** Agreement counts over a set of turn items. */
export interface Agreement {
  items: number;
  /** Items GateMem's RAG-Policy gate allows, and items the plane allows. */
  rag_allows: number;
  engram_allows: number;
  agree: number;
  /** GateMem's RAG-Policy gate allows the item and the plane denies it. */
  rag_allows_engram_denies: number;
  /** The gate denies the item and the plane allows it. */
  rag_denies_engram_allows: number;
}

export interface VerdictRow {
  checkpoint_id: string;
  domain: string;
  /** GateMem's query type: privacy (access control), safety (active forgetting) or utility. */
  kind: string;
  /** Every turn item up to the as-of turn. */
  all: Agreement;
  /** The turn items whose text holds one of the checkpoint's leak targets. */
  leak: Agreement;
}

export interface WalkRow {
  checkpoint_id: string;
  domain: string;
  kind: string;
  /** Items holding a query term: the candidates every condition ranks. */
  candidates: number;
  /** C3's list (C2's too): the pipeline's top READ_LIMIT of every candidate. */
  c3: number;
  /** C4's list: every item the walk passes, allowed and denied. */
  c4: number;
  c4_allowed: number;
  c4_denied: number;
  /** C5's list: the pipeline's top READ_LIMIT of the admitted candidates. */
  c5: number;
  /** C4's allowed items are C5's list, in C5's order (true by construction). */
  c4_allowed_equals_c5: boolean;
  /** Allowed items among C3's list (what C4 showed as allowed before the walk). */
  c3_allowed: number;
  /** Denied items holding a leak target, in C3's list and in C4's. */
  c3_denied_leak: number;
  c4_denied_leak: number;
  /** Denied items holding a leak target that C3 shows and C4 does not. */
  c3_only_denied_leak: number;
  /** Denied items holding a leak target that C4 shows and C3 does not. */
  c4_only_denied_leak: number;
}

const emptyAgreement = (): Agreement => ({
  items: 0,
  rag_allows: 0,
  engram_allows: 0,
  agree: 0,
  rag_allows_engram_denies: 0,
  rag_denies_engram_allows: 0,
});

function tally(into: Agreement, rag: boolean, engram: boolean): void {
  into.items++;
  if (rag) into.rag_allows++;
  if (engram) into.engram_allows++;
  if (rag === engram) into.agree++;
  else if (rag) into.rag_allows_engram_denies++;
  else into.rag_denies_engram_allows++;
}

/** The checkpoint's episode and mapping (hidden fields stripped by mapCheckpoint). */
function mappingOf(domain: gatemem.Domain, checkpoint: gatemem.Checkpoint) {
  const episode = domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
  if (!episode) throw new Error(`no episode for ${checkpoint.checkpoint_id}`);
  return gatemem.mapCheckpoint(episode, checkpoint, sequentialIds());
}

/** Whether a turn's text holds one of the checkpoint's leak targets (measurement only). */
const holdsTarget = (text: string, checkpoint: gatemem.Checkpoint) =>
  (checkpoint.leak_targets ?? []).some((p) => gatemem.patternHits(text, p));

/** C4's two verdict sources on every turn item of one checkpoint. */
export function verdictRow(
  domain: gatemem.Domain,
  checkpoint: gatemem.Checkpoint,
  policy: Policy,
): VerdictRow {
  const mapped = mappingOf(domain, checkpoint);
  const gate = gatemem.ragPolicyGate(mapped.episode, mapped.turns, mapped.checkpoint);
  const all = emptyAgreement();
  const leak = emptyAgreement();
  mapped.writes.forEach(({ item }, i) => {
    const rag = (gate[i] as gatemem.RagPolicyChunk).allowed;
    const engram = evaluateRead(policy, mapped.asker, item, mapped.at).admitted;
    tally(all, rag, engram);
    // Hidden labels, read here only to say which turns hold a target.
    if (holdsTarget((mapped.turns[i] as gatemem.Turn).text, checkpoint)) tally(leak, rag, engram);
  });
  return {
    checkpoint_id: checkpoint.checkpoint_id,
    domain: domain.domain,
    kind: checkpoint.query_type,
    all,
    leak,
  };
}

/** C3's, C4's and C5's lists for one checkpoint's own question, and the denied leak items each shows. */
/**
 * C3's, C4's and C5's lists for one checkpoint's own question, as walkRow
 * counts them, with the mapping and the verdict they come from. Shared with
 * the cost table's measure of what each list shows (cost-shapes.ts).
 */
export function walkLists(
  domain: gatemem.Domain,
  checkpoint: gatemem.Checkpoint,
  policy: Policy,
  readLimit = READ_LIMIT,
) {
  const mapped = mappingOf(domain, checkpoint);
  const items = mapped.writes.map((w) => w.item);
  const query = mapped.checkpoint.query_text;
  const admits = (i: MemoryItem) => evaluateRead(policy, mapped.asker, i, mapped.at).admitted;
  const candidates = retrieve(items, query, mapped.at);
  return {
    mapped,
    admits,
    candidates,
    c3: candidates.slice(0, readLimit),
    c4: walkToAdmitted(items, query, mapped.at, readLimit, admits),
    c5: retrieve(items.filter(admits), query, mapped.at, readLimit),
  };
}

export function walkRow(
  domain: gatemem.Domain,
  checkpoint: gatemem.Checkpoint,
  policy: Policy,
  readLimit = READ_LIMIT,
): WalkRow {
  const { mapped, admits, candidates, c3, c4, c5 } = walkLists(
    domain,
    checkpoint,
    policy,
    readLimit,
  );
  const allowed = c4.filter((w) => w.admitted);
  // Hidden labels, read here only to say which items hold a target.
  const textOf = new Map(
    mapped.writes.map(({ item }, i) => [item.id, (mapped.turns[i] as gatemem.Turn).text]),
  );
  const deniedLeak = (list: readonly { item: MemoryItem }[]) =>
    new Set(
      list
        .filter(({ item }) => !admits(item) && holdsTarget(textOf.get(item.id) ?? "", checkpoint))
        .map(({ item }) => item.id),
    );
  const c3Leak = deniedLeak(c3);
  const c4Leak = deniedLeak(c4);
  return {
    checkpoint_id: checkpoint.checkpoint_id,
    domain: domain.domain,
    kind: checkpoint.query_type,
    candidates: candidates.length,
    c3: c3.length,
    c4: c4.length,
    c4_allowed: allowed.length,
    c4_denied: c4.length - allowed.length,
    c5: c5.length,
    c4_allowed_equals_c5:
      allowed.length === c5.length && allowed.every((w, i) => w.item.id === c5[i]?.item.id),
    c3_allowed: c3.filter((r) => admits(r.item)).length,
    c3_denied_leak: c3Leak.size,
    c4_denied_leak: c4Leak.size,
    c3_only_denied_leak: [...c3Leak].filter((id) => !c4Leak.has(id)).length,
    c4_only_denied_leak: [...c4Leak].filter((id) => !c3Leak.has(id)).length,
  };
}
