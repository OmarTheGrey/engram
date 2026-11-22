// Who a served HTTP surface authenticated, recorded beside each event it
// appends (card E8.12, ADR 0042 decision 8). The event schema does not
// change (AGENTS.md rule 5): the fact goes to the side table
// `event_attestations` (migration 6, packages/core/src/db/migrate.ts), one row
// per event, keyed by the event's seq.
//
// How. A served surface runs each request inside `attested(attestation, fn)`,
// an AsyncLocalStorage context, so concurrent requests each keep their own.
// The workspace's log handle is wrapped by `attestingDb`: when core's append
// runs its one INSERT INTO events (packages/core/src/events.ts), the wrapper
// inserts the row for the current attestation in the same statement call,
// inside the append's own transaction. An event and its row commit together
// or not at all. Outside any context (the in-process client, ADR 0027
// decision 3, and every library caller) the wrapper passes through and no
// row is written. The invariant test (packages/server/test/attestation.test.ts)
// holds every served event to having its row, so a change to core's INSERT
// that this wrapper stops seeing fails it.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Db, Param, Row, Statement } from "@engram/core";

/** The served surface a request came through. */
export type Surface = "http" | "mcp_http";

/** How the requester was authenticated, or `insecure_loopback` for the waiver (ADR 0042 decision 5). */
export type AuthMethod = "jwt" | "api_key" | "insecure_loopback";

/** What a served surface knows of the requester; one row per event appended for it. */
export interface Attestation {
  surface: Surface;
  method: AuthMethod;
  /** The requester's actor id: the credential's actor, or under the waiver the id the body asserted. */
  actor: string;
  /** The token's issuer; null for an API key and under the waiver. */
  issuer: string | null;
  /** The token's subject, or the API key's id; null under the waiver. */
  subject: string | null;
}

/** One row of the side table. */
export interface AttestationRow extends Attestation {
  seq: number;
  event_id: string;
}

const current = new AsyncLocalStorage<Attestation>();

/** Runs `fn` with `attestation` recorded for every event it appends through an attesting log. */
export function attested<T>(attestation: Attestation, fn: () => T): T {
  return current.run(attestation, fn);
}

/** The attestation of the request being served, if any. */
export const currentAttestation = (): Attestation | undefined => current.getStore();

/** The start of core's one event append (packages/core/src/events.ts). */
const EVENT_INSERT = "INSERT INTO events (seq, id,";
const RECORD =
  "INSERT INTO event_attestations (seq, event_id, surface, method, actor, issuer, subject) VALUES (?, ?, ?, ?, ?, ?, ?)";

const ATTESTING = Symbol("attesting");
const wrappers = new WeakMap<Db, Db>();

/**
 * The log handle a workspace serves through: every call passes to `db`, and
 * the event append also records the current attestation, when there is one.
 * Wrapping is idempotent and one wrapper is kept per handle, so the write
 * queue (keyed by handle, packages/core/src/plane/queue.ts) is the same for
 * every caller of the workspace.
 */
export function attestingDb(db: Db): Db {
  if ((db as { [ATTESTING]?: true })[ATTESTING]) return db;
  const known = wrappers.get(db);
  if (known !== undefined) return known;
  const wrapper: Db & { [ATTESTING]: true } = {
    [ATTESTING]: true,
    get dialect() {
      return db.dialect;
    },
    exec: (sql) => db.exec(sql),
    prepare(sql: string): Statement {
      const statement = db.prepare(sql);
      if (!sql.trimStart().startsWith(EVENT_INSERT)) return statement;
      return {
        run(...params: Param[]) {
          const result = statement.run(...params);
          const a = current.getStore();
          if (a !== undefined)
            db.prepare(RECORD).run(
              params[0] ?? null,
              params[1] ?? null,
              a.surface,
              a.method,
              a.actor,
              a.issuer,
              a.subject,
            );
          return result;
        },
        get: (...params: Param[]): Row | undefined => statement.get(...params),
        all: (...params: Param[]): Row[] => statement.all(...params),
      };
    },
    transaction: (fn) => db.transaction(fn),
    close: () => db.close(),
  };
  wrappers.set(db, wrapper);
  return wrapper;
}

/** Every row of the side table, in seq order. */
export function attestations(db: Db): AttestationRow[] {
  return db
    .prepare(
      "SELECT seq, event_id, surface, method, actor, issuer, subject FROM event_attestations ORDER BY seq",
    )
    .all()
    .map((r) => ({
      seq: Number(r.seq),
      event_id: String(r.event_id),
      surface: String(r.surface) as Surface,
      method: String(r.method) as AuthMethod,
      actor: String(r.actor),
      issuer: r.issuer === null || r.issuer === undefined ? null : String(r.issuer),
      subject: r.subject === null || r.subject === undefined ? null : String(r.subject),
    }));
}
