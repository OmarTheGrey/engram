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
  /** Removes the item; deleting an unknown or already deleted ref is not an error. */
  delete(ref: StoreRef): Promise<void>;
  /** Every item stored in exactly this scope. */
  list(scope: string): Promise<MemoryItem[]>;
  /** Items matching `query`, never outside `scopeFilter`. */
  search?(query: string, scopeFilter: readonly string[]): Promise<MemoryItem[]>;
  /** Every version written under `ref`, oldest first. */
  history?(ref: StoreRef): Promise<MemoryItem[]>;
}

export class ForeignRefError extends Error {
  constructor(adapter: string, ref: StoreRef) {
    super(`adapter ${adapter} cannot resolve a ref from adapter ${ref.adapter}`);
  }
}
