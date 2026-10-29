// The Plane interface (docs/architecture.md, "Interfaces"). Every read and
// write to a store crosses it (AGENTS.md rule 2). It is asynchronous because
// adapters are. Every method is declared (card E0.3).
//
// `createPlane` is the real plane: the write gate (card E2.3, plane/write.ts),
// the read filter and explanations (card E2.2, plane/read.ts), both deciding
// through the pure evaluator in policy/evaluate.ts, retention (card E2.4,
// plane/retention.ts) through policy/retention.ts, and promotion (card E2.5,
// plane/promote.ts) through policy/promotion.ts. Methods whose cards have
// not landed reject with NotImplementedYet, naming the card that implements them.
import type { Actor } from "./actor.ts";
import type { Adapter } from "./adapter.ts";
import type { Db } from "./db/db.ts";
import type { DistillMethod, Session } from "./distill.ts";
import { allEvents } from "./events.ts";

export { ADOPT_RETRACT_ID, type AdoptReport, adoptStoreItems } from "./plane/adopt.ts";

import { recordBypass } from "./plane/bypass.ts";
import { promote } from "./plane/promote.ts";
import { filteredRead, storedExplanations } from "./plane/read.ts";
import { retain } from "./plane/retention.ts";
import { checkWrite, gatedWrite } from "./plane/write.ts";
import type { Explanation, LintFinding, MemoryEvent, MemoryItem, Policy } from "./schema.ts";
import type { SimReport, Workload } from "./simulate.ts";

export {
  type Actor,
  ActorShape,
  ExplainDeniedError,
  InvalidCallError,
  UnknownReadError,
} from "./actor.ts";
export {
  BYPASS_ID,
  BYPASS_PATH_ID,
  BYPASS_RESULT_ID,
  bypassAttempt,
  MAX_ATTEMPT_LENGTH,
} from "./plane/bypass.ts";
export { inWriteQueue, NestedWriteQueueError } from "./plane/queue.ts";
export { enforceBudget, retentionUsage } from "./plane/retention.ts";
export { retiredContent } from "./plane/write.ts";

export interface ReadQuery {
  text?: string;
  /** The time validity windows and grant expiry are evaluated at; injected, never read from a clock. */
  at: string;
}

export interface WriteResult {
  /** The item as stored, with its store_ref, or null when the write was denied. */
  item: MemoryItem | null;
  event: MemoryEvent;
  /**
   * The events the budget check appended after this write, in its queue
   * slot (ADR 0025): an `evict` per item evicted, or one `evict` with
   * decision `ask` for a manual rule's overage. Empty when the write was
   * denied or nothing was over budget.
   */
  retention: MemoryEvent[];
}

/** What a retention sweep of one scope did (Plane.retain, ADR 0025). */
export interface RetentionReport {
  /** `deny` when the actor is not a member of the scope; nothing was evaluated. */
  decision: "allow" | "deny";
  /** Every event the sweep appended, in log order; empty when there was nothing to do. */
  events: MemoryEvent[];
  /** Items retired because their ttl ran out (op retire). */
  expired: string[];
  /** Items evicted over a budget (op evict, decision allow). */
  evicted: string[];
}

/**
 * What a read returns. `items`, `explanations` and `filtered` reveal nothing
 * about items the reader cannot reach (decision D5) and may be shown to the
 * model. `event` is the audit record: its reason also counts the items out of
 * the reader's reach, so a harness keeps it from the model.
 */
export interface ReadResult {
  items: MemoryItem[];
  explanations: Explanation[];
  /**
   * How many reachable candidates the filter removed: in a readable scope or
   * reached through a grant naming the reader, but not active, past its ttl
   * (ADR 0025), outside the validity window, or with no grant whose class
   * and expiry admit it.
   */
  filtered: number;
  event: MemoryEvent;
}

/** The decision a write would get, without committing it (decision D12). */
export interface WriteCheckResult {
  decision: MemoryEvent["decision"];
  reason: string;
  policy_id: string;
}

/**
 * Something a surface refused because it would reach a store without the
 * Plane (ADR 0014, decisions D10 and D11), and the store it would reach.
 */
export interface Bypass {
  /**
   * What was attempted: the shell command, the file tool and its path, or the
   * memory tool result. The event's reason keeps it, cut and with secrets removed.
   */
  command: string;
  store: string;
  /**
   * `command` (default): a store's CLI in a shell command. `path`: a file tool
   * on a path inside a store's root. `result`: a memory tool result the
   * Engram extension did not produce, withheld from the model.
   */
  route?: "command" | "path" | "result";
}

/** The id of the `read` event a ReadResult carries; explain looks the read up by it. */
export type ReadId = string;

/** The outcome of a gated transition such as a promotion. */
export interface GateResult {
  decision: MemoryEvent["decision"];
  /** The item as it stands after the transition; null when it was denied or awaits review. */
  item: MemoryItem | null;
  /**
   * The decision's event: `promote` (allow or deny), or `gate` with decision
   * `ask` when the target requires review and no reviewer approved.
   */
  event: MemoryEvent;
  /**
   * Every event the call appended, in log order, `event` first: for a new
   * version also the source's `retire` (`<policy>/promotion/superseded`) and
   * any `evict` the target's budget check made (ADR 0025).
   */
  events: MemoryEvent[];
}

/** How a promotion is asked for (ADR 0026). */
export interface PromoteOptions {
  /**
   * The actor approves as a reviewer: it must be user-sourced, a member of
   * the target scope and not the item's owner, else `engram/promote/reviewer`.
   */
  review?: boolean;
}

export interface Plane {
  write(actor: Actor, item: MemoryItem, at: string): Promise<WriteResult>;
  /**
   * The decision `write` would give now, computed the same way, with no store
   * write and no event (decision D12). A harness that decides before it
   * commits (pi's tool_call before the tool's execute) checks here and
   * commits with `write`, whose decision is the one recorded.
   */
  checkWrite(actor: Actor, item: MemoryItem, at: string): Promise<WriteCheckResult>;
  read(actor: Actor, query: ReadQuery): Promise<ReadResult>;
  /**
   * Promotes an item (ADR 0026): episodic to semantic after k confirmations
   * counted from the log or a review, a procedural candidate to active with a
   * validation record, a candidate to active or an item to a wider scope
   * through a review; always judged as a write into `toScope`. A status-only
   * change is in place; a class or scope change is a new version whose source
   * is retired. Decision `ask`, with a null item and one `gate` event, when
   * the target requires review and the actor is not reviewing. Runs in the
   * write queue. An invalid actor, time, item id or scope is refused with
   * InvalidCallError before the log is touched.
   */
  promote(
    actor: Actor,
    itemId: string,
    toScope: string,
    at: string,
    options?: PromoteOptions,
  ): Promise<GateResult>;
  /**
   * Sweeps one scope (ADR 0025): retires items past their ttl, then evicts
   * any budget overage in the rule's order, each one event; items stay in
   * the store. The actor must be a member of the scope, else one deny event
   * (`engram/retention/membership`). Runs in the write queue, so it never
   * interleaves with a write. Surfaces call it; nothing runs on a timer.
   */
  retain(actor: Actor, scope: string, at: string): Promise<RetentionReport>;
  /** Runs the enabled lints over one scope; every finding is also a `lint` event. */
  lint(scope: string): Promise<LintFinding[]>;
  /** Replays a recorded workload under a candidate policy; zero model calls, no store I/O. */
  simulate(workload: Workload, policy: Policy): Promise<SimReport>;
  /** Candidate procedural items induced from sessions. */
  distill(sessions: Session[], method: DistillMethod): Promise<MemoryItem[]>;
  /**
   * Records a bypass a surface blocked (ADR 0014) as one `bypass_blocked`
   * deny event whose reason keeps the attempt; nothing reaches the store.
   * Refuses an invalid actor, time or bypass with InvalidCallError.
   */
  recordBypass(actor: Actor, bypass: Bypass, at: string): Promise<MemoryEvent>;
  /**
   * The explanations recorded for a read, for the actor who made it only;
   * another actor is refused with ExplainDeniedError (decision D5).
   */
  explain(actor: Actor, readId: ReadId): Promise<Explanation[]>;
  /** The event log, in sequence order. */
  events(): MemoryEvent[];
}

/** A Plane method not implemented yet; `card` is the card that implements it. */
export class NotImplementedYet extends Error {
  readonly method: string;
  readonly card: string;
  constructor(method: string, card: string) {
    super(`Plane.${method} is not implemented yet; card ${card} implements it`);
    this.name = "NotImplementedYet";
    this.method = method;
    this.card = card;
  }
}

export interface PlaneDeps {
  /** The plane's own log and projection, migrated. */
  db: Db;
  /** The one store this plane governs. */
  adapter: Adapter;
  /** The policy every decision is evaluated against. */
  policy: Policy;
  /** UUIDv7 generator for event ids, injected so core stays free of clocks and randomness. */
  newId: () => string;
}

export function createPlane(deps: PlaneDeps): Plane {
  return {
    write: (actor, item, at) => gatedWrite(deps, actor, item, at),
    checkWrite: async (actor, item, at) => checkWrite(deps, actor, item, at),
    read: (actor, query) => filteredRead(deps, actor, query),
    explain: async (actor, readId) => storedExplanations(deps, actor, readId),
    recordBypass: async (actor, bypass, at) => recordBypass(deps, actor, bypass, at),
    retain: async (actor, scope, at) => retain(deps, actor, scope, at),
    promote: async (actor, itemId, toScope, at, options) =>
      promote(deps, actor, itemId, toScope, at, options),
    lint: async () => {
      throw new NotImplementedYet("lint", "L1");
    },
    simulate: async () => {
      throw new NotImplementedYet("simulate", "E8.9");
    },
    distill: async () => {
      throw new NotImplementedYet("distill", "D2");
    },
    events: () => allEvents(deps.db),
  };
}
