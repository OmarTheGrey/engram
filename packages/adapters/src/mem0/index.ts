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
// - Writes and deletes run one at a time per adapter, so two concurrent
//   writes of one item id cannot both miss the lookup and add two memories.
//
// The embedding model is injected (AGENTS.md rule 4). Mem0 builds its model
// slot from the config at construction; the adapter then replaces that model
// with one whose every method rejects with Engram's own error, so a code path
// that would infer fails loudly instead of reaching a provider (Mem0's own
// LangChain wrapper would fail first on a missing `@langchain/core` import,
// with an error that does not say why).
//
// Telemetry (AGENTS.md rule 12: nothing leaves the machine) is off twice:
// ./telemetry-off.ts sets MEM0_TELEMETRY=false before `mem0ai/oss` loads when
// @engram/adapters is imported first, and `silence` replaces each instance's
// telemetry and notice methods with no-ops, which holds whatever the import
// order. Neither path writes Mem0's home folder (MEM0_DIR or ~/.mem0).
//
// A file vector store (`dbPath` ending in `.db`) gets a sibling file
// `<name>_entities.db`: Mem0 links the entities it finds in each memory text
// into a second collection, kept beside the first.
//
// History is not offered: Mem0's history table records memory text only, not
// the metadata that carries the MemoryItem, so it cannot return versions.
import "./telemetry-off.ts";
import type { MemoryItem } from "@engram/core";
import type { MemoryItem as Mem0Record, Memory } from "mem0ai/oss";
import { type Adapter, ForeignRefError, type StoreRef } from "../contract.ts";
import type { Embedder } from "../embedder.ts";

export interface Mem0AdapterOptions {
  /** The embedding model Mem0 indexes and searches with. */
  embedder: Embedder;
  /**
   * Mem0's local vector store: ":memory:", or a file path ending in `.db`.
   * A file store also writes `<name>_entities.db` beside it. Default ":memory:".
   */
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
export const REFUSAL = "mem0 adapter: Engram never asks Mem0 to call a model (infer: false)";
export const PLACEHOLDER_REACHED =
  "mem0 adapter: Mem0 reached the placeholder model of its config; the refusing model slot is missing";

type Mem0Module = typeof import("mem0ai/oss");
let mem0Module: Promise<Mem0Module> | undefined;

/** Loads `mem0ai/oss` once; ./telemetry-off.ts has already run. */
const loadMem0 = (): Promise<Mem0Module> => {
  mem0Module ??= import("mem0ai/oss");
  return mem0Module;
};

/** Mem0 instance methods that send telemetry, fetch notices or write Mem0's home folder. */
const TELEMETRY_METHODS =
  /^_(?:initializeTelemetry|captureEvent|get(?:Notice)?TelemetryId|display\w*Notice)$/;
const REQUIRED_TELEMETRY_METHODS = ["_initializeTelemetry", "_captureEvent", "_getTelemetryId"];

/**
 * Replaces every telemetry and notice method of one Mem0 instance with a
 * no-op. It runs right after construction, before Mem0's own asynchronous
 * initialisation reaches its telemetry step. It fails loudly if a Mem0
 * upgrade renames the methods, rather than letting telemetry back on.
 */
function silence(memory: Memory): void {
  const names = new Set<string>();
  for (let proto = Object.getPrototypeOf(memory); proto && proto !== Object.prototype; ) {
    for (const n of Object.getOwnPropertyNames(proto)) if (TELEMETRY_METHODS.test(n)) names.add(n);
    proto = Object.getPrototypeOf(proto);
  }
  const missing = REQUIRED_TELEMETRY_METHODS.filter((n) => !names.has(n));
  if (missing.length > 0) {
    throw new Error(`mem0 adapter: Mem0 no longer has ${missing.join(", ")}; check its telemetry`);
  }
  const target = memory as unknown as Record<string, unknown>;
  for (const n of names) {
    target[n] = n.endsWith("TelemetryId") ? async () => "engram" : async () => undefined;
  }
  memory.telemetryId = "engram";
}

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

/**
 * The Mem0 instance the adapter runs on, configured as described above.
 * Exported for the adapter's own tests; the plane only sees the adapter.
 */
export async function createMem0Memory(options: Mem0AdapterOptions): Promise<Memory> {
  const dbPath = options.dbPath ?? ":memory:";
  if (dbPath !== ":memory:" && !dbPath.endsWith(".db")) {
    // Mem0 names the entity store by replacing a trailing `.db`; any other
    // name would put both collections in one file.
    throw new Error(
      `mem0 adapter: dbPath must be ":memory:" or a file ending in .db, got ${JSON.stringify(dbPath)}`,
    );
  }
  const { Memory: Mem0Memory } = await loadMem0();
  const { embedder } = options;
  const memory: Memory = new Mem0Memory({
    version: "v1.1",
    // Mem0's "langchain" embedder takes any object with the LangChain method
    // names; that is how the injected embedder reaches Mem0.
    embedder: {
      provider: "langchain",
      config: {
        model: {
          embedQuery: (text: string) => embedder.embed(text),
          embedDocuments: (texts: string[]) => embedder.embedBatch(texts),
        },
      },
    },
    // Mem0 requires an LLM config; this placeholder is replaced below. Its
    // error differs from REFUSAL, so a test can tell the two apart.
    llm: {
      provider: "langchain",
      config: { model: { invoke: () => Promise.reject(new Error(PLACEHOLDER_REACHED)) } },
    },
    vectorStore: {
      provider: "memory",
      config: {
        collectionName: options.collectionName ?? "engram",
        dimension: embedder.dimension,
        dbPath,
      },
    },
    disableHistory: true,
  });
  silence(memory);
  const refuse = () => Promise.reject(new Error(REFUSAL));
  (memory as unknown as { llm: unknown }).llm = { generateResponse: refuse, generateChat: refuse };
  return memory;
}

export async function createMem0Adapter(options: Mem0AdapterOptions): Promise<Adapter> {
  const memory = await createMem0Memory(options);
  const name = options.name ?? "mem0";
  const namespace = options.namespace ?? "engram";

  // Writes and deletes run one at a time: a write looks the item id up, then
  // adds or updates, and two interleaved writes would both add.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

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

    write(item) {
      return serial(async () => {
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
      });
    },

    async read(ref) {
      const record = await memory.get(keyOf(ref));
      return ours(record) ? toItem(record, ref) : undefined;
    },

    async delete(ref) {
      const key = keyOf(ref);
      return serial(async () => {
        const record = await memory.get(key);
        if (ours(record)) await memory.delete(record.id);
      });
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
