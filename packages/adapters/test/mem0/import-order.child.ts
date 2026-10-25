// Run by mem0.test.ts in a fresh Node process (review finding R4-7): Mem0 reads
// MEM0_TELEMETRY once, when `mem0ai/oss` is first evaluated, so this script
// unsets the variable, loads `mem0ai/oss` and @engram/adapters in the order
// its first argument names ("mem0-first" or "adapters-first"), and then
// drives the adapter. It prints the network calls Mem0 attempted and whether
// Mem0's home folder (MEM0_DIR, a temp folder set by the parent) was created.
import { existsSync } from "node:fs";
import type { MemoryItem } from "@engram/core";

delete process.env.MEM0_TELEMETRY;
const calls: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => {
  calls.push(String(input instanceof Request ? input.url : input));
  throw new Error("import-order child: network access refused");
}) as typeof fetch;

const order = process.argv[2];
if (order === "mem0-first") await import("mem0ai/oss");
const { createMem0Adapter, createHashingEmbedder } = await import("../../src/index.ts");
if (order !== "mem0-first") await import("mem0ai/oss");

const adapter = await createMem0Adapter({ embedder: createHashingEmbedder(), dbPath: ":memory:" });
const item: MemoryItem = {
  id: "01920000-0000-7000-8000-0000000000c1",
  class: "semantic",
  scope: "team:platform",
  owner: "person:omar",
  content: "The staging cluster restarts at noon.",
  provenance: {
    kind: "user",
    ref: "doc/c1",
    hash: `sha256:${"cd".repeat(32)}`,
    actor: "person:omar",
  },
  confidence: 0.8,
  valid_from: "2026-10-25T09:00:00Z",
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: null,
  schema_version: 0,
};
const ref = await adapter.write(item);
await adapter.search?.("staging cluster", [item.scope]);
await adapter.list(item.scope);
await adapter.read(ref);
await adapter.delete(ref);
// Mem0 sends telemetry without awaiting it; give those promises a turn to run.
await new Promise((resolve) => setTimeout(resolve, 100));
process.stdout.write(
  JSON.stringify({ calls, mem0DirCreated: existsSync(process.env.MEM0_DIR ?? "") }),
);
