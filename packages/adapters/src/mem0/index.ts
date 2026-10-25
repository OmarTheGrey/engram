// The Mem0 adapter (card A1, ADR 0013) on open-source Mem0 (`mem0ai/oss`),
// running in-process on Mem0's own local vector store (SQLite, in memory or a
// file). The plane owns the metadata and Mem0 owns the bytes:
//
// - Each MemoryItem is one Mem0 memory, added with `infer: false`, so Mem0
//   stores the text the plane gave it verbatim and never asks a model to
//   extract, merge or delete facts. The memory text is the item's content
//   (procedural and JSON content rendered as JSON) and is what Mem0 embeds.
// - The whole MemoryItem rides in Mem0 metadata (`engram_item`), with
//   `engram_id` and `engram_scope` beside it for Mem0's metadata filters.
//   `list(scope)` and `search(query, scopes)` filter on `engram_scope`.
// - Every memory is filed under one Mem0 `user_id` (the namespace), because
//   Mem0 requires an entity id and the plane's scopes are not Mem0 users.
// - The store_ref key is Mem0's own memory id.
//
// The embedding model is injected (AGENTS.md rule 4). Mem0's LLM slot gets a
// model that refuses every call, so a code path that would infer fails loudly
// instead of reaching a provider. Mem0's telemetry is switched off before the
// package loads (AGENTS.md rule 12: nothing leaves the machine).
//
// History is not offered: Mem0's history table records memory text only, not
// the metadata that carries the MemoryItem, so it cannot return versions.
import type { MemoryItem } from "@engram/core";
import type { MemoryItem as Mem0Record, Memory } from "mem0ai/oss";
import { type Adapter, ForeignRefError, type StoreRef } from "../contract.ts";
import type { Embedder } from "../embedder.ts";

export interface Mem0AdapterOptions {
  /** The embedding model Mem0 indexes and searches with. */
  embedder: Embedder;
  /** Mem0's local vector store file, or ":memory:". Default ":memory:". */
  dbPath?: string;
  /** Adapter name, matched by every ref it returns. Default "mem0". */
  name?: string;
  /** Mem0 `user_id` every memory is filed under. Default "engram". */
  namespace?: string;
  /** Mem0 collection name. Default "engram". */
  collectionName?: string;
  /** Most items a search returns. Default 20, Mem0's own default. */
  searchTopK?: number;
  /** Lowest semantic similarity a search keeps, 0 to 1. Default 0.1, Mem0's own default. */
  searchThreshold?: number;
}

/** Large enough that `list` returns every item in a scope. */
const LIST_LIMIT = Number.MAX_SAFE_INTEGER;

type Mem0Module = typeof import("mem0ai/oss");
let mem0Module: Promise<Mem0Module> | undefined;

/** Loads `mem0ai/oss` once, with telemetry off: Mem0 reads MEM0_TELEMETRY when the module loads. */
const loadMem0 = (): Promise<Mem0Module> => {
  if (!mem0Module) {
    process.env.MEM0_TELEMETRY = "false";
    mem0Module = import("mem0ai/oss");
  }
  return mem0Module;
};

const memoryText = (item: MemoryItem): string => {
  const text = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
  // Mem0 refuses blank text; the item itself still rides verbatim in metadata.
  return text.trim() === "" ? item.id : text;
};

const toItem = (record: Mem0Record, ref: StoreRef): MemoryItem | undefined => {
  const raw = record.metadata?.engram_item;
  if (typeof raw !== "string") return undefined;
  return { ...(JSON.parse(raw) as MemoryItem), store_ref: ref };
};

export async function createMem0Adapter(options: Mem0AdapterOptions): Promise<Adapter> {
  const { Memory: Mem0Memory } = await loadMem0();
  const name = options.name ?? "mem0";
  const namespace = options.namespace ?? "engram";
  const { embedder } = options;

  const memory: Memory = new Mem0Memory({
    version: "v1.1",
    // Mem0's "langchain" providers take any object with the LangChain method
    // names; that is how an embedder and a refusing model are injected.
    embedder: {
      provider: "langchain",
      config: {
        model: {
          embedQuery: (text: string) => embedder.embed(text),
          embedDocuments: (texts: string[]) => embedder.embedBatch(texts),
        },
      },
    },
    llm: {
      provider: "langchain",
      config: {
        model: {
          invoke: () => {
            throw new Error("mem0 adapter: Engram never asks Mem0 to call a model (infer: false)");
          },
        },
      },
    },
    vectorStore: {
      provider: "memory",
      config: {
        collectionName: options.collectionName ?? "engram",
        dimension: embedder.dimension,
        dbPath: options.dbPath ?? ":memory:",
      },
    },
    disableHistory: true,
  });
  // A telemetry id set before initialisation stops Mem0 writing a random user
  // id to ~/.mem0/config.json; with telemetry off it is never sent anywhere.
  memory.telemetryId = "engram";

  const keyOf = (ref: StoreRef) => {
    if (ref.adapter !== name) throw new ForeignRefError(name, ref);
    return ref.key;
  };
  const refOf = (record: Mem0Record): StoreRef => ({ adapter: name, key: record.id });
  const ours = (record: Mem0Record | null): record is Mem0Record =>
    record !== null && (record as Mem0Record & { user_id?: string }).user_id === namespace;

  const findById = async (id: string): Promise<Mem0Record | undefined> => {
    const { results } = await memory.getAll({
      filters: { user_id: namespace, engram_id: id },
      topK: 1,
    });
    return results[0];
  };

  const metadataOf = (item: MemoryItem) => ({
    engram_id: item.id,
    engram_scope: item.scope,
    engram_item: JSON.stringify({ ...item, store_ref: null }),
  });

  return {
    name,
    capabilities: {
      native_validity: false,
      native_history: false,
      native_search: true,
      native_graph: false,
    },

    async write(item) {
      const metadata = metadataOf(item);
      const existing = await findById(item.id);
      if (existing) {
        // Same item id: replace under the same Mem0 id; identical content is a no-op.
        if (existing.metadata?.engram_item !== metadata.engram_item) {
          await memory.update(existing.id, { text: memoryText(item), metadata });
        }
        return refOf(existing);
      }
      const { results } = await memory.add(memoryText(item), {
        userId: namespace,
        metadata,
        infer: false,
      });
      const added = results[0];
      if (!added || results.length !== 1) {
        throw new Error(`mem0 adapter: expected one memory from add, got ${results.length}`);
      }
      return refOf(added);
    },

    async read(ref) {
      const record = await memory.get(keyOf(ref));
      return ours(record) ? toItem(record, ref) : undefined;
    },

    async delete(ref) {
      const record = await memory.get(keyOf(ref));
      if (ours(record)) await memory.delete(record.id);
    },

    async list(scope) {
      const { results } = await memory.getAll({
        filters: { user_id: namespace, engram_scope: scope },
        topK: LIST_LIMIT,
      });
      return results.flatMap((r) => toItem(r, refOf(r)) ?? []).filter((i) => i.scope === scope);
    },

    async search(query, scopeFilter) {
      // An empty filter admits nothing; it never means "every scope".
      if (scopeFilter.length === 0) return [];
      const { results } = await memory.search(query, {
        filters: { user_id: namespace, engram_scope: { in: [...scopeFilter] } },
        topK: options.searchTopK ?? 20,
        threshold: options.searchThreshold ?? 0.1,
      });
      return results
        .flatMap((r) => toItem(r, refOf(r)) ?? [])
        .filter((i) => scopeFilter.includes(i.scope));
    },
  };
}
