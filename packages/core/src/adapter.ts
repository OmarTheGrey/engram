// The Adapter contract (ADR 0013, docs/architecture.md "Interfaces"). The
// plane owns the metadata; the store owns the bytes. Only the plane calls an
// adapter (AGENTS.md rule 2), and a store's special needs stay behind this
// contract rather than branching in packages/core. It lives in core because
// the Plane calls it; packages/adapters implements it and re-exports it.
import type { MemoryItem } from "./schema.ts";

/** Where an item's bytes live. Opaque to the plane: it stores and returns refs, never builds them. */
export interface StoreRef {
  adapter: string;
  key: string;
}

/** What the store does natively, so the plane uses it instead of duplicating it. */
export interface Capabilities {
  native_validity: boolean;
  native_history: boolean;
  native_search: boolean;
  native_graph: boolean;
}

export interface Adapter {
  /** Matches `StoreRef.adapter` on every ref this adapter returns. */
  readonly name: string;
  readonly capabilities: Capabilities;
  /** Stores the item; writing the same item id again replaces it under the same ref. */
  write(item: MemoryItem): Promise<StoreRef>;
  /** The stored item with `store_ref` set, or undefined if the key is unknown. Throws on another adapter's ref. */
  read(ref: StoreRef): Promise<MemoryItem | undefined>;
  /**
   * Removes the item; deleting an unknown or already deleted ref is not an
   * error. A store that will never let the plane delete this item (a record
   * it did not write, such as a file the person keeps by hand) throws a
   * NotDeletableError; any other error is taken as transient.
   */
  delete(ref: StoreRef): Promise<void>;
  /** Every item stored in exactly this scope. */
  list(scope: string): Promise<MemoryItem[]>;
  /** Items matching `query`, never outside `scopeFilter`. */
  search?(query: string, scopeFilter: readonly string[]): Promise<MemoryItem[]>;
  /** Every distinct version written under `ref`, oldest first; rewriting identical content adds none. */
  history?(ref: StoreRef): Promise<MemoryItem[]>;
  /**
   * The entries the latest `list` or `search` skipped because the store
   * cannot read them, by key (a file whose frontmatter no longer parses).
   * Adoption names the reason when it retires what the plane held there.
   */
  diagnostics?(): StoreDiagnostic[];
  /**
   * The fields of an item the latest `list` returned that the store derived
   * from its own bookkeeping rather than stored with the item, such as a
   * file's modification time standing in for `valid_from`. Adoption ignores
   * them when it decides whether the store's item changed, so touching a
   * file is not a new version (ADR 0013 amendments, round 2).
   */
  derivedFields?(item: MemoryItem): readonly (keyof MemoryItem)[];
}

/** An entry the store skipped, by key, and why. */
export interface StoreDiagnostic {
  key: string;
  reason: string;
}

/**
 * The store refuses the plane's delete of this record on every attempt, not
 * just now: it holds a record the plane may read but not remove (the files
 * adapter's ReadOnlyItemError, a memory file Engram did not write). Erasure
 * (offboarding) still removes the item from the projection and the log and
 * reports the ref as left in the store for the person to delete; a transient
 * error keeps the item back until a rerun (ADR 0010, review of PR #41).
 */
export class NotDeletableError extends Error {
  /** Marks the refusal as permanent even across module copies, where instanceof fails. */
  readonly notDeletable = true as const;
}

/** Whether `e` is a permanent delete refusal (NotDeletableError). */
export function isNotDeletable(e: unknown): boolean {
  return (
    e instanceof NotDeletableError ||
    (typeof e === "object" && e !== null && (e as { notDeletable?: unknown }).notDeletable === true)
  );
}

export class ForeignRefError extends Error {
  constructor(adapter: string, ref: StoreRef) {
    super(`adapter ${adapter} cannot resolve a ref from adapter ${ref.adapter}`);
  }
}
