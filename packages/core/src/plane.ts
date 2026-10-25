// The Plane interface (docs/architecture.md, "Interfaces"). Every read and
// write to a store crosses it (AGENTS.md rule 2). It is asynchronous because
// adapters are. Every method is declared (card E0.3).
//
// `createPlane` is the real plane: the write gate (card E2.3, plane/write.ts),
// the read filter and explanations (card E2.2, plane/read.ts), both deciding
// through the pure evaluator in policy/evaluate.ts. Methods whose cards have
// not landed reject with NotImplementedYet, naming the card that implements them.
import type { Adapter } from "./adapter.ts";
import type { Db } from "./db/db.ts";
import type { DistillMethod, Session } from "./distill.ts";
import { allEvents } from "./events.ts";
import { filteredRead, storedExplanations } from "./plane/read.ts";
import { gatedWrite } from "./plane/write.ts";
import type {
  Explanation,
  LintFinding,
  MemoryEvent,
  MemoryItem,
  Policy,
  ScopeLevel,
} from "./schema.ts";
import type { SimReport, Workload } from "./simulate.ts";

/** Who is asking, and in which capacity. */
export interface Actor {
  id: string;
  /** The level the actor reads as: the calling context. */
  level: ScopeLevel;
  /** Scopes the actor belongs to, such as `person:omar` or `team:platform`. */
  memberships: string[];
}

export interface ReadQuery {
  text?: string;
  /** The time validity windows and grant expiry are evaluated at; injected, never read from a clock. */
  at: string;
}

export interface WriteResult {
  /** The item as stored, with its store_ref, or null when the write was denied. */
  item: MemoryItem | null;
  event: MemoryEvent;
}

export interface ReadResult {
  items: MemoryItem[];
  explanations: Explanation[];
  /** How many candidate items the filter removed. */
  filtered: number;
  event: MemoryEvent;
}

/** The id of the `read` event a ReadResult carries; explain looks the read up by it. */
export type ReadId = string;

/** The outcome of a gated transition such as a promotion. */
export interface GateResult {
  decision: MemoryEvent["decision"];
  /** The item as it stands after the transition; null when it was denied or awaits review. */
  item: MemoryItem | null;
  event: MemoryEvent;
}

export interface Plane {
  write(actor: Actor, item: MemoryItem, at: string): Promise<WriteResult>;
  read(actor: Actor, query: ReadQuery): Promise<ReadResult>;
  /** Moves an item to a wider scope (or a candidate to active) if the promotion policy allows. */
  promote(actor: Actor, itemId: string, toScope: string, at: string): Promise<GateResult>;
  /** Runs the enabled lints over one scope; every finding is also a `lint` event. */
  lint(scope: string): Promise<LintFinding[]>;
  /** Replays a recorded workload under a candidate policy; zero model calls, no store I/O. */
  simulate(workload: Workload, policy: Policy): Promise<SimReport>;
  /** Candidate procedural items induced from sessions. */
  distill(sessions: Session[], method: DistillMethod): Promise<MemoryItem[]>;
  /** The explanations recorded for a read. */
  explain(readId: ReadId): Promise<Explanation[]>;
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
    read: (actor, query) => filteredRead(deps, actor, query),
    explain: async (readId) => storedExplanations(deps, readId),
    promote: async () => {
      throw new NotImplementedYet("promote", "E2.5");
    },
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
