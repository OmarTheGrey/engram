// The stores a runner config may name (card B3), each built fresh and empty
// per session, offline. Mem0 runs in process exactly as the adapters'
// conformance registry builds it (packages/adapters/test/conformance/registry.ts):
// its own SQLite vector store in memory, `infer: false`, the hashing fake as
// its embedding model, a model slot that refuses every call, telemetry off.
// Letta (card A2, ADR 0028) is a MemFS repository the adapter initialises in
// a fresh temporary folder; git runs locally, never a network command. The
// folders are removed when the process exits.
import { mkdtempSync, rmSync } from "node:fs";
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

const lettaRoots: string[] = [];
process.on("exit", () => {
  for (const root of lettaRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A fresh, empty store of the named kind, reaching no network. */
export async function openStore(name: StoreName): Promise<Adapter> {
  switch (name) {
    case "fake":
      return createFakeAdapter();
    case "mem0":
      return createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });
    case "letta": {
      const root = mkdtempSync(join(tmpdir(), "engram-runner-letta-"));
      lettaRoots.push(root);
      return createLettaAdapter({ root });
    }
  }
}
