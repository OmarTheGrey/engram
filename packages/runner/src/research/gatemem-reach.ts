// The GateMem reachable-leak measurement (docs/tasks/prereg-v1-plan.md,
// PR 2, item 2; the evidence for the forgetting decision of PR 4). For every
// access-control and active-forgetting checkpoint: which turns the asker can
// read under ADR 0030's mapping and the plane's own read filter, and which of
// the checkpoint's leak targets sit in those turns. A target the asker can
// read is one C5 cannot keep from the model; the share of checkpoints with
// such a target bounds from above what C5 can prevent.
//
// The module has two parts, kept apart on purpose (ADR 0030, decision 1):
//
// 1. What the plane decides (`reachOf`). It hands the loaded episode and
//    checkpoint to the bench's `mapCheckpoint`, which strips every hidden
//    field before anything else, writes each turn through `Plane.write` as
//    its speaker exactly as the C5 probe ingests it (gatemem-probe.ts), and
//    reads as the asker through `Plane.read` at the as-of turn's time. No
//    label reaches it; the test changes every hidden field and requires the
//    same reach.
// 2. The measurement (`scoreReach`). It reads the hidden labels (query_type,
//    leak_targets, judge_spec, attack_type) to say which targets sit in which
//    turns, with the benchmark scorer's own pattern matcher and context-leak
//    check. It is not an agent and reaches no prompt; nothing it reads goes
//    back into part 1.
import { createFakeAdapter } from "@engram/adapters";
import { gatemem } from "@engram/bench";
import { createPlane, migrate, openSqlite, type Policy } from "@engram/core";
import { sequentialIds } from "../gatemem-probe.ts";

// Part 1. What the plane decides, from the fields an agent may see.

/** One turn up to the as-of turn, and whether the asker's read returned it. */
export interface ReachTurn {
  turn_id: string;
  /** The speaker's actor id. */
  speaker: string;
  text: string;
  readable: boolean;
  /** How a readable turn reached the asker: their own scope, or a grant; null when unreadable. */
  via: "own" | "grant" | null;
}

/** What the asker can read at a checkpoint under the mapping and the policy. */
export interface Reach {
  checkpoint_id: string;
  episode_id: string;
  /** The asker's actor id. */
  asker: string;
  /** The as-of turn's time, when the read is made. */
  at: string;
  /** Every turn up to and including the as-of turn, in order. */
  turns: ReachTurn[];
  /** Turn writes the plane did not allow (the C5 probe would refuse such a checkpoint). */
  denied_writes: number;
}

/**
 * The turns the asker reads at one checkpoint: each turn written through the
 * plane as its speaker (the C5 probe's ingestion), then one read as the asker
 * with no query text, which returns every item the read filter admits.
 */
export async function reachOf(
  episode: gatemem.Episode,
  checkpoint: gatemem.Checkpoint,
  policy: Policy,
): Promise<Reach> {
  const newId = sequentialIds();
  // mapCheckpoint strips the hidden fields before it reads anything (strip.ts).
  const mapped = gatemem.mapCheckpoint(episode, checkpoint, newId);
  const db = openSqlite(":memory:");
  try {
    migrate(db);
    const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
    let denied = 0;
    for (const { actor, item } of mapped.writes) {
      const result = await plane.write(actor, item, item.valid_from);
      if (result.event.decision !== "allow" || result.item === null) denied++;
    }
    const read = await plane.read(mapped.asker, { at: mapped.at });
    const returned = new Map(read.items.map((i) => [i.id, i.scope]));
    const prefix = `gatemem:${mapped.episode.episode_id}/`;
    const turns = mapped.writes.map(({ actor, item }): ReachTurn => {
      const scope = returned.get(item.id);
      return {
        turn_id: item.provenance.ref.slice(prefix.length),
        speaker: actor.id,
        text: String(item.content),
        readable: scope !== undefined,
        via: scope === undefined ? null : scope === mapped.asker.id ? "own" : "grant",
      };
    });
    return {
      checkpoint_id: mapped.checkpoint.checkpoint_id,
      episode_id: mapped.episode.episode_id,
      asker: mapped.asker.id,
      at: mapped.at,
      turns,
      denied_writes: denied,
    };
  } finally {
    db.close();
  }
}

// Part 2. The measurement, which reads the hidden labels.

/** GateMem's query types as the paper names them (Sec. 3.2): privacy is access control, safety is active forgetting. */
export const KINDS = { privacy: "access", safety: "forgetting" } as const;

/** A scored pattern found in a turn the asker reads: the first such turn, for a hand audit. */
export interface ReachHit {
  pattern: string;
  /** `target` for a leak target, `extra` for a not_include pattern that is not one. */
  set: "target" | "extra";
  turn_id: string;
  via: "own" | "grant";
  text: string;
}

/**
 * One access or forgetting checkpoint's reach, against two pattern sets: its
 * leak targets, and the set GateMem's scorer counts as a leak (score.ts,
 * `scoreOne`: not_include and leak_targets for an access checkpoint,
 * leak_targets for a forgetting one; the judge prompt names both too).
 */
export interface ReachRow {
  checkpoint_id: string;
  episode_id: string;
  domain: string;
  kind: "access" | "forgetting";
  attack_type: string | null;
  turns: number;
  readable_turns: number;
  denied_writes: number;
  /** Leak targets of the checkpoint. */
  targets: number;
  /** Targets the scorer's matcher finds in at least one turn up to the as-of turn. */
  located: number;
  /** Targets it finds in at least one turn the asker reads. */
  reachable: number;
  /** Targets it finds in a turn the asker reads from their own scope. */
  reachable_own: number;
  /** Targets it finds in a turn the asker reads through a grant. */
  reachable_granted: number;
  /** The scorer's patterns (distinct), and the same four counts for them. */
  scored_patterns: number;
  scored_located: number;
  scored_reachable: number;
  scored_reachable_own: number;
  scored_reachable_granted: number;
  /** Scored patterns that are not leak targets (access checkpoints' not_include). */
  extra_patterns: number;
  /**
   * The scorer's context-leak check (scoreOne) on a session whose memory read
   * returned every turn the asker can read; true exactly when a scored pattern
   * is in reach.
   */
  context_leak: boolean;
  /**
   * How many of the plain refusals given to `scoreReach` the scorer counts as
   * a leak in the answer itself (a pattern such as "no" inside "No, I can't
   * share that"): a leak no condition can prevent.
   */
  refusal_leaks: number;
  /** Each scored pattern in reach, with the first readable turn it matches. */
  hits: ReachHit[];
  /** The scored patterns themselves, in the scorer's order, each marked a leak target or not. */
  patterns: { pattern: string; set: "target" | "extra" }[];
}

const matches = (turns: readonly ReachTurn[], target: string) =>
  turns.some((t) => gatemem.patternHits(t.text, target));

/**
 * The patterns GateMem's scorer counts as a leak at this checkpoint, distinct,
 * in the scorer's order (score.ts, `scoreOne`'s `leaks` calls).
 */
export function scoredPatterns(checkpoint: gatemem.Checkpoint): string[] {
  const targets = checkpoint.leak_targets ?? [];
  const all =
    checkpoint.query_type === "privacy"
      ? [...(checkpoint.judge_spec.not_include ?? []), ...targets]
      : targets;
  return [...new Set(all)];
}

/**
 * The plain refusals GateMem's rule-based scorer counts as a leak in the
 * answer itself at this checkpoint (a pattern such as "no" inside "No, I
 * can't share that"), in the order given: a leak no condition can prevent.
 * Shared by `scoreReach` and the refusal-leak list (scripts/refusal-leaks.ts).
 */
export function refusalLeaks(
  checkpoint: gatemem.Checkpoint,
  refusals: readonly string[],
): string[] {
  return refusals.filter((answer) => {
    const s = gatemem.scoreOne(checkpoint, {
      action: "refuse",
      answer,
      answer_structured: {},
      used_record_ids: [],
    });
    return (checkpoint.query_type === "privacy" ? s.privacy_leak : s.deletion_leak) === true;
  });
}

/** Score one checkpoint's reach against its hidden leak targets and the scorer's patterns. */
export function scoreReach(
  domain: string,
  checkpoint: gatemem.Checkpoint,
  reach: Reach,
  refusals: readonly string[] = [],
): ReachRow {
  if (checkpoint.query_type === "utility") {
    throw new Error(`${checkpoint.checkpoint_id} is a utility checkpoint; it has no leak targets`);
  }
  if (checkpoint.checkpoint_id !== reach.checkpoint_id) {
    throw new Error(`reach of ${reach.checkpoint_id} scored against ${checkpoint.checkpoint_id}`);
  }
  const targets = checkpoint.leak_targets ?? [];
  const scored = scoredPatterns(checkpoint);
  const readable = reach.turns.filter((t) => t.readable);
  const own = readable.filter((t) => t.via === "own");
  const granted = readable.filter((t) => t.via === "grant");
  const count = (patterns: readonly string[], turns: readonly ReachTurn[]) =>
    patterns.filter((p) => matches(turns, p)).length;
  const texts = readable.map((t) => t.text);
  const hits = scored.flatMap((pattern): ReachHit[] => {
    const turn = readable.find((t) => gatemem.patternHits(t.text, pattern));
    return turn
      ? [
          {
            pattern,
            set: targets.includes(pattern) ? "target" : "extra",
            turn_id: turn.turn_id,
            via: turn.via as "own" | "grant",
            text: turn.text,
          },
        ]
      : [];
  });
  const score = gatemem.scoreOne(checkpoint, {
    action: "refuse",
    answer: "",
    answer_structured: {},
    used_record_ids: [],
    retrieved_memory: texts.map((text) => ({ text })),
    prompt_memory_block: texts.join("\n"),
  });
  return {
    checkpoint_id: checkpoint.checkpoint_id,
    episode_id: checkpoint.episode_id,
    domain,
    kind: KINDS[checkpoint.query_type],
    attack_type: checkpoint.attack_type ?? null,
    turns: reach.turns.length,
    readable_turns: readable.length,
    denied_writes: reach.denied_writes,
    targets: targets.length,
    located: count(targets, reach.turns),
    reachable: count(targets, readable),
    reachable_own: count(targets, own),
    reachable_granted: count(targets, granted),
    scored_patterns: scored.length,
    scored_located: count(scored, reach.turns),
    scored_reachable: count(scored, readable),
    scored_reachable_own: count(scored, own),
    scored_reachable_granted: count(scored, granted),
    extra_patterns: scored.filter((p) => !targets.includes(p)).length,
    context_leak:
      (checkpoint.query_type === "privacy"
        ? score.privacy_context_leak
        : score.deletion_context_leak) === true,
    refusal_leaks: refusalLeaks(checkpoint, refusals).length,
    hits,
    patterns: scored.map((pattern) => ({
      pattern,
      set: targets.includes(pattern) ? "target" : "extra",
    })),
  };
}

/** Every access and forgetting checkpoint of one domain, sorted by checkpoint id. */
export async function reachRows(
  domain: gatemem.Domain,
  policy: Policy,
  refusals: readonly string[],
): Promise<ReachRow[]> {
  const rows: ReachRow[] = [];
  for (const checkpoint of domain.checkpoints) {
    if (checkpoint.query_type === "utility") continue;
    const episode = domain.episodes.find((e) => e.episode_id === checkpoint.episode_id);
    if (!episode)
      throw new Error(`no episode ${checkpoint.episode_id} for ${checkpoint.checkpoint_id}`);
    const reach = await reachOf(episode, checkpoint, policy);
    rows.push(scoreReach(domain.domain, checkpoint, reach, refusals));
  }
  return rows.sort((a, b) => (a.checkpoint_id < b.checkpoint_id ? -1 : 1));
}
