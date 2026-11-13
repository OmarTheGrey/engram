// Run by race.test.ts in its own Node process (review finding R2-1): opens
// the Letta adapter on the repository named by the first argument and writes
// eight items, ids from the second argument on, one after another. Prints
// which writes resolved and which were refused, as JSON.
import type { MemoryItem } from "@engram/core";
import { createLettaAdapter } from "../../src/letta/index.ts";

const [root, first] = process.argv.slice(2) as [string, string];
const adapter = await createLettaAdapter({ root, lockWaitMs: 30_000 });
const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const resolved: string[] = [];
const refused: string[] = [];
for (let n = Number(first); n < Number(first) + 8; n++) {
  const item = {
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `Fact number ${n}.`,
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"ab".repeat(32)}`,
      actor: "person:omar",
    },
    confidence: 0.9,
    valid_from: "2026-10-22T09:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
  try {
    await adapter.write(item);
    resolved.push(item.id);
  } catch {
    refused.push(item.id);
  }
}
process.stdout.write(JSON.stringify({ resolved, refused }));
