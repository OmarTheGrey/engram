// What a surface does before a read (card RV5, finding RV-SRF-1): the
// retention sweeps and the adoption of the store's own memories, decided in
// one place for the HTTP server (and so the CLI and the MCP server, which
// call its read route) and the pi extension.
//
// Before RV5 the server's read route swept the store's scope as the store's
// owner at the request's `at`, whoever was reading: any reader could retire
// the owner's items by naming a future time, which `POST /retain` refuses
// them, and an honest reader with a clock running ahead retired them for
// good (nothing reinstates a retirement yet, ADR 0025 decision 6). Here:
//
// - The sweeps run at `now`, the surface's own clock. A surface never passes
//   a time its caller supplied; a request's `at` is at most a read's
//   `valid_at` (ADR 0027, amendment proposed by card RV5).
// - The store's scope is swept as its owner only when the reader is the
//   owner. Anyone else's read sweeps nothing: budgets are kept by the write
//   path in any case (ADR 0025 decision 3), and a read excludes an expired
//   item whoever sweeps (decision 2), so nothing leaks.
// - `sweep` names scopes the reader sweeps as itself (the pi session's
//   scopes). Plane.retain decides those as it always does: by ttl only in the
//   reader's own person scope or for a user-sourced reader (mayRetireByTtl).
// - The store's own memories are adopted as its owner before every read,
//   whoever reads (decision D8): adoption decides by the write gate, not by a
//   time, and without it no reader sees a memory written into the store
//   outside the plane. Adoption is core's adoptStoreItems, unchanged.
// - What goes back to the reader: the whole report to the store's owner;
//   anyone else gets only the sweeps it made as itself, since the store's
//   report names the owner's item ids, reasons and a content hash (review
//   finding R3-3).
//
// The reader is self-asserted until authentication exists (ADR 0027 decision
// 5): a caller claiming the owner's id is treated as the owner. Every sweep is
// a Plane.retain call, so every retirement it makes is an event with its
// reason and rule (AGENTS.md rule 3).
import type { Actor } from "../actor.ts";
import type { Plane, PlaneDeps, RetentionReport } from "../plane.ts";
import { type AdoptReport, adoptStoreItems } from "./adopt.ts";

/** The store a read adopts from, and the owner its memories belong to. */
export interface ReadStore {
  /** The deps of the plane over the store, for adoption. */
  deps: PlaneDeps;
  /** The scope the store's own memories live in (`person:<owner>`). */
  scope: string;
  /** The store's owner, as adoption acts (source `import` is set by adoption). */
  owner: Actor;
}

export interface BeforeRead {
  /** Who is about to read. */
  reader: Actor;
  /** The surface's own clock; never a time the caller supplied. */
  now: string;
  /** The store whose own memories are adopted before the read. */
  store?: ReadStore;
  /** Scopes the reader sweeps as itself, in order. */
  sweep?: readonly string[];
  /** Called before each sweep, with who sweeps which scope (pi records the call first). */
  onSweep?: (actor: Actor, scope: string) => void;
}

export interface BeforeReadReport {
  /** Each sweep made, in order: who swept which scope, and its report. */
  sweeps: { actor: string; scope: string; report: RetentionReport }[];
  /** The store's adoption, or null when there was no store or the reader is not shown it. */
  adoption: AdoptReport | null;
}

/**
 * Sweeps and adopts before a read (see the module comment). Returns the
 * whole report and the part the reader may see.
 */
export async function syncBeforeRead(
  plane: Pick<Plane, "retain">,
  request: BeforeRead,
): Promise<{ report: BeforeReadReport; forReader: BeforeReadReport }> {
  const { reader, now, store } = request;
  const sweeps: BeforeReadReport["sweeps"] = [];
  const own: BeforeReadReport["sweeps"] = [];
  const sweepAs = async (actor: Actor, scope: string) => {
    request.onSweep?.(actor, scope);
    const done = { actor: actor.id, scope, report: await plane.retain(actor, scope, now) };
    sweeps.push(done);
    return done;
  };
  const isOwner = store !== undefined && reader.id === store.owner.id;
  // Retention first (ADR 0025), then adoption (decision D8).
  if (store !== undefined && isOwner) await sweepAs(store.owner, store.scope);
  for (const scope of request.sweep ?? []) own.push(await sweepAs(reader, scope));
  const adoption =
    store === undefined ? null : await adoptStoreItems(store.deps, store.owner, store.scope, now);
  const report = { sweeps, adoption };
  return { report, forReader: isOwner ? report : { sweeps: own, adoption: null } };
}
