// Session custom entries and replay (card PX2, ADR 0001 decision 4). A pi
// session the Engram extension ran in holds two kinds of custom entry:
//
// - `engram.policy`, before the first call of each runtime pi starts on the
//   session (a resume or a fork records it again): the policy the plane
//   decides under, in full, since its id alone does not pin its rules;
// - `engram.call`, one per Plane call the extension made, before its events:
//   the actor in full, the call as a workload step (core's WorkloadStep,
//   the item written, the query read, the scope swept, the bypass blocked),
//   and the id, version and content hash of the policy;
// - `engram.event`, every MemoryEvent that call appended, as the Engram log
//   holds it.
//
// The events and the Engram log reconstruct each other: the session's events
// are the log's, and appended to an empty log they rebuild its item state.
// The calls are the policy simulator's input: replayed through the plane
// (core's replayWorkload) on a scratch log and store, with no model and no
// pi runtime, they make the session's decisions again. Custom entries are
// never sent to a model.
//
// Nothing here decides anything (AGENTS.md rule 1): it reads entries and
// hands them to core.
import { createHash } from "node:crypto";
import {
  type Actor,
  appendEvent,
  type Db,
  type MemoryEvent,
  type Policy,
  type PolicyRun,
  Policy as PolicyShape,
  replayWorkload,
  type Workload,
  type WorkloadStep,
} from "@engram/core";

export const ENGRAM_CALL = "engram.call";
export const ENGRAM_POLICY = "engram.policy";
/** The custom entry each MemoryEvent is mirrored as (ADR 0001 decision 4). */
export const ENGRAM_EVENT = "engram.event";

/** What an `engram.call` entry records. */
export interface CallEntry {
  /** The actor the call was made as; `step.as` names it in the workload. */
  actor: Actor;
  step: WorkloadStep;
  /**
   * The policy the plane decided under: its id, its version and the hash of
   * its content (policyHash), since an id and version do not pin the rules.
   */
  policy: { id: string; version: number; hash: string };
}

/** JSON with object keys sorted, so two equal values print alike whatever their key order. */
function canonical(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
          )
        : v;
  return JSON.stringify(sort(value));
}

/** The hash of a policy's content, whatever its key order: `sha256:<hex>`. */
export function policyHash(policy: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(policy)).digest("hex")}`;
}

/** The part of a session entry replay reads; pi's own entries carry more. */
export interface SessionLine {
  type: string;
  customType?: string;
  data?: unknown;
}

/** The entries of a session JSONL (version 3), the header included. */
export function parseSession(jsonl: string): SessionLine[] {
  return jsonl
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l, i) => {
      try {
        return JSON.parse(l) as SessionLine;
      } catch (e) {
        throw new Error(`session line ${i + 1} is not JSON: ${(e as Error).message}`);
      }
    });
}

const custom = (entries: readonly SessionLine[], type: string) =>
  entries.flatMap((e) => (e.type === "custom" && e.customType === type ? [e.data] : []));

/** The session's `engram.event` entries: its MemoryEvents, in order. */
export function sessionEvents(entries: readonly SessionLine[]): MemoryEvent[] {
  return custom(entries, ENGRAM_EVENT) as MemoryEvent[];
}

/** The session's `engram.call` entries, in order. */
export function sessionCalls(entries: readonly SessionLine[]): CallEntry[] {
  return custom(entries, ENGRAM_CALL) as CallEntry[];
}

/**
 * The session's calls as a workload: each step as recorded, and each actor
 * name bound to the actor it was recorded with. A name bound to two
 * different actors is refused, since the replay could not say which made the
 * call.
 */
export function sessionWorkload(entries: readonly SessionLine[], id = "session"): Workload {
  const actors: Record<string, Actor> = {};
  const steps: WorkloadStep[] = [];
  for (const [i, { actor, step }] of sessionCalls(entries).entries()) {
    const known = actors[step.as];
    if (known !== undefined && JSON.stringify(known) !== JSON.stringify(actor))
      throw new Error(`engram.call ${i}: actor name ${step.as} is bound to two different actors`);
    actors[step.as] = actor;
    steps.push(step);
  }
  return { id, actors, steps };
}

/**
 * The policy the session's calls were decided under, from its
 * `engram.policy` entries, validated. Each runtime pi starts on the session
 * (a resume, a fork) records the policy again, so the entries may repeat;
 * each call names the content hash of its policy, so an entry edited after
 * the calls were made, or a call made under a policy the session does not
 * hold, is refused, and so is a session whose calls name two policies, since
 * a replay decides under one.
 */
export function sessionPolicy(entries: readonly SessionLine[]): Policy {
  const recorded = new Map(custom(entries, ENGRAM_POLICY).map((p) => [policyHash(p), p]));
  if (recorded.size === 0) throw new Error("the session holds no engram.policy entry");
  const used = new Set<string>();
  for (const [i, c] of sessionCalls(entries).entries()) {
    const p = recorded.get(c.policy.hash) as Policy | undefined;
    if (p === undefined || p.id !== c.policy.id || p.version !== c.policy.version)
      throw new Error(
        `engram.call ${i} was decided under ${c.policy.id} v${c.policy.version} ${c.policy.hash}, which no engram.policy entry of the session holds`,
      );
    used.add(c.policy.hash);
  }
  const hashes = used.size > 0 ? [...used] : [...recorded.keys()];
  if (hashes.length > 1)
    throw new Error(
      `the session's calls were decided under ${hashes.length} policies; a replay decides under one`,
    );
  return PolicyShape.parse(recorded.get(hashes[0] as string));
}

/**
 * Appends the session's events to `db`, an empty migrated log, keeping each
 * event's id and refusing one whose seq the log would not give it: the log
 * the session mirrors, rebuilt from the session alone.
 */
export function logFromSession(db: Db, entries: readonly SessionLine[]): MemoryEvent[] {
  return sessionEvents(entries).map((event) => {
    const { seq, ...input } = event;
    const appended = appendEvent(db, input);
    if (appended.seq !== seq)
      throw new Error(`event ${event.id}: the session gives seq ${seq}, the log ${appended.seq}`);
    return appended;
  });
}

/** An event as a decision: the fields a replay must reproduce. */
export function decisionOf(e: MemoryEvent) {
  const { id: _id, seq: _seq, item, ...rest } = e;
  if (!item) return rest;
  const { store_ref: _ref, ...kept } = item;
  return { ...rest, item: kept };
}

export interface SessionReplay {
  workload: Workload;
  run: PolicyRun;
  /** The events the replay appended, on its scratch log. */
  events: MemoryEvent[];
  /** The events the session recorded. */
  recorded: MemoryEvent[];
  /** Where the replay's decisions differ from the recorded ones, one line each; empty when they agree. */
  differences: string[];
  /**
   * Null when the replay ran under the session's own policy; otherwise which
   * policy it ran under instead, saying so when that one carries the
   * session's id and version with other rules (an id does not pin its rules).
   */
  policyDifference: string | null;
}

/**
 * Replays the session's calls through the plane under `policy` (the
 * session's own when not given, from its `engram.policy` entries) and
 * compares every event's decision with the one the session recorded: op,
 * item, actor, scopes, decision, reason, rule and the item it carried, apart
 * from event ids and the store the item was written to. No model is called.
 */
export async function replaySession(
  entries: readonly SessionLine[],
  policy?: Policy,
): Promise<SessionReplay> {
  const own = sessionPolicy(entries);
  const used = policy ?? own;
  const name = (p: Policy) => `${p.id} v${p.version}`;
  const policyDifference =
    policyHash(used) === policyHash(own)
      ? null
      : used.id === own.id && used.version === own.version
        ? `replayed under ${name(used)} with other rules than the session's ${name(own)}`
        : `replayed under ${name(used)}, not the session's ${name(own)}`;
  const workload = sessionWorkload(entries);
  const { run, events } = await replayWorkload(workload, used);
  const recorded = sessionEvents(entries);
  const differences: string[] = [];
  const n = Math.max(events.length, recorded.length);
  for (let i = 0; i < n; i++) {
    const a = recorded[i];
    const b = events[i];
    if (a === undefined || b === undefined) {
      differences.push(
        `event ${i}: ${a === undefined ? "the replay appended one the session did not record" : "the session recorded one the replay did not append"}`,
      );
      continue;
    }
    const want = canonical(decisionOf(a));
    const got = canonical(decisionOf(b));
    if (want !== got) differences.push(`event ${i} (${a.op}): recorded ${want}, replayed ${got}`);
  }
  return { workload, run, events, recorded, differences, policyDifference };
}
