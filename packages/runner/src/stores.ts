// The stores a runner config may name (card B3), each built fresh and empty
// per session, offline. Mem0 runs in process exactly as the adapters'
// conformance registry builds it (packages/adapters/test/conformance/registry.ts):
// its own SQLite vector store in memory, `infer: false`, the hashing fake as
// its embedding model, a model slot that refuses every call, telemetry off.
import {
  type Adapter,
  createFakeAdapter,
  createHashingEmbedder,
  createMem0Adapter,
} from "@engram/adapters";

/**
 * Store names a config may use. LETTA: when the Letta adapter (PR 2 of the
 * Gate B plan, card A2) is on main, add "letta" here and its factory in
 * `openStore` below; nothing else in the runner names a store.
 */
export const STORES = ["fake", "mem0"] as const;
export type StoreName = (typeof STORES)[number];

/** A fresh, empty store of the named kind, reaching no network. */
export async function openStore(name: StoreName): Promise<Adapter> {
  switch (name) {
    case "fake":
      return createFakeAdapter();
    case "mem0":
      return createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });
    // LETTA: case "letta": a Letta adapter over a fresh temporary MemFS repository.
  }
}
