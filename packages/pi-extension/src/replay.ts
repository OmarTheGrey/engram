// Session custom entries and replay (card PX2, ADR 0001 decision 4). A pi
// session the Engram extension ran in holds two kinds of custom entry:
//
// - `engram.policy`, once, before the first call: the policy the plane
//   decides under, in full, since its id alone does not pin its rules;
// - `engram.call`, one per Plane call the extension made, before its events:
//   the actor in full, the call as a workload step (core's WorkloadStep,
//   the item written, the query read, the scope swept, the bypass blocked),
//   and the id and version of the policy;
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
  /** The policy the plane decided under, `<id>` and its version. */
  policy: { id: string; version: number };
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
 * `engram.policy` entry, validated; refused when there is none, when there
 * are several, or when a call names another id or version.
 */
export function sessionPolicy(entries: readonly SessionLine[]): Policy {
  const recorded = custom(entries, ENGRAM_POLICY);
  if (recorded.length !== 1)
    throw new Error(`the session holds ${recorded.length} engram.policy entries; expected one`);
  const policy = PolicyShape.parse(recorded[0]);
  for (const [i, c] of sessionCalls(entries).entries())
    if (c.policy.id !== policy.id || c.policy.version !== policy.version)
      throw new Error(
        `engram.call ${i} was decided under ${c.policy.id} v${c.policy.version}, not the session's ${policy.id} v${policy.version}`,
      );
  return policy;
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
}

/**
 * Replays the session's calls through the plane under `policy` (the
 * session's own when not given, from its `engram.policy` entry) and compares
 * every event's decision with the one the session recorded: op, item, actor,
 * scopes, decision, reason, rule and the item it carried, apart from event
 * ids and the store the item was written to. No model is called.
 */
export async function replaySession(
  entries: readonly SessionLine[],
  policy: Policy = sessionPolicy(entries),
): Promise<SessionReplay> {
  const workload = sessionWorkload(entries);
  const { run, events } = await replayWorkload(workload, policy);
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
  return { workload, run, events, recorded, differences };
}
