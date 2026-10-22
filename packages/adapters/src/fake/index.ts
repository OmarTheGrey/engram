// A complete in-memory adapter (testing convention, "Fakes, not mocks"). Every
// test above layer 1 that needs a store uses it unless it is about a real
// store. It passes the whole conformance suite.
import type { MemoryItem } from "@engram/core";
import { type Adapter, ForeignRefError, type StoreRef } from "../contract.ts";

export interface FakeAdapterOptions {
  name?: string;
  /** Offer search (term match over content). Default true. */
  search?: boolean;
  /** Offer history (every version per key). Default true. */
  history?: boolean;
}

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

export function createFakeAdapter(options: FakeAdapterOptions = {}): Adapter {
  const name = options.name ?? "fake";
  const withSearch = options.search ?? true;
  const withHistory = options.history ?? true;
  const live = new Map<string, MemoryItem>();
  const versions = new Map<string, MemoryItem[]>();

  const keyOf = (ref: StoreRef) => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    return ref.key;
  };

  const adapter: Adapter = {
    name,
    capabilities: {
      native_validity: false,
      native_history: withHistory,
      native_search: withSearch,
      native_graph: false,
    },
    async write(item) {
      const ref: StoreRef = { adapter: name, key: item.id };
      const stored = structuredClone({ ...item, store_ref: ref }) as MemoryItem;
      live.set(ref.key, stored);
      const past = versions.get(ref.key) ?? [];
      const last = past.at(-1);
      if (!last || JSON.stringify(last) !== JSON.stringify(stored)) past.push(stored);
      versions.set(ref.key, past);
      return ref;
    },
    async read(ref) {
      const item = live.get(keyOf(ref));
      return item ? structuredClone(item) : undefined;
    },
    async delete(ref) {
      live.delete(keyOf(ref));
    },
    async list(scope) {
      return [...live.values()].filter((i) => i.scope === scope).map((i) => structuredClone(i));
    },
  };

  if (withSearch) {
    adapter.search = async (query, scopeFilter) => {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      return [...live.values()]
        .filter((i) => scopeFilter.includes(i.scope))
        .filter((i) => terms.every((t) => contentText(i).includes(t)))
        .map((i) => structuredClone(i));
    };
  }
  if (withHistory) {
    adapter.history = async (ref) => structuredClone(versions.get(keyOf(ref)) ?? []);
  }
  return adapter;
}
