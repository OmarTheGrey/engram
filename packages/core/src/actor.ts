// Who calls the plane (docs/architecture.md, "Interfaces"), and the errors a
// call the plane cannot record is refused with. Not a contract in schema.ts:
// an actor is supplied by the harness on every call and is never stored apart
// from its id, which every event carries.
import { z } from "zod";
import { Principal, ProvenanceKind, ScopeLevel } from "./schema.ts";

/** Who is asking, and in which capacity. */
export interface Actor {
  id: string;
  /** The level the actor reads as: the calling context. */
  level: ScopeLevel;
  /** Scopes the actor belongs to, such as `person:omar` or `team:platform`. */
  memberships: string[];
  /**
   * The provenance kind of what this actor writes, set by the harness, never
   * by the model or the caller's item (ADR 0004, decision D4): the pi
   * extension sets `model` for agent tool calls, the CLI `user` for
   * `engram write`, adoption `import`. When present, the plane overwrites
   * `item.provenance.kind` with it and `item.provenance.actor` with `id`.
   */
  source?: z.infer<typeof ProvenanceKind>;
}

/**
 * The shape every call's actor must have; checked before the store or the log
 * is touched. Extra fields a harness carries are allowed and ignored.
 */
export const ActorShape = z.object({
  id: Principal,
  level: ScopeLevel,
  memberships: z.array(z.string().min(1)),
  source: ProvenanceKind.optional(),
});

/**
 * A call whose actor or time is invalid. The plane refuses it before any
 * store or log access: no event could record it faithfully, since every event
 * needs a valid actor id and timestamp (decision D6).
 */
export class InvalidCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCallError";
  }
}

/** `explain` called by an actor other than the one who made the read (decision D5). */
export class ExplainDeniedError extends Error {
  readonly readId: string;
  constructor(readId: string) {
    super(`explain: read ${readId} was made by another actor; only its reader may explain it`);
    this.name = "ExplainDeniedError";
    this.readId = readId;
  }
}
