// The Plane interface (docs/architecture.md, "Interfaces"). Every read and
// write to a store crosses it (AGENTS.md rule 2). It is asynchronous because
// adapters are. Every method is declared (card E0.3).
//
// `createPlane` is the real plane: the write gate (card E2.3, plane/write.ts),
// the read filter and explanations (card E2.2, plane/read.ts), both deciding
// through the pure evaluator in policy/evaluate.ts, retention (card E2.4,
// plane/retention.ts) through policy/retention.ts, and promotion (card E2.5,
// plane/promote.ts) through policy/promotion.ts, the deterministic lints
// (card L1, plane/lint.ts) through lint/det.ts, and the simulator (card
// E8.9, plane/simulate.ts) over all of them, and grant changes (card E9.4,
// plane/grants.ts) through policy/grants.ts. Methods whose cards have
// not landed reject with NotImplementedYet, naming the card that implements them.
import type { Actor } from "./actor.ts";
import type { Adapter } from "./adapter.ts";
import type { Db } from "./db/db.ts";
import type { ReplayEvidence } from "./distill/validate.ts";
import type { DistillMethod, Session } from "./distill.ts";
import { allEvents } from "./events.ts";
import type { ModelLintSetup } from "./lint/model.ts";

export {
  ADOPT_ERASED_ID,
  ADOPT_REKEYED_ID,
  ADOPT_RETRACT_ID,
  type AdoptReport,
  adoptStoreItems,
} from "./plane/adopt.ts";

import { recordBypass } from "./plane/bypass.ts";
import { changeGrants } from "./plane/grants.ts";
import { type LintReport, lint } from "./plane/lint.ts";
import { promote } from "./plane/promote.ts";
import { filteredRead, storedExplanations } from "./plane/read.ts";

export { accessTime } from "./plane/read.ts";

import { retain } from "./plane/retention.ts";
import { simulate } from "./plane/simulate.ts";
import { checkWrite, gatedWrite } from "./plane/write.ts";
import type { GrantChange } from "./policy/grants.ts";
import type { Explanation, MemoryEvent, MemoryItem, Policy } from "./schema.ts";
import type { SimReport, Workload } from "./simulate.ts";

export {
  type Actor,
  ActorShape,
  ExplainDeniedError,
  InvalidCallError,
  UnknownReadError,
} from "./actor.ts";
export {
  type BeforeRead,
  type BeforeReadReport,
  type ReadStore,
  syncBeforeRead,
} from "./plane/before-read.ts";
export {
  BYPASS_ID,
  BYPASS_PATH_ID,
  BYPASS_RESULT_ID,
  bypassAttempt,
  MAX_ATTEMPT_LENGTH,
} from "./plane/bypass.ts";
export {
  ADOPT_NARROWED_ID,
  ADOPT_WITHDRAWN_ID,
  type Basis,
  basisNow,
  ERASING_ID,
  erasureBegunSince,
  erasureOpen,
  lastErasure,
  logHead,
  staleness,
  touchedSince,
} from "./plane/commit.ts";
export { LINT_MEMBERSHIP_ID, type LintReport, planModelLints } from "./plane/lint.ts";
export {
  type DeletionReport,
  HANDOVER_CONFLICT_ID,
  HANDOVER_ID,
  NOT_HANDED_OVER_ID,
  OFFBOARD_BEGIN_ID,
  OFFBOARD_MEMBERSHIP_ID,
  OFFBOARD_REPORT_ID,
  OFFBOARD_SWEPT_ID,
  type OffboardRequest,
  offboard,
  REDACTED,
} from "./plane/offboard.ts";
export { PROMOTE_CONFLICT_ID } from "./plane/promote.ts";
export { inWriteQueue, NestedWriteQueueError } from "./plane/queue.ts";
export {
  formatReadReason,
  parseReadReason,
  ReadCounts,
  readCounts,
  readValidAt,
} from "./plane/read-reason.ts";
export { enforceBudget, retentionUsage } from "./plane/retention.ts";
export { checkWorkload, replayWorkload, runWorkload, SIMULATION_STORE } from "./plane/simulate.ts";
export { retiredContent, WRITE_CONFLICT_ID, WRITE_ERASED_ID } from "./plane/write.ts";

export interface ReadQuery {
  text?: string;
  /**
   * The read's time: its event's `ts`, and the time status, ttl, grant expiry
   * and scoring are judged at; injected, never read from a clock. A surface
   * passes its own clock here (card RV5, finding RV-SRF-2).
   */
  at: string;
  /**
   * The time validity windows are judged at, when the reader asks what was
   * true at another time; `at` when absent. It changes nothing else: what
   * grants and ttls have closed at `at` stays closed. Recorded in the read
   * event's reason (readValidAt), since the event has no field for it.
   */
  valid_at?: string;
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

/** The outcome of a grant change (card E9.4, ADR 0034). */
export interface GrantResult {
  decision: "allow" | "deny";
  /**
   * The item as it stands after the change, its new version; null when the
   * change was denied, or when the read matrix does not let the owner's
   * level read the item's scope.
   */
  item: MemoryItem | null;
  /** The decision's one `update` event. */
  event: MemoryEvent;
}

/** How a promotion is asked for (ADR 0026). */
export interface PromoteOptions {
  /**
   * The actor approves as a reviewer: it must be user-sourced, a member of
   * the target scope and not the item's owner, else `engram/promote/reviewer`.
   */
  review?: boolean;
  /**
   * A procedural candidate's replay on held-out tasks (card D3, ADR 0045
   * proposed): the outcomes the plane derives the validation record from
   * (distill/validate.ts), never a record the caller states. Only a
   * user-sourced actor may present one (`engram/promote/validation-source`);
   * it names the item's id and content hash, and its induction tasks are
   * checked against the item's distill ref through `distillTasks`; one not
   * the item's is a deny event (`engram/promote/replay-item`,
   * `engram/promote/replay-split`), and a malformed one is refused with
   * InvalidCallError before the log is touched.
   */
  replay?: ReplayEvidence;
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
   * write queue. An invalid actor, time, item id, scope or replay is refused
   * with InvalidCallError before the log is touched.
   */
  promote(
    actor: Actor,
    itemId: string,
    toScope: string,
    at: string,
    options?: PromoteOptions,
  ): Promise<GateResult>;
  /**
   * Adds or removes grants on one item (card E9.4, ADR 0034). Only the
   * item's owner, user-sourced and a member of its scope, may; every added
   * grant must pass the write gate's grant rule (a principal or a prefixed
   * pattern, a class, an expiry; none on model or compaction content) and
   * not have expired. Every decision is one `update` event; an allowed
   * change is a new version in place (same id, version plus one) rewritten
   * to the store. Runs in the write queue. An invalid actor, time, item id or
   * change (malformed grants, or nothing to add or remove) is refused with
   * InvalidCallError before the log is touched.
   */
  changeGrants(actor: Actor, itemId: string, change: GrantChange, at: string): Promise<GrantResult>;
  /**
   * Sweeps one scope (ADR 0025): retires items past their ttl, then evicts
   * any budget overage in the rule's order, each one event; items stay in
   * the store. The actor must be a member of the scope, else one deny event
   * (`engram/retention/membership`). Runs in the write queue, so it never
   * interleaves with a write. Surfaces call it; nothing runs on a timer.
   */
  retain(actor: Actor, scope: string, at: string): Promise<RetentionReport>;
  /**
   * Runs the deterministic lints the policy enables over one scope at `at`
   * (card L1, ADR 0008), then, when the plane has a lint model, the
   * model-based ones it enables (card L3); every finding is also one `lint`
   * event, which changes no item, and a model finding's event carries the
   * call's usage. The report's `judgments` list every unit the model lints
   * sent, refusals and malformed replies included. The actor must be able to read the scope (a member
   * whose level the read matrix lets read it), else one deny event
   * (`engram/lint/membership`); an item outside the scope that a finding
   * would name counts as absent unless the actor could read it at `at`,
   * and even then its finding shows no current hash, status or retiring rule
   * of it, since every member of the scope sees the event (ADR 0009).
   * Runs in the write queue. An invalid actor, time or scope is refused with
   * InvalidCallError before the log is touched.
   */
  lint(actor: Actor, at: string, scope: string): Promise<LintReport>;
  /**
   * Replays a recorded workload under this plane's policy and under a
   * candidate one (card E8.9), each on a scratch log and store: decisions,
   * the utility proxy and evictions per policy, and the steps that differ.
   * Never reads or writes this plane's log or store, and calls no model. An
   * invalid workload is refused with InvalidCallError.
   */
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

/**
 * A Plane method not implemented yet; `card` is the card that implements it,
 * or `backlog` when no card does yet and docs/tasks/backlog.md holds the work.
 */
export class NotImplementedYet extends Error {
  readonly method: string;
  readonly card: string;
  constructor(method: string, card: string) {
    super(
      card === "backlog"
        ? `Plane.${method} is not implemented yet; no card implements it yet (docs/tasks/backlog.md)`
        : `Plane.${method} is not implemented yet; card ${card} implements it`,
    );
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
  /**
   * How `read` finds and orders what it returns. Unset: the store's search in
   * the reader's member scopes and the plane's match for granted items (ADR
   * 0009 as accepted). `{ pipeline: "core" }`: the core retrieval pipeline
   * (plane/retrieve.ts) over the reachable projection, after the read
   * filter, cut to `limit` when given; the store is never searched (ADR
   * 0009, proposed amendment of 2026-11-02).
   */
  retrieval?: { pipeline: "core"; limit?: number };
  /**
   * The model-based lints' model (card L3): the injected ModelCall (AGENTS.md
   * rule 4), the `provider/model-id` it names and the config's seed. Unset,
   * Plane.lint runs the deterministic lints only, whatever the policy enables.
   */
  lintModel?: ModelLintSetup;
  /**
   * Session id to task id (card D1's session index), so Plane.promote can
   * name the tasks a candidate's distill ref (`distill:<method>:<sessions>`,
   * card D2) was induced from and check a replay's split against them (card
   * D3 review, D3-3). Unset, a replay of a candidate with a distill ref is
   * refused (`engram/promote/replay-split`).
   */
  distillTasks?: ReadonlyMap<string, string>;
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
    lint: async (actor, at, scope) => lint(deps, actor, at, scope),
    changeGrants: async (actor, itemId, change, at) =>
      changeGrants(deps, actor, itemId, change, at),
    simulate: (workload, policy) => simulate(deps, workload, policy),
    distill: async () => {
      // Card D2 built the induction as a Distiller (distill/induce.ts); this
      // method has no actor, time or model to run it with, so wiring it is
      // backlog work ("Plane.distill and the /distill route").
      throw new NotImplementedYet("distill", "backlog");
    },
    events: () => allEvents(deps.db),
  };
}
