// The stores a runner config may name (card B3), each built fresh and empty
// per session, offline. Mem0 runs in process exactly as the adapters'
// conformance registry builds it (packages/adapters/test/conformance/registry.ts):
// its own SQLite vector store in memory, `infer: false`, the hashing fake as
// its embedding model, a model slot that refuses every call, telemetry off.
// Letta (card A2, ADR 0028) is a MemFS repository the adapter initialises in
// a fresh temporary folder; git runs locally, never a network command. The
// caller closes every store it opened (`closeStore`), which removes that
// folder; a process exit hook would not run in a test worker.
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Adapter,
  createFakeAdapter,
  createHashingEmbedder,
  createLettaAdapter,
  createMem0Adapter,
} from "@engram/adapters";

/** Store names a config may use; nothing else in the runner names a store. */
export const STORES = ["fake", "mem0", "letta"] as const;
export type StoreName = (typeof STORES)[number];

/** The temporary repository of each open Letta store. */
const lettaRoots = new WeakMap<Adapter, string>();

/** The prefix of the temporary folder of every Letta store the runner opens. */
export const LETTA_STORE_PREFIX = "engram-runner-letta-";

/** A fresh, empty store of the named kind, reaching no network. */
export async function openStore(name: StoreName): Promise<Adapter> {
  switch (name) {
    case "fake":
      return createFakeAdapter();
    case "mem0":
      return createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });
    case "letta": {
      const root = mkdtempSync(join(tmpdir(), LETTA_STORE_PREFIX));
      try {
        const adapter = await createLettaAdapter({ root });
        lettaRoots.set(adapter, root);
        return adapter;
      } catch (e) {
        await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
        throw e;
      }
    }
  }
}

/** Releases what `openStore` made for this store: a Letta store's temporary repository. */
export async function closeStore(adapter: Adapter): Promise<void> {
  const root = lettaRoots.get(adapter);
  if (root === undefined) return;
  lettaRoots.delete(adapter);
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
}
