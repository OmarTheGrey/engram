// A test double that truthfully claims `native_validity` (card A5), so the
// conformance suite has a store that claims the capability beside the
// stores that do not. It wraps the fake adapter, which is not changed: the
// runner and committed results use it (packages/adapters/src/fake/index.ts).
//
// What it does natively, in Zep's vocabulary (arXiv 2501.13956, taken as an
// idea): the store keeps each record's world-time window, `valid_from` and
// `valid_to` (Zep's t_valid and t_invalid), in its own index beside the
// bytes, and serves read, list and search from that index. Invalidating a
// record closes its window and keeps the record; the store never hides a
// record for being outside its window, because the plane judges validity at
// the reader's time (ADR 0031, ADR 0035). History returns each version with
// the window it was written with. It has no graph: the Adapter contract has
// no method to show one (ADR 0013, amendment of card A5).
import type { MemoryItem } from "@engram/core";
import type { Adapter, StoreRef } from "../../src/contract.ts";
import { createFakeAdapter } from "../../src/fake/index.ts";

interface Window {
  valid_from: string;
  valid_to: string | null;
}

export function createValidityAdapter(options: { name?: string } = {}): Adapter {
  const inner = createFakeAdapter({ name: options.name ?? "fake-validity" });
  /** The store's own validity index, by record key. */
  const windows = new Map<string, Window>();
  const withWindow = (item: MemoryItem): MemoryItem => {
    const window = item.store_ref ? windows.get(item.store_ref.key) : undefined;
    return window ? ({ ...item, ...window } as MemoryItem) : item;
  };
  const search = inner.search?.bind(inner);
  const history = inner.history?.bind(inner);
  const adapter: Adapter = {
    name: inner.name,
    capabilities: { ...inner.capabilities, native_validity: true },
    async write(item) {
      const ref = await inner.write(item);
      windows.set(ref.key, { valid_from: item.valid_from, valid_to: item.valid_to });
      return ref;
    },
    async read(ref: StoreRef) {
      const item = await inner.read(ref);
      return item && withWindow(item);
    },
    async delete(ref) {
      await inner.delete(ref);
      windows.delete(ref.key);
    },
    async list(scope) {
      return (await inner.list(scope)).map(withWindow);
    },
  };
  if (search)
    adapter.search = async (query, scopes) => (await search(query, scopes)).map(withWindow);
  if (history) adapter.history = (ref) => history(ref);
  return adapter;
}
